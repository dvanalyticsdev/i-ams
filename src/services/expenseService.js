import { apiRequest } from './api';

const EXPENSE_CACHE_KEY = 'iams_expenses';
const LEGACY_KEYS = ['iams_expenses'];

const readExpenseCache = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(EXPENSE_CACHE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const writeExpenseCache = (expenses) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(EXPENSE_CACHE_KEY, JSON.stringify(expenses));
  }
  return expenses;
};

const sortExpensesByDate = (expenses) =>
  [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

const getYearFromExpenseDate = (dateValue) => {
  const parsed = new Date(dateValue || Date.now());
  const year = parsed.getFullYear();
  return Number.isFinite(year) ? year : new Date().getFullYear();
};

const getNextLocalExpenseId = (existingExpenses, dateValue) => {
  const year = getYearFromExpenseDate(dateValue);
  const prefix = `EXP-${year}-`;
  const maxSequence = existingExpenses.reduce((highest, expense) => {
    const expenseId = String(expense.expenseId || '');
    if (!expenseId.startsWith(prefix)) {
      return highest;
    }

    const sequence = Number.parseInt(expenseId.slice(prefix.length), 10);
    if (Number.isNaN(sequence)) {
      return highest;
    }

    return Math.max(highest, sequence);
  }, 0);

  return `EXP-${year}-${String(maxSequence + 1).padStart(4, '0')}`;
};

const withLocalExpenseDefaults = (expense, existingExpenses = []) => {
  const nextExpense = { ...expense };
  if (!nextExpense.date) {
    nextExpense.date = new Date().toISOString().split('T')[0];
  }
  if (!nextExpense.expenseId) {
    nextExpense.expenseId = getNextLocalExpenseId(existingExpenses, nextExpense.date);
  }
  return nextExpense;
};

export const initializeDB = async () => {
  if (typeof window !== 'undefined') {
    for (const key of LEGACY_KEYS) {
      window.localStorage.removeItem(key);
    }
  }

  try {
    const expenses = await apiRequest('/expenses');
    return writeExpenseCache(expenses);
  } catch {
    return readExpenseCache();
  }
};

export const getExpenses = () => readExpenseCache();

export const saveExpense = async (expense) => {
  const isEdit = Boolean(expense.expenseId);
  const currentExpenses = getExpenses();
  try {
    const savedExpense = await apiRequest(
      isEdit ? `/expenses/${encodeURIComponent(expense.expenseId)}` : '/expenses',
      {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(expense),
      }
    );

    const nextExpenses = isEdit
      ? currentExpenses.map((entry) => (entry.expenseId === savedExpense.expenseId ? savedExpense : entry))
      : [savedExpense, ...currentExpenses];

    writeExpenseCache(sortExpensesByDate(nextExpenses));
    return savedExpense;
  } catch {
    const localExpense = withLocalExpenseDefaults(expense, currentExpenses);
    const nextExpenses = isEdit
      ? currentExpenses.map((entry) => (entry.expenseId === localExpense.expenseId ? localExpense : entry))
      : [localExpense, ...currentExpenses];

    writeExpenseCache(sortExpensesByDate(nextExpenses));
    return localExpense;
  }
};

export const saveExpensesBulk = async (expenses, importMeta = null) => {
  const currentExpenses = getExpenses();
  const payload = expenses.map((expense) => ({
    ...expense,
    ...(importMeta || {}),
  }));

  const savedExpenses = await apiRequest('/expenses/bulk', {
    method: 'POST',
    body: JSON.stringify({ expenses: payload }),
  });

  const savedExpenseIds = new Set(savedExpenses.map((expense) => expense.expenseId));
  const nextExpenses = [
    ...savedExpenses,
    ...currentExpenses.filter((expense) => !savedExpenseIds.has(expense.expenseId)),
  ];

  writeExpenseCache(sortExpensesByDate(nextExpenses));
  return nextExpenses;
};

export const deleteExpense = async (expenseId) => {
  try {
    await apiRequest(`/expenses/${encodeURIComponent(expenseId)}`, {
      method: 'DELETE',
    });
  } finally {
    writeExpenseCache(getExpenses().filter((expense) => expense.expenseId !== expenseId));
  }
  return true;
};

export const deleteExpensesByImportBatch = async (importBatchId) => {
  const result = await apiRequest(`/expenses/import-batch/${encodeURIComponent(importBatchId)}`, {
    method: 'DELETE',
  });

  writeExpenseCache(getExpenses().filter((expense) => expense.importBatchId !== importBatchId));
  return result.removedCount || 0;
};

const filterByDateRange = (data, rangeType, customStart = null, customEnd = null) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (rangeType) {
    case 'today':
      break;
    case 'currentWeek': {
      const dayOfWeek = start.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(start.getDate() - diffToMonday);
      break;
    }
    case 'week':
      start.setDate(today.getDate() - 7);
      break;
    case 'currentMonth':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'month':
      start.setMonth(today.getMonth() - 1);
      break;
    case '3months':
      start.setMonth(today.getMonth() - 3);
      break;
    case '6months':
      start.setMonth(today.getMonth() - 6);
      break;
    case 'ytd':
      start = new Date(today.getFullYear(), 0, 1);
      break;
    case 'custom':
      if (customStart) start = new Date(customStart);
      if (customEnd) {
        today.setTime(new Date(customEnd).getTime());
        today.setHours(23, 59, 59, 999);
      }
      break;
    default:
      start.setMonth(today.getMonth() - 1);
  }

  return data.filter((item) => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= today;
  });
};

const buildForecastFromMonthlyTrend = (monthlyTrendData, monthNames) => {
  if (monthlyTrendData.length < 4) {
    return {
      forecastData: monthlyTrendData.map((item) => ({
        ...item,
        actualSpend: item.spend,
        projectedSpend: null,
      })),
      meta: {
        method: 'Insufficient history',
        confidence: 'Low',
        mape: null,
        note: 'Need at least 4 months of history for a stronger forecast.',
      },
    };
  }

  const values = monthlyTrendData.map((item) => item.spend);
  const parameterOptions = [0.2, 0.35, 0.5, 0.65, 0.8];
  let bestModel = null;

  for (const alpha of parameterOptions) {
    for (const beta of parameterOptions) {
      let level = values[0];
      let trend = values[1] - values[0];
      const errors = [];

      for (let index = 1; index < values.length; index += 1) {
        const forecast = level + trend;
        const actual = values[index];
        errors.push(actual - forecast);

        const previousLevel = level;
        level = alpha * actual + (1 - alpha) * (level + trend);
        trend = beta * (level - previousLevel) + (1 - beta) * trend;
      }

      const mse = errors.reduce((sum, error) => sum + error ** 2, 0) / errors.length;
      const rmse = Math.sqrt(mse);
      const mape =
        errors.reduce((sum, error, index) => {
          const actual = values[index + 1];
          if (!actual) {
            return sum;
          }
          return sum + Math.abs(error / actual);
        }, 0) / errors.length;

      if (!bestModel || rmse < bestModel.rmse) {
        bestModel = {
          alpha,
          beta,
          level,
          trend,
          rmse,
          mape,
        };
      }
    }
  }

  const forecastData = monthlyTrendData.map((item) => ({
    ...item,
    actualSpend: item.spend,
    projectedSpend: null,
  }));
  const lastKnownDate = new Date();
  const confidenceMultiplier = 1.28;
  const lastActualPoint = monthlyTrendData[monthlyTrendData.length - 1];

  forecastData[forecastData.length - 1] = {
    ...forecastData[forecastData.length - 1],
    projectedSpend: lastActualPoint.spend,
  };

  for (let step = 1; step <= 4; step += 1) {
    const nextDate = new Date(lastKnownDate);
    nextDate.setMonth(nextDate.getMonth() + step);
    const projectedValue = Math.max(0, bestModel.level + step * bestModel.trend);
    const varianceBand = bestModel.rmse * confidenceMultiplier * Math.sqrt(step);

    forecastData.push({
      month: `${monthNames[nextDate.getMonth()]} ${nextDate.getFullYear().toString().slice(-2)}`,
      spend: Math.round(projectedValue),
      actualSpend: null,
      projectedSpend: Math.round(projectedValue),
      lowerBound: Math.round(Math.max(0, projectedValue - varianceBand)),
      upperBound: Math.round(projectedValue + varianceBand),
      isForecast: true,
    });
  }

  let confidence = 'Low';
  if (bestModel.mape <= 0.1) {
    confidence = 'High';
  } else if (bestModel.mape <= 0.2) {
    confidence = 'Moderate';
  }

  return {
    forecastData,
    meta: {
      method: 'Holt linear trend',
      confidence,
      mape: Number((bestModel.mape * 100).toFixed(1)),
      note: `${confidence} confidence based on recent month-fit error.`,
    },
  };
};

export const getDashboardAnalytics = (rangeType = 'month', customStart = null, customEnd = null) => {
  const allExpenses = getExpenses();
  const filtered = filterByDateRange(allExpenses, rangeType, customStart, customEnd);
  const totalSpend = filtered.reduce((sum, expense) => sum + expense.amount, 0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyExpenses = allExpenses
    .filter((expense) => {
      const date = new Date(expense.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayExpenses = allExpenses
    .filter((expense) => expense.date === todayStr)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const avgExpenseValue = filtered.length ? totalSpend / filtered.length : 0;

  const categorySpend = {};
  filtered.forEach((expense) => {
    categorySpend[expense.category] = (categorySpend[expense.category] || 0) + expense.amount;
  });

  let highestCategory = { name: 'N/A', amount: 0 };
  let lowestCategory = { name: 'N/A', amount: Infinity };

  Object.keys(categorySpend).forEach((category) => {
    if (categorySpend[category] > highestCategory.amount) {
      highestCategory = { name: category, amount: categorySpend[category] };
    }
    if (categorySpend[category] < lowestCategory.amount) {
      lowestCategory = { name: category, amount: categorySpend[category] };
    }
  });

  if (lowestCategory.amount === Infinity) {
    lowestCategory = { name: 'N/A', amount: 0 };
  }

  const totalTransactions = filtered.length;

  const deptSpend = {};
  filtered.forEach((expense) => {
    deptSpend[expense.department] = (deptSpend[expense.department] || 0) + expense.amount;
  });

  let topDept = { name: 'N/A', amount: 0 };
  Object.keys(deptSpend).forEach((department) => {
    if (deptSpend[department] > topDept.amount) {
      topDept = { name: department, amount: deptSpend[department] };
    }
  });

  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = prevMonthDate.getMonth();
  const prevMonthYear = prevMonthDate.getFullYear();

  const prevMonthSpend = allExpenses
    .filter((expense) => {
      const date = new Date(expense.date);
      return date.getMonth() === prevMonth && date.getFullYear() === prevMonthYear;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  let growthRate = 0;
  if (prevMonthSpend > 0) {
    growthRate = ((monthlyExpenses - prevMonthSpend) / prevMonthSpend) * 100;
  }

  const monthlyTrendData = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.getMonth();
    const year = date.getFullYear();
    const label = `${monthNames[month]} ${year.toString().slice(-2)}`;

    const monthSpend = allExpenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === month && expenseDate.getFullYear() === year;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    monthlyTrendData.push({
      month: label,
      spend: Math.round(monthSpend),
    });
  }

  const categoryData = Object.keys(categorySpend)
    .map((category) => ({
      name: category,
      value: Math.round(categorySpend[category]),
    }))
    .sort((a, b) => b.value - a.value);

  const departmentData = Object.keys(deptSpend)
    .map((department) => ({
      department,
      spend: Math.round(deptSpend[department]),
    }))
    .sort((a, b) => b.spend - a.spend);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weeklyDataMap = {};
  dayNames.forEach((day) => {
    weeklyDataMap[day] = 0;
  });

  filtered.forEach((expense) => {
    const dayName = dayNames[new Date(expense.date).getDay()];
    weeklyDataMap[dayName] += expense.amount;
  });

  const weeklyData = dayNames.map((day) => ({
    day: day.slice(0, 3),
    spend: Math.round(weeklyDataMap[day]),
  }));

  const subCategorySpend = {};
  filtered.forEach((expense) => {
    subCategorySpend[expense.subCategory] = (subCategorySpend[expense.subCategory] || 0) + expense.amount;
  });

  const topSubCategories = Object.keys(subCategorySpend)
    .map((subCategory) => ({
      name: subCategory.length > 25 ? `${subCategory.slice(0, 25)}...` : subCategory,
      spend: Math.round(subCategorySpend[subCategory]),
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  const paymentSpend = {};
  filtered.forEach((expense) => {
    paymentSpend[expense.paymentMode] = (paymentSpend[expense.paymentMode] || 0) + expense.amount;
  });

  const paymentModeData = Object.keys(paymentSpend).map((mode) => ({
    name: mode,
    value: Math.round(paymentSpend[mode]),
  }));

  const forecastResult = buildForecastFromMonthlyTrend(monthlyTrendData, monthNames);
  const recentTimeline = filtered.slice(0, 8).map((expense) => ({
    id: expense.expenseId,
    date: expense.date,
    employee: expense.employeeName,
    department: expense.department,
    amount: expense.amount,
    category: expense.category,
    subCategory: expense.subCategory,
    description: expense.description,
  }));

  return {
    kpis: {
      totalSpend: Math.round(totalSpend),
      monthlyExpenses: Math.round(monthlyExpenses),
      todayExpenses: Math.round(todayExpenses),
      avgExpenseValue: Math.round(avgExpenseValue),
      highestCategory: highestCategory.name,
      highestCategoryAmount: Math.round(highestCategory.amount),
      lowestCategory: lowestCategory.name,
      lowestCategoryAmount: Math.round(lowestCategory.amount),
      totalTransactions,
      topDeptName: topDept.name,
      topDeptAmount: Math.round(topDept.amount),
      growthRate: parseFloat(growthRate.toFixed(2)),
    },
    charts: {
      monthlyTrend: monthlyTrendData,
      categoryBreakdown: categoryData,
      departmentSpend: departmentData,
      weeklySpend: weeklyData,
      topSubCategories,
      paymentModeAnalysis: paymentModeData,
      spendingForecast: forecastResult.forecastData,
      spendingForecastMeta: forecastResult.meta,
      recentTimeline,
    },
  };
};

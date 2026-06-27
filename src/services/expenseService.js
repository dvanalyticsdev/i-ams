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

export const getFinancialYears = () => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentFYStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
  
  const list = [];
  for (let i = 0; i < 5; i++) {
    const startYear = currentFYStartYear - i;
    const endYear = startYear + 1;
    const endYearShort = String(endYear).slice(-2);
    list.push({
      value: `fy_${startYear}`,
      label: `FY ${startYear}-${endYearShort}`,
    });
  }
  return list;
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

const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const startOfWeek = (value) => {
  const date = startOfDay(value);
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() - diffToMonday);
  return date;
};

const startOfMonth = (value) => new Date(value.getFullYear(), value.getMonth(), 1);

const getDateRangeBounds = (rangeType, customStart = null, customEnd = null) => {
  const today = endOfDay(new Date());
  let start = startOfDay(new Date());
  let end = new Date(today);

  if (rangeType && rangeType.startsWith('fy_')) {
    const startYear = parseInt(rangeType.split('_')[1], 10);
    start = startOfDay(new Date(startYear, 3, 1));
    end = endOfDay(new Date(startYear + 1, 2, 31));
    return { start, end };
  }

  switch (rangeType) {
    case 'today':
      break;
    case 'currentWeek':
      start = startOfWeek(new Date());
      break;
    case 'week':
      start.setDate(start.getDate() - 6);
      break;
    case 'currentMonth':
      start = startOfMonth(new Date());
      break;
    case 'month':
      start.setDate(start.getDate() - 29);
      break;
    case '3months':
      start.setMonth(start.getMonth() - 2);
      start = startOfMonth(start);
      break;
    case '6months':
      start.setMonth(start.getMonth() - 5);
      start = startOfMonth(start);
      break;
    case 'ytd':
      start = new Date(today.getFullYear(), 0, 1);
      break;
    case 'fy': {
      const fyMonth = today.getMonth();
      const fyYear = today.getFullYear();
      if (fyMonth < 3) {
        start = startOfDay(new Date(fyYear - 1, 3, 1));
        end = endOfDay(new Date(fyYear, 2, 31));
      } else {
        start = startOfDay(new Date(fyYear, 3, 1));
        end = endOfDay(new Date(fyYear + 1, 2, 31));
      }
      break;
    }
    case 'custom':
      if (customStart) {
        start = startOfDay(new Date(customStart));
      }
      if (customEnd) {
        end = endOfDay(new Date(customEnd));
      }
      break;
    default:
      start.setDate(start.getDate() - 29);
  }

  return { start, end };
};

const filterByDateRange = (data, rangeType, customStart = null, customEnd = null) => {
  const { start, end } = getDateRangeBounds(rangeType, customStart, customEnd);
  return data.filter((item) => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
};

const applyDashboardFilters = (data, filters = {}) => {
  const {
    category = '',
    subCategory = '',
    expenseBy = '',
    department = '',
    paymentMode = '',
    minAmount = '',
    maxAmount = '',
  } = filters;

  return data.filter((expense) => {
    if (category && expense.category !== category) {
      return false;
    }

    if (subCategory && expense.subCategory !== subCategory) {
      return false;
    }

    if (expenseBy && String(expense.employeeName || '') !== expenseBy) {
      return false;
    }

    if (department && String(expense.department || '') !== department) {
      return false;
    }

    if (paymentMode && String(expense.paymentMode || '') !== paymentMode) {
      return false;
    }

    if (minAmount !== '' && Number(expense.amount) < Number(minAmount)) {
      return false;
    }

    if (maxAmount !== '' && Number(expense.amount) > Number(maxAmount)) {
      return false;
    }

    return true;
  });
};

const detectTrendGranularity = (rangeType, start, end) => {
  if (rangeType === 'today') {
    return 'hour';
  }

  if (rangeType === 'currentWeek' || rangeType === 'week') {
    return 'day';
  }

  if (rangeType === 'currentMonth' || rangeType === 'month') {
    return 'week';
  }

  if (rangeType === '3months' || rangeType === '6months' || rangeType === 'ytd' || rangeType === 'fy' || (rangeType && rangeType.startsWith('fy_'))) {
    return 'month';
  }

  const spanDays = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
  if (spanDays <= 2) {
    return 'hour';
  }
  if (spanDays <= 14) {
    return 'day';
  }
  if (spanDays < 90) {
    return 'week';
  }
  return 'month';
};

const getBucketStart = (value, granularity) => {
  const date = new Date(value);

  switch (granularity) {
    case 'hour':
      date.setMinutes(0, 0, 0);
      return date;
    case 'day':
      return startOfDay(date);
    case 'week':
      return startOfWeek(date);
    case 'month':
      return startOfMonth(date);
    default:
      return startOfDay(date);
  }
};

const addBucket = (value, granularity, step = 1) => {
  const date = new Date(value);

  switch (granularity) {
    case 'hour':
      date.setHours(date.getHours() + step);
      break;
    case 'day':
      date.setDate(date.getDate() + step);
      break;
    case 'week':
      date.setDate(date.getDate() + (step * 7));
      break;
    case 'month':
      date.setMonth(date.getMonth() + step);
      break;
    default:
      date.setDate(date.getDate() + step);
  }

  return date;
};

const formatBucketLabel = (bucketDate, granularity) => {
  const date = new Date(bucketDate);

  switch (granularity) {
    case 'hour':
      return `${String(date.getHours()).padStart(2, '0')}:00`;
    case 'day':
      return `${String(date.getDate()).padStart(2, '0')} ${monthNamesShort[date.getMonth()]}`;
    case 'week': {
      const weekEnd = addBucket(date, 'day', 6);
      return `${String(date.getDate()).padStart(2, '0')} ${monthNamesShort[date.getMonth()]} - ${String(weekEnd.getDate()).padStart(2, '0')} ${monthNamesShort[weekEnd.getMonth()]}`;
    }
    case 'month':
      return `${monthNamesShort[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
    default:
      return `${String(date.getDate()).padStart(2, '0')} ${monthNamesShort[date.getMonth()]}`;
  }
};

const formatDateRange = (rangeStart, rangeEnd) => {
  const formatDate = (value) => {
    const date = new Date(value);
    return `${String(date.getDate()).padStart(2, '0')} ${monthNamesShort[date.getMonth()]}`;
  };

  return `${formatDate(rangeStart)} - ${formatDate(rangeEnd)}`;
};

const buildTrendSeries = (expenses, start, end, granularity, useNumberedWeeks = false) => {
  const normalizedStart = getBucketStart(start, granularity);
  const bucketMap = new Map();
  const series = [];

  for (let cursor = new Date(normalizedStart); cursor <= end; cursor = addBucket(cursor, granularity, 1)) {
    const key = cursor.toISOString();
    const visibleWeekStart = new Date(Math.max(cursor.getTime(), start.getTime()));
    const visibleWeekEnd = new Date(Math.min(
      addBucket(cursor, 'day', 6).getTime(),
      end.getTime()
    ));
    bucketMap.set(key, {
      label: useNumberedWeeks && granularity === 'week'
        ? `Week ${series.length + 1}`
        : formatBucketLabel(cursor, granularity),
      dateRange: useNumberedWeeks && granularity === 'week'
        ? formatDateRange(visibleWeekStart, visibleWeekEnd)
        : null,
      bucketDate: new Date(cursor),
      spend: 0,
    });
    series.push(bucketMap.get(key));
  }

  expenses.forEach((expense) => {
    const expenseDate = new Date(expense.date);
    const bucketDate = getBucketStart(expenseDate, granularity);
    const key = bucketDate.toISOString();
    if (bucketMap.has(key)) {
      bucketMap.get(key).spend += expense.amount;
    }
  });

  return series.map((entry) => ({
    label: entry.label,
    dateRange: entry.dateRange,
    bucketDate: entry.bucketDate,
    spend: Math.round(entry.spend),
  }));
};

const buildTransactionComparisonSeries = (expenses, trendSeries, granularity) => {
  const bucketStats = new Map(
    trendSeries.map((entry) => [
      entry.bucketDate.toISOString(),
      { transactionCount: 0, totalAmount: 0 },
    ])
  );

  expenses.forEach((expense) => {
    const bucketDate = getBucketStart(new Date(expense.date), granularity);
    const stats = bucketStats.get(bucketDate.toISOString());
    if (!stats) {
      return;
    }

    stats.transactionCount += 1;
    stats.totalAmount += Number(expense.amount || 0);
  });

  return trendSeries.map((entry) => {
    const stats = bucketStats.get(entry.bucketDate.toISOString());
    return {
      label: entry.label,
      dateRange: entry.dateRange,
      transactionCount: stats?.transactionCount || 0,
      averageExpense: stats?.transactionCount
        ? Math.round(stats.totalAmount / stats.transactionCount)
        : null,
    };
  });
};

const getRangeMeta = (rangeType, granularity) => {
  const labelsByRange = {
    today: 'Today',
    currentWeek: 'This Week',
    week: 'Last 7 Days',
    currentMonth: 'This Month',
    month: 'Last 30 Days',
    '3months': 'Last 90 Days',
    '6months': 'Last 6 Months',
    ytd: 'Year to Date',
    fy: 'Financial Year',
    custom: 'Custom Range',
  };

  const groupLabelByGranularity = {
    hour: 'Hourly',
    day: 'Daily',
    week: 'Weekly',
    month: 'Monthly',
  };

  const forecastUnitByGranularity = {
    hour: 'hours',
    day: 'days',
    week: 'weeks',
    month: 'months',
  };

  let timelineLabel = labelsByRange[rangeType] || 'Selected Range';
  if (rangeType && rangeType.startsWith('fy_')) {
    const startYear = parseInt(rangeType.split('_')[1], 10);
    const endYearShort = String(startYear + 1).slice(-2);
    timelineLabel = `FY ${startYear}-${endYearShort}`;
  }

  return {
    timelineLabel,
    trendTitle: `${groupLabelByGranularity[granularity]} Spend Trend`,
    distributionTitle: `${groupLabelByGranularity[granularity]} Spend Distribution`,
    forecastTitle: `${groupLabelByGranularity[granularity]} Spending Forecast`,
    growthLabel: `${groupLabelByGranularity[granularity]} Growth`,
    latestBucketLabel: `Latest ${groupLabelByGranularity[granularity].replace('ly', '')} Spend`,
    previousPeriodLabel: 'Previous Matching Period',
    forecastUnit: forecastUnitByGranularity[granularity],
  };
};

const buildForecastFromTrendSeries = (trendSeries, granularity, useNumberedWeeks = false) => {
  if (trendSeries.length < 4) {
    return {
      forecastData: trendSeries.map((item) => ({
        ...item,
        actualSpend: item.spend,
        projectedSpend: null,
      })),
      meta: {
        method: 'Insufficient history',
        confidence: 'Low',
        mape: null,
        note: 'Need at least 4 timeline buckets of history for a stronger forecast.',
      },
    };
  }

  const values = trendSeries.map((item) => item.spend);
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

  const forecastData = trendSeries.map((item) => ({
    ...item,
    actualSpend: item.spend,
    projectedSpend: null,
  }));
  const horizonByGranularity = {
    hour: 6,
    day: 7,
    week: 6,
    month: 4,
  };
  const horizon = horizonByGranularity[granularity] || 4;
  const confidenceMultiplier = 1.28;
  const lastActualPoint = trendSeries[trendSeries.length - 1];
  const lastKnownDate = lastActualPoint.bucketDate;

  forecastData[forecastData.length - 1] = {
    ...forecastData[forecastData.length - 1],
    projectedSpend: lastActualPoint.spend,
  };

  for (let step = 1; step <= horizon; step += 1) {
    const nextDate = addBucket(lastKnownDate, granularity, step);
    const projectedValue = Math.max(0, bestModel.level + step * bestModel.trend);
    const varianceBand = bestModel.rmse * confidenceMultiplier * Math.sqrt(step);

    forecastData.push({
      label: useNumberedWeeks && granularity === 'week'
        ? `Week ${trendSeries.length + step}`
        : formatBucketLabel(nextDate, granularity),
      dateRange: useNumberedWeeks && granularity === 'week'
        ? formatDateRange(nextDate, addBucket(nextDate, 'day', 6))
        : null,
      bucketDate: nextDate,
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

export const getDashboardAnalytics = (rangeType = 'month', customStart = null, customEnd = null, filters = {}) => {
  const allExpenses = getExpenses();
  const filteredBase = applyDashboardFilters(allExpenses, filters);
  const { start, end } = getDateRangeBounds(rangeType, customStart, customEnd);
  const filtered = filterByDateRange(filteredBase, rangeType, customStart, customEnd);
  const granularity = detectTrendGranularity(rangeType, start, end);
  const rangeMeta = getRangeMeta(rangeType, granularity);
  const totalSpend = filtered.reduce((sum, expense) => sum + expense.amount, 0);
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

  const rangeDurationMs = Math.max(24 * 60 * 60 * 1000, end.getTime() - start.getTime() + 1);
  const previousPeriodEnd = new Date(start.getTime() - 1);
  const previousPeriodStart = new Date(previousPeriodEnd.getTime() - rangeDurationMs + 1);
  const previousPeriodSpend = filteredBase
    .filter((expense) => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= previousPeriodStart && expenseDate <= previousPeriodEnd;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  let growthRate = 0;
  if (previousPeriodSpend > 0) {
    growthRate = ((totalSpend - previousPeriodSpend) / previousPeriodSpend) * 100;
  }

  const useNumberedWeeks = rangeType === 'currentMonth' || rangeType === 'month';
  const trendSeries = buildTrendSeries(
    filtered,
    start,
    end,
    granularity,
    useNumberedWeeks
  );
  const latestBucketSpend = trendSeries.length ? trendSeries[trendSeries.length - 1].spend : 0;

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

  const distributionData = [...trendSeries];

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
  const transactionComparisonSeries = buildTransactionComparisonSeries(
    filtered,
    trendSeries,
    granularity
  );

  const forecastResult = buildForecastFromTrendSeries(
    trendSeries,
    granularity,
    useNumberedWeeks
  );
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
      previousPeriodSpend: Math.round(previousPeriodSpend),
      latestBucketSpend: Math.round(latestBucketSpend),
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
      trendSeries,
      categoryBreakdown: categoryData,
      departmentSpend: departmentData,
      distributionSeries: distributionData,
      topSubCategories,
      paymentModeAnalysis: paymentModeData,
      transactionCountComparison: transactionComparisonSeries,
      spendingForecast: forecastResult.forecastData,
      spendingForecastMeta: forecastResult.meta,
      recentTimeline,
    },
    meta: rangeMeta,
  };
};

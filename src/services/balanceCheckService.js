const BALANCE_CHECK_STORAGE_KEY = 'iams_balance_check_entries';

const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const readBalanceEntries = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(BALANCE_CHECK_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const writeBalanceEntries = (entries) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(BALANCE_CHECK_STORAGE_KEY, JSON.stringify(entries));
  }

  return entries;
};

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
      break;
  }

  return { start, end };
};

const detectTrendGranularity = (rangeType, start, end) => {
  if (rangeType === 'today') {
    return 'hour';
  }
  if (rangeType === 'currentWeek' || rangeType === 'week') {
    return 'day';
  }

  const spanDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
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

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const withDerivedValues = (entry) => {
  const openingBalance = normalizeNumber(entry.openingBalance);
  const debit = normalizeNumber(entry.debit);
  const credit = normalizeNumber(entry.credit);
  const closingBalanceInput = entry.closingBalance;
  const closingBalance = closingBalanceInput === '' || closingBalanceInput === null || closingBalanceInput === undefined
    ? openingBalance - debit + credit
    : normalizeNumber(closingBalanceInput);

  return {
    entryId: String(entry.entryId || `bal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    date: String(entry.date || '').trim(),
    openingBalance,
    debit,
    credit,
    closingBalance,
    difference: closingBalance - openingBalance,
  };
};

const sortEntriesByDate = (entries, direction = 'asc') =>
  [...entries].sort((left, right) => {
    const result = new Date(left.date) - new Date(right.date);
    return direction === 'asc' ? result : -result;
  });

const buildTrendSeries = (entries, start, end, granularity, useNumberedWeeks = false) => {
  const normalizedStart = getBucketStart(start, granularity);
  const bucketMap = new Map();
  const series = [];

  for (let cursor = new Date(normalizedStart); cursor <= end; cursor = addBucket(cursor, granularity, 1)) {
    const key = cursor.toISOString();
    const visibleWeekStart = new Date(Math.max(cursor.getTime(), start.getTime()));
    const visibleWeekEnd = new Date(Math.min(addBucket(cursor, 'day', 6).getTime(), end.getTime()));
    const bucket = {
      label: useNumberedWeeks && granularity === 'week'
        ? `Week ${series.length + 1}`
        : formatBucketLabel(cursor, granularity),
      dateRange: useNumberedWeeks && granularity === 'week'
        ? formatDateRange(visibleWeekStart, visibleWeekEnd)
        : null,
      bucketDate: new Date(cursor),
      openingBalance: 0,
      debit: 0,
      credit: 0,
      closingBalance: 0,
      difference: 0,
      entryCount: 0,
    };
    bucketMap.set(key, bucket);
    series.push(bucket);
  }

  entries.forEach((entry) => {
    const bucketDate = getBucketStart(new Date(entry.date), granularity);
    const key = bucketDate.toISOString();
    const bucket = bucketMap.get(key);
    if (!bucket) {
      return;
    }

    bucket.openingBalance += entry.openingBalance;
    bucket.debit += entry.debit;
    bucket.credit += entry.credit;
    bucket.closingBalance += entry.closingBalance;
    bucket.difference += entry.difference;
    bucket.entryCount += 1;
  });

  return series.map((entry) => ({
    ...entry,
    openingBalance: Math.round(entry.openingBalance),
    debit: Math.round(entry.debit),
    credit: Math.round(entry.credit),
    closingBalance: Math.round(entry.closingBalance),
    difference: Math.round(entry.difference),
  }));
};

export const getBalanceEntries = () => sortEntriesByDate(readBalanceEntries(), 'desc');

export const saveBalanceEntry = async (entry) => {
  const currentEntries = getBalanceEntries();
  const nextEntry = withDerivedValues(entry);
  const isEdit = currentEntries.some((item) => item.entryId === nextEntry.entryId);
  const nextEntries = isEdit
    ? currentEntries.map((item) => (item.entryId === nextEntry.entryId ? nextEntry : item))
    : [nextEntry, ...currentEntries];

  writeBalanceEntries(sortEntriesByDate(nextEntries, 'desc'));
  return nextEntry;
};

export const deleteBalanceEntry = async (entryId) => {
  const nextEntries = getBalanceEntries().filter((entry) => entry.entryId !== entryId);
  writeBalanceEntries(nextEntries);
  return true;
};

export const getBalanceCheckAnalytics = (rangeType = 'month', customStart = null, customEnd = null) => {
  const allEntries = sortEntriesByDate(readBalanceEntries(), 'asc').map(withDerivedValues);
  const { start, end } = getDateRangeBounds(rangeType, customStart, customEnd);
  const filteredEntries = allEntries.filter((entry) => {
    const date = new Date(entry.date);
    return date >= start && date <= end;
  });

  const granularity = detectTrendGranularity(rangeType, start, end);
  const useNumberedWeeks = rangeType === 'currentMonth' || rangeType === 'month';
  const trendSeries = buildTrendSeries(filteredEntries, start, end, granularity, useNumberedWeeks);
  const totals = filteredEntries.reduce(
    (accumulator, entry) => ({
      openingBalance: accumulator.openingBalance + entry.openingBalance,
      debit: accumulator.debit + entry.debit,
      credit: accumulator.credit + entry.credit,
      closingBalance: accumulator.closingBalance + entry.closingBalance,
      difference: accumulator.difference + entry.difference,
    }),
    {
      openingBalance: 0,
      debit: 0,
      credit: 0,
      closingBalance: 0,
      difference: 0,
    }
  );

  return {
    entries: sortEntriesByDate(filteredEntries, 'desc'),
    totals: {
      openingBalance: Math.round(totals.openingBalance),
      debit: Math.round(totals.debit),
      credit: Math.round(totals.credit),
      closingBalance: Math.round(totals.closingBalance),
      difference: Math.round(totals.difference),
    },
    chart: trendSeries,
  };
};

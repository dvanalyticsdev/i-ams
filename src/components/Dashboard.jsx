import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  Cell, 
  ComposedChart,
  PieChart, 
  Pie, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  IndianRupee, 
  Calendar, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Building,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RefreshCw,
  FileText
} from 'lucide-react';
import { getExpenses } from '../services/expenseService';
import { getDashboardAnalytics } from '../services/expenseService';

function ChartSurface({ minHeight, children }) {
  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const [size, setSize] = useState(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const updateSize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = requestAnimationFrame(() => {
        const nextWidth = Math.max(Math.round(width), 0);
        const nextHeight = Math.max(Math.round(height), minHeight);

        setSize((current) => {
          if (current && current.width === nextWidth && current.height === nextHeight) {
            return current;
          }

          return { width: nextWidth, height: nextHeight };
        });
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [minHeight]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: `${minHeight}px`, minWidth: 0, minHeight: `${minHeight}px`, overflow: 'hidden' }}>
      {size && size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}

function Dashboard({ categories, departments, showToast }) {
  const [rangeType, setRangeType] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [filterExpenseBy, setFilterExpenseBy] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [currentTheme, setCurrentTheme] = useState('light');
  const expenses = getExpenses();
  const categoryNames = Object.keys(categories);
  const availableSubCategories = filterCategory ? (categories[filterCategory] || []) : [];
  const expenseByOptions = [...new Set(
    expenses
      .map((expense) => String(expense.employeeName || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
  const paymentModeOptions = [...new Set(
    expenses
      .map((expense) => String(expense.paymentMode || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const fetchAnalytics = () => {
    const data = getDashboardAnalytics(rangeType, startDate, endDate, {
      category: filterCategory,
      subCategory: filterSubCategory,
      expenseBy: filterExpenseBy,
      department: filterDept,
      paymentMode: filterPaymentMode,
      minAmount: filterMinAmount,
      maxAmount: filterMaxAmount,
    });
    setAnalytics(data);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [rangeType, startDate, endDate, filterCategory, filterSubCategory, filterExpenseBy, filterDept, filterPaymentMode, filterMinAmount, filterMaxAmount]);

  useEffect(() => {
    if (filterCategory && !categories[filterCategory]) {
      setFilterCategory('');
      setFilterSubCategory('');
      return;
    }

    if (filterSubCategory && filterCategory && !categories[filterCategory]?.includes(filterSubCategory)) {
      setFilterSubCategory('');
    }
  }, [categories, filterCategory, filterSubCategory]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.hasAttribute('data-theme');
      setCurrentTheme(isDark ? 'dark' : 'light');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    const isInitiallyDark = document.documentElement.hasAttribute('data-theme');
    setCurrentTheme(isInitiallyDark ? 'dark' : 'light');

    return () => observer.disconnect();
  }, []);

  if (!analytics) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
        <span style={{ marginLeft: '10px' }}>Loading Financial Analytics...</span>
      </div>
    );
  }

  const { kpis, charts, meta } = analytics;

  const getThemeColors = () => {
    const isDark = currentTheme === 'dark';
    return {
      primary: isDark ? '#f05a28' : '#e05322',
      secondary: isDark ? '#5cc8ff' : '#3b82f6',
      success: isDark ? '#00b852' : '#4caf50',
      textMuted: isDark ? '#8e9db0' : '#666666',
      border: isDark ? '#2d323f' : '#e8e8e8',
      grid: isDark ? 'rgba(45, 50, 63, 0.5)' : 'rgba(232, 232, 232, 0.8)',
      colors: isDark 
        ? ['#f05a28', '#5cc8ff', '#00b852', '#8e9db0', '#ff5722', '#e91e63', '#9c27b0']
        : ['#e05322', '#3b82f6', '#4caf50', '#9b9b9b', '#df514c', '#e91e63', '#9c27b0']
    };
  };

  const chartTheme = getThemeColors();

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleCustomRangeSubmit = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      showToast("Please select both start and end dates", "warning");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      showToast("Start date cannot be after end date", "warning");
      return;
    }
    fetchAnalytics();
    showToast("Applied custom date range filter", "success");
  };

  const handleResetFilters = () => {
    setRangeType('month');
    setStartDate('');
    setEndDate('');
    setFilterCategory('');
    setFilterSubCategory('');
    setFilterExpenseBy('');
    setFilterDept('');
    setFilterPaymentMode('');
    setFilterMinAmount('');
    setFilterMaxAmount('');
    showToast('Dashboard filters cleared', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* FILTER BAR CONTAINER */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dashboard Filters</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handleResetFilters} style={{ fontSize: '12px' }}>
            Reset Filters
          </button>
        </div>

        <div className="filter-grid" style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
          <div>
            <label>Timeline</label>
            <select value={rangeType} onChange={(event) => setRangeType(event.target.value)}>
              <option value="today">Today</option>
              <option value="currentWeek">This Week</option>
              <option value="week">Last 7 Days</option>
              <option value="currentMonth">This Month</option>
              <option value="month">Last 30 Days</option>
              <option value="3months">Last 90 Days</option>
              <option value="6months">Last 6 Months</option>
              <option value="ytd">Year to Date</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <div>
            <label>Category</label>
            <select value={filterCategory} onChange={(event) => { setFilterCategory(event.target.value); setFilterSubCategory(''); }}>
              <option value="">All Categories</option>
              {categoryNames.map((categoryName) => (
                <option key={categoryName} value={categoryName}>{categoryName}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Sub-Category</label>
            <select value={filterSubCategory} onChange={(event) => setFilterSubCategory(event.target.value)} disabled={!filterCategory}>
              <option value="">All Sub-Categories</option>
              {availableSubCategories.map((subCategory) => (
                <option key={subCategory} value={subCategory}>{subCategory}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Expense By</label>
            <select value={filterExpenseBy} onChange={(event) => setFilterExpenseBy(event.target.value)}>
              <option value="">All People</option>
              {expenseByOptions.map((expenseBy) => (
                <option key={expenseBy} value={expenseBy}>{expenseBy}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Department</label>
            <select value={filterDept} onChange={(event) => setFilterDept(event.target.value)}>
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Payment Mode</label>
            <select value={filterPaymentMode} onChange={(event) => setFilterPaymentMode(event.target.value)}>
              <option value="">All Modes</option>
              {paymentModeOptions.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Min Amount</label>
            <input type="number" placeholder="Min amount" value={filterMinAmount} onChange={(event) => setFilterMinAmount(event.target.value)} />
          </div>

          <div>
            <label>Max Amount</label>
            <input type="number" placeholder="Max amount" value={filterMaxAmount} onChange={(event) => setFilterMaxAmount(event.target.value)} />
          </div>
        </div>

        {rangeType === 'custom' && (
          <form onSubmit={handleCustomRangeSubmit} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <div style={{ width: '160px' }}>
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div style={{ width: '160px' }}>
              <label>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '36px', fontSize: '12px' }}>
              Apply Range
            </button>
          </form>
        )}
      </div>

      {/* KPI CARDS GRID (9 Cards) */}
      <div className="grid-3">
        {/* KPI 1: Total Expenses */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--primary-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
            <IndianRupee size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Expenses (Range)</span>
            <span style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>{formatCurrency(kpis.totalSpend)}</span>
          </div>
        </div>

        {/* KPI 2: Previous Period Spend */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--accent)' }}>
            <Calendar size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{meta.previousPeriodLabel}</span>
            <span style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>{formatCurrency(kpis.previousPeriodSpend)}</span>
          </div>
        </div>

        {/* KPI 3: Latest Bucket Spend */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--accent)' }}>
            <Clock size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{meta.latestBucketLabel}</span>
            <span style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>{formatCurrency(kpis.latestBucketSpend)}</span>
          </div>
        </div>

        {/* KPI 4: Average Expense Value */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--primary-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
            <Activity size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Avg. Transaction</span>
            <span style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>{formatCurrency(kpis.avgExpenseValue)}</span>
          </div>
        </div>

        {/* KPI 5: Highest Expense Category */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--danger-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)' }}>
            <TrendingUp size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Highest Category</span>
            <span style={{ fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={kpis.highestCategory}>
              {kpis.highestCategory}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{formatCurrency(kpis.highestCategoryAmount)}</span>
          </div>
        </div>

        {/* KPI 6: Lowest Expense Category */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--success-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--success)' }}>
            <TrendingDown size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Lowest Category</span>
            <span style={{ fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={kpis.lowestCategory}>
              {kpis.lowestCategory}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{formatCurrency(kpis.lowestCategoryAmount)}</span>
          </div>
        </div>

        {/* KPI 7: Total Transactions */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--primary-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
            <Activity size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Transactions Count</span>
            <span style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>{kpis.totalTransactions} Items</span>
          </div>
        </div>

        {/* KPI 8: Expense Growth Rate */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            padding: '10px', 
            backgroundColor: kpis.growthRate <= 0 ? 'var(--success-soft)' : 'var(--danger-soft)', 
            borderRadius: 'var(--radius-sm)', 
            color: kpis.growthRate <= 0 ? 'var(--success)' : 'var(--danger)' 
          }}>
            {kpis.growthRate <= 0 ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{meta.growthLabel}</span>
            <span style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px', color: kpis.growthRate <= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {kpis.growthRate > 0 ? `+${kpis.growthRate}` : kpis.growthRate}%
            </span>
          </div>
        </div>

        {/* KPI 9: Department Spend */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--primary-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
            <Building size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Top Department</span>
            <span style={{ fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
              {kpis.topDeptName}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{formatCurrency(kpis.topDeptAmount)}</span>
          </div>
        </div>
      </div>

      {/* CHARTS CONTAINER */}
      <div className="grid-2">
        {/* Chart 1: Dynamic Expense Trend */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{meta.trendTitle}</h3>
          <ChartSurface minHeight={240}>
            {({ width, height }) => (
              <LineChart width={width} height={height} data={charts.trendSeries} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} key={currentTheme}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="label" stroke={chartTheme.textMuted} fontSize={11} tickLine={false} />
                <YAxis stroke={chartTheme.textMuted} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `₹${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px' }}
                  labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--primary)' }}
                  formatter={(value) => [formatCurrency(value), 'Spend']}
                />
                <Line type="monotone" dataKey="spend" stroke={chartTheme.primary} strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 3 }} />
              </LineChart>
            )}
          </ChartSurface>
        </div>

        {/* Chart 2: Category Distribution */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category-wise Spend Split</h3>
          <ChartSurface minHeight={240}>
            {({ width, height }) => (
              <PieChart width={width} height={height} key={currentTheme}>
                <Pie
                  data={charts.categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {charts.categoryBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartTheme.colors[index % chartTheme.colors.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px' }}
                  formatter={(value) => [formatCurrency(value), 'Total Spend']}
                />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, color: 'var(--text)' }} />
              </PieChart>
            )}
          </ChartSurface>
        </div>

        {/* Chart 3: Department-wise Expenses */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department-wise Spend</h3>
          <ChartSurface minHeight={240}>
            {({ width, height }) => (
              <BarChart width={width} height={height} data={charts.departmentSpend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} key={currentTheme}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="department" stroke={chartTheme.textMuted} fontSize={11} tickLine={false} />
                <YAxis stroke={chartTheme.textMuted} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `₹${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px' }}
                  formatter={(value) => [formatCurrency(value), 'Spend']}
                />
                <Bar dataKey="spend" radius={[4, 4, 0, 0]}>
                  {charts.departmentSpend.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.spend === kpis.topDeptAmount ? 'var(--primary)' : 'var(--border-strong)'} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ChartSurface>
        </div>

        {/* Chart 5: Top Spending Subcategories */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Spending Subcategories</h3>
          <ChartSurface minHeight={240}>
            {({ width, height }) => (
              <BarChart 
                width={width}
                height={height}
                data={charts.topSubCategories} 
                layout="vertical"
                margin={{ top: 10, right: 10, left: 20, bottom: 10 }} 
                key={currentTheme}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                <XAxis type="number" stroke={chartTheme.textMuted} fontSize={11} tickLine={false} tickFormatter={v => `₹${v/1000}k`} />
                <YAxis dataKey="name" type="category" stroke={chartTheme.textMuted} fontSize={10} tickLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px' }}
                  formatter={(value) => [formatCurrency(value), 'Spend']}
                />
                <Bar dataKey="spend" fill={chartTheme.primary} radius={[0, 4, 4, 0]} barSize={15} />
              </BarChart>
            )}
          </ChartSurface>
        </div>

        {/* Chart 6: Payment Mode Analysis */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Mode Analysis</h3>
          <ChartSurface minHeight={240}>
            {({ width, height }) => (
              <PieChart width={width} height={height} key={currentTheme}>
                <Pie
                  data={charts.paymentModeAnalysis}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                >
                  {charts.paymentModeAnalysis.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartTheme.colors[(index + 2) % chartTheme.colors.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px' }}
                  formatter={(value) => [formatCurrency(value), 'Spend']}
                />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            )}
          </ChartSurface>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Count &amp; Average Expense</h3>
          <ChartSurface minHeight={240}>
            {({ width, height }) => (
              <ComposedChart
                width={width}
                height={height}
                data={charts.transactionCountComparison}
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                key={`${currentTheme}-transactions`}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="label" stroke={chartTheme.textMuted} fontSize={11} tickLine={false} />
                <YAxis
                  yAxisId="count"
                  stroke={chartTheme.textMuted}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="cost"
                  orientation="right"
                  stroke={chartTheme.textMuted}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px' }}
                  formatter={(value, name, item) => {
                    if (item?.dataKey === 'transactionCount') {
                      return [value, 'Transaction Count'];
                    }

                    return [formatCurrency(value), 'Average Expense'];
                  }}
                />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar
                  yAxisId="count"
                  dataKey="transactionCount"
                  name="Transaction Count"
                  fill={chartTheme.primary}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={90}
                />
                <Bar
                  yAxisId="cost"
                  dataKey="averageCosting"
                  name="Average Expense"
                  fill={chartTheme.secondary}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={90}
                />
              </ComposedChart>
            )}
          </ChartSurface>
        </div>

        {/* Chart 7: Spending Forecast */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{meta.forecastTitle}</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {charts.spendingForecastMeta.method} · {charts.spendingForecastMeta.note}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Confidence: <strong style={{ color: 'var(--text)' }}>{charts.spendingForecastMeta.confidence}</strong>
              {typeof charts.spendingForecastMeta.mape === 'number' ? ` · MAPE ${charts.spendingForecastMeta.mape}%` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '18px', height: '2px', backgroundColor: chartTheme.secondary, display: 'inline-block' }}></span>
              Actual spend timeline
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '18px', height: '2px', borderTop: `2px dashed ${chartTheme.primary}`, display: 'inline-block' }}></span>
              Projected future trend
            </span>
          </div>
          <ChartSurface minHeight={380}>
            {({ width, height }) => (
              <AreaChart width={width} height={height} data={charts.spendingForecast} margin={{ top: 12, right: 18, left: 12, bottom: 8 }} key={currentTheme}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="label" stroke={chartTheme.textMuted} fontSize={11} tickLine={false} />
                <YAxis stroke={chartTheme.textMuted} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `₹${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px' }}
                  formatter={(value, name, props) => {
                    if (value === null || value === undefined) {
                      return null;
                    }

                    if (name === 'actualSpend') {
                      return [formatCurrency(value), 'Actual'];
                    }

                    return [
                      `${formatCurrency(value)}${props.payload.isForecast ? ` (Projected${props.payload.lowerBound ? `, range ${formatCurrency(props.payload.lowerBound)} to ${formatCurrency(props.payload.upperBound)}` : ''})` : ''}`,
                      'Projected'
                    ];
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="actualSpend" 
                  stroke={chartTheme.secondary} 
                  fill={chartTheme.secondary} 
                  fillOpacity={0.08} 
                  strokeWidth={2.5}
                />
                <Area 
                  type="monotone" 
                  dataKey="projectedSpend" 
                  stroke={chartTheme.primary} 
                  fill={chartTheme.primary} 
                  fillOpacity={0.12} 
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                />
              </AreaChart>
            )}
          </ChartSurface>
        </div>
      </div>

      {/* RECENT TRANSACTIONS TIMELINE */}
      <div className="grid-1">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent Activity Feed</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Realtime ledger updates</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
            {charts.recentTimeline.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No transaction activities registered in this timeframe.
              </div>
            ) : (
              charts.recentTimeline.map((item, idx) => (
                <div 
                  key={item.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface-muted)',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '0', flex: 1 }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-soft)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      <FileText size={12} />
                    </div>

                    <div style={{ minWidth: '0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{item.employee}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({item.department})</span>
                        <span style={{ fontSize: '10px', padding: '1px 5px', backgroundColor: 'var(--border)', borderRadius: '2px', fontFamily: 'monospace' }}>{item.id}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                        {item.description} - <strong style={{ color: 'var(--text)' }}>{item.subCategory}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(item.amount)}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

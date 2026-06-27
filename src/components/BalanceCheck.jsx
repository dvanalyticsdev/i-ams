import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Activity, Eye, Pencil, Trash2, Wallet } from 'lucide-react';
import { deleteBalanceEntry, getBalanceCheckAnalytics, getBalanceEntries, saveBalanceEntry } from '../services/balanceCheckService';
import { getFinancialYears } from '../services/expenseService';

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

    const observer = new ResizeObserver(() => updateSize());
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

function BalanceCheck({ showToast }) {
  const [rangeType, setRangeType] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entries, setEntries] = useState(getBalanceEntries());
  const [analytics, setAnalytics] = useState(() => getBalanceCheckAnalytics('month'));
  const [editingEntryId, setEditingEntryId] = useState('');
  const financialYears = getFinancialYears();
  const [formData, setFormData] = useState({
    entryId: '',
    date: '',
    openingBalance: '',
    debit: '',
    credit: '',
    closingBalance: '',
  });

  const refreshAnalytics = () => {
    setEntries(getBalanceEntries());
    setAnalytics(getBalanceCheckAnalytics(rangeType, startDate, endDate));
  };

  useEffect(() => {
    setAnalytics(getBalanceCheckAnalytics(rangeType, startDate, endDate));
    setEntries(getBalanceEntries());
  }, [rangeType, startDate, endDate]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.date) {
      showToast('Date is required for balance check', 'warning');
      return;
    }

    const payload = {
      ...formData,
      openingBalance: Number(formData.openingBalance || 0),
      debit: Number(formData.debit || 0),
      credit: Number(formData.credit || 0),
      closingBalance: formData.closingBalance === '' ? '' : Number(formData.closingBalance || 0),
    };

    await saveBalanceEntry(payload);
    refreshAnalytics();
    setEditingEntryId('');
    setFormData({
      entryId: '',
      date: '',
      openingBalance: '',
      debit: '',
      credit: '',
      closingBalance: '',
    });
    showToast(editingEntryId ? 'Balance entry updated successfully' : 'Balance entry added successfully', 'success');
  };

  const handleEdit = (entry) => {
    setEditingEntryId(entry.entryId);
    setFormData({
      entryId: entry.entryId,
      date: entry.date,
      openingBalance: String(entry.openingBalance),
      debit: String(entry.debit),
      credit: String(entry.credit),
      closingBalance: String(entry.closingBalance),
    });
  };

  const handleDelete = async (entryId) => {
    const confirmed = window.confirm('Delete this balance check row?');
    if (!confirmed) {
      return;
    }

    await deleteBalanceEntry(entryId);
    refreshAnalytics();
    if (editingEntryId === entryId) {
      setEditingEntryId('');
      setFormData({
        entryId: '',
        date: '',
        openingBalance: '',
        debit: '',
        credit: '',
        closingBalance: '',
      });
    }
    showToast('Balance entry deleted successfully', 'success');
  };

  const handleTimelineChange = (event) => {
    const val = event.target.value;
    if (val === 'fy') {
      setRangeType(financialYears[0]?.value || 'fy');
    } else {
      setRangeType(val);
    }
  };

  const handleResetRange = () => {
    setRangeType('month');
    setStartDate('');
    setEndDate('');
    showToast('Balance check filters cleared', 'success');
  };

  const projectedClosingBalance =
    Number(formData.closingBalance === '' ? Number(formData.openingBalance || 0) - Number(formData.debit || 0) + Number(formData.credit || 0) : formData.closingBalance || 0);
  const projectedDifference = projectedClosingBalance - Number(formData.openingBalance || 0);
  const chartData = analytics.chart.map((entry) => ({
    ...entry,
    trendValue: entry.closingBalance,
  }));

  return (
    <div className="panel-stack">
      <div className="grid-3">
        <div className="card metric-card" style={{ '--metric-accent': 'var(--primary)', '--metric-soft': 'var(--primary-soft)' }}>
          <div className="metric-icon">
            <Wallet size={18} />
          </div>
          <div>
            <div className="metric-label">Closing Balance</div>
            <div className="metric-value">{formatCurrency(analytics.totals.closingBalance)}</div>
          </div>
        </div>
        <div className="card metric-card" style={{ '--metric-accent': 'var(--success)', '--metric-soft': 'var(--success-soft)' }}>
          <div className="metric-icon">
            <Activity size={18} />
          </div>
          <div>
            <div className="metric-label">Net Difference</div>
            <div className="metric-value">{formatCurrency(analytics.totals.difference)}</div>
          </div>
        </div>
        <div className="card metric-card" style={{ '--metric-accent': 'var(--warning)', '--metric-soft': 'var(--warning-soft)' }}>
          <div className="metric-icon">
            <Eye size={18} />
          </div>
          <div>
            <div className="metric-label">Rows In Range</div>
            <div className="metric-value">{analytics.entries.length}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Balance Check Timeline</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Trendline follows the selected date range on this page.</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select value={rangeType.startsWith('fy_') ? 'fy' : rangeType} onChange={handleTimelineChange} style={{ minWidth: '140px' }}>
              <option value="today">Today</option>
              <option value="currentWeek">This Week</option>
              <option value="week">Last 7 Days</option>
              <option value="currentMonth">This Month</option>
              <option value="month">Last 30 Days</option>
              <option value="3months">Last 90 Days</option>
              <option value="6months">Last 6 Months</option>
              <option value="ytd">Year to Date</option>
              <option value="fy">Financial Year</option>
              <option value="custom">Custom Range</option>
            </select>
            {rangeType.startsWith('fy_') ? (
              <select value={rangeType} onChange={(event) => setRangeType(event.target.value)} style={{ minWidth: '140px' }}>
                {financialYears.map((fy) => (
                  <option key={fy.value} value={fy.value}>{fy.label}</option>
                ))}
              </select>
            ) : null}
            <button type="button" className="btn btn-secondary" onClick={handleResetRange}>
              Reset
            </button>
          </div>
        </div>

        {rangeType === 'custom' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label>From Date</label>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <label>To Date</label>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>
        ) : null}

        <ChartSurface minHeight={320}>
          {({ width, height }) => (
            <LineChart width={width} height={height} data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--text-muted)" />
              <YAxis
                stroke="var(--text-muted)"
                tickFormatter={(value) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}
              />
              <Tooltip
                formatter={(value, name) => [formatCurrency(value), name === 'trendValue' ? 'Closing Balance' : name]}
                labelFormatter={(label, payload) => {
                  const dateRange = payload?.[0]?.payload?.dateRange;
                  return dateRange ? `${label} (${dateRange})` : label;
                }}
              />
              <Line type="monotone" dataKey="trendValue" name="Closing Balance" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          )}
        </ChartSurface>
      </div>

      <div className="grid-2">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {editingEntryId ? 'Edit Balance Row' : 'Add Balance Row'}
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Opening, debit, and credit are manual. Closing balance can be entered or left to auto-calculate.
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label>Daily</label>
              <input type="date" name="date" value={formData.date} onChange={handleFormChange} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label>Opening Balance</label>
                <input type="number" step="0.01" name="openingBalance" value={formData.openingBalance} onChange={handleFormChange} />
              </div>
              <div>
                <label>Debit</label>
                <input type="number" step="0.01" name="debit" value={formData.debit} onChange={handleFormChange} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label>Credit</label>
                <input type="number" step="0.01" name="credit" value={formData.credit} onChange={handleFormChange} />
              </div>
              <div>
                <label>Closing Balance</label>
                <input type="number" step="0.01" name="closingBalance" value={formData.closingBalance} onChange={handleFormChange} placeholder="Leave blank to auto-calc" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--surface-muted)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Projected Closing</div>
                <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>{formatCurrency(projectedClosingBalance)}</div>
              </div>
              <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--surface-muted)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Difference</div>
                <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px', color: projectedDifference >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatCurrency(projectedDifference)}
                </div>
              </div>
            </div>

            <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="btn btn-primary">
                {editingEntryId ? 'Update Row' : 'Save Row'}
              </button>
              {editingEntryId ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingEntryId('');
                    setFormData({
                      entryId: '',
                      date: '',
                      openingBalance: '',
                      debit: '',
                      credit: '',
                      closingBalance: '',
                    });
                  }}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overall Summary</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Auto-totaled from the visible timeline rows.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="card" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Opening Balance</div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>{formatCurrency(analytics.totals.openingBalance)}</div>
            </div>
            <div className="card" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Debit</div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>{formatCurrency(analytics.totals.debit)}</div>
            </div>
            <div className="card" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Credit</div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>{formatCurrency(analytics.totals.credit)}</div>
            </div>
            <div className="card" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Difference</div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px', color: analytics.totals.difference >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatCurrency(analytics.totals.difference)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Balance Check Register</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sheet-style daily rows with an automatic overall footer.</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th className="text-left">Daily</th>
              <th className="text-right">Opening Balance</th>
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
              <th className="text-right">Closing Balance</th>
              <th className="text-right">Difference</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {analytics.entries.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '32px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No balance check entries in the selected range yet.
                </td>
              </tr>
            ) : (
              analytics.entries.map((entry) => (
                <tr key={entry.entryId}>
                  <td className="text-left" style={{ fontWeight: 600 }}>{entry.date}</td>
                  <td className="text-right">{formatCurrency(entry.openingBalance)}</td>
                  <td className="text-right">{formatCurrency(entry.debit)}</td>
                  <td className="text-right">{formatCurrency(entry.credit)}</td>
                  <td className="text-right">{formatCurrency(entry.closingBalance)}</td>
                  <td className="text-right" style={{ color: entry.difference >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {formatCurrency(entry.difference)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => handleEdit(entry)} title="Edit Row">
                        <Pencil size={13} />
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => handleDelete(entry.entryId)} title="Delete Row" style={{ color: 'var(--danger)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            <tr style={{ backgroundColor: 'rgba(240, 90, 40, 0.08)' }}>
              <td className="text-left" style={{ fontWeight: 800 }}>OVERALL</td>
              <td className="text-right" style={{ fontWeight: 800 }}>{formatCurrency(analytics.totals.openingBalance)}</td>
              <td className="text-right" style={{ fontWeight: 800 }}>{formatCurrency(analytics.totals.debit)}</td>
              <td className="text-right" style={{ fontWeight: 800 }}>{formatCurrency(analytics.totals.credit)}</td>
              <td className="text-right" style={{ fontWeight: 800 }}>{formatCurrency(analytics.totals.closingBalance)}</td>
              <td className="text-right" style={{ fontWeight: 800, color: analytics.totals.difference >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatCurrency(analytics.totals.difference)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BalanceCheck;

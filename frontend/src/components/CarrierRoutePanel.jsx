import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell
} from 'recharts';
import { X, Route, TrendingUp, Package, DollarSign, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';

const ROUTE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
  '#e11d48', '#0ea5e9', '#a855f7', '#22d3ee', '#facc15'
];

const fmtNum = (v) => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0));
const fmtTons = (v) => fmtNum(v) + ' Tấn';
const fmtCost = (v) => fmtNum(v) + ' ₫';

// Custom Tooltip for stacked bar chart
const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={`p-3 rounded-xl border text-xs shadow-xl max-w-xs ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
      <p className="font-bold mb-2 text-blue-400">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: entry.fill }} />
          <span className="truncate max-w-[140px] font-medium">{entry.name}</span>
          <span className="ml-auto font-mono font-semibold">{fmtTons(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

const CarrierRoutePanel = ({ carrier, fileId, filters, onClose }) => {
  const { isDark } = useTheme();
  const [groupBy, setGroupBy] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('tons');
  const [sortAsc, setSortAsc] = useState(false);
  const [metric, setMetric] = useState('tons');

  const fetchData = useCallback(async () => {
    if (!carrier || !fileId) return;
    setLoading(true);
    try {
      const res = await api.get(`/carrier-routes/${fileId}`, {
        params: { carrier_name: carrier, group_by: groupBy, ...filters }
      });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load carrier routes:', err);
    } finally {
      setLoading(false);
    }
  }, [carrier, fileId, groupBy, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build time-series chart data: one row per time_period, columns per route_code
  const buildChartData = () => {
    if (!data?.time_series?.length) return { chartRows: [], routeCodes: [] };
    const allPeriods = [...new Set(data.time_series.map(d => d.time_period))].sort();
    const allRoutes = [...new Set(data.time_series.map(d => d.route_code))];

    // Build pivot
    const pivot = {};
    allPeriods.forEach(p => { pivot[p] = { time_period: p }; });
    data.time_series.forEach(d => {
      if (!pivot[d.time_period]) pivot[d.time_period] = { time_period: d.time_period };
      pivot[d.time_period][d.route_code] = d[metric] ?? 0;
    });

    return {
      chartRows: allPeriods.map(p => pivot[p]),
      routeCodes: allRoutes
    };
  };

  const { chartRows, routeCodes } = buildChartData();

  const [columnFilters, setColumnFilters] = useState({
    route_code: '',
    time_period: '',
    province: ''
  });

  const handleColumnFilterChange = (col, value) => {
    setColumnFilters(prev => ({ ...prev, [col]: value }));
  };

  // Filter & Sorted routes table
  const filteredRoutes = useMemo(() => {
    let list = [...(data?.routes || [])];

    if (columnFilters.route_code) {
      const q = columnFilters.route_code.trim().toUpperCase();
      list = list.filter(r => (r.route_code || '').toUpperCase().includes(q));
    }
    if (columnFilters.time_period) {
      const q = columnFilters.time_period.trim().toUpperCase();
      list = list.filter(r => (r.time_period || '').toUpperCase().includes(q));
    }
    if (columnFilters.province) {
      const q = columnFilters.province.trim().toUpperCase();
      list = list.filter(r => (r.province || '').toUpperCase().includes(q));
    }

    return list.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? av - bv : bv - av;
    });
  }, [data?.routes, columnFilters, sortKey, sortAsc]);

  const handleSortClick = (key) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />;
  };

  const cardBg = isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const thBg = isDark ? 'bg-slate-950/60 text-slate-400' : 'bg-slate-100 text-slate-500';
  const trHover = isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50';
  const inputBg = isDark ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className={`fixed right-0 top-0 h-full z-50 w-full max-w-4xl shadow-2xl border-l flex flex-col transition-all duration-300 overflow-y-auto ${
        isDark ? 'bg-[#0b0f19] border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 ${isDark ? 'bg-[#0b0f19] border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Route className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-extrabold text-base">Phân tích Tuyến — {carrier}</h2>
              <p className={`text-xs ${muted}`}>Sản lượng từng tuyến vận chuyển của nhà vận chuyển này</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            id="carrier-route-panel-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          )}

          {!loading && data && (
            <>
              {/* Summary KPI mini-cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Tổng sản lượng', value: fmtTons(data.summary?.total_tons), icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                  { label: 'Tổng chi phí', value: fmtCost(data.summary?.total_cost), icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  { label: 'Số lô hàng', value: fmtNum(data.summary?.total_shipments), icon: Package, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                  { label: 'Số tuyến', value: data.summary?.route_count || 0, icon: Route, color: 'text-amber-500', bg: 'bg-amber-500/10' }
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`border rounded-2xl p-4 flex items-center gap-3 ${cardBg}`}>
                    <div className={`p-2 rounded-xl ${bg}`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div>
                      <p className={`text-[10px] uppercase tracking-wide font-semibold ${muted}`}>{label}</p>
                      <p className="font-extrabold text-sm">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Controls: Group by + Metric */}
              <div className="flex flex-wrap items-center gap-3">
                <span className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Nhóm theo:</span>
                {['month', 'week'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setGroupBy(opt)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                      groupBy === opt
                        ? 'bg-blue-600 text-white border-blue-500 shadow'
                        : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {opt === 'month' ? 'Tháng' : 'Tuần'}
                  </button>
                ))}

                <span className={`text-xs font-bold uppercase tracking-wide ${muted} ml-4`}>Chỉ số:</span>
                {[
                  { key: 'tons', label: 'Sản lượng (Tấn)' },
                  { key: 'cost', label: 'Chi phí (₫)' },
                  { key: 'shipments', label: 'Số lô' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setMetric(key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                      metric === key
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                        : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Stacked Bar Chart: time period x route_code */}
              {chartRows.length > 0 ? (
                <div className={`border rounded-2xl p-4 ${cardBg}`}>
                  <h3 className="text-sm font-bold mb-4">Biểu đồ {metric === 'tons' ? 'Sản lượng' : metric === 'cost' ? 'Chi phí' : 'Số lô'} theo Tuyến & {groupBy === 'week' ? 'Tuần' : 'Tháng'}</h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartRows} margin={{ top: 5, right: 20, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} />
                        <XAxis
                          dataKey="time_period"
                          stroke={isDark ? '#64748b' : '#94a3b8'}
                          tick={{ fontSize: 10 }}
                          angle={-35}
                          textAnchor="end"
                          height={55}
                        />
                        <YAxis
                          stroke={isDark ? '#64748b' : '#94a3b8'}
                          tick={{ fontSize: 10 }}
                          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                        />
                        <Tooltip
                          content={<CustomTooltip isDark={isDark} />}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                          formatter={(value) => <span style={{ color: isDark ? '#94a3b8' : '#475569' }}>{value}</span>}
                        />
                        {routeCodes.map((route, idx) => (
                          <Bar
                            key={route}
                            dataKey={route}
                            stackId="a"
                            fill={ROUTE_COLORS[idx % ROUTE_COLORS.length]}
                            radius={idx === routeCodes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className={`border rounded-2xl p-8 text-center ${cardBg} ${muted} text-sm`}>
                  Không có dữ liệu tuyến đủ điều kiện (thiếu route_code hoặc ngày).
                </div>
              )}

              {/* Route Detail Table */}
              {data.routes?.length > 0 && (
                <div className={`border rounded-2xl overflow-hidden ${cardBg}`}>
                  <div className="px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
                    <h3 className="text-sm font-bold">Bảng Chi tiết theo Tuyến ({filteredRoutes.length}/{data.routes.length} bản ghi)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={`${thBg} text-[10px] uppercase tracking-wide`}>
                          {[
                            { key: 'route_code', label: 'Tuyến (Route)' },
                            { key: 'time_period', label: 'Thời gian' },
                            { key: 'tons', label: 'Sản lượng (Tấn)' },
                            { key: 'cost', label: 'Tổng chi phí' },
                            { key: 'shipments', label: 'Số lô' },
                            { key: 'avg_unit_price', label: 'Đơn giá TB/Tấn' },
                            { key: 'province', label: 'Tỉnh / Thành' },
                          ].map(({ key, label }) => (
                            <th
                              key={key}
                              className="px-3 py-2 text-left cursor-pointer select-none hover:opacity-80 transition"
                              onClick={() => handleSortClick(key)}
                            >
                              <span className="flex items-center gap-1">
                                {label} <SortIcon col={key} />
                              </span>
                            </th>
                          ))}
                        </tr>
                        {/* Column Filter Row */}
                        <tr className={isDark ? 'bg-slate-900/60' : 'bg-slate-50'}>
                          <th className="p-1.5">
                            <input
                              type="text"
                              placeholder="Lọc tuyến..."
                              value={columnFilters.route_code}
                              onChange={e => handleColumnFilterChange('route_code', e.target.value)}
                              className={`w-full px-2 py-1 text-[11px] rounded border font-normal ${inputBg}`}
                            />
                          </th>
                          <th className="p-1.5">
                            <input
                              type="text"
                              placeholder="Lọc thời gian..."
                              value={columnFilters.time_period}
                              onChange={e => handleColumnFilterChange('time_period', e.target.value)}
                              className={`w-full px-2 py-1 text-[11px] rounded border font-normal ${inputBg}`}
                            />
                          </th>
                          <th className="p-1.5"></th>
                          <th className="p-1.5"></th>
                          <th className="p-1.5"></th>
                          <th className="p-1.5"></th>
                          <th className="p-1.5">
                            <input
                              type="text"
                              placeholder="Lọc tỉnh..."
                              value={columnFilters.province}
                              onChange={e => handleColumnFilterChange('province', e.target.value)}
                              className={`w-full px-2 py-1 text-[11px] rounded border font-normal ${inputBg}`}
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                        {filteredRoutes.map((route, idx) => (
                          <tr key={`${route.route_code}-${route.time_period}-${idx}`} className={`transition ${trHover}`}>
                            <td className="px-3 py-2 font-mono font-bold">
                              <span className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
                                />
                                {route.route_code}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-400 font-semibold">{route.time_period}</td>
                            <td className="px-3 py-2 text-blue-500 font-semibold">{fmtTons(route.tons)}</td>
                            <td className="px-3 py-2 text-emerald-500 font-medium">{fmtCost(route.cost)}</td>
                            <td className="px-3 py-2 text-purple-500 font-medium">{fmtNum(route.shipments)}</td>
                            <td className="px-3 py-2 text-indigo-400 font-mono">{fmtCost(route.avg_unit_price)}</td>
                            <td className="px-3 py-2 font-medium text-slate-300">{route.province}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !data && (
            <div className={`text-center py-20 ${muted} text-sm`}>
              Không có dữ liệu. Vui lòng thử lại.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CarrierRoutePanel;

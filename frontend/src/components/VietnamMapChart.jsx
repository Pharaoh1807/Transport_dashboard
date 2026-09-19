import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { Navigation, Truck, Layers, Info, TrendingUp, DollarSign, Package, Route, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';

const GEO_URL = '/vietnam-provinces-wgs84.json';

const CARRIER_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
];

const fmtNum = (v) => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0));
const fmtTons = (v) => fmtNum(v) + ' Tấn';
const fmtCost = (v) => fmtNum(v) + ' ₫';

const PROVINCE_ALIASES = {
  'SOUTHEAST': 'DONGNAI',
  'HOCHIMINHCITY': 'HOCHIMINH',
  'HOCHIMINH': 'HOCHIMINH',
  'HCM': 'HOCHIMINH',
  'TPHCM': 'HOCHIMINH',
  'TPHOCHIMINH': 'HOCHIMINH',
  'CANTHO': 'CANTHO',
  'HAIPHONG': 'HAIPHONG',
  'DANANG': 'DANANG',
  'HANOI': 'HANOI',
  'HUE': 'THUATHIENHUE',
  'THUATHIENHUE': 'THUATHIENHUE',
};

// Normalize province names for fuzzy matching between SAP data and GeoJSON
const normalizeName = (text) => {
  if (!text) return '';
  let str = text.toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/^(TINH|TP|TP\.|THANH PHO|TT\.|TT|CITY)[\s\.]*/i, '')
    .replace(/[\s\.]*CITY$/i, '')
    .replace(/[^A-Z0-9]/g, '');
  return PROVINCE_ALIASES[str] || str;
};

// Route Table for selected carrier
const CarrierRouteTable = ({ carrier, fileId, filters, isDark }) => {
  const [groupBy, setGroupBy] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState('tons');
  const [sortAsc, setSortAsc] = useState(false);
  const [colFilters, setColFilters] = useState({ route_code: '', time_period: '', province: '' });

  useEffect(() => {
    if (!carrier || !fileId) return;
    setLoading(true);
    api.get(`/carrier-routes/${fileId}`, { params: { carrier_name: carrier, group_by: groupBy, ...filters } })
      .then(res => setData(res.data))
      .catch(err => console.error('Failed to load carrier routes:', err))
      .finally(() => setLoading(false));
  }, [carrier, fileId, groupBy, filters]);

  const filteredRoutes = useMemo(() => {
    let list = [...(data?.routes || [])];
    if (colFilters.route_code) {
      const q = colFilters.route_code.trim().toUpperCase();
      list = list.filter(r => (r.route_code || '').toUpperCase().includes(q));
    }
    if (colFilters.time_period) {
      const q = colFilters.time_period.trim().toUpperCase();
      list = list.filter(r => (r.time_period || '').toUpperCase().includes(q));
    }
    if (colFilters.province) {
      const q = colFilters.province.trim().toUpperCase();
      list = list.filter(r => (r.province || '').toUpperCase().includes(q));
    }

    return list.sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? av - bv : bv - av;
    });
  }, [data?.routes, colFilters, sortKey, sortAsc]);

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200';
  const thBg = isDark ? 'bg-slate-950/60 text-slate-400' : 'bg-slate-100 text-slate-500';
  const trHover = isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50';
  const divider = isDark ? 'divide-slate-800' : 'divide-slate-100';
  const inputBg = isDark ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400';

  return (
    <div className={`mt-6 border rounded-2xl overflow-hidden ${cardBg}`}>
      {/* Table Header */}
      <div className={`px-5 py-3 border-b flex flex-wrap items-center gap-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <Route className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-bold">Sản lượng theo Tuyến — {carrier}</span>

        {/* Summary mini-pills */}
        {data?.summary && (
          <div className="flex flex-wrap gap-2 ml-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-500">{fmtTons(data.summary.total_tons)}</span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">{fmtCost(data.summary.total_cost)}</span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-500">{data.summary.route_count} tuyến</span>
          </div>
        )}

        {/* Group by controls */}
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs ${muted}`}>Nhóm theo:</span>
          {['month', 'week'].map(opt => (
            <button key={opt} onClick={() => setGroupBy(opt)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                groupBy === opt
                  ? 'bg-blue-600 text-white border-blue-500'
                  : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>{opt === 'month' ? 'Tháng' : 'Tuần'}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      )}

      {!loading && data?.routes?.length > 0 && (
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-xs">
            <thead>
              <tr className={`${thBg} text-[10px] uppercase tracking-wide sticky top-0 z-10`}>
                {[
                  { key: 'route_code', label: 'Tuyến (Route)' },
                  { key: 'time_period', label: 'Thời gian' },
                  { key: 'tons', label: 'Sản lượng (Tấn)' },
                  { key: 'cost', label: 'Tổng cước' },
                  { key: 'shipments', label: 'Số lô' },
                  { key: 'avg_unit_price', label: 'Đơn giá TB/Tấn' },
                  { key: 'province', label: 'Tỉnh / Thành' },
                ].map(({ key, label }) => (
                  <th key={key} onClick={() => handleSort(key)}
                    className="px-3 py-2 text-left cursor-pointer select-none hover:opacity-80">
                    <span className="flex items-center gap-1">
                      {label}
                      {sortKey === key
                        ? (sortAsc ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />)
                        : <ChevronDown className="w-3 h-3 opacity-30" />}
                    </span>
                  </th>
                ))}
              </tr>
              <tr className={isDark ? 'bg-slate-900/80' : 'bg-slate-50'}>
                <th className="p-1.5">
                  <input
                    type="text"
                    placeholder="Lọc tuyến..."
                    value={colFilters.route_code}
                    onChange={e => setColFilters(prev => ({ ...prev, route_code: e.target.value }))}
                    className={`w-full px-2 py-0.5 text-[11px] rounded border font-normal ${inputBg}`}
                  />
                </th>
                <th className="p-1.5">
                  <input
                    type="text"
                    placeholder="Lọc thời gian..."
                    value={colFilters.time_period}
                    onChange={e => setColFilters(prev => ({ ...prev, time_period: e.target.value }))}
                    className={`w-full px-2 py-0.5 text-[11px] rounded border font-normal ${inputBg}`}
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
                    value={colFilters.province}
                    onChange={e => setColFilters(prev => ({ ...prev, province: e.target.value }))}
                    className={`w-full px-2 py-0.5 text-[11px] rounded border font-normal ${inputBg}`}
                  />
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${divider}`}>
              {filteredRoutes.map((route, idx) => (
                <tr key={`${route.route_code}-${route.time_period}-${idx}`} className={`transition ${trHover}`}>
                  <td className="px-3 py-2 font-mono font-bold">{route.route_code}</td>
                  <td className="px-3 py-2 text-slate-400 font-semibold">{route.time_period}</td>
                  <td className="px-3 py-2 text-blue-500 font-semibold">{fmtTons(route.tons)}</td>
                  <td className="px-3 py-2 text-emerald-500">{fmtCost(route.cost)}</td>
                  <td className="px-3 py-2 text-purple-500">{fmtNum(route.shipments)}</td>
                  <td className="px-3 py-2 text-indigo-400 font-mono">{fmtCost(route.avg_unit_price)}</td>
                  <td className="px-3 py-2 font-medium text-slate-300">{route.province}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (!data?.routes || data.routes.length === 0) && (
        <p className={`text-center py-8 text-sm ${muted}`}>Không có dữ liệu tuyến cho NVC này.</p>
      )}
    </div>
  );
};

// ===== Main Component =====
const VietnamMapChart = ({ data, activeFileId, filters }) => {
  const { isDark } = useTheme();
  const [selectedCarrier, setSelectedCarrier] = useState('ALL');
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const provincesData = useMemo(() => data?.provinces || [], [data]);
  const topCarriers = useMemo(() => data?.top_carriers || [], [data]);

  const carrierColorMap = useMemo(() => {
    const map = {};
    topCarriers.forEach((cName, idx) => {
      map[cName] = CARRIER_COLORS[idx % CARRIER_COLORS.length];
    });
    map['Khác'] = '#64748b';
    return map;
  }, [topCarriers]);

  const provinceLookupMap = useMemo(() => {
    const map = new Map();
    provincesData.forEach(p => {
      const norm = normalizeName(p.province);
      if (norm) map.set(norm, p);
    });
    return map;
  }, [provincesData]);

  const getProvinceInfo = useCallback((geoProperties) => {
    const geoName = geoProperties.name || geoProperties['woe-name'] || geoProperties.NAME_1 || geoProperties.VARNAME_1 || '';
    const norm = normalizeName(geoName);
    return provinceLookupMap.get(norm) || null;
  }, [provinceLookupMap]);

  // Audit province matching on data update
  useEffect(() => {
    if (provincesData.length > 0) {
      console.log('🗺️ [VietnamMapChart] Auditing Province Name Matching...');
      console.log('📌 Provinces in SAP Data:', provincesData.map(p => p.province));

      fetch(GEO_URL)
        .then(res => res.json())
        .then(geo => {
          const geoNames = geo.features.map(f => f.properties.name);
          console.log('🗺️ Provinces in GeoJSON (63 features):', geoNames);

          const geoNormSet = new Set(geoNames.map(g => normalizeName(g)));
          const unmatched = provincesData.filter(p => !geoNormSet.has(normalizeName(p.province)));

          if (unmatched.length > 0) {
            console.warn('⚠️ Unmatched Provinces between Data & GeoJSON:', unmatched.map(u => u.province));
          } else {
            console.log('✅ 100% Data Provinces matched with GeoJSON Features!');
          }
        })
        .catch(err => console.error('Failed to audit GeoJSON:', err));
    }
  }, [provincesData]);

  const getGeoFillColor = (pInfo) => {
    if (!pInfo || pInfo.total_tons === 0) return isDark ? '#334155' : '#cbd5e1';
    // TEST COLOR FOR PROVINCES WITH DATA: BRIGHT RED (#ff0000)
    return '#ff0000';
  };

  const getGeoOpacity = (pInfo) => {
    if (selectedCarrier === 'ALL') return 1.0; // Solid non-transparent fill
    if (!pInfo || !pInfo.carriers?.[selectedCarrier]) return 0.45; // Dimmed gray when carrier selected
    return 1.0;
  };

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`p-5 rounded-2xl border transition-colors duration-200 relative z-20 ${
      isDark ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800 shadow-md'
    }`}>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700/40">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl text-white shadow-md">
              <Navigation className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Bản Đồ Phủ Tuyến 63 Tỉnh Thành Việt Nam
            </h3>
          </div>
          <p className={`text-xs mt-1 ${muted}`}>
            Tô màu từng Tỉnh/Thành theo NVC chính — click NVC để lọc &amp; xem chi tiết tuyến
          </p>
        </div>

        {/* Carrier Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedCarrier('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedCarrier === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >Tất cả NVC</button>

          {topCarriers.map(cName => {
            const color = carrierColorMap[cName];
            const isSelected = selectedCarrier === cName;
            return (
              <button
                key={cName}
                onClick={() => setSelectedCarrier(prev => prev === cName ? 'ALL' : cName)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                  isSelected ? 'text-white shadow-md' : isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                style={{ backgroundColor: isSelected ? color : undefined, borderColor: isSelected ? color : undefined }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: isSelected ? '#fff' : color }} />
                {cName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map + Legend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-20">

        {/* Map (without overflow-hidden so tooltips are never clipped) */}
        <div
          className="lg:col-span-8 flex justify-center relative rounded-2xl border"
          style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#475569' : '#cbd5e1' }}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [107.5, 16.2], scale: 2400 }}
            style={{ width: '100%', height: '520px' }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const pInfo = getProvinceInfo(geo.properties);
                  const fillColor = getGeoFillColor(pInfo);
                  const opacity = getGeoOpacity(pInfo);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseMove={evt => {
                        const rect = evt.currentTarget.closest('svg').getBoundingClientRect();
                        const relX = evt.clientX - rect.left;
                        const relY = evt.clientY - rect.top;
                        const topY = relY > 340 ? relY - 140 : relY + 15;
                        const leftX = relX > 350 ? relX - 210 : relX + 15;
                        setTooltipPos({ x: leftX, y: topY });
                        setTooltipContent({ name: geo.properties.name || geo.properties['woe-name'] || '?', info: pInfo });
                      }}
                      onMouseLeave={() => setTooltipContent(null)}
                      style={{
                        default: {
                          fill: fillColor,
                          fillOpacity: opacity,
                          stroke: '#ffffff',
                          strokeWidth: 1.5,
                          outline: 'none',
                          transition: 'fill 200ms, fill-opacity 200ms'
                        },
                        hover: {
                          fill: '#f59e0b',
                          fillOpacity: 1,
                          stroke: '#ffffff',
                          strokeWidth: 2.5,
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        pressed: { fill: '#d97706', outline: 'none' }
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {/* Hover Tooltip z-50 */}
          {tooltipContent && (
            <div
              className="absolute z-50 p-3.5 rounded-xl shadow-2xl border text-xs pointer-events-none min-w-[200px] max-w-[260px]"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(15, 23, 42, 0.96)',
                borderColor: '#475569',
                color: '#f8fafc'
              }}
            >
              <p className="font-extrabold text-sm text-amber-400 mb-1.5 pb-1 border-b border-slate-700/60">{tooltipContent.name}</p>
              {tooltipContent.info ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Tổng sản lượng:</span>
                    <strong className="text-blue-400 font-mono">{fmtTons(tooltipContent.info.total_tons)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Tổng cước:</span>
                    <strong className="text-emerald-400 font-mono">{fmtCost(tooltipContent.info.total_cost)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Số NVC phục vụ:</span>
                    <strong className="text-slate-200">{tooltipContent.info.carrier_count} đối tác</strong>
                  </div>

                  {/* List carriers sorted by tonnage (highest to lowest) */}
                  {tooltipContent.info.carriers && Object.keys(tooltipContent.info.carriers).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700/60 space-y-1">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">NVC theo sản lượng (Cao → Thấp):</p>
                      {Object.entries(tooltipContent.info.carriers)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cName, cTons]) => (
                          <div key={cName} className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full inline-block shrink-0"
                                style={{ backgroundColor: carrierColorMap[cName] || '#3b82f6' }}
                              />
                              <span className="font-semibold text-slate-200 truncate max-w-[120px]">{cName}</span>
                            </span>
                            <strong className="font-mono text-blue-400 ml-2">{fmtTons(cTons)}</strong>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 italic">Chưa phát sinh vận chuyển</p>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Chú Thích NVC</h4>
            <span className={`text-[11px] px-2.5 py-1 bg-blue-500/10 text-blue-500 rounded-full font-semibold flex items-center gap-1`}>
              <Layers className="w-3 h-3" /><span>63 Tỉnh</span>
            </span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {topCarriers.map((cName, idx) => {
              const color = carrierColorMap[cName];
              const isSelected = selectedCarrier === cName;
              return (
                <div
                  key={cName}
                  onClick={() => setSelectedCarrier(prev => prev === cName ? 'ALL' : cName)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'shadow-md'
                      : isDark ? 'bg-slate-950/40 border-slate-800 hover:bg-slate-800/50' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                  style={isSelected ? { borderColor: color, backgroundColor: color + '18' } : {}}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                    <div>
                      <p className="text-xs font-bold">{cName}</p>
                      <p className={`text-[10px] ${muted}`}>NVC Chính #{idx + 1}</p>
                    </div>
                  </div>
                  <Truck className="w-4 h-4 opacity-40" />
                </div>
              );
            })}
          </div>

          <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Click vào tên NVC để lọc bản đồ và xem bảng chi tiết từng tuyến bên dưới.</span>
          </div>
        </div>
      </div>

      {/* Carrier Route Table — shown when a specific carrier is selected */}
      {selectedCarrier !== 'ALL' && activeFileId && (
        <CarrierRouteTable
          carrier={selectedCarrier}
          fileId={activeFileId}
          filters={filters}
          isDark={isDark}
        />
      )}
    </div>
  );
};

export default VietnamMapChart;

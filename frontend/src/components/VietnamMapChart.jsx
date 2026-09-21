import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { Navigation, Truck, Layers, Info, TrendingUp, DollarSign, Package, Route, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';

const GEO_URL = '/Transport_dashboard/vietnam-provinces-wgs84.json';

// Mapping 63 tỉnh cũ → 34 tỉnh mới (theo Nghị quyết 2025)
// Format: old_province_name -> new_province_name
const PROVINCE_MERGE_MAPPING = {
  // ===== 6 Thành phố trực thuộc TW =====
  // Hà Nội (giữ nguyên)
  'Hà Nội': 'Hà Nội',
  'Ha Noi': 'Hà Nội',
  'Hanoi': 'Hà Nội',
  
  // Thành phố Hồ Chí Minh (TP.HCM + Bình Dương + Bà Rịa-Vũng Tàu)
  'Thành phố Hồ Chí Minh': 'Thành phố Hồ Chí Minh',
  'Hồ Chí Minh': 'Thành phố Hồ Chí Minh',
  'Hồ Chí Minh city': 'Thành phố Hồ Chí Minh',
  'TP.HCM': 'Thành phố Hồ Chí Minh',
  'TPHCM': 'Thành phố Hồ Chí Minh',
  'Ho Chi Minh': 'Thành phố Hồ Chí Minh',
  'Ho Chi Minh City': 'Thành phố Hồ Chí Minh',
  'Bình Dương': 'Thành phố Hồ Chí Minh',
  'Binh Duong': 'Thành phố Hồ Chí Minh',
  'Bà Rịa-Vũng Tàu': 'Thành phố Hồ Chí Minh',
  'Ba Ria-Vung Tau': 'Thành phố Hồ Chí Minh',
  
  // Hải Phòng (Hải Phòng + Hải Dương)
  'Hải Phòng': 'Hải Phòng',
  'Hai Phong': 'Hải Phòng',
  'Haiphong': 'Hải Phòng',
  'Hải Dương': 'Hải Phòng',
  'Hai Duong': 'Hải Phòng',
  
  // Đà Nẵng (Đà Nẵng + Quảng Nam)
  'Đà Nẵng': 'Đà Nẵng',
  'Da Nang': 'Đà Nẵng',
  'Da Nẵng': 'Đà Nẵng',
  'Quảng Nam': 'Đà Nẵng',
  'Quàng Nam': 'Đà Nẵng', // typo có trong GeoJSON
  'Quang Nam': 'Đà Nẵng',
  
  // Cần Thơ (Cần Thơ + Hậu Giang + Sóc Trăng)
  'Cần Thơ': 'Cần Thơ',
  'Can Tho': 'Cần Thơ',
  'Can Thơ': 'Cần Thơ',
  'Hậu Giang': 'Cần Thơ',
  'Hau Giang': 'Cần Thơ',
  'Sóc Trăng': 'Cần Thơ',
  'Soc Trang': 'Cần Thơ',
  
  // Huế (nâng cấp từ Thừa Thiên Huế)
  'Huế': 'Huế',
  'Hue': 'Huế',
  'Thừa Thiên Huế': 'Huế',
  'Thua Thien Hue': 'Huế',
  
  // ===== 28 Tỉnh =====
  // --- 9 tỉnh giữ nguyên ---
  'Cao Bằng': 'Cao Bằng',
  'Cao Bang': 'Cao Bằng',
  'Điện Biên': 'Điện Biên',
  'Dien Bien': 'Điện Biên',
  'Hà Tĩnh': 'Hà Tĩnh',
  'Ha Tinh': 'Hà Tĩnh',
  'Lai Châu': 'Lai Châu',
  'Lai Chau': 'Lai Châu',
  'Lạng Sơn': 'Lạng Sơn',
  'Lang Son': 'Lạng Sơn',
  'Nghệ An': 'Nghệ An',
  'Nghe An': 'Nghệ An',
  'Quảng Ninh': 'Quảng Ninh',
  'Quang Ninh': 'Quảng Ninh',
  'Sơn La': 'Sơn La',
  'Son La': 'Sơn La',
  'Thanh Hóa': 'Thanh Hóa',
  'Thanh Hoa': 'Thanh Hóa',
  
  // --- Trung du và miền núi phía Bắc ---
  // Tuyên Quang (Hà Giang + Tuyên Quang)
  'Tuyên Quang': 'Tuyên Quang',
  'Tuyen Quang': 'Tuyên Quang',
  'Hà Giang': 'Tuyên Quang',
  'Ha Giang': 'Tuyên Quang',
  
  // Lào Cai (Yên Bái + Lào Cai)
  'Lào Cai': 'Lào Cai',
  'Lao Cai': 'Lào Cai',
  'Yên Bái': 'Lào Cai',
  'Yen Bai': 'Lào Cai',
  
  // Thái Nguyên (Bắc Kạn + Thái Nguyên)
  'Thái Nguyên': 'Thái Nguyên',
  'Thai Nguyen': 'Thái Nguyên',
  'Bắc Kạn': 'Thái Nguyên',
  'Bac Kan': 'Thái Nguyên',
  
  // Phú Thọ (Vĩnh Phúc + Hòa Bình + Phú Thọ)
  'Phú Thọ': 'Phú Thọ',
  'Phu Tho': 'Phú Thọ',
  'Hòa Bình': 'Phú Thọ',
  'Hoa Binh': 'Phú Thọ',
  'Vĩnh Phúc': 'Phú Thọ',
  'Vinh Phuc': 'Phú Thọ',
  
  // Bắc Ninh (Bắc Giang + Bắc Ninh)
  'Bắc Ninh': 'Bắc Ninh',
  'Bac Ninh': 'Bắc Ninh',
  'Bắc Giang': 'Bắc Ninh',
  'Bac Giang': 'Bắc Ninh',
  
  // --- Đồng bằng sông Hồng ---
  // Hưng Yên (Thái Bình + Hưng Yên)
  'Hưng Yên': 'Hưng Yên',
  'Hưng Yen': 'Hưng Yên',
  'Hung Yen': 'Hưng Yên',
  'Thái Bình': 'Hưng Yên',
  'Thai Binh': 'Hưng Yên',
  
  // Ninh Bình (Hà Nam + Nam Định + Ninh Bình)
  'Ninh Bình': 'Ninh Bình',
  'Ninh Binh': 'Ninh Bình',
  'Hà Nam': 'Ninh Bình',
  'Ha Nam': 'Ninh Bình',
  'Nam Định': 'Ninh Bình',
  'Nam Dinh': 'Ninh Bình',
  
  // --- Bắc Trung Bộ và Duyên hải miền Trung ---
  // Quảng Trị (Quảng Bình + Quảng Trị)
  'Quảng Trị': 'Quảng Trị',
  'Quang Tri': 'Quảng Trị',
  'Quảng Bình': 'Quảng Trị',
  'Quang Binh': 'Quảng Trị',
  
  // Quảng Ngãi (Quảng Ngãi + Kon Tum)
  'Quảng Ngãi': 'Quảng Ngãi',
  'Quang Ngai': 'Quảng Ngãi',
  'Kon Tum': 'Quảng Ngãi',
  'Kontum': 'Quảng Ngãi',
  
  // Gia Lai (Gia Lai + Bình Định)
  'Gia Lai': 'Gia Lai',
  'Bình Định': 'Gia Lai',
  'Binh Dinh': 'Gia Lai',
  
  // Khánh Hòa (Khánh Hòa + Ninh Thuận)
  'Khánh Hòa': 'Khánh Hòa',
  'Khanh Hoa': 'Khánh Hòa',
  'Ninh Thuận': 'Khánh Hòa',
  'Ninh Thuan': 'Khánh Hòa',
  
  // --- Tây Nguyên ---
  // Đắk Lắk (Đắk Lắk + Phú Yên)
  'Đắk Lắk': 'Đắk Lắk',
  'Dak Lak': 'Đắk Lắk',
  'DAKLAK': 'Đắk Lắk',
  'Phú Yên': 'Đắk Lắk',
  'Phu Yen': 'Đắk Lắk',
  
  // Lâm Đồng (Lâm Đồng + Đắk Nông + Bình Thuận)
  'Lâm Đồng': 'Lâm Đồng',
  'Lam Dong': 'Lâm Đồng',
  'Đắk Nông': 'Lâm Đồng',
  'Dak Nong': 'Lâm Đồng',
  'DAKNONG': 'Lâm Đồng',
  'Bình Thuận': 'Lâm Đồng',
  'Binh Thuan': 'Lâm Đồng',
  
  // --- Đông Nam Bộ ---
  // Đồng Nai (Đồng Nai + Bình Phước)
  'Đồng Nai': 'Đồng Nai',
  'Dong Nai': 'Đồng Nai',
  'Bình Phước': 'Đồng Nai',
  'Binh Phuoc': 'Đồng Nai',
  'Southeast': 'Đồng Nai', // GeoJSON vn-331
  
  // Tây Ninh (Long An + Tây Ninh)
  'Tây Ninh': 'Tây Ninh',
  'Tay Ninh': 'Tây Ninh',
  'Long An': 'Tây Ninh',
  
  // --- Đồng bằng sông Cửu Long ---
  // Đồng Tháp (Đồng Tháp + Tiền Giang)
  'Đồng Tháp': 'Đồng Tháp',
  'Dong Thap': 'Đồng Tháp',
  'Tiền Giang': 'Đồng Tháp',
  'Tien Giang': 'Đồng Tháp',
  
  // Vĩnh Long (Bến Tre + Vĩnh Long + Trà Vinh)
  'Vĩnh Long': 'Vĩnh Long',
  'Vinh Long': 'Vĩnh Long',
  'Bến Tre': 'Vĩnh Long',
  'Ben Tre': 'Vĩnh Long',
  'Trà Vinh': 'Vĩnh Long',
  'Tra Vinh': 'Vĩnh Long',
  
  // An Giang (An Giang + Kiên Giang)
  'An Giang': 'An Giang',
  'Kiên Giang': 'An Giang',
  'Kien Giang': 'An Giang',
  
  // Cà Mau (Cà Mau + Bạc Liêu)
  'Cà Mau': 'Cà Mau',
  'Ca Mau': 'Cà Mau',
  'Bạc Liêu': 'Cà Mau',
  'Bac Lieu': 'Cà Mau',
};

// Reverse mapping: new_province -> list of old provinces (for aggregation)
const NEW_TO_OLD_MAPPING = {};
Object.entries(PROVINCE_MERGE_MAPPING).forEach(([old, newP]) => {
  if (!NEW_TO_OLD_MAPPING[newP]) {
    NEW_TO_OLD_MAPPING[newP] = [];
  }
  NEW_TO_OLD_MAPPING[newP].push(old);
});

const CARRIER_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
  '#f97316', '#14b8a6', '#a855f7', '#6366f1', '#ef4444', '#84cc16',
  '#0284c7', '#d97706', '#c026d3', '#059669', '#dc2626', '#7c3aed',
  '#e11d48', '#0284c7', '#16a34a', '#ca8a04'
];

// High-contrast color palette for 34 provinces (optimized for adjacent regions)
const PROVINCE_GROUP_COLORS = {
  'Hà Nội': '#ef4444',           // Red
  'Thành phố Hồ Chí Minh': '#3b82f6', // Blue
  'Hải Phòng': '#10b981',          // Emerald
  'Đà Nẵng': '#f59e0b',            // Amber
  'Cần Thơ': '#8b5cf6',            // Violet
  'Huế': '#ec4899',                // Pink
  'Tuyên Quang': '#06b6d4',        // Cyan
  'Lào Cai': '#f97316',            // Orange
  'Thái Nguyên': '#14b8a6',        // Teal
  'Phú Thọ': '#a855f7',            // Purple
  'Bắc Ninh': '#6366f1',            // Indigo
  'Hưng Yên': '#84cc16',            // Lime
  'Ninh Bình': '#e11d48',            // Rose
  'Quảng Trị': '#0284c7',          // Sky blue
  'Quảng Ngãi': '#d97706',         // Amber dark
  'Gia Lai': '#059669',             // Emerald dark
  'Khánh Hòa': '#dc2626',           // Red dark
  'Đắk Lắk': '#7c3aed',            // Violet dark
  'Lâm Đồng': '#be185d',           // Pink dark
  'Đồng Nai': '#0891b2',           // Cyan dark
  'Tây Ninh': '#c2410c',           // Orange dark
  'Đồng Tháp': '#65a30d',          // Lime dark
  'Vĩnh Long': '#9333ea',           // Purple dark
  'An Giang': '#db2777',           // Pink dark
  'Cà Mau': '#4d7c0f',             // Olive
  'Cao Bằng': '#1d4ed8',           // Blue dark
  'Điện Biên': '#059669',           // Emerald dark
  'Hà Tĩnh': '#b91c1c',           // Red dark
  'Lai Châu': '#c2410c',           // Orange dark
  'Lạng Sơn': '#7c3aed',           // Violet dark
  'Nghệ An': '#0891b2',            // Cyan dark
  'Quảng Ninh': '#4d7c0f',         // Olive
  'Sơn La': '#65a30d',             // Lime dark
  'Thanh Hóa': '#9333ea',          // Purple dark
};

const fmtNum = (v) => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0));
const fmtTons = (v) => fmtNum(v) + ' Tấn';
const fmtCost = (v) => fmtNum(v) + ' ₫';

// Map SAP province names (normalized) → GeoJSON normalized key
// GeoJSON normalized keys are from: normalizeName(feature.properties.name)
const PROVINCE_ALIASES = {
  // HCM variants
  'HOCHIMINHCITY': 'HOCHIMINH',
  'TPHCM': 'HOCHIMINH',
  'TPHOCHIMINH': 'HOCHIMINH',
  'HCM': 'HOCHIMINH',
  'HCMCITY': 'HOCHIMINH',
  // Hue — GeoJSON key is HUE (not THUATHIENHUE)
  'THUATHIENHUE': 'HUE',
  'THUA THIEN HUE': 'HUE',
  'THUATHIENHUECITY': 'HUE',
  // Southeast region in GeoJSON is vn-331, maps to Dong Nai area
  'SOUTHEAST': 'DONGNAI',  // Map Southeast to Dong Nai
  // Hanoi
  'HANOI': 'HANOI',
  'HANOICITY': 'HANOI',
  // Hai Phong
  'HAIPHONG': 'HAIPHONG',
  // Da Nang
  'DANANG': 'DANANG',
  'DANANGCITY': 'DANANG',
  // Can Tho
  'CANTHO': 'CANTHO',
  'CANTHOCITY': 'CANTHO',
  // Dak Lak variants
  'DAKLAK': 'DAKLAK',
  'DACLAK': 'DAKLAK',
  'DAKLAC': 'DAKLAK',
  // Dak Nong
  'DAKNONG': 'DAKNONG',
  'DACNONG': 'DAKNONG',
  'DAK NONG': 'DAKNONG',
  'DĂK NÔNG': 'DAKNONG',
  'ĐĂK NÔNG': 'DAKNONG',
  // Quang Nam (typo in GeoJSON: 'Quàng Nam')
  'QUANGNAM': 'QUANGNAM',
  // Bac Lieu
  'BACLIEU': 'BACLIEU',
  'BACLIE': 'BACLIEU',
  // Ba Ria - Vung Tau
  'BARIAVUNGTAU': 'BARIAVUNGTAU',
  'VUNGTAU': 'BARIAVUNGTAU',
  'BARIA': 'BARIAVUNGTAU',
  // Binh Duong
  'BINHDUONG': 'BINHDUONG',
  // Dong Nai
  'DONGNAI': 'DONGNAI',
  // Phu Yen variants
  'PHUYEN': 'PHUYEN',
  'PHU YEN': 'PHUYEN',
  // Tien Giang variants
  'TIENGIANG': 'TIENGIANG',
  'TIEN GIANG': 'TIENGIANG',
};

// Normalize province names for fuzzy matching between SAP data and GeoJSON
const normalizeName = (text) => {
  if (!text) return '';
  let str = text.toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/^(TINH|TP\.?|THANH PHO|TT\.?|CITY|THANHPHO)[\s\.]*/i, '')
    .replace(/[\s\.]*CITY$/i, '')
    .replace(/[^A-Z0-9]/g, '');
  return PROVINCE_ALIASES[str] || str;
};

// Add normalized versions to NEW_TO_OLD_MAPPING
Object.keys(NEW_TO_OLD_MAPPING).forEach(newP => {
  const norm = normalizeName(newP);
  if (norm !== newP) {
    NEW_TO_OLD_MAPPING[norm] = NEW_TO_OLD_MAPPING[newP];
  }
});

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
    api.get(`/api/carrier-routes/${fileId}`, { params: { carrier_name: carrier, group_by: groupBy, ...filters } })
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
  const [hoveredKey, setHoveredKey] = useState(null);

  const provincesData = useMemo(() => {
    const rawProvinces = data?.provinces || [];
    
    // Aggregate data by new province names (34 provinces)
    const aggregated = {};
    
    rawProvinces.forEach(p => {
      const oldName = p.province;
      // Normalize old name for matching
      const oldNorm = normalizeName(oldName);
      
      // Try to find mapping by normalized name
      let newName = oldName;
      for (const [old, newP] of Object.entries(PROVINCE_MERGE_MAPPING)) {
        if (normalizeName(old) === oldNorm) {
          newName = newP;
          break;
        }
      }
      
      if (!aggregated[newName]) {
        aggregated[newName] = {
          province: newName,
          total_tons: 0,
          total_cost: 0,
          shipments: 0,
          carriers: {}
        };
      }
      
      // Aggregate metrics
      aggregated[newName].total_tons += (p.total_tons || 0);
      aggregated[newName].total_cost += (p.total_cost || 0);
      aggregated[newName].shipments += (p.shipments || 0);
      
      // Aggregate carriers
      if (p.carriers) {
        Object.entries(p.carriers).forEach(([carrier, tons]) => {
          if (!aggregated[newName].carriers[carrier]) {
            aggregated[newName].carriers[carrier] = 0;
          }
          aggregated[newName].carriers[carrier] += tons;
        });
      }
    });
    
    return Object.values(aggregated);
  }, [data]);
  const topCarriers = useMemo(() => data?.top_carriers || [], [data]);

  const carrierColorMap = useMemo(() => {
    const map = {};
    topCarriers.forEach((cName, idx) => {
      if (CARRIER_COLORS[idx]) {
        map[cName] = CARRIER_COLORS[idx];
      } else {
        const hue = (idx * 137.5) % 360;
        map[cName] = `hsl(${hue}, 70%, 55%)`;
      }
    });
    map['Khác'] = '#64748b';
    return map;
  }, [topCarriers]);

  const provinceLookupMap = useMemo(() => {
    const map = new Map();
    provincesData.forEach(p => {
      const norm = normalizeName(p.province);
      if (norm) map.set(norm, p);
      // Also store original name as fallback
      const origNorm = p.province?.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (origNorm && origNorm !== norm) map.set(origNorm, p);
      
      // Debug: log if province name contains Đắk Nông variants
      if (p.province.toLowerCase().includes('đak') || p.province.toLowerCase().includes('dak')) {
        console.log('🔍 Found Đắk Nông variant in data:', p.province, '→ normalized:', norm);
      }
    });
    return map;
  }, [provincesData]);

  const getProvinceInfo = useCallback((geoProperties) => {
    // Try matching by normalized name from multiple GeoJSON properties
    const candidates = [
      geoProperties.name,
      geoProperties['woe-name'],
      geoProperties.NAME_1,
      geoProperties.VARNAME_1
    ].filter(Boolean);

    for (const candidate of candidates) {
      const norm = normalizeName(candidate);
      if (provinceLookupMap.has(norm)) return provinceLookupMap.get(norm);
      
      // Also try mapping old province name to new province name
      const mappedName = PROVINCE_MERGE_MAPPING[candidate];
      if (mappedName) {
        const mappedNorm = normalizeName(mappedName);
        if (provinceLookupMap.has(mappedNorm)) return provinceLookupMap.get(mappedNorm);
      }
    }
    return null;
  }, [provinceLookupMap]);

  // Audit province matching on data update
  useEffect(() => {
    if (provincesData.length > 0) {
      console.log('🗺️ [VietnamMapChart] Auditing Province Name Matching (34 provinces 2025)...');
      console.log('📌 Provinces in Aggregated Data:', provincesData.map(p => p.province));
      console.log('📌 Normalized Provinces:', provincesData.map(p => normalizeName(p.province)));

      fetch(GEO_URL)
        .then(res => res.json())
        .then(geo => {
          const geoNames = geo.features.map(f => f.properties.name);
          console.log('🗺️ Provinces in GeoJSON (63 old features):', geoNames);

          const geoNormSet = new Set(geoNames.map(g => normalizeName(g)));
          
          // Check if aggregated provinces can be matched via old province names
          const unmatched = provincesData.filter(p => {
            const norm = normalizeName(p.province);
            // Direct match
            if (geoNormSet.has(norm)) return false;
            
            // Check if any old province mapping to this new province exists in GeoJSON
            const oldProvinces = NEW_TO_OLD_MAPPING[p.province] || [];
            console.log(`🔍 Checking ${p.province}: old provinces = ${oldProvinces}`);
            const hasOldMatch = oldProvinces.some(old => geoNormSet.has(normalizeName(old)));
            console.log(`   Has old match: ${hasOldMatch}`);
            return !hasOldMatch;
          });

          if (unmatched.length > 0) {
            console.warn('⚠️ Unmatched Provinces between Data & GeoJSON:', unmatched.map(u => u.province));
          } else {
            console.log('✅ 100% Data Provinces matched with GeoJSON Features (via old province mapping)!');
          }
        })
        .catch(err => console.error('Failed to audit GeoJSON:', err));
    }
  }, [provincesData]);

  const getGeoFillColor = (pInfo) => {
    // No data for this province
    if (!pInfo || pInfo.total_tons === 0) return isDark ? '#1e3a5f' : '#dde8f5';
    
    // Use province group color based on merged province name
    const provinceName = pInfo.province;
    return PROVINCE_GROUP_COLORS[provinceName] || (isDark ? '#1e3a5f' : '#dde8f5');
  };

  const getGeoOpacity = (pInfo) => {
    if (selectedCarrier === 'ALL') return 1.0;
    if (!pInfo || !pInfo.carriers?.[selectedCarrier]) return 0.35;
    return 1.0;
  };

  // Count matched provinces for debug
  const [matchedCount, setMatchedCount] = useState(null);
  useEffect(() => {
    if (provincesData.length === 0) { setMatchedCount(null); return; }
    fetch(GEO_URL)
      .then(r => r.json())
      .then(geo => {
        const geoNormSet = new Set(geo.features.flatMap(f => [
          normalizeName(f.properties.name),
          normalizeName(f.properties['woe-name'] || '')
        ].filter(Boolean)));
        
        const matched = provincesData.filter(p => {
          const norm = normalizeName(p.province);
          // Direct match
          if (geoNormSet.has(norm)) return true;
          
          // Check via old province mapping
          const oldProvinces = NEW_TO_OLD_MAPPING[p.province] || [];
          return oldProvinces.some(old => geoNormSet.has(normalizeName(old)));
        }).length;
        
        setMatchedCount({ matched, total: provincesData.length });
        
        const unmatched = provincesData.filter(p => {
          const norm = normalizeName(p.province);
          if (geoNormSet.has(norm)) return false;
          const oldProvinces = NEW_TO_OLD_MAPPING[p.province] || [];
          return !oldProvinces.some(old => geoNormSet.has(normalizeName(old)));
        });
        
        if (unmatched.length > 0) {
          console.warn('⚠️ Unmatched provinces:', unmatched.map(u => `${u.province} -> ${normalizeName(u.province)}`));
        } else {
          console.log('✅ All provinces matched!');
        }
      })
      .catch(() => {});
  }, [provincesData]);

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
              Bản Đồ Phủ Tuyến 34 Tỉnh Thành Việt Nam (2025)
            </h3>
          </div>
          <p className={`text-xs mt-1 ${muted}`}>
            Dữ liệu đã gom theo 34 tỉnh/thành sau reform 2025 — Tô màu theo NVC chính
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
          style={{ backgroundColor: isDark ? '#0f2744' : '#e8f0fb', borderColor: isDark ? '#1e40af' : '#93c5fd' }}
        >
          {/* Debug badge */}
          {matchedCount && (
            <div className={`absolute top-2 left-2 z-10 px-2 py-1 rounded-lg text-[10px] font-bold ${
              matchedCount.matched === matchedCount.total
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              ✓ {matchedCount.matched}/{matchedCount.total} tỉnh khớp bản đồ
            </div>
          )}
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [107.5, 16.2], scale: 2400 }}
            style={{ width: '100%', height: '520px' }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const pInfo = getProvinceInfo(geo.properties);
                  const isHovered = hoveredKey === geo.rsmKey;
                  const fillColor = isHovered ? '#f59e0b' : getGeoFillColor(pInfo);
                  const opacity = isHovered ? 1 : getGeoOpacity(pInfo);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fillColor}
                      fillOpacity={opacity}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 2.5 : 1.2}
                      onMouseEnter={() => setHoveredKey(geo.rsmKey)}
                      onMouseMove={evt => {
                        const rect = evt.currentTarget.closest('svg').getBoundingClientRect();
                        const relX = evt.clientX - rect.left;
                        const relY = evt.clientY - rect.top;
                        const topY = relY > 340 ? relY - 140 : relY + 15;
                        const leftX = relX > 350 ? relX - 210 : relX + 15;
                        setTooltipPos({ x: leftX, y: topY });
                        setTooltipContent({ name: geo.properties.name || geo.properties['woe-name'] || '?', info: pInfo });
                      }}
                      onMouseLeave={() => {
                        setHoveredKey(null);
                        setTooltipContent(null);
                      }}
                      style={{ outline: 'none', cursor: 'pointer', transition: 'fill 160ms, fill-opacity 160ms' }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {/* Hover Tooltip - very low z-index with offset to avoid covering map */}
          {tooltipContent && (
            <div
              className="absolute z-0 p-3.5 rounded-xl shadow-2xl border text-xs pointer-events-none min-w-[200px] max-w-[260px]"
              style={{
                left: `${tooltipPos.x + 20}px`,
                top: `${tooltipPos.y + 20}px`,
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

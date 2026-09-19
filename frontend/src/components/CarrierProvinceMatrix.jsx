import React from 'react';
import { Grid } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const CarrierProvinceMatrix = ({ data }) => {
  const { isDark } = useTheme();

  if (!data || !data.carriers || data.carriers.length === 0 || !data.provinces || data.provinces.length === 0) {
    return (
      <div className={`border rounded-2xl p-6 text-center ${
        isDark ? 'bg-slate-900/60 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'
      }`}>
        Chưa có dữ liệu ma trận Phủ địa lý (Carrier × Province).
      </div>
    );
  }

  const { carriers, provinces, matrix } = data;
  const [carrierFilter, setCarrierFilter] = React.useState('');
  const [provinceFilter, setProvinceFilter] = React.useState('');
  const [sortProv, setSortProv] = React.useState(null); // sort matrix rows by specific province tonnage
  const [sortAsc, setSortAsc] = React.useState(false);

  // Filtered provinces columns
  const filteredProvinces = React.useMemo(() => {
    if (!provinceFilter) return provinces;
    return provinces.filter(p => p.toLowerCase().includes(provinceFilter.toLowerCase()));
  }, [provinces, provinceFilter]);

  // Filtered & Sorted matrix rows
  const filteredMatrix = React.useMemo(() => {
    let rows = matrix.filter(r => {
      if (carrierFilter && !(r.carrier_name || '').toLowerCase().includes(carrierFilter.toLowerCase())) return false;
      return true;
    });

    if (sortProv) {
      rows.sort((a, b) => {
        const av = a[sortProv] || 0;
        const bv = b[sortProv] || 0;
        return sortAsc ? av - bv : bv - av;
      });
    }

    return rows;
  }, [matrix, carrierFilter, sortProv, sortAsc]);

  const handleHeaderClick = (prov) => {
    if (sortProv === prov) {
      setSortAsc(v => !v);
    } else {
      setSortProv(prov);
      setSortAsc(false);
    }
  };

  let maxVal = 0;
  matrix.forEach(row => {
    provinces.forEach(prov => {
      const val = row[prov] || 0;
      if (val > maxVal) maxVal = val;
    });
  });

  const getHeatBg = (val) => {
    if (!val || val === 0) return isDark ? 'bg-slate-950/40 text-slate-600' : 'bg-slate-100 text-slate-400';
    const ratio = val / (maxVal || 1);
    if (ratio > 0.6) return 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/30';
    if (ratio > 0.3) return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold shadow-sm';
    if (ratio > 0.1) return isDark ? 'bg-blue-500/30 text-blue-200 font-semibold' : 'bg-blue-100 text-blue-800 font-medium';
    return isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700';
  };

  const formatTons = (val) => val > 0 ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(val) : '-';
  const inputBg = isDark ? 'bg-slate-950/80 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400';

  return (
    <div className={`border rounded-2xl p-5 shadow-xl flex flex-col h-fit self-start transition-colors duration-200 ${
      isDark ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
    }`}>
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Ma Trận Nhà Vận Chuyển × Khu Vực</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Heatmap sản lượng (Tấn) — Click tiêu đề cột để sắp xếp</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-600" /> Cao</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500/30" /> Thấp</span>
        </div>
      </div>

      {/* Heatmap Matrix Table */}
      <div className="overflow-x-auto max-h-[420px]">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className={`sticky left-0 top-0 z-20 p-2.5 text-left font-bold border-b border-r ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}>
                NVC / Tỉnh
              </th>
              {filteredProvinces.map((prov) => (
                <th key={prov}
                  onClick={() => handleHeaderClick(prov)}
                  className={`sticky top-0 z-10 p-2.5 text-center font-semibold border-b whitespace-nowrap cursor-pointer hover:text-blue-400 transition ${
                  isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  {prov} {sortProv === prov ? (sortAsc ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
            {/* Filter Row */}
            <tr className={isDark ? 'bg-slate-950/80' : 'bg-slate-50'}>
              <th className={`sticky left-0 z-20 p-1.5 border-r ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                <input
                  type="text"
                  placeholder="Lọc NVC..."
                  value={carrierFilter}
                  onChange={e => setCarrierFilter(e.target.value)}
                  className={`w-full px-2 py-1 text-[11px] rounded border font-normal ${inputBg}`}
                />
              </th>
              <th colSpan={filteredProvinces.length} className="p-1.5 text-left border-b border-slate-700/30">
                <input
                  type="text"
                  placeholder="Lọc tên tỉnh..."
                  value={provinceFilter}
                  onChange={e => setProvinceFilter(e.target.value)}
                  className={`w-40 px-2 py-1 text-[11px] rounded border font-normal ${inputBg}`}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMatrix.map((row) => (
              <tr key={row.carrier_name}>
                <td className={`sticky left-0 z-10 p-2.5 font-bold whitespace-nowrap border-r ${
                  isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  {row.carrier_name}
                </td>
                {filteredProvinces.map((prov) => {
                  const val = row[prov] || 0;
                  return (
                    <td
                      key={prov}
                      className={`p-2.5 text-center transition ${getHeatBg(val)} border-b ${
                        isDark ? 'border-slate-800/40' : 'border-slate-100'
                      }`}
                      title={`${row.carrier_name} → ${prov}: ${formatTons(val)} Tấn`}
                    >
                      {formatTons(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default CarrierProvinceMatrix;

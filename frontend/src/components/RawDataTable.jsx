import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import api from '../api/client';
import { useTheme } from '../context/ThemeContext';

const RawDataTable = ({ activeFileId, filters }) => {
  const { isDark } = useTheme();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('plan_issue_date');
  const [sortOrder, setSortOrder] = useState('desc');

  const [columnFilters, setColumnFilters] = useState({
    plan_issue_date: '',
    carrier_name: '',
    shipment_number: '',
    province: '',
    ship_to_name: '',
    delivery_type: ''
  });

  const handleColumnFilterChange = (col, value) => {
    setColumnFilters(prev => ({ ...prev, [col]: value }));
  };

  useEffect(() => {
    if (!activeFileId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/table/${activeFileId}`, {
          params: {
            page,
            page_size: pageSize,
            sort_by: sortBy,
            sort_order: sortOrder,
            search,
            ...filters
          }
        });
        setData(res.data.records);
        setTotalPages(res.data.total_pages);
        setTotalRecords(res.data.total);
      } catch (err) {
        console.error('Failed to load table data:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 250);
    return () => clearTimeout(timer);
  }, [activeFileId, page, pageSize, sortBy, sortOrder, search, filters]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatNumber = (val) => new Intl.NumberFormat('vi-VN').format(val || 0);

  // Client-side column-filtered data
  const filteredData = React.useMemo(() => {
    return data.filter(row => {
      if (columnFilters.plan_issue_date && !(row.plan_issue_date || '').toLowerCase().includes(columnFilters.plan_issue_date.toLowerCase())) return false;
      if (columnFilters.carrier_name && !(row.carrier_name || '').toLowerCase().includes(columnFilters.carrier_name.toLowerCase())) return false;
      if (columnFilters.shipment_number && !(row.shipment_number || '').toLowerCase().includes(columnFilters.shipment_number.toLowerCase())) return false;
      if (columnFilters.province && !(row.province || '').toLowerCase().includes(columnFilters.province.toLowerCase())) return false;
      if (columnFilters.ship_to_name && !(row.ship_to_name || '').toLowerCase().includes(columnFilters.ship_to_name.toLowerCase())) return false;
      if (columnFilters.delivery_type && !(row.delivery_type || '').toLowerCase().includes(columnFilters.delivery_type.toLowerCase())) return false;
      return true;
    });
  }, [data, columnFilters]);

  const inputBg = isDark ? 'bg-slate-950/80 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400';

  return (
    <div className={`border rounded-2xl p-5 shadow-xl space-y-4 transition-colors duration-200 ${
      isDark ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
    }`}>
      
      {/* Search & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold">Bảng Chi Tiết Dữ Liệu Vận Chuyển</h3>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tổng cộng {formatNumber(totalRecords)} bản ghi</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Tìm NVC, Tỉnh, Số lô..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={`pl-9 pr-4 py-1.5 text-xs rounded-xl border outline-none transition w-56 ${
                isDark ? 'bg-slate-950/60 border-slate-800 text-slate-200 focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-blue-500'
              }`}
            />
          </div>

          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className={`px-3 py-1.5 text-xs rounded-xl border outline-none transition ${
              isDark ? 'bg-slate-950/60 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
            }`}
          >
            <option value={15}>15 dòng/trang</option>
            <option value={30}>30 dòng/trang</option>
            <option value={50}>50 dòng/trang</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700/30">
        <table className="w-full text-xs text-left">
          <thead className={`text-[11px] uppercase font-bold border-b ${
            isDark ? 'bg-slate-950/60 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            <tr>
              <th className="p-3">#</th>
              <th onClick={() => handleSort('plan_issue_date')} className="p-3 cursor-pointer hover:text-blue-500 transition">
                <span className="flex items-center gap-1">Ngày Kế Hoạch <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('carrier_name')} className="p-3 cursor-pointer hover:text-blue-500 transition">
                <span className="flex items-center gap-1">Nhà Vận Chuyển <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('shipment_number')} className="p-3 cursor-pointer hover:text-blue-500 transition">
                <span className="flex items-center gap-1">Số Lô (Shipment) <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('province')} className="p-3 cursor-pointer hover:text-blue-500 transition">
                <span className="flex items-center gap-1">Tỉnh Thành <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('ship_to_name')} className="p-3 cursor-pointer hover:text-blue-500 transition">
                <span className="flex items-center gap-1">Điểm Giao <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('delivery_type')} className="p-3 text-right cursor-pointer hover:text-blue-500 transition">
                <span className="flex items-center justify-end gap-1">Loại Giao <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('tons')} className="p-3 text-right cursor-pointer hover:text-blue-500 transition">
                <span className="flex items-center justify-end gap-1">Số Tấn <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th onClick={() => handleSort('total_amount')} className="p-3 text-right cursor-pointer hover:text-blue-500 transition">
                <span className="flex items-center justify-end gap-1">Tổng Cước (VNĐ) <ArrowUpDown className="w-3 h-3" /></span>
              </th>
            </tr>
            {/* Column Filter Row */}
            <tr className={isDark ? 'bg-slate-950/40' : 'bg-slate-50'}>
              <th className="p-1.5"></th>
              <th className="p-1.5">
                <input
                  type="text"
                  placeholder="Lọc ngày..."
                  value={columnFilters.plan_issue_date}
                  onChange={e => handleColumnFilterChange('plan_issue_date', e.target.value)}
                  className={`w-full px-2 py-0.5 text-[11px] rounded border font-normal ${inputBg}`}
                />
              </th>
              <th className="p-1.5">
                <input
                  type="text"
                  placeholder="Lọc NVC..."
                  value={columnFilters.carrier_name}
                  onChange={e => handleColumnFilterChange('carrier_name', e.target.value)}
                  className={`w-full px-2 py-0.5 text-[11px] rounded border font-normal ${inputBg}`}
                />
              </th>
              <th className="p-1.5">
                <input
                  type="text"
                  placeholder="Lọc số lô..."
                  value={columnFilters.shipment_number}
                  onChange={e => handleColumnFilterChange('shipment_number', e.target.value)}
                  className={`w-full px-2 py-0.5 text-[11px] rounded border font-normal ${inputBg}`}
                />
              </th>
              <th className="p-1.5">
                <input
                  type="text"
                  placeholder="Lọc tỉnh..."
                  value={columnFilters.province}
                  onChange={e => handleColumnFilterChange('province', e.target.value)}
                  className={`w-full px-2 py-0.5 text-[11px] rounded border font-normal ${inputBg}`}
                />
              </th>
              <th className="p-1.5">
                <input
                  type="text"
                  placeholder="Lọc điểm giao..."
                  value={columnFilters.ship_to_name}
                  onChange={e => handleColumnFilterChange('ship_to_name', e.target.value)}
                  className={`w-full px-2 py-0.5 text-[11px] rounded border font-normal ${inputBg}`}
                />
              </th>
              <th className="p-1.5">
                <input
                  type="text"
                  placeholder="Lọc loại..."
                  value={columnFilters.delivery_type}
                  onChange={e => handleColumnFilterChange('delivery_type', e.target.value)}
                  className={`w-full px-2 py-0.5 text-[11px] rounded border font-normal text-right ${inputBg}`}
                />
              </th>
              <th className="p-1.5"></th>
              <th className="p-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400 animate-pulse">
                  Đang tải dữ liệu bảng...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  Không tìm thấy bản ghi phù hợp.
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr
                  key={idx}
                  className={`transition ${
                    row.is_return
                      ? 'bg-rose-500/10 text-rose-500 font-medium'
                      : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="p-3 font-mono opacity-60">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="p-3 font-mono">{row.plan_issue_date || '-'}</td>
                  <td className="p-3 font-bold">{row.carrier_name}</td>
                  <td className="p-3 font-mono text-blue-500 font-semibold">{row.shipment_number}</td>
                  <td className="p-3 font-medium text-amber-500">{row.province}</td>
                  <td className="p-3 max-w-[180px] truncate" title={row.ship_to_name}>{row.ship_to_name}</td>
                  <td className="p-3 text-right font-mono text-purple-500">{row.delivery_type}</td>
                  <td className="p-3 text-right font-bold text-blue-500">{formatNumber(row.tons)}</td>
                  <td className="p-3 text-right font-bold text-emerald-500">{formatNumber(row.total_amount)} ₫</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className={`flex items-center justify-between text-xs pt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        <span>Trang {page} / {totalPages || 1}</span>
        <div className="flex items-center gap-1.5">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className={`p-1.5 disabled:opacity-40 rounded-lg transition ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className={`p-1.5 disabled:opacity-40 rounded-lg transition ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};

export default RawDataTable;

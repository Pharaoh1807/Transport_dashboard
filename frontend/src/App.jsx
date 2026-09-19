import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import KPICards from './components/KPICards';
import CarrierRankingChart from './components/CarrierRankingChart';
import CarrierProvinceMatrix from './components/CarrierProvinceMatrix';
import ProvinceDistributionChart from './components/ProvinceDistributionChart';
import MonthlyTrendChart from './components/MonthlyTrendChart';
import CostBreakdownChart from './components/CostBreakdownChart';
import VietnamMapChart from './components/VietnamMapChart';
import RawDataTable from './components/RawDataTable';
import FileUploadModal from './components/FileUploadModal';
import AdminModal from './components/AdminModal';
import LoginModal from './components/LoginModal';
import CarrierRoutePanel from './components/CarrierRoutePanel';
import api from './api/client';
import { Upload, RefreshCw, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [activeFile, setActiveFile] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Filters state
  const [filters, setFilters] = useState({
    carrier: [],
    province: [],
    delivery_type: [],
    years: [],
    months: [],
    exclude_return: true
  });
  const [filterOptions, setFilterOptions] = useState({});

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Carrier Route Analysis panel
  const [selectedCarrier, setSelectedCarrier] = useState(null);

  // Fetch cascading filter options
  const fetchFilterOptions = async (fileId, currentFilters) => {
    try {
      const res = await api.get(`/filters/${fileId}`, { params: currentFilters });
      setFilterOptions(res.data);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  // Fetch Dashboard KPIs & Charts
  const fetchDashboardData = async (fileId, currentFilters) => {
    setLoading(true);
    try {
      const res = await api.get(`/dashboard/${fileId}`, { params: currentFilters });
      setDashboardData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeFile?.file_id) return;
    fetchDashboardData(activeFile.file_id, filters);
    fetchFilterOptions(activeFile.file_id, filters);
  }, [activeFile?.file_id, filters]);

  const handleUploadSuccess = (fileData) => {
    setActiveFile(fileData);
    setIsUploadOpen(false);
    setFilters({
      carrier: [],
      province: [],
      delivery_type: [],
      years: [],
      months: [],
      exclude_return: true
    });
  };

  const handleDeleteFile = async () => {
    if (!activeFile?.file_id) return;
    const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu file "${activeFile.filename}" khỏi hệ thống không? Dữ liệu cũ sẽ bị xóa hoàn toàn khỏi database.`);
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await api.delete(`/file/${activeFile.file_id}`);
      setActiveFile(null);
      setDashboardData(null);
      setFilterOptions({});
      setFilters({
        carrier: [],
        province: [],
        delivery_type: [],
        years: [],
        months: [],
        exclude_return: true
      });
      setIsUploadOpen(true);
    } catch (err) {
      console.error('Lỗi khi xóa file:', err);
      alert('Không thể xóa file: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangeFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      carrier: [],
      province: [],
      delivery_type: [],
      years: [],
      months: [],
      exclude_return: true
    });
  };

  const handleExport = async () => {
    if (!activeFile?.file_id) return;
    setIsExporting(true);
    try {
      const response = await api.get(`/export/${activeFile.file_id}`, {
        params: filters,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TransportData_Export_${activeFile.filename}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!user) {
    return <LoginModal />;
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isDark ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-100 text-slate-800'
    }`}>
      <Navbar
        activeFile={activeFile}
        onOpenUpload={() => setIsUploadOpen(true)}
        onExport={handleExport}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onDeleteFile={handleDeleteFile}
        isExporting={isExporting}
        isDeleting={isDeleting}
      />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar Filter */}
        <Sidebar
          filterOptions={filterOptions}
          filters={filters}
          onChangeFilter={handleChangeFilter}
          onResetFilters={handleResetFilters}
          isLoading={loading}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto">
          
          {!activeFile ? (
            <div className={`flex flex-col items-center justify-center min-h-[60vh] border rounded-3xl p-8 text-center ${
              isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-md'
            }`}>
              <div className="p-5 bg-blue-500/10 text-blue-500 rounded-3xl mb-4">
                <Upload className="w-12 h-12" />
              </div>
              <h2 className="text-xl font-extrabold">Chưa có dữ liệu SAP được chọn</h2>
              <p className={`text-sm max-w-md mt-1 mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Vui lòng upload file Excel xuất từ SAP (`datavc.xlsx`) để bắt đầu phân tích sản lượng, cước phí và nhà vận chuyển.
              </p>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition active:scale-95"
              >
                Upload File Excel SAP
              </button>
            </div>
          ) : (
            <>
              {/* Row 1: KPI Cards */}
              <KPICards kpis={dashboardData?.kpis} />

              {/* Row 2: Top Carrier Rankings & Carrier x Province Pivot Heatmap */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                <CarrierRankingChart
                  data={dashboardData?.charts?.carrierRanking}
                  onCarrierClick={(carrierName) => setSelectedCarrier(carrierName)}
                />
                <CarrierProvinceMatrix data={dashboardData?.charts?.carrierProvinceMatrix} />
              </div>

              {/* Row 3: Regional Distribution, Volume Trend, Cost Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ProvinceDistributionChart data={dashboardData?.charts?.provinceDistribution} />
                <MonthlyTrendChart data={dashboardData?.charts?.monthlyTrend} />
                <CostBreakdownChart data={dashboardData?.charts?.costBreakdown} />
              </div>

              {/* Row 4: Vietnam Map Analytics (Bản đồ GeoJSON 63 Tỉnh Thành ở cuối trang) */}
              <VietnamMapChart
                data={dashboardData?.charts?.vietnamMap}
                activeFileId={activeFile?.file_id}
                filters={filters}
              />
            </>
          )}

        </main>
      </div>

      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />

      {/* Carrier Route Analysis Drawer */}
      {selectedCarrier && activeFile?.file_id && (
        <CarrierRoutePanel
          carrier={selectedCarrier}
          fileId={activeFile.file_id}
          filters={filters}
          onClose={() => setSelectedCarrier(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;

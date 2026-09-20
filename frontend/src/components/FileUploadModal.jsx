import React, { useState, useEffect } from 'react';
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../api/client';

const FileUploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(''); // Add status message

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setLoading(false);
      setError('');
      setUploadResult(null);
      setSelectedSheet('');
      setUploadProgress(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.xlsx') || dropped.name.endsWith('.xls'))) {
      setFile(dropped);
      setError('');
    } else {
      setError('Vui lòng chọn file Excel đúng định dạng (.xlsx, .xls)');
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setUploadProgress(0);
    setError('');
    setUploadStatus('');

    const formData = new FormData();
    formData.append('file', file);

    // Show status for large files
    if (file.size > 5 * 1024 * 1024) {
      setUploadStatus('Đang xử lý file theo chunk... (có thể mất 1-2 phút)');
    }

    try {
      const res = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
        timeout: 600000 // 10 minutes timeout for large files
      });
      setUploadResult(res.data);
      setSelectedSheet(res.data.selected_sheet);
      onUploadSuccess(res.data);
    } catch (err) {
      let errorMessage = 'Lỗi xử lý file Excel SAP.';

      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Timeout: Server quá tải hoặc file quá lớn. Vui lòng thử lại hoặc chia nhỏ file.';
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.';
      } else if (err.response?.status === 413) {
        errorMessage = 'File quá lớn. Vui lòng chia nhỏ file hoặc sử dụng file dưới 100MB.';
      } else if (err.response?.status === 502) {
        errorMessage = 'Server quá tải. Vui lòng thử lại sau hoặc sử dụng file nhỏ hơn.';
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSheetSelect = async (sheetName) => {
    if (!uploadResult) return;
    setSelectedSheet(sheetName);
    setLoading(true);
    try {
      const res = await api.post(`/api/select-sheet/${uploadResult.file_id}?sheet_name=${encodeURIComponent(sheetName)}`);
      onUploadSuccess({ ...uploadResult, ...res.data });
    } catch (err) {
      setError(err.response?.data?.detail || 'Lỗi khi chuyển đổi sheet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Upload Dữ Liệu Vận Chuyển SAP</h3>
            <p className="text-xs text-slate-400">Đọc tự động header dòng 5 & số serial date • Hỗ trợ file lên đến 100MB</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!uploadResult ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => document.getElementById('excel-file-input')?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 bg-slate-950/50 hover:bg-slate-900/40 rounded-2xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3"
          >
            <FileSpreadsheet className="w-10 h-10 text-slate-500" />
            <div>
              <p className="text-xs font-semibold text-slate-200">Kéo thả file `datavc.xlsx` vào đây</p>
              <p className="text-[11px] text-slate-500">hoặc click vào đây để chọn file từ máy tính</p>
            </div>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-file-input"
            />
            <span
              className="mt-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
            >
              Duyệt file...
            </span>
            {file && (
              <div className="mt-2 text-center w-full">
                <p className="text-xs text-blue-400 font-medium truncate max-w-[280px] mx-auto">
                  {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
                {loading && (
                  <div className="mt-3 w-full bg-slate-800 rounded-full h-2 overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                {loading && (
                  <p className="text-[11px] text-slate-400 mt-1.5 animate-pulse">
                    {uploadProgress < 100
                      ? `Đang tải file lên server: ${uploadProgress}%`
                      : uploadStatus || `Đang đọc dữ liệu Excel bằng engine Calamine siêu tốc...`}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Đã tải file thành công! ({uploadResult.row_count} dòng)</span>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Chọn Sheet để phân tích:</label>
              <select
                value={selectedSheet}
                onChange={(e) => handleSheetSelect(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-200 outline-none"
              >
                {(uploadResult.sheet_names || []).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
          >
            Đóng
          </button>

          {!uploadResult && (
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Tải Lên & Xử Lý</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default FileUploadModal;

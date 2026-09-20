import React, { useState, useEffect } from 'react';
import { X, Shield, Check, UserX, KeyRound, Trash2 } from 'lucide-react';
import api from '../api/client';

const AdminModal = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchUsers();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApprove = async (userId, isApproved) => {
    try {
      await api.post('/api/admin/approve-user', { user_id: userId, is_approved: isApproved });
      setMessage('Đã cập nhật trạng thái người dùng.');
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return;
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setMessage('Đã xóa người dùng.');
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Quản Trị Người Dùng & Phê Duyệt Tài Khoản</h3>
            <p className="text-xs text-slate-400">Duyệt tài khoản mới đăng ký & phân quyền</p>
          </div>
        </div>

        {message && (
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-xl mb-3">
            {message}
          </div>
        )}

        {/* User list table */}
        <div className="overflow-y-auto flex-1 border border-slate-800 rounded-2xl">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
              <tr>
                <th className="p-3">Họ và tên</th>
                <th className="p-3">Email</th>
                <th className="p-3">Quyền</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">Đang tải danh sách...</td>
                </tr>
              ) : users.map(u => (
                <tr key={u._id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-slate-200">{u.full_name}</td>
                  <td className="p-3 text-slate-400">{u.email}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3">
                    {u.is_approved ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đã duyệt
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <UserX className="w-3.5 h-3.5" /> Chờ duyệt
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {!u.is_approved ? (
                      <button
                        onClick={() => handleApprove(u._id, true)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-medium transition"
                      >
                        Phê duyệt
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprove(u._id, false)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition"
                      >
                        Khóa
                      </button>
                    )}
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => handleDelete(u._id)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default AdminModal;

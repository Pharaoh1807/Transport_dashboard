import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://transport-dashboard-9mf7.onrender.com',
  timeout: 300000, // 5 minutes timeout for large files (100MB+)
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Only clear + reload if it's not the login call itself (avoid infinite loop)
      if (!error.config?.url?.includes('/auth/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Reload root — React will show LoginModal since user is null
        window.location.replace('/');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

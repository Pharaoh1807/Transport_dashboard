# Hướng dẫn Deployment

## Tổng quan
- **Backend**: Deploy lên Render (FastAPI + MongoDB/SQLite)
- **Frontend**: Deploy lên GitHub Pages (React + Vite)

---

## 1. Backend Deployment (Render)

### 1.1 Chuẩn bị MongoDB (Khuyên dùng)
1. Tạo tài khoản MongoDB Atlas miễn phí: https://www.mongodb.com/cloud/atlas
2. Tạo cluster mới
3. Tạo database user với username/password
4. Whitelist IP `0.0.0.0/0` (cho phép tất cả IP)
5. Copy connection string (mongodb+srv://...)

### 1.2 Deploy lên Render
1. Đăng nhập vào https://render.com
2. Tạo New Web Service
3. Kết nối GitHub repository này
4. Chọn folder `backend` làm Root Directory
5. Cấu hình:
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Thêm Environment Variables:
   - `MONGODB_URL`: Connection string từ MongoDB Atlas
   - `DATABASE_NAME`: `transport_data_db`
   - `ADMIN_EMAIL`: Email admin (ví dụ: `admin@yourdomain.com`)
   - `ADMIN_PASSWORD`: Mật khẩu admin mạnh
7. Deploy

### 1.3 Lưu ý
- Nếu không cấu hình MongoDB, hệ thống sẽ tự động dùng SQLite (không khuyến khích cho production)
- URL backend sau khi deploy sẽ có dạng: `https://transport-dashboard-api.onrender.com`

---

## 2. Frontend Deployment (GitHub Pages)

### 2.1 Cài đặt dependencies
```bash
cd frontend
npm install
```

### 2.2 Cấu hình API URL
1. Copy file `.env.example` thành `.env`
2. Cập nhật `VITE_API_URL` với URL backend từ Render:
   ```
   VITE_API_URL=https://transport-dashboard-api.onrender.com
   ```

### 2.3 Build và Deploy
```bash
# Build production
npm run build

# Deploy lên GitHub Pages
npm run deploy
```

Hoặc sử dụng GitHub Actions:
1. Vào repository Settings > Pages
2. Chọn source là `gh-pages` branch
3. Push code, GitHub Actions sẽ tự động deploy

### 2.4 URL Frontend
Sau khi deploy, frontend sẽ có dạng:
`https://pharaoh1807.github.io/Transport_dashboard/`

---

## 3. Cấu hình CORS (Quan trọng)

Sau khi có URL backend và frontend, cập nhật CORS trong `backend/main.py`:

```python
# Thay thế allow_origins=["*"] bằng:
allow_origins=[
    "https://pharaoh1807.github.io",  # Frontend URL
    "http://localhost:3000"          # Local development
]
```

Sau đó redeploy backend trên Render.

---

## 4. Testing Sau Deployment

### 4.1 Backend
```bash
curl https://transport-dashboard-api.onrender.com/
```
Phải trả về: `{"message": "SAP Transportation Data API is running", "version": "2.0.0"}`

### 4.2 Frontend
1. Truy cập URL GitHub Pages
2. Thử đăng nhập với admin account
3. Upload file Excel và test các chức năng

---

## 5. Troubleshooting

### Backend không start
- Kiểm tra Render logs
- Đảm bảo MongoDB connection string đúng
- Verify environment variables

### Frontend không gọi được API
- Kiểm tra CORS configuration
- Verify `VITE_API_URL` trong `.env`
- Kiểm tra backend logs

### MongoDB connection error
- Kiểm tra IP whitelist trong MongoDB Atlas
- Verify username/password
- Thử connection string locally trước

---

## 6. File Cấu Hình Đã Tạo

### Backend
- `backend/.env.example` - Template environment variables
- `backend/runtime.txt` - Python version cho Render
- `backend/render.yaml` - Render service configuration

### Frontend
- `frontend/.env.example` - Template API URL
- `frontend/vite.config.js` - Đã cấu hình `base: '/Transport_dashboard/'`
- `frontend/package.json` - Đã thêm `gh-pages` và deploy script

---

## 7. Next Steps

1. Deploy backend lên Render trước
2. Lấy URL backend từ Render
3. Cấu hình `VITE_API_URL` trong frontend
4. Deploy frontend lên GitHub Pages
5. Cập nhật CORS trong backend
6. Test toàn bộ hệ thống

# SAP Transportation Data Dashboard

Dashboard phân tích dữ liệu vận chuyển SAP với visualization tương tác và authentication system.

## 🚀 Features

- **Upload & Process Excel Files**: Hỗ trợ file .xlsx/.xls với nhiều sheet
- **Interactive Dashboard**: Biểu đồ và KPIs real-time
- **Advanced Filtering**: Lọc dữ liệu theo carrier, province, delivery type, route, thời gian
- **Vietnam Map Visualization**: Bản đồ tương tác hiển thị dữ liệu theo tỉnh
- **Data Export**: Xuất dữ liệu đã lọc ra Excel
- **Authentication System**: Đăng nhập/đăng ký với role-based access (Admin/User)
- **Responsive Design**: Tương thích mọi thiết bị

## 🛠 Tech Stack

### Backend
- **FastAPI**: Python web framework
- **MongoDB/SQLite**: Database (auto-fallback nếu MongoDB không khả dụng)
- **Pandas**: Data processing
- **JWT**: Authentication
- **Pydantic**: Data validation

### Frontend
- **React 18**: UI framework
- **Vite**: Build tool
- **Tailwind CSS**: Styling
- **Recharts**: Charting library
- **React Simple Maps**: Vietnam map visualization
- **Axios**: HTTP client

## 📦 Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB (optional, có thể dùng SQLite)

### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from .env.example)
cp .env.example .env

# Run server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Run development server
npm run dev
```

## 🔧 Configuration

### Backend (.env)
```env
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/transport_data_db
DATABASE_NAME=transport_data_db
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_secure_password
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000
```

## 🎯 Usage

1. **Truy cập Dashboard**: Mở http://localhost:3000
2. **Đăng nhập**: 
   - Admin: Sử dụng email/password từ .env
   - User: Đăng ký tài khoản mới
3. **Upload File**: Chọn file Excel dữ liệu vận chuyển
4. **Chọn Sheet**: Chọn sheet cần phân tích
5. **Phân tích**: Sử dụng các bộ lọc và biểu đồ

## 📊 Dashboard Features

### KPIs
- Total Tonnage
- Total Cost
- Average Cost per Ton
- Total Shipments

### Charts
- Carrier Ranking
- Province Distribution
- Delivery Type Analysis
- Route Analysis
- Vietnam Map Visualization

### Filters
- Carrier selection
- Province selection  
- Delivery type filtering
- Route code filtering
- Date range filtering
- Year/Month selection

## 🚢 Deployment

### Backend (Render)
Xem file [DEPLOYMENT.md](./DEPLOYMENT.md) để biết chi tiết.

1. Deploy backend lên Render
2. Cấu hình MongoDB và environment variables
3. Lấy URL backend

### Frontend (GitHub Pages)
1. Cấu hình `VITE_API_URL` với URL backend
2. Build và deploy lên GitHub Pages
3. Cập nhật CORS trong backend

## 🔐 Authentication

### Admin Account
Tự động tạo khi backend start (nếu database trống):
- Email: Từ `ADMIN_EMAIL` trong .env
- Password: Từ `ADMIN_PASSWORD` trong .env

### User Roles
- **Admin**: Full access, xem tất cả files
- **User**: Chỉ xem files của chính mình

## 📁 Project Structure

```
TransportData/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── database.py          # Database layer (MongoDB/SQLite)
│   ├── auth.py              # Authentication logic
│   ├── processor.py         # Data processing logic
│   ├── routers/             # API routes
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment template
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── api/             # API client
│   │   ├── context/         # React context
│   │   └── App.jsx          # Main app
│   ├── package.json         # Node dependencies
│   ├── vite.config.js       # Vite configuration
│   └── .env.example         # Environment template
└── DEPLOYMENT.md            # Deployment guide
```

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License.

## 📞 Support

For support, email nguyenthanhhao@pharaohmac.lan or open an issue in the repository.

---

**Note**: Project được phát triển để phân tích dữ liệu vận chuyển SAP với giao diện thân thiện và tính năng phân tích dữ liệu mạnh mẽ.

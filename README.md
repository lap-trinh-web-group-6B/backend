# MONETY - BACKEND API EXPRESS & PRISMA

Đây là mã nguồn **Backend API** của dự án Monety, được xây dựng bằng **Node.js (Express)**, **Prisma ORM**, và **PostgreSQL**.

---

## Live Demo & Production
- **Link APP:** https://monety-frontend.onrender.com
- **Backend API**: [https://monety-backend.onrender.com](https://monety-backend.onrender.com)
- **Bảng điều khiển Quản trị (Admin Dashboard)**: [https://monety-backend.onrender.com/admin](https://monety-backend.onrender.com/admin)

> [!NOTE]
> **Lưu ý**: Vì backend được host trên **Render bản miễn phí**, server sẽ tự động chuyển sang chế độ ngủ nếu không hoạt động. Ở lần truy cập đầu tiên, vui lòng đợi từ **50 giây đến 2 phút** để server wake up (Lần đầu tiên khi truy cập nếu server ở trạng thái sleep thì bắt buộc phải vào cả **Link APP:** và **Bảng điều khiển Quản trị (Admin Dashboard)** để wakeup server).

---

##  Hướng dẫn cài đặt và chạy local (Step-by-Step)

### 1. Cài đặt các gói thư viện phụ thuộc
Đảm bảo bạn đã di chuyển vào thư mục `backend/`:
```bash
cd backend
npm install
```

### 2. Cấu hình file biến môi trường (`.env`)
Tạo tệp tin `.env` trong thư mục `backend/` và cấu hình các giá trị sau:

```env
# Địa chỉ kết nối PostgreSQL Database
DATABASE_URL="postgresql://username:password@localhost:5432/monety_db?schema=public"

# Cổng chạy ứng dụng Backend
PORT=3001

# Khóa bí mật dùng để mã hóa & xác thực JWT
JWT_SECRET="your_super_secret_jwt_key_here_random_string"

# Khóa bảo mật Webhook từ cổng thanh toán tự động Sepay
SEPAY_WEBHOOK_KEY="sepay_webhook_secure_key_2026"

# Cấu hình SMTP gửi mail qua Brevo (để gửi mã OTP & cảnh báo ngân sách)
BREVO_API_KEY="xkeysib-your_brevo_api_key"
SMTP_USER="your_email@gmail.com"

# Cấu hình tài khoản ngân hàng thụ hưởng (Hiển thị mã VietQR nâng cấp Premium)
BIN_BANK_ACCOUNT="970415" # Mã BIN Vietinbank hoặc ngân hàng khác
BANK_ACCOUNT="101234567890" # Số tài khoản ngân hàng của bạn

# Cấu hình tài khoản Quản trị viên mặc định (Admin Dashboard)
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin_secure_password"
```

##  Đồng bộ Prisma với Database

Để ánh xạ mô hình cơ sở dữ liệu từ Prisma vào PostgreSQL và tạo các bảng, hãy chạy lệnh sau để áp dụng các file Migrations có sẵn:
```bash
npx prisma migrate dev
```
*Lưu ý: Lệnh này sẽ tự động chạy `npx prisma generate` để sinh ra Client Prisma mới tương thích.*

---

## Khởi động Backend API

Chạy lệnh phát triển (hot-reload với nodemon):
```bash
npm run dev
```
*Backend API chạy tại địa chỉ: `http://localhost:3001`*

Để chạy môi trường production:
```bash
npm run start
```

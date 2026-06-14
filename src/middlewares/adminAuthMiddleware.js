import jwt from 'jsonwebtoken';

// Middleware bảo vệ các route cho phần Admin
// (Note: Kiểm tra cookie 'adminToken', nếu hợp lệ cho qua, lỗi thì đá về trang đăng nhập)
export const requireAdminAuth = (req, res, next) => {
    try {
        // (Note: Lấy admin token từ cookie)
        const token = req.cookies.adminToken;

        if (!token) {
            // Chưa có token -> quay về trang đăng nhập
            return res.redirect('/admin/login');
        }

        // Giải mã token xem hợp lệ và còn hạn không
        // (Note: Dùng JWT verify cùng khóa bí mật trong hệ thống)
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');

        // Gán vào req để các controller phía sau dùng
        req.admin = decoded;

        next();
    } catch (error) {
        console.error('[Admin Auth] Token không hợp lệ hoặc đã hết hạn:', error.message);
        // (Note: Đăng nhập lại nếu token hết hạn)
        res.clearCookie('adminToken');
        return res.redirect('/admin/login');
    }
};

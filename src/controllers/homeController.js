// Logic xử lý khi người dùng truy cập trang chủ
// (Note: Controller xử lý request cho trang chủ)
export const getHomePage = (req, res) => {
    // (Note: Chuyển hướng ngay lập tức người dùng sang trang quản trị)
    res.redirect('/admin/dashboard');
};

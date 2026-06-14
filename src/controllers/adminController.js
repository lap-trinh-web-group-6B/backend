import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { configService, systemConfigKeys } from '../services/configService.js';

export const getLoginPage = (req, res) => {
    // Nếu đã đăng nhập thì đá về dashboard
    // (Note: Kiểm tra đã có token thì cho vào thẳng Dashboard ko cần login nữa)
    if (req.cookies.adminToken) {
        return res.redirect('/admin/dashboard');
    }

    // (Note: Mở trang giao diện HTML đăng nhập với biến error rỗng)
    res.render('admin/login', { error: null });
};

export const loginAdmin = (req, res) => {
    const { username, password } = req.body;

    // Lấy thông tin tài khoản được định nghĩa trong file .env
    // (Note: So sánh form POST lên với cấu hình)
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (username === adminUser && password === adminPass) {
        // (Note: Mã hóa 1 phiên đăng nhập của Admin thành token JWT)
        const token = jwt.sign(
            { username: adminUser, role: 'admin' },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '12h' } // Hạn sống 12 tiếng
        );

        // Lưu HTTP Only Cookie
        // (Note: Gửi Cookie gắn liền với Response để Browser tự động giữ state)
        res.cookie('adminToken', token, {
            httpOnly: true,
            maxAge: 12 * 60 * 60 * 1000 // 12 giờ
            // secure: process.env.NODE_ENV === 'production' // Bật secure nếu HTTPS
        });

        return res.redirect('/admin/dashboard');
    }

    // Nếu không khớp
    // (Note: Render lại trang đăng nhập, kèm thông báo lỗi)
    return res.render('admin/login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
};

export const logoutAdmin = (req, res) => {
    // (Note: Xóa phiên hiện tại trên trình duyệt)
    res.clearCookie('adminToken');
    res.redirect('/admin/login');
};

export const getDashboard = async (req, res) => {
    try {
        const [
            userCount,
            premiumUserCount,
            systemCategoryCount,
            recentUsers
        ] = await Promise.all([
            prisma.users.count(),
            prisma.users.count({ where: { type: 'PREMIUM' } }),
            prisma.categories.count({ where: { user_id: null } }),
            prisma.users.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5
            })
        ]);

        // (Note: Render trang chủ của Dashboard admin với dữ liệu thực tế từ Database)
        res.render('admin/dashboard', {
            adminUsername: req.admin.username,
            currentUrl: '/admin/dashboard',
            stats: {
                totalUsers: userCount,
                premiumUsers: premiumUserCount,
                systemCategories: systemCategoryCount
            },
            recentUsers
        });
    } catch (error) {
        console.error('[AdminDashboard] getDashboard error:', error);
        res.status(500).send('Lỗi server khi tải Dashboard');
    }
};

export const getCategoriesDashboard = (req, res) => {
    // (Note: Trả về trang quản lý Danh mục thu chi cho Admin)
    res.render('admin/categories', {
        adminUsername: req.admin.username,
        currentUrl: '/admin/categories'
    });
};

export const getDashboardStatsAsync = async (req, res) => {
    try {
        const { range } = req.query; // '7', '28', '90', '365'
        let daysAgo = 28; // Mặc định 28 ngày
        if (range && !isNaN(parseInt(range))) {
            daysAgo = parseInt(range);
        }
        const startDateString = `${daysAgo}daysAgo`;

        // Tính toán đối tượng Date
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(now.getDate() - daysAgo);

        // 1. Dữ liệu Đăng ký User theo ngày
        const usersTrendRaw = await prisma.$queryRaw`
            SELECT DATE(u."createdAt") as "date",
                   SUM(CASE WHEN u."type" = 'FREE' THEN 1 ELSE 0 END)::int as "free_count",
                   SUM(CASE WHEN u."type" = 'PREMIUM' THEN 1 ELSE 0 END)::int as "premium_count"
            FROM "users" u
            WHERE u."createdAt" >= ${startDate}
            GROUP BY DATE(u."createdAt")
            ORDER BY DATE(u."createdAt") ASC
        `;

        // 2. Dữ liệu Tài khoản Active (Dựa trên giao dịch) theo ngày
        const activeUsersTrendRaw = await prisma.$queryRaw`
            SELECT DATE(tx.transaction_date) as "date",
                   COUNT(DISTINCT tx.user_id)::int as "active_count"
            FROM transactions tx
            WHERE tx.transaction_date >= ${startDate}
            GROUP BY DATE(tx.transaction_date)
            ORDER BY DATE(tx.transaction_date) ASC
        `;

        // 3. Tổng số để hiển thị trên thẻ card (Tổng trong khoản thời gian)
        const totalNewFree = await prisma.users.count({
            where: {
                type: 'FREE',
                createdAt: {
                    gte: startDate
                }
            }
        });

        const totalNewPremium = await prisma.users.count({
            where: {
                type: 'PREMIUM',
                createdAt: {
                    gte: startDate
                }
            }
        });

        const totalActiveAccountsRaw = await prisma.$queryRaw`
            SELECT COUNT(DISTINCT tx.user_id)::int as "count"
            FROM transactions tx
            WHERE tx.transaction_date >= ${startDate}
        `;
        
        const totalActiveAccounts = totalActiveAccountsRaw[0]?.count || 0;

        return res.json({
            status: "success",
            data: {
                summary: {
                    newFree: totalNewFree,
                    newPremium: totalNewPremium,
                    activeAccounts: totalActiveAccounts
                },
                charts: {
                    userTrend: usersTrendRaw,
                    activeTrend: activeUsersTrendRaw
                }
            }
        });
    } catch (error) {
        console.error('[AdminDashboard] getDashboardStatsAsync error:', error);
        res.status(500).json({ status: "error", message: "Lỗi nội bộ Server" });
    }
};

export const getSettingsPage = async (req, res) => {
    try {
        const configs = await configService.getMany({
            [systemConfigKeys.PREMIUM_PRICE]: '2000',
            [systemConfigKeys.BANK_BIN]: process.env.BIN_BANK_ACCOUNT || '970405',
            [systemConfigKeys.BANK_ACCOUNT]: process.env.BANK_ACCOUNT || '3910205185595',
            [systemConfigKeys.BANK_NAME]: 'Agribank',
            [systemConfigKeys.BANK_OWNER_NAME]: 'LE NGOC UYEN'
        });

        res.render('admin/settings', {
            adminUsername: req.admin.username,
            currentUrl: '/admin/settings',
            pageTitle: 'Cấu hình hệ thống',
            configs
        });
    } catch (error) {
        console.error('[AdminSettings] getSettingsPage error:', error);
        res.status(500).send('Lỗi server khi tải trang Cấu hình hệ thống');
    }
};

export const updateSettings = async (req, res) => {
    try {
        const { premium_price, bank_bin, bank_account, bank_name, bank_owner_name } = req.body;

        // Validation
        if (!premium_price || isNaN(parseInt(premium_price)) || parseInt(premium_price) < 1000) {
            return res.status(400).json({ status: 'error', message: 'Giá gói Premium không hợp lệ (tối thiểu 1000 VNĐ)' });
        }
        if (!bank_bin || !/^[0-9]{6}$/.test(bank_bin)) {
            return res.status(400).json({ status: 'error', message: 'Mã BIN ngân hàng phải gồm 6 chữ số' });
        }
        if (!bank_account || bank_account.trim() === '') {
            return res.status(400).json({ status: 'error', message: 'Số tài khoản ngân hàng không được để trống' });
        }
        if (!bank_name || bank_name.trim() === '') {
            return res.status(400).json({ status: 'error', message: 'Tên ngân hàng không được để trống' });
        }
        if (!bank_owner_name || bank_owner_name.trim() === '') {
            return res.status(400).json({ status: 'error', message: 'Tên chủ tài khoản không được để trống' });
        }

        // Save
        await Promise.all([
            configService.set(systemConfigKeys.PREMIUM_PRICE, premium_price),
            configService.set(systemConfigKeys.BANK_BIN, bank_bin),
            configService.set(systemConfigKeys.BANK_ACCOUNT, bank_account),
            configService.set(systemConfigKeys.BANK_NAME, bank_name),
            configService.set(systemConfigKeys.BANK_OWNER_NAME, bank_owner_name.toUpperCase().trim())
        ]);

        return res.json({ status: 'success', message: 'Cập nhật cấu hình hệ thống thành công' });
    } catch (error) {
        console.error('[AdminSettings] updateSettings error:', error);
        return res.status(500).json({ status: 'error', message: 'Lỗi server khi lưu cấu hình' });
    }
};

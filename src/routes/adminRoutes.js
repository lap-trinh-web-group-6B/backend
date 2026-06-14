import express from 'express';
import { requireAdminAuth } from '../middlewares/adminAuthMiddleware.js';
import {
    getLoginPage,
    loginAdmin,
    logoutAdmin,
    getDashboard,
    getCategoriesDashboard,
    getDashboardStatsAsync,
    getSettingsPage,
    updateSettings
} from '../controllers/adminController.js';

import {
    getAdminCategories,
    createAdminCategory,
    updateAdminCategory
} from '../controllers/adminCategoryController.js';

import {
    getUsersPage,
    getAdminUsers,
    banAdminUser,
    unbanAdminUser
} from '../controllers/adminUserController.js';

import { multerIconUpload } from '../config/multer.js';
import { compressIconMiddleware } from '../middlewares/compressImageMiddleware.js';

const router = express.Router();

// Routes công khai cho Admin (Không bảo vệ: Đăng nhập)
// (Note: GET form đăng nhập)
router.get('/login', getLoginPage);

// (Note: POST kiểm tra username/password)
router.post('/login', loginAdmin);

// Các Route bảo vệ (Cần Cookie, đăng nhập mới xem đc)
// (Note: API Logout - Yêu cầu Auth để xoá Session cookie)
router.post('/logout', requireAdminAuth, logoutAdmin);

// (Note: Trang chủ quản lý Dashboard)
router.get('/dashboard', requireAdminAuth, getDashboard);

// (Note: Trang quản lý danh mục categories)
router.get('/categories', requireAdminAuth, getCategoriesDashboard);

// (Note: Trang quản lý người dùng)
router.get('/users', requireAdminAuth, getUsersPage);

// (Note: Trang cấu hình hệ thống)
router.get('/settings', requireAdminAuth, getSettingsPage);

// ==========================================
// AJAX internal routes (dành riêng cho fetch() bên dưới client dashboard Admin)
// (Note: Các API này tự động parse cookie auth nhờ middleware mà không cần Authorization header của App Client V1)
router.get('/api/dashboard/stats', requireAdminAuth, getDashboardStatsAsync);

router.get('/api/categories', requireAdminAuth, getAdminCategories);
router.post('/api/categories', requireAdminAuth, multerIconUpload, compressIconMiddleware, createAdminCategory);
router.patch('/api/categories/:id', requireAdminAuth, multerIconUpload, compressIconMiddleware, updateAdminCategory);

// (Note: Các API quản lý người dùng)
router.get('/api/users', requireAdminAuth, getAdminUsers);
router.patch('/api/users/:id/ban', requireAdminAuth, banAdminUser);
// (Note: API thực hiện mở khóa tài khoản)
router.patch('/api/users/:id/unban', requireAdminAuth, unbanAdminUser);

// (Note: API cấu hình hệ thống)
router.post('/api/settings', requireAdminAuth, updateSettings);

// Mặc định truy cập /admin sẽ chuyển về dashboard (nếu có auth) hoặc login (nếu không)
router.get('/', (req, res) => res.redirect('/admin/dashboard'));

export default router;

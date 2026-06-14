import { prisma } from '../config/database.js';
import { sendBanWarningEmail, sendUnbanNotificationEmail } from '../utils/mailSender.js';

import { jsonResponse } from '../utils/responseHelper.js';

/**
 * [Admin View] Hiển thị trang quản lý người dùng
 * (Note: Render giao diện EJS cho trang quản lý người dùng)
 */
export const getUsersPage = (req, res) => {
    res.render('admin/users', {
        adminUsername: req.admin.username,
        currentUrl: '/admin/users',
        pageTitle: 'Quản lý người dùng'
    });
};

/**
 * [Admin API] Lấy danh sách người dùng với phân trang, tìm kiếm và lọc
 * (Note: API trả về dữ liệu JSON cho frontend hiển thị bảng)
 */
export const getAdminUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, sort = 'createdAt_desc', search, type, status } = req.query;
        const where = {};

        // Note: Tìm kiếm theo họ tên (không phân biệt hoa thường)
        if (search) {
            where.fullName = {
                contains: search,
                mode: 'insensitive'
            };
        }

        // Note: Lọc theo loại tài khoản (FREE/PREMIUM)
        if (type && type !== 'ALL') {
            where.type = type;
        }

        // Note: Lọc theo trạng thái tài khoản
        if (status && status !== 'ALL') {
            where.status = status;
        }

        // Note: Xử lý sắp xếp dữ liệu
        let orderBy = {};
        if (sort === 'fullName_asc') {
            orderBy = { fullName: 'asc' };
        } else if (sort === 'fullName_desc') {
            orderBy = { fullName: 'desc' };
        } else if (sort === 'createdAt_asc') {
            orderBy = { createdAt: 'asc' };
        } else {
            orderBy = { createdAt: 'desc' };
        }

        // Note: Thực hiện phân trang
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const [items, total] = await Promise.all([
            prisma.users.findMany({
                where,
                orderBy,
                skip,
                take
            }),
            prisma.users.count({
                where
            })
        ]);
        const totalPages = Math.ceil(total / Number(limit));

        return jsonResponse(res, 200, 'Thành công', {
            items,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages
        });
    } catch (error) {
        console.error('[AdminUser] getAdminUsers error:', error);
        return jsonResponse(res, 500, 'Lỗi server khi lấy danh sách người dùng', null);
    }
};

/**
 * [Admin API] Khóa tài khoản người dùng và gửi email thông báo
 * (Note: Cập nhật trạng thái người dùng thành BANNED và gửi email cảnh báo)
 */
export const banAdminUser = async (req, res) => {
    try {
        const userId = Number(req.params.id);

        const user = await prisma.users.findUnique({ where: { id: userId } });
        if (!user) {
            return jsonResponse(res, 404, 'Không tìm thấy người dùng', null);
        }

        if (user.status === 'BANNED') {
            return jsonResponse(res, 400, 'Tài khoản này đã bị khóa từ trước', null);
        }

        // Note: Cập nhật trạng thái trong cơ sở dữ liệu
        const updatedUser = await prisma.users.update({
            where: { id: userId },
            data: { status: 'BANNED' }
        });

        // Note: Gửi email cảnh báo qua tiện ích Resend
        try {
            await sendBanWarningEmail(updatedUser.email);
        } catch (emailError) {
            console.error('[AdminUser] Gửi email cảnh báo thất bại:', emailError.message);
            // Vẫn trả về success vì DB đã update, email lỗi có thể do cấu hình
        }

        return jsonResponse(res, 200, 'Đã khóa tài khoản thành công', updatedUser);
    } catch (error) {
        console.error('[AdminUser] banAdminUser error:', error);
        return jsonResponse(res, 500, 'Lỗi server khi thực hiện khóa tài khoản', null);
    }
};

/**
 * [Admin API] Mở khóa tài khoản người dùng và gửi email thông báo
 * (Note: Cập nhật trạng thái người dùng thành ACTIVATE và gửi email thông báo mở khóa)
 */
export const unbanAdminUser = async (req, res) => {
    try {
        const userId = Number(req.params.id);

        const user = await prisma.users.findUnique({ where: { id: userId } });
        if (!user) {
            return jsonResponse(res, 404, 'Không tìm thấy người dùng', null);
        }

        // Note: Kiểm tra xem người dùng có đang bị khóa hay không
        if (user.status !== 'BANNED') {
            return jsonResponse(res, 400, 'Tài khoản này hiện không bị khóa', null);
        }

        // Note: Cập nhật trạng thái thành ACTIVATE trong cơ sở dữ liệu
        const updatedUser = await prisma.users.update({
            where: { id: userId },
            data: { status: 'ACTIVATE' }
        });

        // Note: Gửi email thông báo mở khóa qua tiện ích Resend
        try {
            await sendUnbanNotificationEmail(updatedUser.email);
        } catch (emailError) {
            console.error('[AdminUser] Gửi email thông báo mở khóa thất bại:', emailError.message);
        }

        return jsonResponse(res, 200, 'Đã mở khóa tài khoản thành công', updatedUser);
    } catch (error) {
        console.error('[AdminUser] unbanAdminUser error:', error);
        return jsonResponse(res, 500, 'Lỗi server khi thực hiện mở khóa tài khoản', null);
    }
};

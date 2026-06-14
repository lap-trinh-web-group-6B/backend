import { prisma } from '../config/database.js';
import { normalizeVietnamese } from '../utils/stringUtils.js';
import { deleteFile } from '../utils/fileUtils.js';

import { jsonResponse } from '../utils/responseHelper.js';

// [Admin API] Lấy danh sách danh mục
export const getAdminCategories = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort, search, type, source } = req.query;
        const where = {};

        // Lọc theo nguồn gốc (hệ thống/người dùng)
        if (source === 'system') {
            where.user_id = null;
        } else if (source === 'mine') { // Tab user_categories ben giao dien
            where.user_id = { not: null };
        }

        if (type) {
            where.type = type;
        }

        if (search) {
            const normalizedSearch = normalizeVietnamese(search);
            where.name_normalized = {
                contains: normalizedSearch,
                mode: 'insensitive'
            };
        }

        let orderBy = {
            createdAt: 'desc'
        };

        if (sort === 'name_asc') {
            orderBy = {
                name_normalized: 'asc'
            };
        } else if (sort === 'name_desc') {
            orderBy = {
                name_normalized: 'desc'
            };
        }

        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const [items, total] = await Promise.all([
            prisma.categories.findMany({
                where,
                orderBy,
                skip,
                take
            }),
            prisma.categories.count({
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
        console.error('[AdminCategory] getAdminCategories error:', error);
        return jsonResponse(res, 500, 'Lỗi server khi lấy danh mục', null);
    }
};

// [Admin API] Tạo danh mục hệ thống
export const createAdminCategory = async (req, res) => {
    try {
        const { name, type } = req.body;
        let icon_url = req.body.icon_url;

        // (Note: Lập url từ router chạy qua multer trung gian)
        if (req.file) {
            icon_url = `/uploads/icons/${req.file.filename}`;
        }

        if (!name || !type) {
            return jsonResponse(res, 400, 'name và type là bắt buộc', null);
        }

        if (!['INCOME', 'EXPENSE'].includes(type)) {
            return jsonResponse(res, 400, 'type không hợp lệ', null);
        }

        const normalizedName = normalizeVietnamese(name);

        const existingSystemCategory = await prisma.categories.findFirst({
            where: {
                name_normalized: normalizedName,
                user_id: null
            }
        });

        if (existingSystemCategory) {
            return jsonResponse(res, 400, 'Lỗi', { name: 'Tên danh mục đã tồn tại trong hệ thống' });
        }

        // Admin tạo -> mặc định là System Category (user_id: null)
        const newCategory = await prisma.categories.create({
            data: {
                name,
                name_normalized: normalizedName,
                type,
                icon_url,
                user_id: null,
                status: 'ACTIVATE'
            }
        });

        return jsonResponse(res, 201, 'Thành công', newCategory);
    } catch (error) {
        console.error('[AdminCategory] createAdminCategory error:', error);
        return jsonResponse(res, 500, 'Lỗi server khi tạo danh mục', null);
    }
};

// [Admin API] Cập nhật danh mục
export const updateAdminCategory = async (req, res) => {
    try {
        const categoryId = Number(req.params.id);
        const { name, type, status } = req.body;
        let icon_url = req.body.icon_url;

        const category = await prisma.categories.findUnique({
            where: { id: categoryId }
        });
        if (!category) return jsonResponse(res, 404, 'Không tìm thấy danh mục', null);

        // Admin chỉ được sửa danh mục hệ thống (bảo vệ data user)
        if (category.user_id !== null) {
            return jsonResponse(res, 403, 'Admin không được tự ý sửa đổi danh mục của user', null);
        }

        const dataToUpdate = {};

        if (name && normalizeVietnamese(name) !== category.name_normalized) {
            const normalizedName = normalizeVietnamese(name);
            const existingSystemCategory = await prisma.categories.findFirst({
                where: {
                    name_normalized: normalizedName,
                    user_id: null
                }
            });

            if (existingSystemCategory) {
                return jsonResponse(res, 400, 'Lỗi', { name: 'Tên danh mục trùng với danh mục hệ thống' });
            }

            dataToUpdate.name = name;
            dataToUpdate.name_normalized = normalizedName;
        }

        if (type && ['INCOME', 'EXPENSE'].includes(type)) {
            dataToUpdate.type = type;
        }

        // (Note: Clear hình ảnh cứng bị ghi đè phiên bản WebP thu gọn)
        if (req.file) {
            if (category.icon_url && category.icon_url.startsWith('/uploads/')) {
                deleteFile(category.icon_url);
            }
            dataToUpdate.icon_url = `/uploads/icons/${req.file.filename}`;
        } else if (icon_url !== undefined) {
            dataToUpdate.icon_url = icon_url;
        }

        if (status && ['ACTIVATE', 'DISABLED'].includes(status)) {
            dataToUpdate.status = status;
        }

        const updatedCategory = await prisma.categories.update({
            where: { id: categoryId },
            data: dataToUpdate
        });

        return jsonResponse(res, 200, 'Thành công', updatedCategory);
    } catch (error) {
        console.error('[AdminCategory] updateAdminCategory error:', error);
        return jsonResponse(res, 500, 'Lỗi server khi cập nhật danh mục', null);
    }
};

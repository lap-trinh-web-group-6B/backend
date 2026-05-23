import {prisma} from '../config/database.js';
import {jsonResponse} from '../utils/responseHelper.js';
import {normalizeVietnamese} from '../utils/stringUtils.js';


export const categoryController = {
    getCategories:  async (req, res) => {
        try {
            const userId = req.user.id;
            const {page = 1, limit = 20, sort, search, type, source} = req.query;
            const where = {};
            if (source === 'system') {
                where.user_id = null;
            } else if (source === 'mine') {
                where.user_id = userId;
            } else {
                where.OR = [
                    { user_id: null },
                    { user_id: userId }
                ];
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
            console.error('[Category] getCategories error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi lấy danh sách danh mục', null);
        }
    },
    getCategoryById: async (req, res) => {
        try {
            const userId = req.user.id;
            const categoryId = req.params.id;
            const category = await prisma.categories.findUnique({
                where: {
                    id: Number(categoryId)
                }
            });
            if (!category) {
                return jsonResponse(res, 404, 'Không tìm thấy danh mục', null);
            }
            if (category.user_id !== null && category.user_id !== userId) {
                return jsonResponse(res, 403, 'Bạn không có quyền xem danh mục này', null);
            }
            return jsonResponse(res, 200, 'Success', category);
        } catch (error) {
            console.error('[Category] getCategoryById error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi lấy chi tiết danh mục', null);
        }
    }





}
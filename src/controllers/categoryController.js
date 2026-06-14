import {prisma} from '../config/database.js';
import {jsonResponse} from '../utils/responseHelper.js';
import {normalizeVietnamese} from '../utils/stringUtils.js';
import {deleteFile} from '../utils/fileUtils.js';


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
    },
    createCategory: async (req, res) => {
        try {
            const userId = req.user.id;
            const {name, type} = req.body;
            let icon_url = req.body.icon_url;
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
                return jsonResponse(res, 400, 'Lỗi', {name: 'Tên danh mục trùng với danh mục hệ thống'});
            }

            const existingUserCategory = await prisma.categories.findFirst({
                where: {
                    name_normalized: normalizedName,
                    user_id: userId
                }
            });

            if (existingUserCategory) {
                return jsonResponse(res, 400, 'Lỗi', {name: 'Bạn đã tạo danh mục với tên này trước đó'});
            }
            const newCategory = await prisma.categories.create({
                data: {
                    name,
                    name_normalized: normalizedName,
                    type,
                    icon_url,
                    user_id: userId,
                    status: 'ACTIVATE'
                }
            });
            return jsonResponse(res, 201, 'Thành công', newCategory);
        } catch (error) {
            console.error('[Category] createCategory error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi tạo danh mục', null);
        }

    },
    updateCategory: async (req, res) => {
        try {
            const userId = req.user.id;
            const categoryId = req.params.id;
            const {name, type, status} = req.body;

            const category = await prisma.categories.findUnique({
                where: {
                    id: Number(categoryId)
                }
            });

            if (!category) {
                return jsonResponse(res, 404, 'Không tìm thấy danh mục', null);
            }
            if (category.user_id === null) {
                return jsonResponse(res, 403, 'Không thể chỉnh sửa danh mục hệ thống', null);
            }
            if (category.user_id !== userId) {
                return jsonResponse(res, 403, 'Bạn không có quyền chỉnh sửa danh mục này', null);
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
                    return jsonResponse(res, 400, 'Lỗi', {name: 'Tên danh mục trùng với danh mục hệ thống'});
                }
                const existingUserCategory = await prisma.categories.findFirst({
                    where: {
                        name_normalized: normalizedName,
                        user_id: userId,
                        id: {
                            not: Number(categoryId)
                        }
                    }
                });
                if (existingUserCategory) {
                    return jsonResponse(res, 400, 'Lỗi', {name: 'Bạn đã tạo danh mục với tên này trước đó'});
                }
                dataToUpdate.name = name;
                dataToUpdate.name_normalized = normalizedName;
            }
            if (type && ['INCOME', 'EXPENSE'].includes(type)) {
                dataToUpdate.type = type;
            }
            if (req.file) {
                if (category.icon_url && category.icon_url.startsWith('/uploads/')) {
                    deleteFile(category.icon_url);
                }
                dataToUpdate.icon_url = `/uploads/icons/${req.file.filename}`;
            } else if (req.body.delete_icon === 'true' || req.body.delete_icon === true) {
                if (category.icon_url && category.icon_url.startsWith('/uploads/')) {
                    deleteFile(category.icon_url);
                }
                dataToUpdate.icon_url = null;
            }
            if (status && ['ACTIVATE', 'DISABLED'].includes(status)) {
                dataToUpdate.status = status;
            }

            const updatedCategory = await prisma.categories.update({
                where: {
                    id: category.id
                },
                data: dataToUpdate
            });
            return jsonResponse(res, 200, 'Thành công', updatedCategory);
        } catch (error) {
            console.error('[Category] updateCategory error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi cập nhật danh mục', null);
        }
    },
    deleteCategory: async (req, res) => {

        try {
            const userId = req.user.id;
            const categoryId = Number(req.params.id);
            await prisma.$transaction(async (tx) => {
                const category = await tx.categories.findUnique({
                    where: {
                        id: categoryId
                    }
                });
                if (!category) {
                    throw {
                        status: 404,
                        message: 'Không tìm thấy danh mục'
                    };
                }
                if (category.user_id === null) {
                    throw {
                        status: 403,
                        message: 'Không thể xóa danh mục hệ thống'
                    };
                }
                if (category.user_id !== userId) {
                    throw {
                        status: 403,
                        message: 'Bạn không có quyền xóa danh mục này'
                    };
                }
                const transactions = await tx.transactions.findMany({
                    where: {
                        category_id: categoryId,
                        user_id: userId
                    }
                });
                const walletUpdates = {};
                for (const transaction of transactions) {
                    const effect =
                        category.type === 'EXPENSE' ? -1 : 1;
                    const adjustment =
                        Number(transaction.amount) * effect;
                    if (!walletUpdates[transaction.wallet_id]) {
                        walletUpdates[transaction.wallet_id] = 0;
                    }
                    walletUpdates[transaction.wallet_id] -= adjustment;
                }
                for (const [walletId, adjustment] of Object.entries(walletUpdates)) {
                    const wallet = await tx.wallets.findFirst({
                        where: {
                            id: Number(walletId),
                            user_id: userId
                        }
                    });
                    if (wallet) {

                        await tx.wallets.update({
                            where: {
                                id: wallet.id
                            },
                            data: {
                                balance:
                                    Number(wallet.balance) + adjustment
                            }
                        });
                    }
                }
                await tx.categories.delete({
                    where: {
                        id: categoryId
                    }
                });
            });

            return jsonResponse(
                res,
                200,
                'Xóa danh mục và hoàn tiền ví thành công',
                null
            );

        } catch (error) {

            console.error(
                '[Category] deleteCategory error:',
                error
            );

            return jsonResponse(
                res,
                error.status || 500,
                error.message || 'Lỗi server khi xóa danh mục',
                null
            );
        }
    }





}
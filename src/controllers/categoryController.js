import {prisma} from '../config/database.js';
import {jsonResponse} from '../utils/responseHelper.js';
import {normalizeVietnamese} from '../utils/stringUtils.js';
import {deleteFile} from '../utils/fileUtils.js';
import {syncBudgetsAfterTransactionChange} from './budgetController.js';


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
                    include: {
                        _count: {
                            select: {
                                transactions: true,
                                budgets: true
                            }
                        }
                    },
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
                return jsonResponse(res, 400, 'Tên danh mục trùng với danh mục hệ thống', null);
            }

            const existingUserCategory = await prisma.categories.findFirst({
                where: {
                    name_normalized: normalizedName,
                    user_id: userId
                }
            });

            if (existingUserCategory) {
                return jsonResponse(res, 400, 'Bạn đã tạo danh mục với tên này trước đó', null);
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
                    return jsonResponse(res, 400, 'Tên danh mục trùng với danh mục hệ thống', null);
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
                    return jsonResponse(res, 400, 'Bạn đã tạo danh mục với tên này trước đó', null);
                }
                dataToUpdate.name = name;
                dataToUpdate.name_normalized = normalizedName;
            }
            if (type && type !== category.type && ['INCOME', 'EXPENSE'].includes(type)) {
                // Check if any transactions exist using this category
                const transactionCount = await prisma.transactions.count({
                    where: {
                        category_id: category.id
                    }
                });
                if (transactionCount > 0) {
                    return jsonResponse(res, 400, 'Không thể thay đổi loại danh mục (Thu/Chi) vì danh mục này đã có giao dịch phát sinh', null);
                }

                // Check if any budgets exist using this category
                const budgetCount = await prisma.budgets.count({
                    where: {
                        category_id: category.id
                    }
                });
                if (budgetCount > 0) {
                    return jsonResponse(res, 400, 'Không thể thay đổi loại danh mục vì đã có ngân sách liên kết', null);
                }

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
            const { mode = 'delete_all', targetCategoryId } = req.query;
            let uniqueDates = [];
            const targetId = targetCategoryId ? Number(targetCategoryId) : null;

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

                if (mode === 'merge') {
                    if (!targetId) {
                        throw {
                            status: 400,
                            message: 'Thiếu danh mục đích để gộp giao dịch'
                        };
                    }
                    if (targetId === categoryId) {
                        throw {
                            status: 400,
                            message: 'Danh mục đích không thể trùng với danh mục bị xóa'
                        };
                    }
                    const targetCategory = await tx.categories.findUnique({
                        where: {
                            id: targetId
                        }
                    });
                    if (!targetCategory || (targetCategory.user_id !== null && targetCategory.user_id !== userId)) {
                        throw {
                            status: 404,
                            message: 'Không tìm thấy danh mục đích hợp lệ'
                        };
                    }
                    if (targetCategory.type !== category.type) {
                        throw {
                            status: 400,
                            message: 'Danh mục đích phải cùng loại thu/chi với danh mục bị xóa'
                        };
                    }

                    // Lấy các ngày giao dịch bị ảnh hưởng để đồng bộ ngân sách sau đó
                    const transactionsToMerge = await tx.transactions.findMany({
                        where: {
                            category_id: categoryId,
                            user_id: userId
                        },
                        select: {
                            transaction_date: true
                        }
                    });
                    uniqueDates = [...new Set(transactionsToMerge.map(t => t.transaction_date.toISOString()))];

                    // Gộp giao dịch sang danh mục mới
                    await tx.transactions.updateMany({
                        where: {
                            category_id: categoryId,
                            user_id: userId
                        },
                        data: {
                            category_id: targetId
                        }
                    });
                } else {
                    // Logic hiện tại: Xóa vĩnh viễn và hoàn lại tiền vào ví
                    const transactions = await tx.transactions.findMany({
                        where: {
                            category_id: categoryId,
                            user_id: userId
                        }
                    });
                    const walletUpdates = {};
                    for (const transaction of transactions) {
                        const effect = category.type === 'EXPENSE' ? -1 : 1;
                        const adjustment = Number(transaction.amount) * effect;
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
                                    balance: Number(wallet.balance) + adjustment
                                }
                            });
                        }
                    }
                }

                // Xóa danh mục
                await tx.categories.delete({
                    where: {
                        id: categoryId
                    }
                });
            });

            if (mode === 'merge' && uniqueDates.length > 0 && targetId) {
                for (const date of uniqueDates) {
                    await syncBudgetsAfterTransactionChange(userId, targetId, date);
                }
            }

            return jsonResponse(
                res,
                200,
                mode === 'merge'
                    ? 'Xóa danh mục và gộp giao dịch thành công'
                    : 'Xóa danh mục và hoàn tiền ví thành công',
                null
            );

        } catch (error) {
            console.error('[Category] deleteCategory error:', error);
            return jsonResponse(
                res,
                error.status || 500,
                error.message || 'Lỗi server khi xóa danh mục',
                null
            );
        }
    }





}
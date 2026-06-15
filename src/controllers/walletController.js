import {jsonResponse} from '../utils/responseHelper.js';
import {prisma} from '../config/database.js';
import {normalizeVietnamese} from '../utils/stringUtils.js';


export const walletController = {
    getWallets: async (req, res) => {
        try {
            const userId = req.user.id;
            const {page = 1, limit = 20, sort, search, type} = req.query;
            const where = {
                user_id: userId,
            };
            if (type && ['CASH', 'BANK_ACCOUNT', 'E_WALLET'].includes(type.toUpperCase())) {
                where.type = type.toUpperCase();
            }
            if (search) {
                where.name = {
                    contains: search,
                    mode: 'insensitive',
                };
            }
            let orderBy = {
                createdAt: 'desc',
            };
            if (sort === 'name_asc') {
                orderBy = {
                    name: 'asc',
                };
            } else if (sort === 'name_desc') {
                orderBy = {
                    name: 'desc',
                };
            }
            const skip = (Number(page) - 1) * Number(limit);
            const take = Number(limit);
            const [items, total] = await Promise.all([
                prisma.wallets.findMany({
                    where,
                    orderBy,
                    skip,
                    take,
                }),
                prisma.wallets.count({
                    where,
                }),
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
            console.error('[WalletController] getWallets error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi lấy danh sách ví', null);
        }
    },
    getWalletById: async (req, res) => {
        try {
            const userId = req.user.id;
            const walletId = req.params.id;
            const wallet = await prisma.wallets.findUnique({
                where: {
                    id: parseInt(walletId),
                },
            });
            if (!wallet) {
                return jsonResponse(res, 404, 'Ví không tồn tại', null);
            }
            if (wallet.user_id !== userId) {
                return jsonResponse(res, 403, 'Bạn không có quyền truy cập ví này', null);
            }
            return jsonResponse(res, 200, 'Success', wallet);
        } catch (error) {
            console.error('[WalletController] getWalletById error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi lấy thông tin ví', null);
        }
    },
    createWallet: async (req, res) => {
        try {
            const userId = req.user.id;
            const { name, type, balance, currency } = req.body;
            if (!name || !type) {
                return jsonResponse(res, 400, 'Tên ví (name) và loại ví (type) là bắt buộc', null);
            }
            if (!['CASH', 'BANK_ACCOUNT', 'E_WALLET'].includes(type.toUpperCase())) {
                return jsonResponse(res, 400, 'Loại ví (type) không hợp lệ', null);
            }
            if (balance !== undefined && isNaN(Number(balance))) {
                return jsonResponse(res, 400, 'Số dư (balance) phải là một con số', null);
            }
            if (balance !== undefined && Number(balance) < 0) {
                return jsonResponse(res, 400, 'Số dư (balance) không được âm', null);
            }
            if (currency && currency !== 'VND') {
                return jsonResponse(res, 400, 'Hệ thống hiện tại chỉ hỗ trợ đơn vị tiền tệ VND', null);
            }

            // Giới hạn số lượng ví cho tài khoản FREE (tối đa 2 ví)
            if (req.user.type === 'FREE') {
                const walletCount = await prisma.wallets.count({
                    where: {
                        user_id: userId
                    }
                });
                if (walletCount >= 2) {
                    return jsonResponse(res, 403, 'Tài khoản FREE chỉ được tạo tối đa 2 ví. Vui lòng nâng cấp lên PREMIUM để không giới hạn ví.', null);
                }
            }

            const existingWallet = await prisma.wallets.findFirst({
                where: {
                    user_id: userId,
                    name: {
                        equals: name,
                        mode: 'insensitive',
                    },
                },
            });
            if (existingWallet) {
                return jsonResponse(res, 400, 'Tên ví đã tồn tại', null);
            }
            const newWallet = await prisma.wallets.create({
                data: {
                    user_id: userId,
                    name: name.trim(),
                    type: type.toUpperCase(),
                    balance: balance !== undefined ? Number(balance) : 0,
                    currency: currency || 'VND',
                    status: 'ACTIVATE',
                },
            });
            return jsonResponse(res, 201, 'Thành công', newWallet);

        } catch (error) {
            if (error.code === 'P2002') {
                return jsonResponse(res, 400, 'Tên ví đã tồn tại', null);
            }
            console.error('[WalletController] createWallet error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi tạo ví mới', null);
        }

    },
    deleteWallet: async (req, res) => {
        try {
            const userId = req.user.id;
            const walletId = req.params.id;
            const wallet = await prisma.wallets.findUnique({
                where: {
                    id: Number(walletId),
                },
            });
            if (!wallet) {
                return jsonResponse(res, 404, 'Ví không tồn tại để xóa', null);
            }
            if (wallet.user_id !== userId) {
                return jsonResponse(res, 403, 'Bạn không có quyền xoá ví của người khác', null);
            }

            const transactionCount = await prisma.transactions.count({
                where: {
                    OR: [
                        { wallet_id: wallet.id },
                        { transfer_wallet_id: wallet.id }
                    ]
                }
            });
            if (transactionCount > 0) {
                return jsonResponse(res, 400, 'Không thể xóa ví vì ví đã phát sinh giao dịch hoặc giao dịch chuyển khoản', null);
            }

            await prisma.wallets.delete({
                where: {
                    id: wallet.id,
                },
            });

            return jsonResponse(res, 200, 'Xóa ví thành công', null);
        } catch (error) {
            console.error('[WalletController] deleteWallet error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi xóa ví', null);
        }
    },
    updateWallet: async (req, res) => {
        try {
            const userId = req.user.id;
            const walletId = req.params.id;
            const { name, type, balance, currency, status } = req.body;
            const wallet = await prisma.wallets.findUnique({
                where: {
                    id: Number(walletId),
                },
            });
            if (!wallet) {
                return jsonResponse(res, 404, 'Ví không tồn tại', null);
            }

            if (wallet.user_id !== userId) {
                return jsonResponse(res, 403, 'Không có quyền chỉnh sửa ví này', null);
            }
            const dataToUpdate = {};
            // Check trùng tên nếu người dùng thay đổi name khác origin
            if (name && name.trim().toLowerCase() !== wallet.name.toLowerCase()) {
                const existingWallet = await prisma.wallets.findFirst({
                    where: {
                        user_id: userId,
                        name: {
                            equals: name.trim(),
                            mode: 'insensitive',
                        },
                    },
                });

                if (existingWallet) {
                    return jsonResponse(res, 400, 'Tên ví đã tồn tại', null);
                }
                dataToUpdate.name = name.trim();
            }
            if (type && ['CASH', 'BANK_ACCOUNT', 'E_WALLET'].includes(type.toUpperCase())) {
                dataToUpdate.type = type.toUpperCase();
            }
            let needsAdjustment = false;
            let diff = 0;
            const balanceVal = balance !== undefined ? Number(balance) : undefined;
            if (balanceVal !== undefined && !isNaN(balanceVal) && balanceVal >= 0) {
                if (balanceVal !== Number(wallet.balance)) {
                    needsAdjustment = true;
                    diff = balanceVal - Number(wallet.balance);
                    dataToUpdate.balance = balanceVal;
                }
            }
            if (status && ['ACTIVATE', 'DISABLED'].includes(status.toUpperCase())) {
                dataToUpdate.status = status.toUpperCase();
            }
            if (currency) {
                if (currency !== 'VND') {
                    return jsonResponse(res, 400, 'Hệ thống hiện tại chỉ hỗ trợ đơn vị tiền tệ VND', null);
                }
                dataToUpdate.currency = currency;
            }

            let updatedWallet;
            if (needsAdjustment) {
                updatedWallet = await prisma.$transaction(async (tx) => {
                    const type = diff > 0 ? 'INCOME' : 'EXPENSE';
                    const amount = Math.abs(diff);
                    const categoryName = diff > 0 ? 'Điều chỉnh tăng số dư' : 'Điều chỉnh giảm số dư';
                    const normalizedCategoryName = normalizeVietnamese(categoryName);

                    // Lấy hoặc tạo danh mục hệ thống công khai
                    let category = await tx.categories.findFirst({
                        where: {
                            name_normalized: normalizedCategoryName,
                            user_id: null
                        }
                    });
                    if (!category) {
                        category = await tx.categories.create({
                            data: {
                                name: categoryName,
                                name_normalized: normalizedCategoryName,
                                type: type,
                                user_id: null,
                                status: 'ACTIVATE'
                            }
                        });
                    }

                    // Tạo giao dịch điều chỉnh
                    await tx.transactions.create({
                        data: {
                            user_id: userId,
                            wallet_id: wallet.id,
                            category_id: category.id,
                            amount: amount,
                            transaction_date: new Date(),
                            note: 'Điều chỉnh số dư ví',
                            currency: 'VND',
                            source: 'MANUAL',
                            status: 'ACTIVATE'
                        }
                    });

                    // Cập nhật số dư ví
                    return await tx.wallets.update({
                        where: {
                            id: wallet.id
                        },
                        data: dataToUpdate
                    });
                });
            } else {
                updatedWallet = await prisma.wallets.update({
                    where: {
                        id: wallet.id,
                    },
                    data: dataToUpdate,
                });
            }

            return jsonResponse(res, 200, 'Thành công', updatedWallet);
        } catch (error) {
            if (error.code === '23505') {
                return jsonResponse(res, 400, 'Tên ví đã tồn tại', null);
            }
            console.error('[WalletController] updateWallet error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi cập nhật ví', null);
        }
    }

}
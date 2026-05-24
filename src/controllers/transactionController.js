import {prisma} from '../config/database.js';
import {jsonResponse} from '../utils/responseHelper.js';
import {triggerNegativeBalanceWarning} from "../services/notificationService.js";
import {checkBudgetAlerts} from "./budgetController.js";

export const transactionController = {
    getTransactions: async (req, res) => {
        try {
            const userId = parseInt(req.user.id);
            const {
                page = 1,
                limit = 20,
                sort = 'date_desc',
                search,
                type,
                wallet_id,
                category_id,
                from_date,
                to_date,
                source
            } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const skip = (pageNum - 1) * limitNum;
            const where = {
                user_id: userId
            };
            if (search) {
                where.note = {
                    contains: search,
                    mode: 'insensitive'
                };
            }
            if (type && (type === 'INCOME' || type === 'EXPENSE')) {
                where.categories = {
                    type
                };
            }
            if (wallet_id) {
                where.wallet_id = parseInt(wallet_id);
            }
            if (category_id) {
                where.category_id = parseInt(category_id);
            }
            if (from_date || to_date) {
                where.transaction_date = {};
                if (from_date) {
                    const start = new Date(from_date);
                    start.setHours(0, 0, 0, 0);
                    where.transaction_date.gte = start;
                }
                if (to_date) {
                    const end = new Date(to_date);
                    end.setHours(23, 59, 59, 999);

                    where.transaction_date.lte = end;
                }
            }
            if (source && (source === 'MANUAL' || source === 'OCR_SCAN')) {
                where.source = source;
            }
            const orderBy =
                sort === 'date_asc'
                    ? { transaction_date: 'asc' }
                    : { transaction_date: 'desc' };
            const [items, total] = await Promise.all([
                prisma.transactions.findMany({
                    where,
                    include: {
                        categories: true,
                        wallets: true
                    },
                    orderBy,
                    skip,
                    take: limitNum
                }),
                prisma.transactions.count({
                    where
                })
            ]);
            return jsonResponse(res, 200, 'Thành công', {
                items,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            });
        } catch (error) {
            console.error('[Error] getTransactions: ', error);
            return jsonResponse(res, 500, 'Lỗi server / Database', null);
        }
    },
    getTransactionById: async (req, res) => {
        try {
            const userId = parseInt(req.user.id);
            const txId = parseInt(req.params.id);
            const tx = await prisma.transactions.findUnique({
                where: {
                    id: txId
                },
                include: {
                    categories: true,
                    wallets: true
                }
            });
            if (!tx) {
                return jsonResponse(res, 404, 'Không tìm thấy giao dịch', null);
            }
            if (tx.user_id !== userId) {
                return jsonResponse(res, 403, 'Không có quyền truy cập giao dịch này', null);
            }
            return jsonResponse(res, 200, 'Success', tx);
        } catch (error) {
            console.error('[Error] getTransactionById: ', error);
            return jsonResponse(res, 500, 'Lỗi server / Database', null);
        }
    },
    createTransaction: async (req, res) => {
        try {
            const userId = req.user.id;
            const { wallet_id, category_id, amount, transaction_date, note, currency } = req.body;
            console.log('Body: ', req.body);
            if (!wallet_id || !category_id || amount === undefined || !transaction_date) {
                return jsonResponse(res, 400, 'Lỗi', {
                    status: 400,
                    message: 'Thiếu thông tin bắt buộc (wallet_id, category_id, amount, transaction_date)'
                });
            }
            const amt = parseFloat(amount);
            if (isNaN(amt) || amt <= 0) {
                return jsonResponse(res, 400, 'amount phải là số tự nhiên lớn hơn 0', null);
            }
            const result = await prisma.$transaction(async (tx) => {
                const wallet = await tx.wallets.findFirst({
                    where: {
                        id: parseInt(wallet_id),
                        user_id: userId
                    }
                });
                if (!wallet) {
                    throw {
                        status: 403,
                        message: { wallet_id: 'Ví không hợp lệ' }
                    };
                }
                const category = await tx.categories.findFirst({
                    where: {
                        id: parseInt(category_id)
                    }
                });
                if (!category || (category.user_id !== null && category.user_id !== userId)) {
                    throw {
                        status: 403,
                        message: { category_id: 'Danh mục không hợp lệ' }
                    };
                }
                const newTx = await tx.transactions.create({
                    data: {
                        user_id: userId,
                        wallet_id: parseInt(wallet_id),
                        category_id: parseInt(category_id),
                        amount: amt,
                        transaction_date: new Date(transaction_date),
                        note: note || '',
                        currency: currency || 'VND',
                        source: 'MANUAL',
                        status: 'ACTIVATE'
                    }
                });
                const adjustment = category.type === 'EXPENSE' ? -amt : amt;
                const oldBalance = parseFloat(wallet.balance);
                const updatedBalance = oldBalance + adjustment;
                const updatedWallet = await tx.wallets.update({
                    where: {
                        id: wallet.id
                    },
                    data: {
                        balance: updatedBalance
                    }
                });
                return {
                    newTx,
                    wallet: updatedWallet,
                    category
                };
            });

            // Note: Kiểm tra cảnh báo số dư âm sau khi commit
            if (result.wallet.balance < 0) {
                triggerNegativeBalanceWarning(result.wallet, userId);
            }

            // Note: Kiểm tra cảnh báo ngân sách
            if (result.category.type === 'EXPENSE') {
                checkBudgetAlerts(userId, parseInt(category_id));
            }

            return jsonResponse(res, 201, 'Tạo giao dịch thành công', {
                data: result.newTx
            });

        } catch (error) {

            console.error('[Error] createTransaction: ', error);

            if (error.status) {
                return jsonResponse(res, error.status, 'Lỗi', error.message);
            }

            return jsonResponse(res, 500, 'Lỗi server / Database', null);
        }
    },
    updateTransaction: async (req, res) => {
        try {
            const userId = req.user.id;
            const txId = parseInt(req.params.id);
            const {
                wallet_id,
                category_id,
                amount,
                transaction_date,
                note,
                currency,
                status
            } = req.body;
            const result = await prisma.$transaction(async (tx) => {
                const oldTx = await tx.transactions.findUnique({
                    where: { id: txId },
                    include: {
                        categories: true
                    }
                });
                if (!oldTx) {
                    throw {
                        status: 404,
                        message: 'Không tìm thấy giao dịch'
                    };
                }
                if (oldTx.user_id !== userId) {
                    throw {
                        status: 403,
                        message: 'Không có quyền sửa giao dịch này'
                    };
                }
                const oldAmount = parseFloat(oldTx.amount);
                const oldWalletId = oldTx.wallet_id;
                const oldEffect =
                    oldTx.categories.type === 'EXPENSE' ? -1 : 1;
                let currentWalletId = oldWalletId;
                if (wallet_id && parseInt(wallet_id) !== oldWalletId) {
                    currentWalletId = parseInt(wallet_id);
                }
                const walletsAffected = new Set([
                    oldWalletId,
                    currentWalletId
                ]);
                const walletsMap = new Map();
                for (const wid of walletsAffected) {
                    await tx.$queryRaw`
                    SELECT id
                    FROM wallets
                    WHERE id = ${wid}
                    FOR UPDATE
                `;
                    const wallet = await tx.wallets.findFirst({
                        where: {
                            id: wid,
                            user_id: userId
                        }
                    });
                    if (!wallet) {
                        throw {
                            status: 403,
                            message: `Ví ${wid} không hợp lệ`
                        };
                    }
                    walletsMap.set(wid, wallet);
                }
                let currentCategory = oldTx.categories;
                if (category_id && parseInt(category_id) !== oldTx.category_id) {
                    const newCategory = await tx.categories.findFirst({
                        where: {
                            id: parseInt(category_id)
                        }
                    });

                    if (
                        !newCategory ||
                        (
                            newCategory.user_id !== null &&
                            newCategory.user_id !== userId
                        )
                    ) {
                        throw {
                            status: 403,
                            message: 'Lỗi',
                            errors: {
                                category_id: 'Danh mục không hợp lệ'
                            }
                        };
                    }
                    currentCategory = newCategory;
                }

                const newAmount =
                    amount !== undefined
                        ? parseFloat(amount)
                        : oldAmount;

                const newEffect = currentCategory.type === 'EXPENSE' ? -1 : 1;
                if (oldWalletId === currentWalletId) {
                    // Case 1: cùng ví
                    const wallet = walletsMap.get(oldWalletId);
                    const delta =
                        (newAmount * newEffect) -
                        (oldAmount * oldEffect);
                    wallet.balance =
                        parseFloat(wallet.balance) + delta;

                } else {
                    // Case 2: đổi ví
                    const oldWallet = walletsMap.get(oldWalletId);
                    const newWallet = walletsMap.get(currentWalletId);
                    // Refund ví cũ
                    oldWallet.balance =
                        parseFloat(oldWallet.balance) -
                        (oldAmount * oldEffect);
                    // Apply ví mới
                    newWallet.balance =
                        parseFloat(newWallet.balance) +
                        (newAmount * newEffect);
                }
                // Note: Update transaction
                const updatedTx = await tx.transactions.update({
                    where: {
                        id: oldTx.id
                    },
                    data: {
                        wallet_id: currentWalletId,
                        category_id: currentCategory.id,
                        amount: newAmount,
                        ...(transaction_date && {
                            transaction_date: new Date(transaction_date)
                        }),
                        ...(note !== undefined && {
                            note
                        }),
                        ...(currency && {
                            currency
                        }),
                        ...(status && {
                            status
                        })
                    },
                    include: {
                        categories: true
                    }
                });
                // Note: Save wallets
                for (const wallet of walletsMap.values()) {
                    await tx.wallets.update({
                        where: {
                            id: wallet.id
                        },
                        data: {
                            balance: wallet.balance
                        }
                    });
                }
                return {
                    updatedTx,
                    wallets: [...walletsMap.values()]
                };
            });
            // Note: Trigger cảnh báo sau commit
            for (const wallet of result.wallets) {
                if (wallet.balance < 0) {
                    triggerNegativeBalanceWarning(wallet, userId);
                }
            }

            return jsonResponse(
                res,
                200,
                'Cập nhật giao dịch thành công',
                result.updatedTx
            );

        } catch (error) {
            console.error('[Error] updateTransaction:', error);
            return jsonResponse(
                res,
                error.status || 500,
                error.message || 'Lỗi server / Database',
                error.errors || null
            );
        }
    },
    deleteTransaction: async (req, res) => {
        try {
            const userId = req.user.id;
            const txId = parseInt(req.params.id);
            await prisma.$transaction(async (txDb) => {
                // Note: Lấy transaction cũ kèm category
                const transaction = await txDb.transactions.findUnique({
                    where: {
                        id: txId
                    },
                    include: {
                        categories: true
                    }
                });
                if (!transaction) {
                    throw {
                        status: 404,
                        message: 'Không tìm thấy giao dịch'
                    };
                }
                if (transaction.user_id !== userId) {
                    throw {
                        status: 403,
                        message: 'Không có quyền xóa giao dịch này'
                    };
                }
                // Note: Lock wallet để tránh race condition
                await txDb.$queryRaw`
                SELECT id
                FROM wallets
                WHERE id = ${transaction.wallet_id}
                FOR UPDATE
            `;
                // Note: Lấy ví
                const wallet = await txDb.wallets.findFirst({
                    where: {
                        id: transaction.wallet_id,
                        user_id: userId
                    }
                });

                if (wallet) {
                    // Note: Refund số dư
                    const effect =
                        transaction.categories.type === 'EXPENSE' ? -1 : 1;
                    const updatedBalance =
                        parseFloat(wallet.balance) -
                        (parseFloat(transaction.amount) * effect);
                    // Note: Update balance
                    await txDb.wallets.update({
                        where: {
                            id: wallet.id
                        },
                        data: {
                            balance: updatedBalance
                        }
                    });
                }
                // Note: Delete transaction
                await txDb.transactions.delete({
                    where: {
                        id: transaction.id
                    }
                });
            });
            return jsonResponse(
                res,
                200,
                'Xóa giao dịch thành công',
                null
            );
        } catch (error) {
            console.error('[Error] deleteTransaction:', error);
            return jsonResponse(
                res,
                error.status || 500,
                error.message || 'Lỗi server / Database',
                null
            );
        }
    }


}
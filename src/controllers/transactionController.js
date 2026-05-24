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
                await triggerNegativeBalanceWarning(result.wallet, userId);
            }

            // Note: Kiểm tra cảnh báo ngân sách
            if (result.category.type === 'EXPENSE') {
                await checkBudgetAlerts(userId, parseInt(category_id));
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
    }


}
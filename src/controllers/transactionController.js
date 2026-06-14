import {prisma} from '../config/database.js';
import {jsonResponse} from '../utils/responseHelper.js';
import {triggerNegativeBalanceWarning} from "../services/notificationService.js";
import {checkBudgetAlerts} from "./budgetController.js";
import {normalizeVietnamese} from '../utils/stringUtils.js';

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
                        wallets: true,
                        transfer_wallets: true
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
                    wallets: true,
                    transfer_wallets: true
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
            const { wallet_id, category_id, amount, transaction_date, note, currency, transfer_wallet_id } = req.body;
            console.log('Body: ', req.body);
            if (!wallet_id || (!category_id && !transfer_wallet_id) || amount === undefined || !transaction_date) {
                return jsonResponse(res, 400, 'Lỗi', {
                    status: 400,
                    message: 'Thiếu thông tin bắt buộc (wallet_id, category_id hoặc transfer_wallet_id, amount, transaction_date)'
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
                        message: { wallet_id: 'Ví gửi không hợp lệ' }
                    };
                }
                const txCurrency = currency || 'VND';
                if (txCurrency !== wallet.currency) {
                    throw {
                        status: 400,
                        message: `Loại tiền tệ của giao dịch (${txCurrency}) không khớp với tiền tệ của ví (${wallet.currency})`
                    };
                }

                let finalCategoryId = category_id ? parseInt(category_id) : null;
                let category = null;
                let transferWallet = null;

                if (transfer_wallet_id) {
                    const targetWalletId = parseInt(transfer_wallet_id);
                    if (targetWalletId === parseInt(wallet_id)) {
                        throw {
                            status: 400,
                            message: 'Ví nhận không thể trùng với ví gửi'
                        };
                    }
                    transferWallet = await tx.wallets.findFirst({
                        where: {
                            id: targetWalletId,
                            user_id: userId
                        }
                    });
                    if (!transferWallet) {
                        throw {
                            status: 403,
                            message: { transfer_wallet_id: 'Ví nhận không hợp lệ' }
                        };
                    }
                    if (txCurrency !== transferWallet.currency) {
                        throw {
                            status: 400,
                            message: `Loại tiền tệ của giao dịch (${txCurrency}) không khớp với tiền tệ của ví nhận (${transferWallet.currency})`
                        };
                    }

                    const normalizedCategoryName = normalizeVietnamese("Chuyển tiền");
                    category = await tx.categories.findFirst({
                        where: {
                            name_normalized: normalizedCategoryName,
                            user_id: null
                        }
                    });
                    if (!category) {
                        category = await tx.categories.create({
                            data: {
                                name: "Chuyển tiền",
                                name_normalized: normalizedCategoryName,
                                type: "EXPENSE",
                                user_id: null,
                                status: "ACTIVATE"
                            }
                        });
                    }
                    finalCategoryId = category.id;
                } else {
                    category = await tx.categories.findFirst({
                        where: {
                            id: finalCategoryId
                        }
                    });
                    if (!category || (category.user_id !== null && category.user_id !== userId)) {
                        throw {
                            status: 403,
                            message: { category_id: 'Danh mục không hợp lệ' }
                        };
                    }
                }

                const newTx = await tx.transactions.create({
                    data: {
                        user_id: userId,
                        wallet_id: parseInt(wallet_id),
                        transfer_wallet_id: transfer_wallet_id ? parseInt(transfer_wallet_id) : null,
                        category_id: finalCategoryId,
                        amount: amt,
                        transaction_date: new Date(transaction_date),
                        note: note || '',
                        currency: txCurrency,
                        source: 'MANUAL',
                        status: 'ACTIVATE'
                    }
                });

                // Update balances
                let updatedWallet = wallet;
                if (transfer_wallet_id) {
                    const updatedSourceBalance = parseFloat(wallet.balance) - amt;
                    const updatedTargetBalance = parseFloat(transferWallet.balance) + amt;

                    updatedWallet = await tx.wallets.update({
                        where: { id: wallet.id },
                        data: { balance: updatedSourceBalance }
                    });
                    await tx.wallets.update({
                        where: { id: transferWallet.id },
                        data: { balance: updatedTargetBalance }
                    });
                } else {
                    const adjustment = category.type === 'EXPENSE' ? -amt : amt;
                    const oldBalance = parseFloat(wallet.balance);
                    const updatedBalance = oldBalance + adjustment;
                    updatedWallet = await tx.wallets.update({
                        where: { id: wallet.id },
                        data: { balance: updatedBalance }
                    });
                }

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
            if (result.category && result.category.type === 'EXPENSE') {
                checkBudgetAlerts(userId, result.newTx.category_id);
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
                status,
                transfer_wallet_id
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
                
                // Determine new values or keep old
                let currentWalletId = oldTx.wallet_id;
                if (wallet_id !== undefined && wallet_id !== null) {
                    currentWalletId = parseInt(wallet_id);
                }

                let currentTransferWalletId = oldTx.transfer_wallet_id;
                if (req.body.hasOwnProperty('transfer_wallet_id')) {
                    currentTransferWalletId = req.body.transfer_wallet_id ? parseInt(req.body.transfer_wallet_id) : null;
                }

                if (currentTransferWalletId !== null && currentTransferWalletId === currentWalletId) {
                    throw {
                        status: 400,
                        message: 'Ví nhận không thể trùng với ví gửi'
                    };
                }

                const walletsAffected = new Set();
                walletsAffected.add(oldTx.wallet_id);
                if (oldTx.transfer_wallet_id) {
                    walletsAffected.add(oldTx.transfer_wallet_id);
                }
                walletsAffected.add(currentWalletId);
                if (currentTransferWalletId) {
                    walletsAffected.add(currentTransferWalletId);
                }

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

                const activeWallet = walletsMap.get(currentWalletId);
                const txCurrency = currency || oldTx.currency;
                if (txCurrency !== activeWallet.currency) {
                    throw {
                        status: 400,
                        message: `Loại tiền tệ của giao dịch (${txCurrency}) không khớp với tiền tệ của ví (${activeWallet.currency})`
                    };
                }
                if (currentTransferWalletId) {
                    const targetWallet = walletsMap.get(currentTransferWalletId);
                    if (txCurrency !== targetWallet.currency) {
                        throw {
                            status: 400,
                            message: `Loại tiền tệ của giao dịch (${txCurrency}) không khớp với tiền tệ của ví nhận (${targetWallet.currency})`
                        };
                    }
                }

                let currentCategory = oldTx.categories;
                let currentCategoryId = oldTx.category_id;

                if (currentTransferWalletId) {
                    // Force system category "Chuyển tiền"
                    const normalizedCategoryName = normalizeVietnamese("Chuyển tiền");
                    let category = await tx.categories.findFirst({
                        where: {
                            name_normalized: normalizedCategoryName,
                            user_id: null
                        }
                    });
                    if (!category) {
                        category = await tx.categories.create({
                            data: {
                                name: "Chuyển tiền",
                                name_normalized: normalizedCategoryName,
                                type: "EXPENSE",
                                user_id: null,
                                status: "ACTIVATE"
                            }
                        });
                    }
                    currentCategory = category;
                    currentCategoryId = category.id;
                } else {
                    if (category_id && parseInt(category_id) !== oldTx.category_id) {
                        const newCategory = await tx.categories.findFirst({
                            where: {
                                id: parseInt(category_id)
                            }
                        });

                        if (!newCategory || (newCategory.user_id !== null && newCategory.user_id !== userId)) {
                            throw {
                                status: 403,
                                message: 'Danh mục không hợp lệ'
                            };
                        }
                        currentCategory = newCategory;
                        currentCategoryId = newCategory.id;
                    }
                }

                const newAmount = amount !== undefined ? parseFloat(amount) : oldAmount;

                // Refund old balances
                const oldWallet = walletsMap.get(oldTx.wallet_id);
                if (oldTx.transfer_wallet_id) {
                    oldWallet.balance = parseFloat(oldWallet.balance) + oldAmount;
                    const oldTargetWallet = walletsMap.get(oldTx.transfer_wallet_id);
                    oldTargetWallet.balance = parseFloat(oldTargetWallet.balance) - oldAmount;
                } else {
                    const oldEffect = oldTx.categories.type === 'EXPENSE' ? -1 : 1;
                    oldWallet.balance = parseFloat(oldWallet.balance) - (oldAmount * oldEffect);
                }

                // Apply new balances
                const newWallet = walletsMap.get(currentWalletId);
                if (currentTransferWalletId) {
                    newWallet.balance = parseFloat(newWallet.balance) - newAmount;
                    const newTargetWallet = walletsMap.get(currentTransferWalletId);
                    newTargetWallet.balance = parseFloat(newTargetWallet.balance) + newAmount;
                } else {
                    const newEffect = currentCategory.type === 'EXPENSE' ? -1 : 1;
                    newWallet.balance = parseFloat(newWallet.balance) + (newAmount * newEffect);
                }

                // Update transaction in database
                const updatedTx = await tx.transactions.update({
                    where: {
                        id: oldTx.id
                    },
                    data: {
                        wallet_id: currentWalletId,
                        transfer_wallet_id: currentTransferWalletId,
                        category_id: currentCategoryId,
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

                // Save updated balances
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

            // Note: Kiểm tra cảnh báo ngân sách sau khi cập nhật giao dịch
            if (result.updatedTx.categories && result.updatedTx.categories.type === 'EXPENSE') {
                checkBudgetAlerts(userId, result.updatedTx.category_id);
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

                // Lock wallets
                const walletsAffected = new Set();
                walletsAffected.add(transaction.wallet_id);
                if (transaction.transfer_wallet_id) {
                    walletsAffected.add(transaction.transfer_wallet_id);
                }
                for (const wid of walletsAffected) {
                    await txDb.$queryRaw`
                        SELECT id
                        FROM wallets
                        WHERE id = ${wid}
                        FOR UPDATE
                    `;
                }

                // Note: Lấy ví gửi
                const wallet = await txDb.wallets.findFirst({
                    where: {
                        id: transaction.wallet_id,
                        user_id: userId
                    }
                });

                if (transaction.transfer_wallet_id) {
                    // It was a transfer transaction
                    const transferWallet = await txDb.wallets.findFirst({
                        where: {
                            id: transaction.transfer_wallet_id,
                            user_id: userId
                        }
                    });

                    if (wallet) {
                        const updatedSourceBalance = parseFloat(wallet.balance) + parseFloat(transaction.amount);
                        await txDb.wallets.update({
                            where: { id: wallet.id },
                            data: { balance: updatedSourceBalance }
                        });
                    }
                    if (transferWallet) {
                        const updatedTargetBalance = parseFloat(transferWallet.balance) - parseFloat(transaction.amount);
                        await txDb.wallets.update({
                            where: { id: transferWallet.id },
                            data: { balance: updatedTargetBalance }
                        });
                    }
                } else {
                    // Normal transaction
                    if (wallet) {
                        const effect = transaction.categories.type === 'EXPENSE' ? -1 : 1;
                        const updatedBalance = parseFloat(wallet.balance) - (parseFloat(transaction.amount) * effect);
                        await txDb.wallets.update({
                            where: { id: wallet.id },
                            data: { balance: updatedBalance }
                        });
                    }
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
    },
    scanInvoice: async (req, res) => {
        try {
            if (req.user.type === 'FREE') {
                return jsonResponse(res, 403, 'Tính năng quét hóa đơn tự động chỉ khả dụng cho tài khoản PREMIUM. Vui lòng nâng cấp tài khoản.', null);
            }
            if (!req.file) {
                return jsonResponse(res, 400, 'Không tìm thấy file ảnh hóa đơn', null);
            }
            console.log(`[OCR] Nhận hóa đơn trong RAM, kích thước: ${req.file.size} bytes`);
            
            await new Promise(resolve => setTimeout(resolve, 1200));

            const mockOcrData = {
                amount: Math.floor(50000 + Math.random() * 450000),
                date: new Date().toISOString(),
                note: 'Thanh toán hóa đơn qua ảnh chụp',
                confidence: 0.95,
                receipt_image_url: null
            };

            return jsonResponse(res, 200, 'Quét hóa đơn thành công (Giả lập OCR)', mockOcrData);
        } catch (error) {
            console.error('[Error] scanInvoice:', error);
            return jsonResponse(res, 500, 'Lỗi hệ thống khi quét hóa đơn', null);
        }
    }


}
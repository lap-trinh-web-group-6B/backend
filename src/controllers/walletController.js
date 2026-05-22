import {jsonResponse} from '../utils/responseHelper.js';
import {prisma} from '../config/database.js';


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
                return jsonResponse(res, 400, 'Lỗi', { message: 'Tên ví (name) và loại ví (type) là bắt buộc' });
            }
            if (!['CASH', 'BANK_ACCOUNT', 'E_WALLET'].includes(type.toUpperCase())) {
                return jsonResponse(res, 400, 'Lỗi', { message: 'Loại ví (type) không hợp lệ' });
            }
            if (balance !== undefined && isNaN(Number(balance))) {
                return jsonResponse(res, 400, 'Lỗi', { message: 'Số dư (balance) phải là một con số' });
            }
            if (balance !== undefined && Number(balance) < 0) {
                return jsonResponse(res, 400, 'Lỗi', { message: 'Số dư (balance) không được âm' });
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
                return jsonResponse(res, 400, 'Lỗi', { name: 'Tên ví đã tồn tại' });
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
                return jsonResponse(res, 400, 'Lỗi', { name: 'Tên ví đã tồn tại' });
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
                    return jsonResponse(res, 400, 'Lỗi', { name: 'Tên ví đã tồn tại' });
                }
                wallet.name = name.trim();
            }
            if (type && ['CASH', 'BANK_ACCOUNT', 'E_WALLET'].includes(type.toUpperCase())) {
                wallet.type = type.toUpperCase();
            }
            if (balance !== undefined && !isNaN(Number(balance)) && Number(balance) >= 0) {
                wallet.balance = Number(balance);
            }
            if (status && ['ACTIVATE', 'DISABLED'].includes(status.toUpperCase())) {
                wallet.status = status.toUpperCase();
            }
            if (currency) {
                wallet.currency = currency;
            }
            await prisma.wallets.update({
                where: {
                    id: wallet.id,
                },
                data: wallet,
            });;
            return jsonResponse(res, 200, 'Thành công', wallet);
        } catch (error) {
            if (error.code === '23505') {
                return jsonResponse(res, 400, 'Lỗi', { name: 'Tên ví đã tồn tại' });
            }
            console.error('[WalletController] updateWallet error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi cập nhật ví', null);
        }
    }

}
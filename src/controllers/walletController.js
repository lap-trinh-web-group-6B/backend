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
    }
}
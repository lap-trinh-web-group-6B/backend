import {jsonResponse} from '../utils/responseHelper.js';
import {prisma} from '../config/database.js';


export const statisticsController = {
    getGeneralStats: async (req, res) => {
        try {
            const userId = req.user.id;
            const { from_date, to_date } = req.query;
            const walletAggregate = await prisma.wallets.aggregate({
                _sum: {
                    balance: true
                },
                where: {
                    user_id: userId
                }
            });

            const whereCondition = {
                user_id: userId
            };
            if (from_date || to_date) {
                whereCondition.transaction_date = {};
                if (from_date) {
                    whereCondition.transaction_date.gte = new Date(from_date);
                }
                if (to_date) {
                    whereCondition.transaction_date.lte = new Date(to_date);
                }
            }

            const stats = await prisma.transactions.groupBy({
                by: ['category_id'],
                where: whereCondition,
                _sum: {
                    amount: true
                }
            });
            const categoryIds = stats.map(item => item.category_id);
            const categories = await prisma.categories.findMany({
                where: {
                    id: {
                        in: categoryIds
                    }
                },
                select: {
                    id: true,
                    type: true
                }
            });
            const categoryMap = new Map(
                categories.map(category => [category.id, category.type])
            );
            let total_income = 0;
            let total_expense = 0;
            stats.forEach(stat => {
                const type = categoryMap.get(stat.category_id);
                const amount = parseFloat(stat._sum.amount || 0);

                if (type === 'INCOME') {
                    total_income += amount;
                }

                if (type === 'EXPENSE') {
                    total_expense += amount;
                }
            });
            return jsonResponse(res, 200, 'Thành công', {
                total_balance: parseFloat(walletAggregate._sum.balance || 0),
                total_income,
                total_expense
            });

        } catch (error) {
            console.error('[Error] getGeneralStats:', error);
            return jsonResponse(res, 500, 'Lỗi server khi lấy thống kê chung', null);
        }
    },
    getStatsByCategory: async (req, res) => {
        try {
            const userId = req.user.id;
            const { type = 'EXPENSE', from_date, to_date } = req.query;
            const whereClause = {
                user_id: userId,
                categories: {
                    type
                }
            };
            if (from_date || to_date) {
                whereClause.transaction_date = {};
                if (from_date) {
                    whereClause.transaction_date.gte = new Date(from_date);
                }
                if (to_date) {
                    whereClause.transaction_date.lte = new Date(to_date);
                }
            }
            const stats = await prisma.transactions.groupBy({
                by: ['category_id'],
                where: whereClause,
                _sum: {
                    amount: true
                },
                orderBy: {
                    _sum: {
                        amount: 'desc'
                    }
                }
            });
            const categoryIds = stats.map(item => item.category_id);

            const categories = await prisma.categories.findMany({
                where: {
                    id: {
                        in: categoryIds
                    }
                },
                select: {
                    id: true,
                    name: true,
                    icon_url: true
                }
            });
            const formattedStats = stats.map(stat => {
                const category = categories.find(
                    c => c.id === stat.category_id
                );
                return {
                    category_id: stat.category_id,
                    category_name: category?.name || null,
                    category_icon: category?.icon_url || null,
                    total_amount: parseFloat(stat._sum.amount || 0)
                };
            });
            return jsonResponse(res, 200, 'Success', formattedStats);
        } catch (error) {
            console.error('[Error] getStatsByCategory:', error);
            return jsonResponse(
                res,
                500,
                'Lỗi server khi lấy thống kê theo danh mục',
                null
            );
        }
    }

}
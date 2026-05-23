import {jsonResponse} from '../utils/responseHelper.js';
import {prisma} from '../config/database.js';


export const budgetController = {
    createBudget: async (req, res) => {
        try {
            const { category_id, amount_limit, start_date, end_date, is_alert_enabled, alert_threshold } = req.body;
            const userId = req.user.id;
            const category = await prisma.categories.findUnique({
                where: {
                    id: category_id
                }
            });
            if (!category || category.type !== 'EXPENSE') {
                return jsonResponse(res, 400, 'Danh mục không hợp lệ hoặc không phải danh mục chi tiêu', null);
            }
            const overlappingBudget = await prisma.budgets.findFirst({
                where: {
                    user_id: userId,
                    category_id: category_id,
                    status: 'ACTIVE',
                    start_date: {
                        lte: new Date(end_date)
                    },
                    end_date: {
                        gte: new Date(start_date)
                    }
                }
            });

            if (overlappingBudget) {
                return jsonResponse(res, 400, 'Đã tồn tại ngân sách đang hoạt động cho danh mục này trong khoảng thời gian đã chọn', null);
            }

            const newBudget = await prisma.budgets.create({
                data: {
                    user_id: userId,
                    category_id,
                    amount_limit,
                    start_date: new Date(start_date),
                    end_date: new Date(end_date),
                    is_alert_enabled: is_alert_enabled ?? true,
                    alert_threshold: alert_threshold ?? 0.8,
                    status: 'ACTIVE'
                }
            });
            return jsonResponse(res, 201, 'Tạo ngân sách thành công', newBudget);
        } catch (error) {
            console.error('[Budget] createBudget error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi tạo ngân sách', null);
        }

        
    },
    getBudgets: async (req, res) => {
        try {
            const userId = req.user.id;
            const { from_date, to_date } = req.query;
            console.log(`Date: ${from_date} - ${to_date}`);
            const whereClause = {
                user_id: userId
            };
            if (from_date) {
                const start = new Date(from_date);
                start.setHours(0, 0, 0, 0);
                whereClause.start_date = {
                    gte: start
                };
            }
            if (to_date) {
                const end = new Date(to_date);
                end.setHours(23, 59, 59, 999);
                whereClause.end_date = {
                    lte: end
                };
            }
            const budgets = await prisma.budgets.findMany({
                where: whereClause,
                include: {
                    categories: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            // Note: Tính toán chi tiêu thực tế cho các ngân sách đang ACTIVE
            const budgetsWithProgress = await Promise.all(budgets.map(async (budget) => {
                const currentSpent = await calculateCurrentSpent(budget);
                const remaining = Number(budget.amount_limit) - currentSpent;
                const percentageUsed = Number(budget.amount_limit) > 0 ? (currentSpent / Number(budget.amount_limit)) : 0;
                return {
                    ...budget,
                    current_spent: currentSpent,
                    remaining_budget: remaining,
                    percentage_used: percentageUsed
                };
            }));
            return jsonResponse(res, 200, 'Success', budgetsWithProgress);
        } catch (error) {
            console.error('[Budget] getBudgets error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi lấy danh sách ngân sách', null);
        }


    }


}

const calculateCurrentSpent = async (budget) => {
    if (budget.status === 'COMPLETED') {
        return Number(budget.final_spent_amount);
    }
    const result = await prisma.transactions.aggregate({
        _sum: {
            amount: true
        },
        where: {
            user_id: budget.user_id,
            category_id: budget.category_id,
            status: 'ACTIVATE',
            transaction_date: {
                gte: budget.start_date,
                lte: budget.end_date
            },
            categories: {
                type: 'EXPENSE'
            }
        }
    });
    return Number(result._sum.amount) || 0;
};
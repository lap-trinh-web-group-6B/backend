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


    },
    getBudgetDetail: async (req, res) => {
        try {
            const budgetId = req.params.id;
            const userId = req.user.id;
            const budget = await prisma.budgets.findFirst({
                where: {
                    id: Number(budgetId),
                    user_id: Number(userId)
                },
                include: {
                    categories: true
                }
            });
            if (!budget) {
                return jsonResponse(res, 404, 'Không tìm thấy ngân sách', null);
            }
            const currentSpent = await calculateCurrentSpent(budget);
            const remaining = Number(budget.amount_limit) - currentSpent;
            const percentageUsed = Number(budget.amount_limit) > 0 ? (currentSpent / Number(budget.amount_limit)) : 0;

            const budgetWithProgress = {
                ...budget,
                current_spent: currentSpent,
                remaining_budget: remaining,
                percentage_used: percentageUsed
            };
            return jsonResponse(res, 200, 'Success', budgetWithProgress);
        } catch (error) {
            console.error('[Budget] getBudgetDetail error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi lấy chi tiết ngân sách', null);
        }
    },
    updateBudget: async (req, res) => {
        try {
            const budgetId = req.params.id;
            const userId = req.user.id;
            const { category_id, amount_limit, start_date, end_date, is_alert_enabled, alert_threshold } = req.body;
            const budget = await prisma.budgets.findUnique({
                where: {
                    id: Number(budgetId)
                }
            });
            if (!budget) {
                return jsonResponse(res, 404, 'Không tìm thấy ngân sách', null);
            }
            if (budget.status !== 'ACTIVE') {
                return jsonResponse(res, 400, 'Chỉ có thể chỉnh sửa ngân sách đang hoạt động', null);
            }
            if (category_id) {
                const category = await prisma.categories.findUnique({
                    where: {
                        id: category_id
                    }
                });
                if (!category || category.type !== 'EXPENSE') {
                    return jsonResponse(res, 400, 'Danh mục không hợp lệ hoặc không phải danh mục chi tiêu', null);
                }
                budget.category_id = category_id;
            }
            if (amount_limit !== undefined) budget.amount_limit = amount_limit;
            if (start_date) budget.start_date = new Date(start_date);
            if (end_date) budget.end_date = new Date(end_date);
            if (is_alert_enabled !== undefined) budget.is_alert_enabled = is_alert_enabled;
            if (alert_threshold !== undefined) budget.alert_threshold = alert_threshold;
            // Note: Kiểm tra trùng lặp nếu có thay đổi ngày hoặc danh mục
            if (category_id || start_date || end_date) {
                const overlappingBudget = await prisma.budgets.findFirst({
                    where: {
                        user_id: userId,
                        category_id: budget.category_id,
                        status: 'ACTIVE',
                        id: {
                            not: Number(budgetId)
                        },
                        start_date: {
                            lte: budget.end_date
                        },
                        end_date: {
                            gte: budget.start_date
                        }
                    }
                });
                if (overlappingBudget) {
                    return jsonResponse(res, 400, 'Khoảng thời gian này đã bị trùng lặp với một ngân sách ACTIVE khác của danh mục này', null);
                }
            }
            await prisma.budgets.update({
                where: {
                    id: Number(budget.id)
                },
                data: budget
            });
            return jsonResponse(res, 200, 'Cập nhật ngân sách thành công', budget);
        } catch (error) {
            console.error('[Budget] updateBudget error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi cập nhật ngân sách', null);
        }
    },
    completeBudget: async (req, res) => {
        try {
            const budgetId = req.params.id;
            const userId = req.user.id;
            const budget = await prisma.budgets.findFirst({
                where: {
                    id: Number(budgetId),
                    user_id: Number(userId)
                }
            });
            if (!budget) {
                return jsonResponse(res, 404, 'Không tìm thấy ngân sách', null);
            }
            if (budget.status !== 'ACTIVE') {
                return jsonResponse(res, 400, 'Chỉ có thể hoàn thành ngân sách đang hoạt động', null);
            }
            const finalSpent = await calculateCurrentSpent(budget);
            let resultStatus = 'EXACT';
            if (finalSpent < Number(budget.amount_limit)) {
                resultStatus = 'UNDER_BUDGET';
            } else if (finalSpent > Number(budget.amount_limit)) {
                resultStatus = 'OVER_BUDGET';
            }
            budget.status = 'COMPLETED';
            budget.final_spent_amount = finalSpent;
            budget.result_status = resultStatus;
            budget.completion_date = new Date();
            await prisma.budgets.update({
                where: {
                    id: Number(budget.id)
                },
                data: budget
            });
            return jsonResponse(res, 200, 'Đã hoàn thành và chốt ngân sách thành công', budget);
        } catch (error) {
            console.error('[Budget] completeBudget error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi hoàn thành ngân sách', null);
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
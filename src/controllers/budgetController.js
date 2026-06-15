import {jsonResponse} from '../utils/responseHelper.js';
import {prisma} from '../config/database.js';
import {createNotification} from "../services/notificationService.js";


export const budgetController = {
    createBudget: async (req, res) => {
        try {
            const { category_id, amount_limit, start_date, end_date, is_alert_enabled, alert_threshold } = req.body;
            const userId = req.user.id;
            
            // Tự động đồng bộ ngân sách quá hạn của user
            await autoSyncExpiredBudgets(userId);

            const category = await prisma.categories.findUnique({
                where: {
                    id: category_id
                }
            });
            if (!category || category.type !== 'EXPENSE') {
                return jsonResponse(res, 400, 'Danh mục không hợp lệ hoặc không phải danh mục chi tiêu', null);
            }

            // Chuẩn hóa thời gian bắt đầu và kết thúc
            const sDate = new Date(start_date);
            sDate.setHours(0, 0, 0, 0);

            const eDate = new Date(end_date);
            eDate.setHours(23, 59, 59, 999);

            // Kiểm tra ngày kết thúc không được trước ngày hiện tại (ở múi giờ server)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (eDate < today) {
                return jsonResponse(res, 400, 'Ngày kết thúc không thể trước ngày hiện tại', null);
            }

            // Kiểm tra ngày bắt đầu không lớn hơn ngày kết thúc
            if (sDate > eDate) {
                return jsonResponse(res, 400, 'Ngày bắt đầu không thể sau ngày kết thúc', null);
            }

            const duplicateBudget = await prisma.budgets.findFirst({
                where: {
                    user_id: userId,
                    category_id: category_id,
                    status: 'ACTIVE',
                    start_date: sDate,
                    end_date: eDate
                }
            });

            if (duplicateBudget) {
                return jsonResponse(res, 400, 'Đã tồn tại ngân sách đang hoạt động với cùng khoảng thời gian này cho danh mục', null);
            }

            // Giới hạn số ngân sách hoạt động cho tài khoản FREE (tối đa 3 ngân sách ACTIVE)
            if (req.user.type === 'FREE') {
                const activeBudgetCount = await prisma.budgets.count({
                    where: {
                        user_id: userId,
                        status: 'ACTIVE'
                    }
                });
                if (activeBudgetCount >= 3) {
                    return jsonResponse(res, 403, 'Tài khoản FREE chỉ được tạo tối đa 3 ngân sách hoạt động cùng lúc. Vui lòng nâng cấp lên PREMIUM để không giới hạn.', null);
                }
            }

            const newBudget = await prisma.budgets.create({
                data: {
                    user_id: userId,
                    category_id,
                    amount_limit,
                    start_date: sDate,
                    end_date: eDate,
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
            
            // Tự động đồng bộ ngân sách quá hạn
            await autoSyncExpiredBudgets(userId);

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
            
            // Tự động đồng bộ ngân sách quá hạn
            await autoSyncExpiredBudgets(userId);

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
            
            // Tự động đồng bộ ngân sách quá hạn
            await autoSyncExpiredBudgets(userId);

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
            
            const targetCategoryId = category_id || budget.category_id;
            
            // Chuẩn hóa ngày bắt đầu và kết thúc mới (hoặc giữ nguyên ngày cũ)
            const targetStartDate = start_date ? new Date(start_date) : new Date(budget.start_date);
            if (start_date) targetStartDate.setHours(0, 0, 0, 0);

            const targetEndDate = end_date ? new Date(end_date) : new Date(budget.end_date);
            if (end_date) targetEndDate.setHours(23, 59, 59, 999);

            // Kiểm tra ngày kết thúc không được trước ngày hiện tại (ở múi giờ server)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (targetEndDate < today) {
                return jsonResponse(res, 400, 'Ngày kết thúc không thể trước ngày hiện tại', null);
            }

            // Kiểm tra ngày bắt đầu không lớn hơn ngày kết thúc
            if (targetStartDate > targetEndDate) {
                return jsonResponse(res, 400, 'Ngày bắt đầu không thể sau ngày kết thúc', null);
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
            }
            
            // Kiểm tra trùng lặp khoảng thời gian chính xác
            if (category_id || start_date || end_date) {
                const duplicateBudget = await prisma.budgets.findFirst({
                    where: {
                        user_id: userId,
                        category_id: targetCategoryId,
                        status: 'ACTIVE',
                        id: {
                            not: Number(budgetId)
                        },
                        start_date: targetStartDate,
                        end_date: targetEndDate
                    }
                });
                if (duplicateBudget) {
                    return jsonResponse(res, 400, 'Đã tồn tại ngân sách đang hoạt động với cùng khoảng thời gian này cho danh mục', null);
                }
            }
            const dataToUpdate = {};
            if (category_id) dataToUpdate.category_id = category_id;
            if (amount_limit !== undefined) dataToUpdate.amount_limit = amount_limit;
            if (start_date) dataToUpdate.start_date = targetStartDate;
            if (end_date) dataToUpdate.end_date = targetEndDate;
            if (is_alert_enabled !== undefined) dataToUpdate.is_alert_enabled = is_alert_enabled;
            if (alert_threshold !== undefined) dataToUpdate.alert_threshold = alert_threshold;

            const updatedBudget = await prisma.budgets.update({
                where: {
                    id: Number(budget.id)
                },
                data: dataToUpdate
            });
            return jsonResponse(res, 200, 'Cập nhật ngân sách thành công', updatedBudget);
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
            const updatedBudget = await prisma.budgets.update({
                where: {
                    id: Number(budget.id)
                },
                data: {
                    status: 'COMPLETED',
                    final_spent_amount: finalSpent,
                    result_status: resultStatus,
                    completion_date: new Date()
                }
            });
            return jsonResponse(res, 200, 'Đã hoàn thành và chốt ngân sách thành công', updatedBudget);
        } catch (error) {
            console.error('[Budget] completeBudget error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi hoàn thành ngân sách', null);
        }
    },
    syncExpiredBudgets: async (req, res) => {
        try {
            const now = new Date();
            const expiredBudgets = await prisma.budgets.findMany({
                where: {
                    status: 'ACTIVE',
                    end_date: {
                        lt: now
                    }
                }
            });

            const updatedBudgets = [];
            for (const budget of expiredBudgets) {
                const finalSpent = await calculateCurrentSpent(budget);
                let resultStatus = 'EXACT';
                if (finalSpent < Number(budget.amount_limit)) {
                    resultStatus = 'UNDER_BUDGET';
                } else if (finalSpent > Number(budget.amount_limit)) {
                    resultStatus = 'OVER_BUDGET';
                }

                const updated = await prisma.budgets.update({
                    where: {
                        id: budget.id
                    },
                    data: {
                        status: 'COMPLETED',
                        final_spent_amount: finalSpent,
                        result_status: resultStatus,
                        completion_date: now
                    }
                });
                updatedBudgets.push(updated);
            }

            return jsonResponse(res, 200, `Đồng bộ thành công. Đã hoàn thành ${updatedBudgets.length} ngân sách quá hạn.`, {
                processed_count: updatedBudgets.length,
                budgets: updatedBudgets
            });
        } catch (error) {
            console.error('[Budget] syncExpiredBudgets error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi đồng bộ ngân sách quá hạn', null);
        }
    },
    deleteBudget: async (req, res) => {
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
            await prisma.budgets.delete({
                where: {
                    id: Number(budget.id)
                }
            });
            return jsonResponse(res, 200, 'Xóa ngân sách thành công', null);
        } catch (error) {
            console.error('[Budget] deleteBudget error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi xóa ngân sách', null);
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

export const autoSyncExpiredBudgets = async (userId) => {
    try {
        const now = new Date();
        const expiredBudgets = await prisma.budgets.findMany({
            where: {
                user_id: userId,
                status: 'ACTIVE',
                end_date: {
                    lt: now
                }
            }
        });

        for (const budget of expiredBudgets) {
            const finalSpent = await calculateCurrentSpent(budget);
            let resultStatus = 'EXACT';
            if (finalSpent < Number(budget.amount_limit)) {
                resultStatus = 'UNDER_BUDGET';
            } else if (finalSpent > Number(budget.amount_limit)) {
                resultStatus = 'OVER_BUDGET';
            }

            await prisma.budgets.update({
                where: {
                    id: budget.id
                },
                data: {
                    status: 'COMPLETED',
                    final_spent_amount: finalSpent,
                    result_status: resultStatus,
                    completion_date: now
                }
            });
        }
    } catch (error) {
        console.error('[Budget] autoSyncExpiredBudgets error:', error);
    }
};

export const checkBudgetAlerts = async (userId, categoryId) => {
    try {
        // Tự động đồng bộ ngân sách quá hạn trước khi kiểm tra cảnh báo
        await autoSyncExpiredBudgets(userId);

        // Lấy tất cả ngân sách ACTIVE của user cho category này
        const activeBudgets = await prisma.budgets.findMany({
            where: {
                user_id: userId,
                category_id: categoryId,
                status: 'ACTIVE',
                is_alert_enabled: true
            },
            include: {
                categories: true
            }
        });

        for (const budget of activeBudgets) {
            const currentSpent = await calculateCurrentSpent(budget);
            const limit = Number(budget.amount_limit);

            if (!limit || limit <= 0) continue;

            const percentage = currentSpent / limit;
            const categoryName = budget.categories?.name || "Unknown Category";

            console.log(
                `[Budget] User ${userId} spent ${percentage * 100}% of ${categoryName}`
            );

            if (currentSpent >= limit) {
                // Kiểm tra xem đã gửi cảnh báo vượt hạn mức chưa
                const existingExceededWarning = await prisma.notifications.findFirst({
                    where: {
                        user_id: userId,
                        type: 'WARNING',
                        status: 'ACTIVE',
                        title: 'Cảnh báo vượt ngân sách',
                        message: {
                            contains: `đã tiêu vượt quá hạn mức`
                        },
                        created_at: {
                            gte: budget.start_date
                        }
                    }
                });

                if (!existingExceededWarning) {
                    console.log(
                        `[Budget] Creating Exceeded Warning for User ${userId}`
                    );

                    await createNotification(
                        userId,
                        "Cảnh báo vượt ngân sách",
                        `Bạn đã tiêu vượt quá hạn mức (${limit.toLocaleString("vi-VN")} đ) cho danh mục: ${categoryName}`,
                        "WARNING"
                    );
                }

            } else if (
                percentage >= Number(budget.alert_threshold || 0.8)
            ) {
                // Kiểm tra xem đã gửi cảnh báo ngưỡng hoặc vượt hạn mức chưa (tránh spam khi chạm ngưỡng)
                const existingWarning = await prisma.notifications.findFirst({
                    where: {
                        user_id: userId,
                        type: 'WARNING',
                        status: 'ACTIVE',
                        title: 'Cảnh báo vượt ngân sách',
                        message: {
                            contains: `danh mục: ${categoryName}`
                        },
                        created_at: {
                            gte: budget.start_date
                        }
                    }
                });

                if (!existingWarning) {
                    console.log(
                        `[Budget] Sending Threshold Alert for User ${userId}`
                    );

                    const thresholdPercent = Math.round(Number(budget.alert_threshold || 0.8) * 100);
                    await createNotification(
                        userId,
                        "Cảnh báo vượt ngân sách",
                        `Bạn đã chi tiêu vượt quá ${thresholdPercent}% hạn mức cho danh mục: ${categoryName}`,
                        "WARNING"
                    );
                }
            }
        }
    } catch (error) {
        console.error(
            '[Budget] checkBudgetAlerts error:',
            error.message
        );
    }
};
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

        
    }


}
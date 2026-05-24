import {jsonResponse} from '../utils/responseHelper.js';
import * as notificationService from '../services/notificationService.js';


export const notificationController = {
    getNotifications: async (req, res) => {
        try {
            const userId = req.user.id;
            const notifications = await notificationService.getUserNotifications(userId);
            return jsonResponse(res, 200, 'Success', notifications);
        } catch (error) {
            console.error('[NotificationController] getNotifications error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi lấy thông báo', null);
        }
    },
    getNotificationDetail: async (req, res) => {
        try {
            const userId = req.user.id;
            const notificationId = parseInt(req.params.id);
            const notification = await notificationService.getNotificationById(notificationId, userId);
            if (!notification) {
                return jsonResponse(res, 404, 'Không tìm thấy thông báo hoặc bạn không có quyền xem', null);
            }
            return jsonResponse(res, 200, 'Success', notification);
        } catch (error) {
            console.error('[NotificationController] getNotificationDetail error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi lấy chi tiết thông báo', null);
        }

    },
    markNotificationRead: async (req, res) => {
        try {
            const userId = req.user.id;
            const notificationId = parseInt(req.params.id);
            const updated = await notificationService.markAsRead(notificationId, userId);
            if (!updated) {
                return jsonResponse(res, 404, 'Không tìm thấy thông báo hoặc bạn không có quyền', null);
            }
            return jsonResponse(res, 200, 'Đã đánh dấu thông báo là đã đọc', updated);
        } catch (error) {
            console.error('[NotificationController] markNotificationRead error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi cập nhật trạng thái đã đọc', null);
        }
    }


}
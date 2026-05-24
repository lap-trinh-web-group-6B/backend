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
    }

}
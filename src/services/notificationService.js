import {prisma} from "../config/database.js";

export const createNotification = async (userId, title, message, type) => {
    try {
        const notification = await prisma.notifications.create({
            data: {
                user_id: userId,
                title,
                message,
                type,
                is_read: false,
                status: 'ACTIVE'
            }
        });
        return notification;
    } catch (error) {
        console.error('[NotificationService] createNotification error:', error);
        throw error;
    }
};

export const getUserNotifications = async (userId) => {
    try {
        return await prisma.notifications.findMany({
            where: {
                user_id: userId,
                status: 'ACTIVE'
            },
            orderBy: {
                created_at: 'desc'
            }
        });
    } catch (error) {
        console.error('[NotificationService] getUserNotifications error:', error);
        throw error;
    }
};

export const getNotificationById = async (id, userId) => {
    try {
        return await prisma.notifications.findFirst({
            where: {
                id,
                user_id: userId,
                status: 'ACTIVE'
            }
        });
    } catch (error) {
        console.error('[NotificationService] getNotificationById error:', error);
        throw error;
    }
};

export const markAsRead = async (id, userId) => {
    try {
        const notification = await getNotificationById(id, userId);
        if (!notification) return null;
        return await prisma.notifications.update({
            where: {
                id: notification.id
            },
            data: {
                is_read: true
            }
        });
    } catch (error) {
        console.error('[NotificationService] markAsRead error:', error);
        throw error;
    }
};

export const softDeleteNotification = async (id, userId) => {
    try {
        const notification = await getNotificationById(id, userId);
        if (!notification) return null;
        return await prisma.notifications.update({
            where: {
                id: notification.id
            },
            data: {
                status: 'DELETED',
                deleted_at: new Date()
            }
        });
    } catch (error) {
        console.error('[NotificationService] softDeleteNotification error:', error);
        throw error;
    }
};

export const softDeleteAllNotifications = async (userId) => {
    try {
        return await prisma.notifications.updateMany({
            where: {
                user_id: userId,
                status: 'ACTIVE'
            },
            data: {
                status: 'DELETED',
                deleted_at: new Date()
            }
        });
    } catch (error) {
        console.error('[NotificationService] softDeleteAllNotifications error:', error);
        throw error;
    }
};

export const triggerNegativeBalanceWarning = async (wallet, user) => {
    try {
        await createNotification(
            user.id || user,
            "Cảnh báo số dư ví âm",
            `${wallet.name} đã bị âm. Vui lòng kiểm tra lại các giao dịch của bạn.`,
            "WARNING"
        );

        // Note: Tích hợp thêm push notification hoặc email cảnh báo tại đây trong tương lai
        console.log(
            `[NotificationService] Warning: Wallet ${wallet.name} for user ${user.id || user} has negative balance.`
        );
    } catch (error) {
        // Note: Cảnh báo là non-blocking nên chỉ log lỗi mà không throw
        console.error('[NotificationService] triggerNegativeBalanceWarning error:', error);
    }
};

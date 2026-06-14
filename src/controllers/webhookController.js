import { createNotification } from '../services/notificationService.js';
import {prisma} from "../config/database.js";

export const webhookController = {
    handleSepayWebhook: async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            let apiKey = '';
            if (authHeader && authHeader.startsWith('Apikey ')) {
                apiKey = authHeader.split(' ')[1];
            } else if (authHeader) {
                apiKey = authHeader;
            } else if (req.headers['x-api-key']) {
                apiKey = req.headers['x-api-key'];
            } else if (req.query.apikey) {
                apiKey = req.query.apikey;
            }

            const expectedKey = process.env.SEPAY_WEBHOOK_KEY || 'sepay_webhook_secure_key_2026';
            if (apiKey !== expectedKey) {
                console.log('[Webhook] Từ chối: Sai khóa webhook bảo mật hoặc không được cung cấp');
                return res.status(401).json({ success: false, message: 'Unauthorized webhook request' });
            }

            res.status(200).json({ success: true });
            console.log('Webhook Running.....');
            const payload = req.body;
            console.log('Payload:', payload);
            if (payload.transferType !== 'in') {
                return;
            }
            const rawContent = payload.content
                ? payload.content.toUpperCase()
                : '';
            const match = rawContent.match(/PRE(\d{8})/);
            if (!match) {
                console.log(
                    `[Bỏ qua] Nội dung không chứa mã PRE hợp lệ: ${rawContent}`
                );
                return;
            }
            const orderCode = match[1];
            const transferAmount = Number(payload.transferAmount);
            const pendingOrder = await prisma.orders.findFirst({
                where: {
                    orderCode,
                    status: 'pending'
                }
            });
            if (!pendingOrder) {
                console.log(`[Webhook] Không tìm thấy order pending ${orderCode}`);
                return;
            }
            if (transferAmount < pendingOrder.amount) {
                console.log(
                    `[Webhook] Số tiền không đủ. Required: ${pendingOrder.amount} - Received: ${transferAmount}`
                );
                return;
            }
            await prisma.$transaction(async (tx) => {
                const updatedOrder = await tx.orders.update({
                    where: {
                        id: pendingOrder.id
                    },
                    data: {
                        status: 'success'
                    }
                });
                const user = await tx.users.update({
                    where: {
                        id: updatedOrder.userId
                    },
                    data: {
                        type: 'PREMIUM'
                    }
                });
                const title = 'Nâng cấp Premium Thành Công';
                const body = 'Tài khoản của bạn đã trở thành PREMIUM!';
                await createNotification(
                    user.id,
                    title,
                    body,
                    'SYSTEM'
                );
                console.log(
                    `[Webhook] User ${user.id} - ${user.fullName} đã kích hoạt PREMIUM thành công qua đơn hàng ${orderCode}`
                );
            });
        } catch (error) {
            console.error(
                '[WebhookController] sepay processing error:',
                error
            );
        }
    }
};
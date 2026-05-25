import { createNotification } from '../services/notificationService.js';
import {prisma} from "../config/database.js";

export const webhookController = {
    handleSepayWebhook: async (req, res) => {
        res.status(200).json({ success: true });
        console.log('Webhook Running.....');
        try {
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
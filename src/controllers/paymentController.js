import { jsonResponse } from '../utils/responseHelper.js';
import {prisma} from '../config/database.js';

export const paymentController = {
    checkout: async (req, res) => {
        try {
            const userId = req.user.id;
            const orderCode = Math.floor(
                10000000 + Math.random() * 90000000
            ).toString();
            const amount = 2000;

            const newOrder = await prisma.orders.create({
                data: {
                    userId,
                    orderCode,
                    amount,
                    status: 'pending'
                }
            });
            const transferContent = `PRE${orderCode}`;
            const binBank =
                process.env.BIN_BANK_ACCOUNT || '970405';
            const bankAccount =
                process.env.BANK_ACCOUNT || '3910205185595';
            const qrUrl =
                `https://img.vietqr.io/image/` +
                `${binBank}-${bankAccount}-compact2.jpg` +
                `?amount=${amount}` +
                `&addInfo=${transferContent}`;

            return jsonResponse(
                res,
                200,
                'Tạo đơn hàng nâng cấp PREMIUM thành công',
                {
                    amount,
                    transferContent,
                    qrUrl,
                    order: newOrder
                }
            );

        } catch (error) {
            console.error(
                '[PaymentController] checkout error:',
                error
            );

            return jsonResponse(
                res,
                500,
                'Lỗi server khi tạo đơn hàng',
                null
            );
        }
    }
};
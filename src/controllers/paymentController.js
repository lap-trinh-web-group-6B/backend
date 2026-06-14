import { jsonResponse } from '../utils/responseHelper.js';
import {prisma} from '../config/database.js';
import { configService, systemConfigKeys } from '../services/configService.js';

export const paymentController = {
    checkout: async (req, res) => {
        try {
            const userId = req.user.id;
            const orderCode = Math.floor(
                10000000 + Math.random() * 90000000
            ).toString();
            
            // Lấy giá gói Premium động từ cấu hình hệ thống
            const premiumPriceStr = await configService.get(systemConfigKeys.PREMIUM_PRICE, '2000');
            const amount = Number(premiumPriceStr);

            const newOrder = await prisma.orders.create({
                data: {
                    userId,
                    orderCode,
                    amount,
                    status: 'pending'
                }
            });
            const transferContent = `PRE${orderCode}`;
            
            // Lấy thông tin tài khoản động từ cấu hình hệ thống
            const binBank = await configService.get(systemConfigKeys.BANK_BIN, process.env.BIN_BANK_ACCOUNT || '970405');
            const bankAccount = await configService.get(systemConfigKeys.BANK_ACCOUNT, process.env.BANK_ACCOUNT || '3910205185595');

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
    },

    getConfig: async (req, res) => {
        try {
            const configs = await configService.getMany({
                [systemConfigKeys.PREMIUM_PRICE]: '2000',
                [systemConfigKeys.BANK_BIN]: process.env.BIN_BANK_ACCOUNT || '970405',
                [systemConfigKeys.BANK_ACCOUNT]: process.env.BANK_ACCOUNT || '3910205185595',
                [systemConfigKeys.BANK_NAME]: 'VietinBank',
                [systemConfigKeys.BANK_OWNER_NAME]: 'NGUYEN VAN A'
            });

            return jsonResponse(res, 200, 'Lấy cấu hình thanh toán thành công', {
                premiumPrice: Number(configs[systemConfigKeys.PREMIUM_PRICE]),
                bankBin: configs[systemConfigKeys.BANK_BIN],
                bankAccount: configs[systemConfigKeys.BANK_ACCOUNT],
                bankName: configs[systemConfigKeys.BANK_NAME],
                bankOwnerName: configs[systemConfigKeys.BANK_OWNER_NAME]
            });
        } catch (error) {
            console.error('[PaymentController] getConfig error:', error);
            return jsonResponse(res, 500, 'Lỗi server khi lấy cấu hình thanh toán', null);
        }
    }
};
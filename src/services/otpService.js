import {prisma} from '../config/database.js';
import { sendOtpEmail } from '../utils/mailSender.js';

const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const otpService = {

    sendOtp: async (email) => {
        const recentOtp = await prisma.otps.findFirst({
            where: { email },
            orderBy: { createdAt: 'desc' }
        });

        if (recentOtp) {
            const now = new Date();
            const diffMs = now.getTime() - new Date(recentOtp.createdAt).getTime();
            const diffMins = Math.round(diffMs / 60000);

            if (diffMins < 1) {
                throw new Error('Bạn cần chờ ít nhất 1 phút để yêu cầu gửi lại OTP');
            }
        }

        await prisma.otps.deleteMany({
            where: { email }
        });

        const newOtpCode = generateOtp();
        await prisma.otps.create({
            data: {
                email,
                otp: newOtpCode
            }
        });

        await sendOtpEmail(email, newOtpCode);
    },
    verifyOtp: async (email, inputOtp) => {
        const otpEntity = await prisma.otps.findFirst({
            where: {
                email
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        if (!otpEntity || otpEntity.otp !== inputOtp) {
            return false;
        }
        const now = new Date();
        const diffMs = now.getTime() - new Date(otpEntity.createdAt).getTime();
        const diffMins = Math.round(diffMs / 60000);
        await prisma.otps.deleteMany({
            where: {
                email
            }
        });
        if (diffMins > 15) {
            return false;
        }
        return true;
    },
    clearExpiredOtps: async () => {
        const timeLimit = new Date(Date.now() - 15 * 60 * 1000); // 15 phút trước
        await prisma.otps.deleteMany({
            where: {
                createdAt: {
                    lt: timeLimit,
                },
            },
        });
        console.log(
            `[Job] Đã dọn dẹp các OTP hết hạn (tạo trước ${timeLimit.toISOString()})`
        );
    }
};

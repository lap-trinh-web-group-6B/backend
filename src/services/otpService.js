import {prisma} from '../config/database.js';
import { sendOtpEmail } from '../utils/resend.js';

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
};

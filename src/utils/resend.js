import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOtpEmail = async (toEmail, otpCode) => {
    try {
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev',
            to: toEmail,
            subject: "Mã xác thực (OTP) - Expense Tracker",
            html: `<h3>Xin chào!</h3>
             <p>Mã OTP của bạn là: <strong>${otpCode}</strong></p>
             <p>Mã này có hiệu lực trong 15 phút. Vui lòng không chia sẻ cho người khác.</p>`,
        });

        if (error) {
            console.error(`[Resend] Lỗi cấu hình/gửi email:`, error);
            throw new Error('Từ chối gửi email: ' + error.message);
        }

        console.log(`[Resend] Đã gửi OTP thành công tới ${toEmail} (ID: ${data?.id})`);
    } catch (error) {
        console.error(`[Resend] Ngoại lệ gửi email:`, error.message);
        throw new Error('Không thể gửi email OTP thông qua Resend');
    }
};
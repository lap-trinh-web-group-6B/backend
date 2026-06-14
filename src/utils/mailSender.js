import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Khởi tạo SMTP Transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true cho SSL (port 465), false cho TLS (port 587)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const senderEmail = process.env.SMTP_SENDER || process.env.SMTP_USER || 'no-reply@expensetracker.com';

export const sendOtpEmail = async (toEmail, otpCode) => {
    try {
        const info = await transporter.sendMail({
            from: senderEmail,
            to: toEmail,
            subject: "Mã xác thực (OTP) - Expense Tracker",
            html: `<h3>Xin chào!</h3>
             <p>Mã OTP của bạn là: <strong>${otpCode}</strong></p>
             <p>Mã này có hiệu lực trong 15 phút. Vui lòng không chia sẻ cho người khác.</p>`,
        });

        console.log(`[SMTP] Đã gửi OTP thành công tới ${toEmail} (MessageId: ${info.messageId})`);
    } catch (error) {
        console.error(`[SMTP] Lỗi gửi email OTP:`, error.message);
        throw new Error('Không thể gửi email OTP thông qua SMTP');
    }
};

export const sendBanWarningEmail = async (toEmail) => {
    try {
        const info = await transporter.sendMail({
            from: senderEmail,
            to: toEmail,
            subject: "Tài khoản của bạn đã bị khóa - Expense Tracker",
            html: `<h3>Thông báo từ Ban Quản Trị</h3>
             <p>Chào bạn,</p>
             <p>Tài khoản của bạn trên <strong>Expense Tracker</strong> đã bị khóa (BANNED) bởi quản trị viên do vi phạm điều khoản hoặc hoạt động bất thường.</p>
             <p>Nếu bạn tin rằng đây là một sự nhầm lẫn, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi để được giải quyết.</p>
             <p>Trân trọng,<br>Đội ngũ Monety</p>`,
        });

        console.log(`[SMTP] Đã gửi mail thông báo khóa tới ${toEmail} (MessageId: ${info.messageId})`);
    } catch (error) {
        console.error(`[SMTP] Lỗi gửi email khóa tài khoản:`, error.message);
        throw new Error('Không thể gửi email thông báo khóa thông qua SMTP');
    }
};

export const sendUnbanNotificationEmail = async (toEmail) => {
    try {
        const info = await transporter.sendMail({
            from: senderEmail,
            to: toEmail,
            subject: "Tài khoản của bạn đã được mở khóa - Expense Tracker",
            html: `<h3>Thông báo từ Ban Quản Trị</h3>
             <p>Chào bạn,</p>
             <p>Tài khoản của bạn trên <strong>Expense Tracker</strong> đã được mở khóa bởi quản trị viên.</p>
             <p>Hiện tại bạn có thể đăng nhập lại và sử dụng các tính năng của ứng dụng bình thường.</p>
             <p>Trân trọng,<br>Đội ngũ Monety</p>`,
        });

        console.log(`[SMTP] Đã gửi mail thông báo mở khóa tới ${toEmail} (MessageId: ${info.messageId})`);
    } catch (error) {
        console.error(`[SMTP] Lỗi gửi email mở khóa tài khoản:`, error.message);
        throw new Error('Không thể gửi email thông báo mở khóa thông qua SMTP');
    }
};

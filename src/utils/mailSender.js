import dotenv from 'dotenv';
dotenv.config();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
// SENDER_EMAIL must be a verified email address on your Brevo account
const SENDER_EMAIL = process.env.SMTP_USER;

const sendMailViaBrevo = async (toEmail, subject, htmlContent) => {
    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY || '',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    name: 'Expense Tracker',
                    email: SENDER_EMAIL
                },
                to: [
                    {
                        email: toEmail
                    }
                ],
                subject: subject,
                htmlContent: htmlContent
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Lỗi gửi email qua Brevo API');
        }
        return data;
    } catch (error) {
        console.error(`[Brevo API Error]`, error.message);
        throw error;
    }
};

export const sendOtpEmail = async (toEmail, otpCode) => {
    try {
        const htmlContent = `<h3>Xin chào!</h3>
              <p>Mã OTP của bạn là: <strong>${otpCode}</strong></p>
              <p>Mã này có hiệu lực trong 15 phút. Vui lòng không chia sẻ cho người khác.</p>`;
        
        await sendMailViaBrevo(toEmail, "Mã xác thực (OTP) - Expense Tracker", htmlContent);
        console.log(`[Brevo API] Đã gửi OTP thành công tới ${toEmail}`);
    } catch (error) {
        console.error(`[SMTP] Lỗi gửi email OTP:`, error.message);
        throw new Error('Không thể gửi email OTP thông qua Brevo API');
    }
};

export const sendBanWarningEmail = async (toEmail) => {
    try {
        const htmlContent = `<h3>Thông báo từ Ban Quản Trị</h3>
              <p>Chào bạn,</p>
              <p>Tài khoản của bạn trên <strong>Expense Tracker</strong> đã bị khóa (BANNED) bởi quản trị viên do vi phạm điều khoản hoặc hoạt động bất thường.</p>
              <p>Nếu bạn tin rằng đây là một sự nhầm lẫn, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi để được giải quyết.</p>
              <p>Trân trọng,<br>Đội ngũ Monety</p>`;

        await sendMailViaBrevo(toEmail, "Tài khoản của bạn đã bị khóa - Expense Tracker", htmlContent);
        console.log(`[Brevo API] Đã gửi mail thông báo khóa tới ${toEmail}`);
    } catch (error) {
        console.error(`[SMTP] Lỗi gửi email khóa tài khoản:`, error.message);
        throw new Error('Không thể gửi email thông báo khóa thông qua Brevo API');
    }
};

export const sendUnbanNotificationEmail = async (toEmail) => {
    try {
        const htmlContent = `<h3>Thông báo từ Ban Quản Trị</h3>
              <p>Chào bạn,</p>
              <p>Tài khoản của bạn trên <strong>Expense Tracker</strong> đã được mở khóa bởi quản trị viên.</p>
              <p>Hiện tại bạn có thể đăng nhập lại và sử dụng các tính năng của ứng dụng bình thường.</p>
              <p>Trân trọng,<br>Đội ngũ Monety</p>`;

        await sendMailViaBrevo(toEmail, "Tài khoản của bạn đã được mở khóa - Expense Tracker", htmlContent);
        console.log(`[Brevo API] Đã gửi mail thông báo mở khóa tới ${toEmail}`);
    } catch (error) {
        console.error(`[SMTP] Lỗi gửi email mở khóa tài khoản:`, error.message);
        throw new Error('Không thể gửi email thông báo mở khóa thông qua Brevo API');
    }
};

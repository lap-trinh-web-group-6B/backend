import {prisma} from '../config/database.js';
import {isValidEmail} from '../utils/validators.js';
import {otpService} from '../services/otpService.js';
import {jsonResponse} from '../utils/responseHelper.js';

export const authController = {
    registerSendOtp: async (req, res) => {
        try {
            const {fullName, email, password} = req.body;
            if (!fullName || !email || !password) {
                return jsonResponse(res, 400, 'Lỗi tham số', {error: 'fullName, email và password là bắt buộc'});
            }
            if (!isValidEmail(email)) {
                return jsonResponse(res, 400, 'Lỗi định dạng', {email: 'Định dạng email không hợp lệ'});
            }
            const existingUser = await prisma.users.findFirst({
                where: { email }
            });
            if (existingUser) {
                if (['ACTIVATE', 'DISABLE', 'BANNED'].includes(existingUser.status)) {
                    return jsonResponse(res, 400, 'Không hợp lệ', {email: 'Email đã được sử dụng'});
                }
            }
            await otpService.sendOtp(email);
            return jsonResponse(res, 200, 'Đã gửi mã OTP tới email, hãy kiểm tra hòm thư', null);
        } catch (error) {
            return jsonResponse(res, 400, 'Lỗi hệ thống', {error: error.message});
        }
    }
};

import {prisma} from '../config/database.js';
import {isValidEmail} from '../utils/validators.js';
import {otpService} from '../services/otpService.js';
import {jsonResponse} from '../utils/responseHelper.js';
import {generateAccessToken} from "../services/jwtService.js";
import * as argon2 from 'argon2';

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
    },
    registerVerifyOtp: async (req, res) => {
        try {
            const {fullName, email, password, otp} = req.body;
            if (!email || !otp || !password) {
                return jsonResponse(res, 400, 'Lỗi tham số', {otp: 'Thiếu thông tin xác thực'});
            }
            if (!isValidEmail(email)) {
                return jsonResponse(res, 400, 'Lỗi định dạng', {email: 'Định dạng email không hợp lệ'});
            }
            const isValid = await otpService.verifyOtp(email, otp);
            if (!isValid) {
                return jsonResponse(res, 400, 'Lỗi OTP', {otp: 'OTP không hợp lệ hoặc đã hết hạn'});
            }
            const hashedPassword = await argon2.hash(password);
            let newUser = await prisma.users.findUnique({
                where: {
                    email,
                },
            });
            if (!newUser) {
                newUser = await prisma.users.create({
                    data: {
                        fullName: fullName || `User_${Date.now()}`,
                        email,
                        password: hashedPassword,
                        status: 'ACTIVATE',
                    },
                });
            } else {
                newUser = await prisma.users.update({
                    where: {
                        id: newUser.id,
                    },
                    data: {
                        fullName: fullName || newUser.fullName,
                        password: hashedPassword,
                        status: 'ACTIVATE',
                    },
                });
            }
            const userData = newUser;
            await otpService.clearExpiredOtps().catch(console.error);
            const accessToken = generateAccessToken(userData);
            const {password: userPassword, syncId, createdAt, ...safeUser} = userData;
            return jsonResponse(res, 201, 'Tạo tài khoản thành công', {accessToken, user: safeUser});
        } catch (error) {
            return jsonResponse(res, 400, 'Lỗi đăng ký', {error: error.message});
        }
    }
};

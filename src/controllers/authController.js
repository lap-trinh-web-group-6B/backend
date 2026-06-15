import {prisma} from '../config/database.js';
import {isValidEmail} from '../utils/validators.js';
import {otpService} from '../services/otpService.js';
import {jsonResponse} from '../utils/responseHelper.js';
import {generateAccessToken, generateForgotPasswordToken,
verifyToken, generateRefreshToken, verifyRefreshToken} from '../services/jwtService.js';
import * as argon2 from 'argon2';

export const authController = {
    registerSendOtp: async (req, res) => {
        try {
            const {fullName, email, password} = req.body;
            if (!fullName || !email || !password) {
                return jsonResponse(res, 400, 'fullName, email và password là bắt buộc', null);
            }
            if (!isValidEmail(email)) {
                return jsonResponse(res, 400, 'Định dạng email không hợp lệ', null);
            }
            const existingUser = await prisma.users.findFirst({
                where: { email }
            });
            if (existingUser) {
                if (['ACTIVATE', 'DISABLE', 'BANNED'].includes(existingUser.status)) {
                    return jsonResponse(res, 400, 'Email đã được sử dụng', null);
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
                return jsonResponse(res, 400, 'Thiếu thông tin xác thực', null);
            }
            if (!isValidEmail(email)) {
                return jsonResponse(res, 400, 'Định dạng email không hợp lệ', null);
            }
            const isValid = await otpService.verifyOtp(email, otp);
            if (!isValid) {
                return jsonResponse(res, 400, 'OTP không hợp lệ hoặc đã hết hạn', null);
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
            const refreshToken = generateRefreshToken(userData);
            await prisma.users.update({
                where: { id: userData.id },
                data: { refreshToken }
            });
            const {password: userPassword, syncId, createdAt, ...safeUser} = userData;
            return jsonResponse(res, 201, 'Tạo tài khoản thành công', {accessToken, refreshToken, user: safeUser});
        } catch (error) {
            return jsonResponse(res, 400, 'Lỗi đăng ký', {error: error.message});
        }
    },
    registerResendOtp: async (req, res) => {
        try {
            const {email} = req.body;
            if (!email) return jsonResponse(res, 400, 'Email là bắt buộc', null);
            if (!isValidEmail(email)) return jsonResponse(res, 400, 'Định dạng email không hợp lệ', null);

            await otpService.sendOtp(email);
            return jsonResponse(res, 200, 'Đã gửi lại OTP', null);
        } catch (error) {
            return jsonResponse(res, 400, 'Cảnh báo chống Spam', {error: error.message});
        }
    },
    login: async (req, res) => {
        try {
            const {email, password} = req.body;
            if (!isValidEmail(email)) {
                return jsonResponse(res, 400, 'Định dạng email không hợp lệ', null);
            }
            const user = await prisma.users.findUnique({
                where: {
                    email,
                },
            });
            if (!user) {
                return jsonResponse(res, 400, 'Email hoặc mật khẩu không chính xác', null);
            }
            switch (user.status) {
                case 'BANNED':
                    return jsonResponse(res, 403, 'Bị chặn', {email: 'Tài khoản đã bị cấm'});
                case 'CANCEL':
                    return jsonResponse(res, 400, 'Email hoặc mật khẩu không chính xác', null);
                case 'DISABLE':
                    // Theo nghiệp vụ, DISABLE vẫn có thể đăng nhập hoặc bạn có thể cấm
                    break;
            }
            const isPasswordValid = await argon2.verify(user.password, password);
            if (!isPasswordValid) {
                return jsonResponse(res, 400, 'Email hoặc mật khẩu không chính xác', null);
            }
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user);
            await prisma.users.update({
                where: { id: user.id },
                data: {
                    refreshToken,
                }
            });
            const {password: userPassword, syncId, createdAt, ...safeUser} = user;
            return jsonResponse(res, 200, 'Đăng nhập thành công', {accessToken, refreshToken, user: safeUser});
        } catch (error) {
            return jsonResponse(res, 500, 'Lỗi hệ thống', {error: error.message});
        }

    },
    forgotPasswordSendOtp: async (req, res) => {
        try {
            const {email} = req.body;
            if (!isValidEmail(email)) {
                return jsonResponse(res, 400, 'Định dạng email không hợp lệ', null);
            }
            const user = await prisma.users.findUnique({
                where: {
                    email,
                },
            });
            if (!user || user.status === 'CANCEL') {
                return jsonResponse(res, 400, 'Email chưa đăng ký', null);
            }
            if (user.status === 'BANNED') {
                return jsonResponse(res, 403, 'Bị chặn', {email: 'Tài khoản đã bị cấm'});
            }
            await otpService.sendOtp(email);
            return jsonResponse(res, 200, 'Yêu cầu đặt lại mật khẩu thành công. Vui lòng kiểm tra email', null);
        } catch (error) {
            return jsonResponse(res, 400, 'Hệ thống bận', {error: error.message});
        }

    },
    forgotPasswordVerifyOtp: async (req, res) => {
        try {
            const {email, otp} = req.body;
            if (!isValidEmail(email)) {
                return jsonResponse(res, 400, 'Định dạng email không hợp lệ', null);
            }
            const isValid = await otpService.verifyOtp(email, otp);
            if (!isValid) {
                return jsonResponse(res, 400, 'OTP không hợp lệ hoặc đã hết hạn', null);
            }
            const user = await prisma.users.findUnique({
                where: {
                    email,
                },
            });
            const fpToken = generateForgotPasswordToken(user.id);
            return jsonResponse(res, 200, 'Xác minh OTP thành công', {forgotPasswordToken: fpToken});
        } catch (error) {
            return jsonResponse(res, 400, 'Lỗi hệ thống', {error: error.message});
        }
    },
    resetPassword: async (req, res) => {
        try {
            const {forgotPasswordToken, password, confirmPassword} = req.body;
            if (password !== confirmPassword) {
                return jsonResponse(res, 400, 'Mật khẩu và Xác nhận mật khẩu không khớp', null);
            }
            const decodedData = verifyToken(forgotPasswordToken);
            if (decodedData.type !== 'forgot_password') {
                return jsonResponse(res, 400, 'Mã xác thực không hợp lệ cho yêu cầu đặt lại mật khẩu', null);
            }
            const user = await prisma.users.findUnique({
                where: {
                    id: decodedData.id,
                },
            });
            if (!user) return jsonResponse(res, 400, 'Hỏng dữ liệu', {error: 'Không tìm thấy người dùng'});
            await prisma.users.update({
                where: {
                    id: user.id,
                },
                data: {
                    password: await argon2.hash(password),
                },
            });
            return jsonResponse(res, 200, 'Đặt lại mật khẩu thành công', null);
        } catch (error) {
            return jsonResponse(res, 401, 'Token lỗi', {error: error.message || 'Yêu cầu không hợp lệ'});
        }
    },
    refreshToken: async (req, res) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return jsonResponse(res, 400, 'Thiếu token', {
                    error: 'refreshToken là bắt buộc'
                });
            }
            const decoded = verifyRefreshToken(refreshToken);
            const user = await prisma.users.findUnique({
                where: { id: decoded.id }
            });
            if (!user || user.status !== 'ACTIVATE' || user.refreshToken !== refreshToken) {
                return jsonResponse(res, 401, 'Token không hợp lệ hoặc tài khoản đã bị khóa', null);
            }
            const newAccessToken = generateAccessToken(user);
            return jsonResponse(res, 200, 'Refresh thành công', {
                accessToken: newAccessToken
            });
        } catch (error) {
            return jsonResponse(res, 401, 'Refresh token lỗi', {
                error: error.message
            });
        }
    },
    logout: async (req, res) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return jsonResponse(res, 400, 'Thiếu token', null);
            }
            const decoded = verifyRefreshToken(refreshToken);
            const user = await prisma.users.findUnique({
                where: { id: decoded.id }
            });
            if (!user) {
                return jsonResponse(res, 400, 'User không tồn tại', null);
            }
            await prisma.users.update({
                where: { id: user.id },
                data: {
                    refreshToken: null
                }
            });
            return jsonResponse(res, 200, 'Đăng xuất thành công', null);
        } catch (error) {
            return jsonResponse(res, 500, 'Lỗi logout', {
                error: error.message
            });
        }
    }

};

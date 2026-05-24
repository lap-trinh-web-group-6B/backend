import {jsonResponse} from '../utils/responseHelper.js';
import {prisma} from '../config/database.js';
import * as argon2 from 'argon2';
import {deleteFile} from "../utils/fileUtils.js";

export const userController= {
    getProfile: async (req, res) => {
        try {
            let id1 = req.user.id;
            const user = await prisma.users.findUnique({
                where: {
                    id: id1
                }
            });
            if (!user) {
                return jsonResponse(res, 404, 'Không tìm thấy người dùng', null);
            }
            const {password, syncId, createdAt, ...userData} = user;
            return jsonResponse(res, 200, 'Thành công', userData);
        } catch (error) {
            return jsonResponse(res, 500, 'Lỗi hệ thống', null);
        }
    },
    updateName: async (req, res) => {
        try {
            const {fullName} = req.body;
            if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
                return jsonResponse(res, 400, 'Lỗi', {fullName: 'Tên không hợp lệ'});
            }
            const user = await prisma.users.findUnique({
                where: {
                    id: req.user.id
                }
            });
            if (!user) {
                return jsonResponse(res, 404, 'Không tìm thấy người dùng', null);
            }
            user.fullName = fullName.trim();
            await prisma.users.update({
                where: {
                    id: user.id
                },
                data: user
            });
            const {password, syncId, createdAt, ...updatedUser} = user;
            return jsonResponse(res, 200, 'Thành công', updatedUser);
        } catch (error) {
            return jsonResponse(res, 500, 'Lỗi hệ thống', null);
        }

    },
    updateStatus: async (req, res) => {
        try {
            const {status} = req.body;
            if (!['ACTIVATE', 'DISABLE', 'CANCEL'].includes(status)) {
                return jsonResponse(res, 400, 'Lỗi', {status: 'Trạng thái không hợp lệ'});
            }
            const user = await prisma.users.findUnique({
                where: {
                    id: req.user.id
                }
            });
            if (!user) {
                return jsonResponse(res, 404, 'Không tìm thấy người dùng', null);
            }
            user.status = status;
            await prisma.users.update({
                where: {
                    id: user.id
                },
                data: user
            });
            return jsonResponse(res, 200, 'Thành công');
        } catch (error) {
            return jsonResponse(res, 500, 'Lỗi hệ thống', null);
        }

    },
    changePassword: async (req, res) => {
        try {
            const {currentPassword, newPassword, confirmPassword} = req.body;
            if (!currentPassword || !newPassword || !confirmPassword) {
                return jsonResponse(res, 400, 'Vui lòng nhập đầy đủ thông tin', null);
            }

            const user = await prisma.users.findUnique({
                where: {
                    id: req.user.id
                }
            });
            if (!user) {
                return jsonResponse(res, 404, 'Không tìm thấy người dùng', null);
            }

            const isPasswordValid = await argon2.verify(user.password, currentPassword);
            if (!isPasswordValid) {
                return jsonResponse(res, 400, 'Lỗi', {currentPassword: 'Mật khẩu hiện tại không đúng'});
            }
            if (newPassword !== confirmPassword) {
                return jsonResponse(res, 400, 'Lỗi', {confirmPassword: 'Mật khẩu xác nhận không khớp'});
            }
            user.password = await argon2.hash(newPassword);
            await prisma.users.update({
                where: {
                    id: user.id
                },
                data: user
            });
            return jsonResponse(res, 200, 'Thành công');
        } catch (error) {
            return jsonResponse(res, 500, 'Lỗi hệ thống', null);
        }
    },
    updateAvatar: async (req, res) => {
        try {
            if (!req.file) {
                return jsonResponse(res, 400, 'Không có file ảnh được upload', null);
            }
            const user = await prisma.users.findUnique({
                where: {
                    id: Number(req.user.id)
                }
            });
            if (!user) {
                return jsonResponse(res, 404, 'Không tìm thấy người dùng', null);
            }
            // Xoá file avatar cũ (nếu có) để giải phóng không gian
            if (user.avatar) {
                deleteFile(user.avatar);
            }
            // Lưu đường dẫn file mới vào db
            // Yêu cầu chuyển đường dẫn vật lý thành URL tương đối tĩnh (VD: /uploads/avatars/filename.webp)
            const fileUrl = `/uploads/avatars/${req.file.filename}`;
            user.avatar = fileUrl;
            await prisma.users.update({
                where: {
                    id: user.id
                },
                data: {
                    email: user.email,
                    fullName: user.fullName,
                    avatar: user.avatar,
                    fcmToken: user.fcmToken,
                    refreshToken: user.refreshToken
                }
            });
            const {password, syncId, createdAt, ...updatedUser} = user;
            return jsonResponse(res, 200, 'Thành công', updatedUser);
        } catch (error) {
            console.error('[UserController] updateAvatar error:', error);
            return jsonResponse(res, 500, 'Lỗi hệ thống khi cập nhật avatar', null);
        }
    }


}
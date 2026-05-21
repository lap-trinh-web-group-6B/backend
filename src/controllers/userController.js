import {jsonResponse} from '../utils/responseHelper.js';
import {prisma} from "../config/database.js";

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
    }


}
import { verifyToken } from '../services/jwtService.js';
import { prisma } from '../config/database.js';

export const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Không tìm thấy accessToken' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        
        // Kiểm tra trạng thái người dùng trong Database
        const user = await prisma.users.findUnique({
            where: { id: decoded.id }
        });
        if (!user || user.status !== 'ACTIVATE') {
            return res.status(401).json({ message: 'Tài khoản không hoạt động hoặc đã bị khóa' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        if (error.message === 'Token đã hết hạn') {
            return res.status(401).json({ message: 'AccessToken đã hết hạn' });
        }
        return res.status(401).json({ message: 'AccessToken không hợp lệ' });
    }
};

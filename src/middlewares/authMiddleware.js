import { verifyToken } from '../services/jwtService.js';

export const requireAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Không tìm thấy accessToken' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.message === 'Token đã hết hạn') {
            return res.status(401).json({ message: 'AccessToken đã hết hạn' });
        }
        return res.status(401).json({ message: 'AccessToken không hợp lệ' });
    }
};

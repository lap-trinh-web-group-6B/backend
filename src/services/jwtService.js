import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET;

export const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            type: user.type,
            status: user.status
        },
        SECRET_KEY,
        { expiresIn: '30d' }
    );
};

export const generateForgotPasswordToken = (userId) => {
    return jwt.sign({ id: userId }, SECRET_KEY, { expiresIn: '1h' });
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new Error('Token đã hết hạn');
        }
        throw new Error('Token không hợp lệ');
    }
};

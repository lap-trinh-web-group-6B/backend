import express from 'express';
import { authController } from '../controllers/authController.js';

const router = express.Router();

router.post('/register/send-otp', authController.registerSendOtp);
router.post('/register/verify-otp', authController.registerVerifyOtp);
router.post('/register/resend-otp', authController.registerResendOtp);
router.post('/login', authController.login);
router.post('/forgot-password/send-otp', authController.forgotPasswordSendOtp);
router.post('/forgot-password/resend-otp', authController.forgotPasswordSendOtp);
router.post('/forgot-password/verify-otp', authController.forgotPasswordVerifyOtp);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshToken);

export default router;

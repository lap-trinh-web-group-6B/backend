import express from 'express';
import { authController } from '../controllers/authController.js';

const router = express.Router();

router.post('/register/send-otp', authController.registerSendOtp);


export default router;

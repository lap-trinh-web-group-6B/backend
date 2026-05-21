import express from 'express';
import { userController } from '../controllers/userController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/profile', requireAuth, userController.getProfile);

router.patch('/update-name', requireAuth, userController.updateName);

router.patch('/update-status', requireAuth, userController.updateStatus);

router.patch('/change-password', requireAuth, userController.changePassword);

export default router;
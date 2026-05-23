import express from 'express';
import { userController } from '../controllers/userController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {multerAvatarUpload} from '../config/multer.js';
import {compressAvatarMiddleware} from '../middlewares/compressImageMiddleware.js';

const router = express.Router();

router.get('/profile', requireAuth, userController.getProfile);

router.patch('/update-name', requireAuth, userController.updateName);

router.patch('/update-status', requireAuth, userController.updateStatus);

router.patch('/change-password', requireAuth, userController.changePassword);

router.patch('/update-avatar', requireAuth, multerAvatarUpload, compressAvatarMiddleware, userController.updateAvatar);



export default router;
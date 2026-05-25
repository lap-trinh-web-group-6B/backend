import express from 'express';
import {requireAuth} from '../middlewares/authMiddleware.js';
import {notificationController} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/', requireAuth, notificationController.getNotifications);

router.get('/:id', requireAuth, notificationController.getNotificationDetail);

router.patch('/:id/read', requireAuth, notificationController.markNotificationRead);

router.delete('/:id', requireAuth, notificationController.deleteNotification);

router.delete('/', requireAuth, notificationController.deleteAllNotifications);



export default router;
import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { paymentController } from '../controllers/paymentController.js';

const router = express.Router();

router.post('/checkout', requireAuth, paymentController.checkout);
router.get('/config', requireAuth, paymentController.getConfig);

export default router;

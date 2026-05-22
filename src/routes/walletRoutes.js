import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {walletController} from '../controllers/walletController.js';


const router = express.Router();

router.get('/', requireAuth, walletController.getWallets);

export default router;
import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {walletController} from '../controllers/walletController.js';


const router = express.Router();

router.get('/', requireAuth, walletController.getWallets);
router.get('/:id', requireAuth, walletController.getWalletById);
router.post('/', requireAuth, walletController.createWallet);
router.delete('/:id', requireAuth, walletController.deleteWallet);
router.patch('/:id', requireAuth, walletController.updateWallet);



export default router;
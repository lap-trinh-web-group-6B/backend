import express from 'express';
import {requireAuth} from '../middlewares/authMiddleware.js';
import {transactionController} from '../controllers/transactionController.js';

const router = express.Router();

router.get('/', requireAuth, transactionController.getTransactions);

router.get('/:id', requireAuth, transactionController.getTransactionById);

export default router;
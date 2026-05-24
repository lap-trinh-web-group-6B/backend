import express from 'express';
import {requireAuth} from '../middlewares/authMiddleware.js';
import {transactionController} from '../controllers/transactionController.js';
import {upload} from "../config/multer.js";

const router = express.Router();

router.get('/', requireAuth, transactionController.getTransactions);

router.get('/:id', requireAuth, transactionController.getTransactionById);

router.post('/', requireAuth, upload.none(), transactionController.createTransaction);

router.patch('/:id', requireAuth, upload.none(), transactionController.updateTransaction);


export default router;
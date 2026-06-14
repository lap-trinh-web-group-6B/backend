import express from 'express';
import {requireAuth} from '../middlewares/authMiddleware.js';
import {transactionController} from '../controllers/transactionController.js';
import {upload, multerMemoryUpload} from "../config/multer.js";

const router = express.Router();

router.get('/', requireAuth, transactionController.getTransactions);

router.get('/:id', requireAuth, transactionController.getTransactionById);

router.post('/', requireAuth, upload.none(), transactionController.createTransaction);

router.post('/scan-invoice', requireAuth, multerMemoryUpload, transactionController.scanInvoice);

router.patch('/:id', requireAuth, upload.none(), transactionController.updateTransaction);

router.delete('/:id', requireAuth, transactionController.deleteTransaction);


export default router;
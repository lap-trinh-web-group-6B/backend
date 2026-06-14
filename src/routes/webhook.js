import express from 'express';
import { webhookController } from '../controllers/webhookController.js';

const router = express.Router();

router.post('/sepay', webhookController.handleSepayWebhook);

export default router;

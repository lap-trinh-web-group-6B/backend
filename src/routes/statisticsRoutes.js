import express from 'express';
import {requireAuth} from '../middlewares/authMiddleware.js';
import {statisticsController} from '../controllers/statisticsController.js';

const router = express.Router();

router.get('/general', requireAuth, statisticsController.getGeneralStats);
router.get('/by-category', requireAuth, statisticsController.getStatsByCategory);
router.get('/trend', requireAuth, statisticsController.getTrendStats);
router.get('/expense-to-balance-ratio', requireAuth, statisticsController.getExpenseToBalanceRatio);
router.get('/income-vs-expense', requireAuth, statisticsController.getIncomeVsExpense);

export default router;
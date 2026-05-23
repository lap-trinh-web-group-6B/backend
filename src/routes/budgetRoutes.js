import express from 'express';
import {requireAuth} from '../middlewares/authMiddleware.js';
import {budgetController} from '../controllers/budgetController.js';

const router = express.Router();

router.post('/', requireAuth, budgetController.createBudget);

router.get('/', requireAuth, budgetController.getBudgets);

router.get('/:id', requireAuth, budgetController.getBudgetDetail);

router.patch('/:id', requireAuth, budgetController.updateBudget);

export default router;
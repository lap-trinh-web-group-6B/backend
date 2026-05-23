import express from 'express';

import authRoutes from './auth.js';
import mockRoutes from './mockRoute.js';
import userRoutes from './userRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import walletRoutes from './walletRoutes.js';
import BudgetRoutes from './budgetRoutes.js';


const router = express.Router();

router.use('/auth', authRoutes);

router.use('/user', userRoutes);

router.use('/categories', categoryRoutes);

router.use('/wallets', walletRoutes);

router.use('/budgets', BudgetRoutes);

router.use('/', mockRoutes);



export default router;

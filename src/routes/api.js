import express from 'express';

import authRoutes from './auth.js';
import mockRoutes from './mockRoute.js';
import userRoutes from './userRoutes.js';
import categoryRoutes from './categoryRoutes.js';


const router = express.Router();

router.use('/auth', authRoutes);

router.use('/user', userRoutes);

router.use('/categories', categoryRoutes);

router.use('/', mockRoutes);

export default router;

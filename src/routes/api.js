import express from 'express';

import authRoutes from './auth.js';
import mockRoutes from './mockRoute.js';
import userRoutes from './userRoutes.js';


const router = express.Router();

router.use('/auth', authRoutes);

router.use('/user', userRoutes);

router.use('/', mockRoutes);

export default router;

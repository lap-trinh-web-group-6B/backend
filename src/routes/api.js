import express from 'express';

import authRoutes from './auth.js';
import mockRoutes from './mockRoute.js';


const router = express.Router();

router.use('/auth', authRoutes);
router.use('/', mockRoutes)

export default router;

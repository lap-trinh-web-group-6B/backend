import express from 'express';
import {requireAuth} from '../middlewares/authMiddleware.js';
import {statisticsController} from "../controllers/statisticsController.js";

const router = express.Router();

router.get('/general', requireAuth, statisticsController.getGeneralStats);
router.get('/by-category', requireAuth, statisticsController.getStatsByCategory);


export default router;
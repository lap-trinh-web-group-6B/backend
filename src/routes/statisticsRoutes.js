import express from 'express';
import {requireAuth} from '../middlewares/authMiddleware.js';
import statisticsRoutes from "./statisticsRoutes.js";
import {statisticsController} from "../controllers/statisticsController.js";

const router = express.Router();

router.get('/general', requireAuth, statisticsController.getGeneralStats);


export default router;
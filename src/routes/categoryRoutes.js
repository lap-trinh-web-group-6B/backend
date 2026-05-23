import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {categoryController} from "../controllers/categoryController.js";
const router = express.Router();

router.get('/', requireAuth, categoryController.getCategories);

export default router;
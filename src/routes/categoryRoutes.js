import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {categoryController} from "../controllers/categoryController.js";
const router = express.Router();

router.get('/', requireAuth, categoryController.getCategories);
router.get('/:id', requireAuth, categoryController.getCategoryById);

export default router;
import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {categoryController} from '../controllers/categoryController.js';
import {multerIconUpload} from '../config/multer.js';
import {compressIconMiddleware} from '../middlewares/compressImageMiddleware.js';
const router = express.Router();

router.get('/', requireAuth, categoryController.getCategories);
router.get('/:id', requireAuth, categoryController.getCategoryById);
router.post('/', requireAuth, multerIconUpload, compressIconMiddleware, categoryController.createCategory);

export default router;
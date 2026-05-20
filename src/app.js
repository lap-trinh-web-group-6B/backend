import express from 'express';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';

const router = express.Router();
router.use('/auth', authRoutes);

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1', apiRoutes);
const PORT = process.env.PORT || 3000;


app.listen(PORT, () => {
    console.log(`[Server] Web App Running: http://localhost:${PORT}`);
});


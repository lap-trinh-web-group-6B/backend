import express from 'express';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import paymentRoutes from './routes/payment.js';
import webhookRoutes from './routes/webhook.js';
import {fileURLToPath} from "url";
import path from "path";
import adminRoutes from './routes/adminRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
router.use('/auth', authRoutes);

dotenv.config();
const app = express();

app.set('view engine', 'ejs');
// Chỉ định thư mục chứa các file view (.ejs) nằm ngoài thư mục src
app.set('views', path.join(__dirname, '../views'));

const corsOptions = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use('/api/v1', apiRoutes);

app.use('/api/payment', paymentRoutes);
app.use('/api/webhook', webhookRoutes);

app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 3001;


app.listen(PORT, () => {
    console.log(`[Server] Web App Running: http://localhost:${PORT}`);
});


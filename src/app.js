import express from 'express';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import cors from 'cors';
import paymentRoutes from './routes/payment.js';
import webhookRoutes from './routes/webhook.js';

const router = express.Router();
router.use('/auth', authRoutes);

dotenv.config();
const app = express();

const corsOptions = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1', apiRoutes);

app.use('/api/payment', paymentRoutes);
app.use('/api/webhook', webhookRoutes);

const PORT = process.env.PORT || 3001;


app.listen(PORT, () => {
    console.log(`[Server] Web App Running: http://localhost:${PORT}`);
});


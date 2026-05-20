import express from 'express';
import dotenv from 'dotenv';
import {prisma} from './config/database.js'





dotenv.config();
const app = express();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`[Server] Web App chạy ở API: http://localhost:${PORT}`);
});


import express from 'express';
import {requireAuth} from "../middlewares/authMiddleware.js";


const router = express.Router();

router.get("/mock",requireAuth, async (req, res, next) => {
    res.json({message: "OK"})
})

export default router;
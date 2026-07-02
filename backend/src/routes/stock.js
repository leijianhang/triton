import express from 'express';
import { getStockList, getStockKline, searchStock } from '../controllers/stockController.js';

const router = express.Router();

router.get('/list', getStockList);
router.get('/search', searchStock);
router.get('/kline/:symbol', getStockKline);

export default router;

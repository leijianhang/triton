import express from 'express';
import { getMarketKline, getMarketList, searchMarket } from '../controllers/marketController.js';

const router = express.Router();

router.get('/:type/list', getMarketList);
router.get('/:type/search', searchMarket);
router.get('/:type/kline/:symbol', getMarketKline);

export default router;

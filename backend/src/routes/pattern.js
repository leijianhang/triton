import express from 'express';
import {
  scanAllPatterns,
  scanCandlePatternGroup,
  scanChartPatternGroup
} from '../controllers/patternController.js';

const router = express.Router();

router.post('/all', scanAllPatterns);
router.post('/candle', scanCandlePatternGroup);
router.post('/chart', scanChartPatternGroup);

export default router;

import { scanCandlePatterns } from '../services/candlePatternService.js';
import { scanChartPatterns } from '../services/chartPatternService.js';
import { scanTheStratPatterns } from '../services/theStratPatternService.js';

const runPatternScan = (scan, data) => {
  try {
    const patterns = scan(data);
    return { patterns: Array.isArray(patterns) ? patterns : [], error: null };
  } catch (error) {
    return { patterns: [], error: error.message };
  }
};

const emptyScan = { patterns: [], error: null };

const getPatternKey = pattern => String(pattern?.type || pattern?.name || '').trim().toLowerCase();

const mergeCandlePatternRows = (candlePatterns = [], theStratPatterns = []) => {
  const rowsByTime = new Map();

  const addPatterns = ({ index, time, patterns }) => {
    if (!time || !Array.isArray(patterns) || !patterns.length) return;
    const existing = rowsByTime.get(time) || { index, time, patterns: [] };
    const patternKeys = new Set(existing.patterns.map(getPatternKey));
    patterns.forEach(pattern => {
      const key = getPatternKey(pattern);
      if (!key || patternKeys.has(key)) return;
      patternKeys.add(key);
      existing.patterns.push(pattern);
    });
    rowsByTime.set(time, existing);
  };

  candlePatterns.forEach(row => addPatterns(row));
  theStratPatterns.forEach(item => addPatterns({
    index: item.index,
    time: item.time,
    patterns: item.pattern ? [item.pattern] : []
  }));

  return Array.from(rowsByTime.values())
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
};

const countCandlePatternRows = rows => rows
  .reduce((count, row) => count + (Array.isArray(row.patterns) ? row.patterns.length : 0), 0);

const combineErrors = (...errors) => errors.filter(Boolean).join('; ') || null;

const buildPatternPayload = ({ candleScan = emptyScan, chartScan = emptyScan, theStratScan = emptyScan }) => {
  const candlePatterns = mergeCandlePatternRows(candleScan.patterns, theStratScan.patterns);
  const chartPatterns = chartScan.patterns;
  const candlePatternCount = countCandlePatternRows(candlePatterns);

  return {
    success: true,
    data: {
      candlePatterns: {
        count: candlePatternCount,
        patterns: candlePatterns
      },
      chartPatterns: {
        count: chartPatterns.length,
        patterns: chartPatterns
      },
      total: candlePatternCount + chartPatterns.length
    },
    errors: {
      candlePatterns: combineErrors(candleScan.error, theStratScan.error),
      chartPatterns: chartScan.error
    }
  };
};

const getPatternData = req => {
  const { data } = req.body;
  if (!data || !Array.isArray(data)) {
    return null;
  }
  return data;
};

export const scanAllPatterns = async (req, res) => {
  try {
    const { data, window, groups } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid K-line data'
      });
    }

    const requestedGroups = Array.isArray(groups) && groups.length ? new Set(groups) : null;
    const shouldScan = group => !requestedGroups || requestedGroups.has(group);
    const candleScan = shouldScan('candle') ? runPatternScan(scanCandlePatterns, data) : emptyScan;
    const chartScan = shouldScan('chart') ? runPatternScan(scanChartPatterns, data) : emptyScan;
    const theStratScan = shouldScan('candle') ? runPatternScan(scanTheStratPatterns, data) : emptyScan;

    res.json(buildPatternPayload({ candleScan, chartScan, theStratScan }));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const scanCandlePatternGroup = async (req, res) => {
  try {
    const data = getPatternData(req);
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Invalid K-line data'
      });
    }

    res.json(buildPatternPayload({
      candleScan: runPatternScan(scanCandlePatterns, data),
      theStratScan: runPatternScan(scanTheStratPatterns, data)
    }));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const scanChartPatternGroup = async (req, res) => {
  try {
    const data = getPatternData(req);
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Invalid K-line data'
      });
    }

    res.json(buildPatternPayload({
      chartScan: runPatternScan(scanChartPatterns, data)
    }));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

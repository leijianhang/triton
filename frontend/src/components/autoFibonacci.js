import { getChartTime } from './chartDataTransform.js';

export const autoFibonacciLevelMeta = [
  { level: -1, color: '#4A00E0', thickness: 1 },
  { level: -0.786, color: '#7B68EE', thickness: 1 },
  { level: -0.618, color: '#9370DB', thickness: 1 },
  { level: -0.5, color: '#BA55D3', thickness: 1 },
  { level: -0.382, color: '#DA70D6', thickness: 1 },
  { level: -0.236, color: '#EE82EE', thickness: 1 },
  { level: 0, color: '#ffffff', thickness: 2.4 },
  { level: 0.236, color: '#FFD700', thickness: 1 },
  { level: 0.382, color: '#FFA500', thickness: 1 },
  { level: 0.5, color: '#FF8C00', thickness: 1 },
  { level: 0.618, color: '#FF4500', thickness: 1 },
  { level: 0.786, color: '#FF6347', thickness: 1 },
  { level: 1, color: '#ffffff', thickness: 2.4 },
  { level: 1.382, color: '#FF69B4', thickness: 1 },
  { level: 1.618, color: '#FF1493', thickness: 1 },
  { level: 2, color: '#DC143C', thickness: 1 },
  { level: 2.618, color: '#B22222', thickness: 1 },
  { level: 4.236, color: '#8B0000', thickness: 1 }
];

export const autoFibonacciLevels = autoFibonacciLevelMeta.map(item => item.level);

const MAX_ANALYSIS_BARS = 180;
const MIN_ANCHOR_GAP = 3;

const toFiniteNumber = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getBarHigh = bar => toFiniteNumber(bar?.high) ?? toFiniteNumber(bar?.close);
const getBarLow = bar => toFiniteNumber(bar?.low) ?? toFiniteNumber(bar?.close);

const clampIndex = (value, min, max) => Math.max(min, Math.min(max, value));

export const getAutoFibonacciWindow = (data = [], visibleRange = null) => {
  if (!Array.isArray(data) || data.length < 2) return [];

  const lastIndex = data.length - 1;
  const hasVisibleRange = Number.isFinite(visibleRange?.from) && Number.isFinite(visibleRange?.to);
  const from = hasVisibleRange
    ? clampIndex(Math.floor(visibleRange.from), 0, lastIndex)
    : Math.max(0, data.length - MAX_ANALYSIS_BARS);
  const to = hasVisibleRange
    ? clampIndex(Math.ceil(visibleRange.to), 0, lastIndex)
    : lastIndex;
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const cappedStart = Math.max(start, end - MAX_ANALYSIS_BARS + 1);

  return data
    .slice(cappedStart, end + 1)
    .map((bar, offset) => ({
      bar,
      index: cappedStart + offset,
      high: getBarHigh(bar),
      low: getBarLow(bar)
    }))
    .filter(item => Number.isFinite(item.high) && Number.isFinite(item.low));
};

const getPivotDepth = length => {
  if (length >= 120) return 5;
  if (length >= 60) return 4;
  if (length >= 28) return 3;
  return 2;
};

const isPivot = (rows, index, field, depth) => {
  const value = rows[index]?.[field];
  if (!Number.isFinite(value)) return false;

  const start = Math.max(0, index - depth);
  const end = Math.min(rows.length - 1, index + depth);
  for (let cursor = start; cursor <= end; cursor += 1) {
    if (cursor === index) continue;
    if (field === 'high' && rows[cursor].high > value) return false;
    if (field === 'low' && rows[cursor].low < value) return false;
  }
  return true;
};

const createAnchor = (row, type) => {
  try {
    return {
      index: row.index,
      price: type === 'high' ? row.high : row.low,
      time: getChartTime(row.bar),
      type
    };
  } catch {
    return null;
  }
};

const uniqueAnchors = anchors => {
  const seen = new Set();
  return anchors.filter(anchor => {
    if (!anchor || !Number.isFinite(anchor.price) || !Number.isFinite(anchor.time)) return false;
    const key = `${anchor.type}:${anchor.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getAnchorCandidates = rows => {
  if (!rows.length) return [];

  const depth = getPivotDepth(rows.length);
  const pivots = rows.flatMap((row, index) => {
    const anchors = [];
    if (isPivot(rows, index, 'high', depth)) anchors.push(createAnchor(row, 'high'));
    if (isPivot(rows, index, 'low', depth)) anchors.push(createAnchor(row, 'low'));
    return anchors;
  });
  const highest = rows.reduce((best, row) => (row.high > best.high ? row : best), rows[0]);
  const lowest = rows.reduce((best, row) => (row.low < best.low ? row : best), rows[0]);

  return uniqueAnchors([
    ...pivots,
    createAnchor(highest, 'high'),
    createAnchor(lowest, 'low'),
    createAnchor(rows[0], 'high'),
    createAnchor(rows[0], 'low'),
    createAnchor(rows[rows.length - 1], 'high'),
    createAnchor(rows[rows.length - 1], 'low')
  ]);
};

const scoreAnchorPair = (start, end, lastIndex) => {
  const span = Math.abs(end.index - start.index);
  if (span < MIN_ANCHOR_GAP) return null;

  const range = Math.abs(end.price - start.price);
  const base = Math.max(Math.abs(start.price), Math.abs(end.price), 1);
  const amplitude = range / base;
  if (amplitude <= 0) return null;

  const recency = 1 - Math.max(0, lastIndex - Math.max(start.index, end.index)) / Math.max(lastIndex + 1, 1);
  const spanScore = Math.min(span / 60, 1);

  return amplitude * 100 + spanScore * 8 + recency * 12;
};

export const getAutoFibonacciModel = (data = [], visibleRange = null) => {
  const rows = getAutoFibonacciWindow(data, visibleRange);
  if (rows.length < 2) return null;

  const candidates = getAnchorCandidates(rows);
  const lastIndex = rows[rows.length - 1].index;
  const bestPair = candidates
    .flatMap(start => candidates.map(end => ({ start, end })))
    .filter(pair => pair.start.type !== pair.end.type && pair.start.index !== pair.end.index)
    .map(pair => ({
      ...pair,
      score: scoreAnchorPair(pair.start, pair.end, lastIndex)
    }))
    .filter(pair => Number.isFinite(pair.score))
    .sort((a, b) => b.score - a.score)[0];

  if (!bestPair) return null;

  const start = bestPair.start.index < bestPair.end.index ? bestPair.start : bestPair.end;
  const end = bestPair.start.index < bestPair.end.index ? bestPair.end : bestPair.start;
  const priceRange = end.price - start.price;

  return {
    start,
    end,
    analysis: {
      time: createAnchor(rows[rows.length - 1], 'high')?.time ?? end.time
    },
    direction: priceRange >= 0 ? 'up' : 'down',
    levels: autoFibonacciLevelMeta.map(item => ({
      ...item,
      price: start.price + priceRange * item.level
    }))
  };
};

export const formatAutoFibonacciLevel = level => {
  if (level === 0 || level === 1) return String(level);
  return Number(level).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
};

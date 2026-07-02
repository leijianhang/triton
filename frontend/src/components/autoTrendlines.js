import { getChartTime } from './chartDataTransform.js';

const trendClusters = [
  { id: 'upper/peaks/shorter + less violated', side: 'resistance', color: '#f4511e', score: s => (s.peaksUp - s.violations) / s.length },
  { id: 'upper/lotta-points/shorter + closer', side: 'resistance', color: '#f4511e', score: s => ((s.pointsHigh + s.pointsHigh2x * 2) / s.length) / s.priceDev50 },
  { id: 'peaks/longer + closer + less violated (a)', color: '#8bc34a', score: s => (Math.max(s.peaksDown, s.bounceDown) - s.violations) * s.length },
  { id: 'peaks/longer + closer + less violated (b)', color: '#8bc34a', score: s => (Math.max(s.peaksUp, s.bounceUp) - s.violations) * s.length },
  { id: 'lotta-points/closer + less violated', color: '#8bc34a', score: s => (s.points + s.points2x * 2 - s.violations) / s.priceDev25 },
  { id: 'lower/lotta-points/shorter + closer', side: 'support', color: '#03a9f4', score: s => ((s.pointsLow + s.pointsLow2x * 2) / s.length) / s.priceDev50 },
  { id: 'lower/peaks/shorter + less violated', side: 'support', color: '#03a9f4', score: s => (s.peaksDown - s.violations) / s.length }
];

const getNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getRowPrice = (row, field) => getNumber(row?.[field]);

const getLinePrice = (row, side, drawingInput = 'wick') => {
  if (drawingInput === 'body') {
    const open = getRowPrice(row, 'open');
    const close = getRowPrice(row, 'close');
    if (open === null || close === null) return null;
    return side === 'resistance' ? Math.max(open, close) : Math.min(open, close);
  }
  return side === 'resistance' ? getRowPrice(row, 'high') : getRowPrice(row, 'low');
};

const getPivotWindow = (analysisType, period) => {
  if (analysisType === 'enhanced') return 10;
  if (analysisType === 'original') {
    if (period === '60min') return 40;
    if (period === 'daily') return 35;
    if (period === 'weekly' || period === 'monthly') return 30;
    return 45;
  }
  return 11;
};

const getTrueRanges = rows => rows.map((row, index) => {
  const high = getRowPrice(row, 'high');
  const low = getRowPrice(row, 'low');
  const previousClose = index > 0 ? getRowPrice(rows[index - 1], 'close') : null;
  if (high === null || low === null) return 0;
  return previousClose === null
    ? high - low
    : Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
});

const getAbandonAtrFactor = period => {
  if (period === '60min') return 6;
  if (period === '120min' || period === '240min' || period === 'daily') return 7;
  if (period === 'weekly' || period === 'monthly') return 8;
  if (['1min', '5min', '10min', '15min', '30min'].includes(period)) return 5;
  return 5.5;
};

const average = values => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;

const getPivotPoints = (rows, options) => {
  const window = getPivotWindow(options.analysisType, options.period);
  const pivots = [];
  for (let index = window; index < rows.length - window; index += 1) {
    const high = getLinePrice(rows[index], 'resistance', options.drawingInput);
    const low = getLinePrice(rows[index], 'support', options.drawingInput);
    if (high === null || low === null) continue;
    const neighbors = rows.slice(index - window, index + window + 1);
    const neighborHighs = neighbors.map(row => getLinePrice(row, 'resistance', options.drawingInput)).filter(Number.isFinite);
    const neighborLows = neighbors.map(row => getLinePrice(row, 'support', options.drawingInput)).filter(Number.isFinite);
    if (high === Math.max(...neighborHighs)) pivots.push({ index, price: high, side: 'resistance' });
    if (low === Math.min(...neighborLows)) pivots.push({ index, price: low, side: 'support' });
  }
  return pivots;
};

const hasIsland = (rows, startIndex, endIndex, atr) => {
  const threshold = atr * 3;
  for (let index = startIndex + 1; index <= endIndex; index += 1) {
    const previousHigh = getRowPrice(rows[index - 1], 'high');
    const previousLow = getRowPrice(rows[index - 1], 'low');
    const high = getRowPrice(rows[index], 'high');
    const low = getRowPrice(rows[index], 'low');
    if ([previousHigh, previousLow, high, low].some(value => value === null)) continue;
    if (low - previousHigh >= threshold || previousLow - high >= threshold) return true;
  }
  return false;
};

const getProjectedPrice = (line, index) =>
  line.startPrice + line.slope * (index - line.startIndex);

const getStrength = ({ line, pivots, rows, atr, drawingInput }) => {
  const lastIndex = rows.length - 1;
  const lastClose = getRowPrice(rows[lastIndex], 'close') || 1;
  const projectedAtEnd = getProjectedPrice(line, lastIndex);
  const tolerance = Math.max(atr * 0.2, Math.abs(lastClose) * 0.001, 1e-8);
  const wideTolerance = tolerance * 2;
  const strength = {
    priceDev25: Math.max(Math.abs(projectedAtEnd - lastClose) / Math.max(Math.abs(lastClose), 1e-8), 1e-8),
    priceDev50: 0,
    priceDev75: 0,
    length: rows.length - line.startIndex + 1,
    violations: 0,
    hits: 0,
    bounceDown: 0,
    bounceUp: 0,
    peaksUp: 0,
    peaksDown: 0,
    points: 0,
    pointsHigh: 0,
    pointsLow: 0,
    points2x: 0,
    pointsHigh2x: 0,
    pointsLow2x: 0,
    seriesLength: rows.length
  };
  const deviations = [];

  for (let index = line.startIndex; index < rows.length; index += 1) {
    const linePrice = getProjectedPrice(line, index);
    const high = getLinePrice(rows[index], 'resistance', drawingInput);
    const low = getLinePrice(rows[index], 'support', drawingInput);
    const close = getRowPrice(rows[index], 'close');
    if (high === null || low === null) continue;
    const distance = Math.min(Math.abs(high - linePrice), Math.abs(low - linePrice));
    deviations.push(distance / Math.max(Math.abs(close || linePrice), 1e-8));
    if (distance <= wideTolerance) strength.hits += 1;
    if (line.side === 'support' ? low < linePrice - tolerance : high > linePrice + tolerance) {
      strength.violations += 1;
    }
  }

  const sortedDeviations = deviations.sort((a, b) => a - b);
  const percentile = fraction => sortedDeviations[Math.floor((sortedDeviations.length - 1) * fraction)] || strength.priceDev25;
  strength.priceDev25 = Math.max(percentile(0.25), 1e-8);
  strength.priceDev50 = Math.max(percentile(0.5), 1e-8);
  strength.priceDev75 = Math.max(percentile(0.75), 1e-8);

  pivots.forEach(pivot => {
    if (pivot.index < line.startIndex) return;
    const distance = Math.abs(pivot.price - getProjectedPrice(line, pivot.index));
    if (distance <= wideTolerance) {
      strength.points2x += 1;
      if (pivot.side === 'resistance') strength.pointsHigh2x += 1;
      else strength.pointsLow2x += 1;
    }
    if (distance > tolerance) return;
    strength.points += 1;
    if (pivot.side === 'resistance') strength.pointsHigh += 1;
    else strength.pointsLow += 1;
    const nextClose = getRowPrice(rows[Math.min(pivot.index + 1, lastIndex)], 'close');
    if (nextClose !== null && nextClose >= pivot.price) {
      strength.bounceUp += 1;
      strength.peaksUp += pivot.side === 'support' ? 1 : 0;
    } else {
      strength.bounceDown += 1;
      strength.peaksDown += pivot.side === 'resistance' ? 1 : 0;
    }
  });
  return strength;
};

const makeCandidates = ({ rows, pivots, options, atr }) => {
  const candidates = [];
  ['support', 'resistance'].forEach(side => {
    const sidePivots = pivots.filter(pivot => pivot.side === side);
    for (let leftIndex = 0; leftIndex < sidePivots.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < sidePivots.length; rightIndex += 1) {
        const left = sidePivots[leftIndex];
        const right = sidePivots[rightIndex];
        if (options.islands === 'respect' && hasIsland(rows, left.index, right.index, atr)) continue;
        const line = {
          side,
          startIndex: left.index,
          startPrice: left.price,
          endIndex: right.index,
          endPrice: right.price,
          slope: (right.price - left.price) / (right.index - left.index)
        };
        const strength = getStrength({ line, pivots, rows, atr, drawingInput: options.drawingInput });
        if (strength.points < 2) continue;
        const lastClose = getRowPrice(rows.at(-1), 'close');
        const isFarFromPrice = lastClose !== null
          && Math.abs(getProjectedPrice(line, rows.length - 1) - lastClose) > atr * getAbandonAtrFactor(options.period);
        candidates.push({ ...line, isFarFromPrice, strength });
      }
    }
  });
  return candidates;
};

const rankCandidates = (candidates, quality) => {
  if (quality === 'all') return candidates.slice(0, 2000);
  const selected = [];
  trendClusters.forEach(cluster => {
    const ranked = candidates
      .filter(candidate => !candidate.isFarFromPrice && (!cluster.side || candidate.side === cluster.side))
      .map(candidate => ({ ...candidate, categoryId: cluster.id, color: cluster.color, score: cluster.score(candidate.strength) }))
      .filter(candidate => Number.isFinite(candidate.score))
      .sort((left, right) => right.score - left.score);
    selected.push(...ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.01))));
    if (quality === 'more') {
      selected.push(...ranked.filter(candidate => candidate.strength.violations < 2));
    }
  });
  const unique = new Map();
  selected.forEach(candidate => {
    const key = `${candidate.startIndex}.${candidate.endIndex}`;
    if (!unique.has(key)) unique.set(key, candidate);
  });
  return [...unique.values()];
};

export const getAutoTrendlines = (rows = [], options = {}) => {
  if (!Array.isArray(rows) || rows.length < 24) return [];
  const normalizedOptions = {
    analysisType: options.analysisType || 'standard',
    drawingInput: options.drawingInput || 'wick',
    islands: options.islands || 'respect',
    period: options.period || 'daily',
    quality: options.quality || 'relevant'
  };
  const pivots = getPivotPoints(rows, normalizedOptions);
  const trueRanges = getTrueRanges(rows);
  const atr = Math.max(average(trueRanges.slice(-14)), 1e-8);
  const candidates = makeCandidates({ rows, pivots, options: normalizedOptions, atr });
  const selected = rankCandidates(candidates, normalizedOptions.quality);
  const analysisTime = getChartTime(rows.at(-1));

  return selected.map((line, index) => ({
    id: `auto-trend-${line.startIndex}-${line.endIndex}-${index}`,
    analysisTime,
    categoryId: line.categoryId,
    color: line.color,
    end: { price: line.endPrice, time: getChartTime(rows[line.endIndex]) },
    score: line.score,
    side: line.side,
    start: { price: line.startPrice, time: getChartTime(rows[line.startIndex]) },
    status: line.isFarFromPrice ? 'stale' : 'active',
    strength: line.strength,
    touches: line.strength.hits
  }));
};

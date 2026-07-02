import { getChartTime } from './chartDataTransform.js';

const MAX_HORIZONTAL_LEVELS = 12;
const MAX_DEPTH_CELLS = 4200;
const MAX_CLASSIC_CELLS = 1800;
const MAX_DEPTH_LEVELS = 8;
const HEATMAP_GRID_COLUMNS = 40;
const HEATMAP_GRID_ROWS = 60;
const PIVOT_LOOKBACK = 3;
const MIN_VISIBLE_WEIGHT = 0.06;

const getNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getVisibleRows = (rows = []) => {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  return rows;
};

const getPriceRange = rows => rows.reduce((range, row) => {
  const high = getNumber(row.high);
  const low = getNumber(row.low);
  if (high === null || low === null) return range;
  return {
    min: Math.min(range.min, low),
    max: Math.max(range.max, high)
  };
}, { min: Infinity, max: -Infinity });

const padPriceRange = range => {
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.max <= range.min) return range;
  const padding = (range.max - range.min) * 0.1;
  return {
    min: range.min - padding,
    max: range.max + padding
  };
};

export const getHeatmapOverlayBounds = (data = []) => {
  const rows = getVisibleRows(data);
  if (rows.length < 2) return null;

  const startTime = getChartTime(rows[0]);
  const endTime = getChartTime(rows.at(-1));
  const priceRange = padPriceRange(getPriceRange(rows));
  if (
    !Number.isFinite(startTime)
    || !Number.isFinite(endTime)
    || !Number.isFinite(priceRange.min)
    || !Number.isFinite(priceRange.max)
    || endTime <= startTime
    || priceRange.max <= priceRange.min
  ) {
    return null;
  }

  return {
    startTime,
    endTime,
    minPrice: priceRange.min,
    maxPrice: priceRange.max
  };
};

const getAverageRange = rows => {
  const ranges = rows
    .map(row => {
      const high = getNumber(row.high);
      const low = getNumber(row.low);
      return high !== null && low !== null ? Math.max(high - low, 0) : null;
    })
    .filter(value => value !== null && value > 0);
  if (!ranges.length) return 0;
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
};

const normalizeWeight = (value, maxWeight) => (
  maxWeight > 0 ? Math.max(MIN_VISIBLE_WEIGHT, value / maxWeight) : MIN_VISIBLE_WEIGHT
);

const isSwingHigh = (rows, index) => {
  const high = getNumber(rows[index]?.high);
  if (high === null) return false;
  for (let offset = 1; offset <= PIVOT_LOOKBACK; offset += 1) {
    const left = getNumber(rows[index - offset]?.high);
    const right = getNumber(rows[index + offset]?.high);
    if ((left !== null && high < left) || (right !== null && high < right)) return false;
  }
  return true;
};

const isSwingLow = (rows, index) => {
  const low = getNumber(rows[index]?.low);
  if (low === null) return false;
  for (let offset = 1; offset <= PIVOT_LOOKBACK; offset += 1) {
    const left = getNumber(rows[index - offset]?.low);
    const right = getNumber(rows[index + offset]?.low);
    if ((left !== null && low > left) || (right !== null && low > right)) return false;
  }
  return true;
};

const getPivotReaction = (rows, index, side) => {
  const pivotPrice = getNumber(side === 'resistance' ? rows[index]?.high : rows[index]?.low);
  if (pivotPrice === null) return 0;
  const reactionRows = rows.slice(index + 1, Math.min(rows.length, index + 9));
  if (!reactionRows.length) return 0;

  if (side === 'resistance') {
    const lowestAfter = Math.min(...reactionRows.map(row => getNumber(row.low)).filter(value => value !== null));
    return Number.isFinite(lowestAfter) ? Math.max(0, pivotPrice - lowestAfter) : 0;
  }

  const highestAfter = Math.max(...reactionRows.map(row => getNumber(row.high)).filter(value => value !== null));
  return Number.isFinite(highestAfter) ? Math.max(0, highestAfter - pivotPrice) : 0;
};

const getPivotPoints = rows => {
  const pivots = [];
  rows.forEach((row, index) => {
    if (index < PIVOT_LOOKBACK || index >= rows.length - PIVOT_LOOKBACK) return;

    if (isSwingHigh(rows, index)) {
      const price = getNumber(row.high);
      if (price !== null) pivots.push({ index, price, side: 'resistance' });
    }

    if (isSwingLow(rows, index)) {
      const price = getNumber(row.low);
      if (price !== null) pivots.push({ index, price, side: 'support' });
    }
  });
  return pivots;
};

const createLevel = pivot => ({
  price: pivot.price,
  touches: 0,
  weight: 0,
  firstIndex: pivot.index,
  lastIndex: pivot.index,
  sideCounts: { support: 0, resistance: 0 }
});

const buildSupportResistanceLevels = (rows, {
  minTouches = 2,
  maxLevels = MAX_HORIZONTAL_LEVELS,
  priceRange = getPriceRange(rows)
} = {}) => {
  if (!Number.isFinite(priceRange.min) || !Number.isFinite(priceRange.max) || priceRange.max <= priceRange.min) return [];

  const averageRange = getAverageRange(rows);
  const span = priceRange.max - priceRange.min;
  const tolerance = Math.max(span * 0.006, averageRange * 0.65);
  const zoneHeight = Math.max(span * 0.0025, averageRange * 0.38, tolerance * 0.42);
  const levels = [];

  getPivotPoints(rows).forEach(pivot => {
    const reaction = getPivotReaction(rows, pivot.index, pivot.side);
    const recency = 0.35 + ((pivot.index + 1) / rows.length) * 0.65;
    const score = recency + (reaction / Math.max(averageRange, 1e-9)) * 0.22;
    const match = levels.find(level => Math.abs(level.price - pivot.price) <= tolerance);
    const level = match || createLevel(pivot);

    const nextTouches = level.touches + 1;
    level.price = ((level.price * level.touches) + pivot.price) / nextTouches;
    level.touches = nextTouches;
    level.weight += score;
    level.firstIndex = Math.min(level.firstIndex, pivot.index);
    level.lastIndex = Math.max(level.lastIndex, pivot.index);
    level.sideCounts[pivot.side] += 1;
    if (!match) levels.push(level);
  });

  const maxWeight = Math.max(...levels.map(level => level.weight), 0);
  return levels
    .filter(level => level.touches >= minTouches)
    .map(level => ({
      ...level,
      heightPrice: zoneHeight,
      side: level.sideCounts.support >= level.sideCounts.resistance ? 'support' : 'resistance',
      weight: normalizeWeight(level.weight, maxWeight)
    }))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, maxLevels);
};

const getHorizontalHeatmapItems = (rows, priceRange) => (
  buildSupportResistanceLevels(rows, { priceRange, minTouches: 2, maxLevels: MAX_HORIZONTAL_LEVELS })
    .map((level, index) => ({
      type: 'horizontal',
      price: level.price,
      heightPrice: level.heightPrice,
      weight: level.weight,
      label: `sr${index + 1}`,
      startTime: getChartTime(rows[level.firstIndex ?? 0]),
      endTime: getChartTime(rows.at(-1)),
      touches: level.touches,
      side: level.side,
      tone: 'heat'
    }))
);

const createCell = ({ mode, rows, startIndex, endIndex, level, weight, priceOffset = 0, heightScale = 1 }) => ({
  type: 'srCell',
  mode,
  startTime: getChartTime(rows[startIndex]),
  endTime: getChartTime(rows[endIndex]),
  price: level.price + priceOffset,
  heightPrice: level.heightPrice * heightScale,
  weight,
  side: level.side,
  tone: 'heat'
});

const getWindowProfile = (rows, startIndex, endIndex) => {
  let low = Infinity;
  let high = -Infinity;
  let closeSum = 0;
  let closeCount = 0;

  for (let index = startIndex; index <= endIndex; index += 1) {
    const row = rows[index];
    const rowLow = getNumber(row?.low);
    const rowHigh = getNumber(row?.high);
    const close = getNumber(row?.close);
    if (rowLow !== null) low = Math.min(low, rowLow);
    if (rowHigh !== null) high = Math.max(high, rowHigh);
    if (close !== null) {
      closeSum += close;
      closeCount += 1;
    }
  }

  return {
    low,
    high,
    close: closeCount ? closeSum / closeCount : null
  };
};

const getLevelInfluence = ({ levels, price, endIndex, spread }) => (
  levels.reduce((strength, level) => {
    if (endIndex < level.firstIndex) return strength;
    const distance = Math.abs(price - level.price);
    const influence = Math.max(0, 1 - distance / Math.max(spread, 1e-9));
    if (!influence) return strength;
    const age = Math.min(1, Math.max(0.18, (endIndex - level.firstIndex + 1) / 120));
    return strength + influence * influence * level.weight * age;
  }, 0)
);

const buildTrendlineCandidates = (rows, priceRange) => {
  const pivotsBySide = getPivotPoints(rows).reduce((groups, pivot) => {
    groups[pivot.side].push(pivot);
    return groups;
  }, { support: [], resistance: [] });
  const averageRange = getAverageRange(rows);
  const span = priceRange.max - priceRange.min;
  const maxSlopePerBar = span / Math.max(8, rows.length) * 1.8;
  const candidates = [];

  Object.values(pivotsBySide).forEach(pivots => {
    for (let leftIndex = 0; leftIndex < pivots.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < pivots.length; rightIndex += 1) {
        const left = pivots[leftIndex];
        const right = pivots[rightIndex];
        const distance = right.index - left.index;
        if (distance < PIVOT_LOOKBACK * 3 || distance > rows.length * 0.72) continue;
        const slope = (right.price - left.price) / distance;
        if (Math.abs(slope) > maxSlopePerBar) continue;
        const leftReaction = getPivotReaction(rows, left.index, left.side);
        const rightReaction = getPivotReaction(rows, right.index, right.side);
        const recency = 0.35 + ((right.index + 1) / rows.length) * 0.65;
        candidates.push({
          startIndex: left.index,
          startPrice: left.price,
          slope,
          score: recency + ((leftReaction + rightReaction) / Math.max(averageRange, 1e-9)) * 0.16
        });
      }
    }
  });

  return candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, 260);
};

const diffuseGrid = grid => {
  const next = Array.from({ length: HEATMAP_GRID_ROWS }, () => Array(HEATMAP_GRID_COLUMNS).fill(0));
  const kernel = [
    [0, 0, 0.18], [0, 1, 0.32], [0, 2, 0.14],
    [1, 0, 0.28], [1, 1, 0.18], [1, 2, 0.08],
    [2, 0, 0.12], [2, 1, 0.08]
  ];

  for (let row = 0; row < HEATMAP_GRID_ROWS; row += 1) {
    for (let column = 0; column < HEATMAP_GRID_COLUMNS; column += 1) {
      const value = grid[row][column];
      if (!value) continue;
      kernel.forEach(([rowOffset, columnOffset, weight]) => {
        for (const rowDirection of rowOffset ? [-1, 1] : [1]) {
          for (const columnDirection of columnOffset ? [-1, 1] : [1]) {
            const targetRow = row + rowOffset * rowDirection;
            const targetColumn = column + columnOffset * columnDirection;
            if (
              targetRow >= 0
              && targetRow < HEATMAP_GRID_ROWS
              && targetColumn >= 0
              && targetColumn < HEATMAP_GRID_COLUMNS
            ) {
              next[targetRow][targetColumn] += value * weight;
            }
          }
        }
      });
    }
  }

  return next;
};

const getTrendlineHeatmapItems = (rows, priceRange, mode) => {
  if (!Number.isFinite(priceRange.min) || !Number.isFinite(priceRange.max) || priceRange.max <= priceRange.min) return [];

  const span = priceRange.max - priceRange.min;
  const grid = Array.from({ length: HEATMAP_GRID_ROWS }, () => Array(HEATMAP_GRID_COLUMNS).fill(0));
  const lines = buildTrendlineCandidates(rows, priceRange);
  if (!lines.length) return [];

  lines.forEach(line => {
    for (let column = 0; column < HEATMAP_GRID_COLUMNS; column += 1) {
      const rowIndex = ((column + 0.5) / HEATMAP_GRID_COLUMNS) * (rows.length - 1);
      const price = line.startPrice + line.slope * (rowIndex - line.startIndex);
      if (price < priceRange.min || price > priceRange.max) continue;
      const row = Math.floor(((priceRange.max - price) / span) * HEATMAP_GRID_ROWS);
      if (row >= 0 && row < HEATMAP_GRID_ROWS) {
        grid[row][column] += line.score;
      }
    }
  });

  const renderGrid = mode === 'depth' ? diffuseGrid(grid) : grid;
  const maxWeight = Math.max(...renderGrid.flat(), 0);
  if (!maxWeight) return [];
  const startTime = getChartTime(rows[0]);
  const endTime = getChartTime(rows.at(-1));
  const timeSpan = endTime - startTime;
  if (timeSpan <= 0) return [];
  const bands = [];

  for (let row = 0; row < HEATMAP_GRID_ROWS; row += 1) {
    for (let column = 0; column < HEATMAP_GRID_COLUMNS; column += 1) {
      const weight = renderGrid[row][column] / maxWeight;
      const threshold = mode === 'depth' ? 0.42 : 0.16;
      if (weight < threshold) continue;
      bands.push({
        x: column / HEATMAP_GRID_COLUMNS,
        width: 1 / HEATMAP_GRID_COLUMNS,
        y: row / HEATMAP_GRID_ROWS,
        height: 1 / HEATMAP_GRID_ROWS,
        weight
      });
    }
  }
  if (!bands.length) return [];

  return [{
    type: 'srPattern',
    mode,
    startTime,
    endTime,
    minPrice: priceRange.min,
    maxPrice: priceRange.max,
    bands
  }];
};

const getDepthHeatmapItems = (rows, priceRange) => getTrendlineHeatmapItems(rows, priceRange, 'depth');

const getClassicHeatmapItems = (rows, priceRange) => {
  return getTrendlineHeatmapItems(rows, priceRange, 'classic');
};

export const getHeatmapOverlayItems = ({ data = [], type = 'none', visibleRange = null }) => {
  if (!type || type === 'none') return [];
  const rows = getVisibleRows(data, visibleRange);
  if (rows.length < 2) return [];

  const priceRange = padPriceRange(getPriceRange(rows));
  if (type === 'depth') return getDepthHeatmapItems(rows, priceRange);
  if (type === 'classic' || type === 'trends') return getClassicHeatmapItems(rows, priceRange);
  return getHorizontalHeatmapItems(rows, priceRange);
};

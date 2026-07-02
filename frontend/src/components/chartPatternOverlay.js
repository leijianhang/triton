import { normalizeChartTime } from './chartDataTransform.js';

const toPatternKey = value => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const isHiddenPattern = (group, patternName, patternType) => {
  const hiddenKeys = (group?.hidden || []).map(toPatternKey);
  return hiddenKeys.includes(toPatternKey(patternName)) || hiddenKeys.includes(toPatternKey(patternType));
};

const isSelectedPattern = (group, patternName, patternType) => {
  const selected = group?.selected || [];
  if (selected.length === 0) return false;

  const selectedKeys = selected.map(toPatternKey);
  return selectedKeys.includes(toPatternKey(patternName)) || selectedKeys.includes(toPatternKey(patternType));
};

export const shouldRenderChartPattern = (group, patternName, patternType) => (
  isSelectedPattern(group, patternName, patternType) && !isHiddenPattern(group, patternName, patternType)
);

const normalizeAnchorTime = value => {
  try {
    return normalizeChartTime(value);
  } catch {
    return null;
  }
};

const getBarAnchor = (chartData, index, priceKey = 'close') => {
  const bar = Number.isInteger(index) ? chartData?.[index] : null;
  if (!bar) return null;
  const price = Number(bar[priceKey] ?? bar.close);
  if (!Number.isFinite(price)) return null;
  const time = normalizeAnchorTime(bar.time);
  return time === null ? null : { time, price };
};

const pointAnchor = point => {
  const time = normalizeAnchorTime(point?.time);
  return Number.isFinite(Number(point?.price)) && time !== null
    ? { time, price: Number(point.price) }
    : null;
};

const horizontalLine = (price, start, end) => (
  Number.isFinite(Number(price)) && start?.time && end?.time
    ? [{ time: start.time, price: Number(price) }, { time: end.time, price: Number(price) }]
    : null
);

const compactLines = lines => lines.filter(line => Array.isArray(line?.points) && line.points.length >= 2);

const buildHeadAndShouldersLines = pattern => {
  const shoulders = [
    pointAnchor(pattern.leftShoulder),
    pointAnchor(pattern.head),
    pointAnchor(pattern.rightShoulder)
  ].filter(Boolean);

  return compactLines([
    { kind: 'outline', points: shoulders },
    {
      kind: 'neckline',
      points: horizontalLine(pattern.neckline, pattern.leftShoulder, pattern.rightShoulder)
    },
    {
      kind: 'target',
      points: horizontalLine(pattern.target, pattern.leftShoulder, pattern.rightShoulder)
    }
  ]);
};

const buildDoubleLines = pattern => {
  const first = pointAnchor(pattern.firstTop || pattern.firstBottom);
  const second = pointAnchor(pattern.secondTop || pattern.secondBottom);

  return compactLines([
    { kind: 'outline', points: [first, second].filter(Boolean) },
    { kind: 'neckline', points: horizontalLine(pattern.neckline, first, second) },
    { kind: 'target', points: horizontalLine(pattern.target, first, second) }
  ]);
};

const buildAscendingTriangleLines = pattern => {
  const support = (pattern.support || []).map(pointAnchor).filter(Boolean);
  const start = support[0];
  const end = support[support.length - 1];

  return compactLines([
    { kind: 'resistance', points: horizontalLine(pattern.resistance, start, end) },
    { kind: 'support', points: support },
    { kind: 'target', points: horizontalLine(pattern.breakoutTarget, start, end) }
  ]);
};

const buildDescendingTriangleLines = pattern => {
  const resistance = (pattern.resistance || []).map(pointAnchor).filter(Boolean);
  const start = resistance[0];
  const end = resistance[resistance.length - 1];

  return compactLines([
    { kind: 'support', points: horizontalLine(pattern.support, start, end) },
    { kind: 'resistance', points: resistance },
    { kind: 'target', points: horizontalLine(pattern.breakoutTarget, start, end) }
  ]);
};

const buildSymmetricalTriangleLines = pattern => compactLines([
  { kind: 'resistance', points: (pattern.highs || []).map(pointAnchor).filter(Boolean) },
  { kind: 'support', points: (pattern.lows || []).map(pointAnchor).filter(Boolean) }
]);

const buildChannelOrWedgeLines = pattern => {
  const resistance = (pattern.resistance || pattern.highs || []).map(pointAnchor).filter(Boolean);
  const support = (pattern.support || pattern.lows || []).map(pointAnchor).filter(Boolean);
  const start = [...resistance, ...support].sort((a, b) => String(a.time).localeCompare(String(b.time)))[0];
  const end = [...resistance, ...support].sort((a, b) => String(a.time).localeCompare(String(b.time))).at(-1);

  return compactLines([
    { kind: 'resistance', points: resistance },
    { kind: 'support', points: support },
    { kind: 'target', points: horizontalLine(pattern.target, start, end) }
  ]);
};

const buildCupAndHandleLines = pattern => {
  const leftRim = pointAnchor(pattern.leftRim);
  const cupLow = pointAnchor(pattern.cupLow);
  const rightRim = pointAnchor(pattern.rightRim);
  const handleEnd = pointAnchor(pattern.handleEnd);

  return compactLines([
    { kind: 'outline', points: [leftRim, cupLow, rightRim, handleEnd].filter(Boolean) },
    { kind: 'neckline', points: horizontalLine(pattern.neckline, leftRim, handleEnd || rightRim) },
    { kind: 'target', points: horizontalLine(pattern.target, rightRim, handleEnd) }
  ]);
};

const buildFlagLines = (pattern, chartData = []) => {
  const poleStart = getBarAnchor(chartData, pattern.poleStart, 'close');
  const poleEnd = getBarAnchor(chartData, pattern.poleEnd, 'close');
  const flagEnd = getBarAnchor(chartData, pattern.flagEnd, 'close');

  return compactLines([
    { kind: 'pole', points: [poleStart, poleEnd].filter(Boolean) },
    { kind: 'outline', points: [poleEnd, flagEnd].filter(Boolean) },
    { kind: 'target', points: horizontalLine(pattern.target, poleEnd, flagEnd) }
  ]);
};

export const getChartPatternOverlayItems = (patterns = {}, chartData = []) => {
  if (patterns?.showPatterns === false) return [];
  const group = patterns.chartPatterns;
  const patternList = Array.isArray(group?.patterns) ? group.patterns : [];

  return patternList
    .filter(pattern => shouldRenderChartPattern(group, pattern.name, pattern.type))
    .map(pattern => {
      let lines = [];
      if (pattern.type === 'head_and_shoulders_top' || pattern.type === 'head_and_shoulders_bottom') {
        lines = buildHeadAndShouldersLines(pattern);
      } else if (pattern.type === 'double_top' || pattern.type === 'double_bottom') {
        lines = buildDoubleLines(pattern);
      } else if (pattern.type === 'ascending_triangle') {
        lines = buildAscendingTriangleLines(pattern);
      } else if (pattern.type === 'descending_triangle') {
        lines = buildDescendingTriangleLines(pattern);
      } else if (pattern.type === 'symmetrical_triangle') {
        lines = buildSymmetricalTriangleLines(pattern);
      } else if (
        pattern.type === 'horizontal_channel'
        || pattern.type === 'ascending_channel'
        || pattern.type === 'descending_channel'
        || pattern.type === 'rising_wedge'
        || pattern.type === 'falling_wedge'
      ) {
        lines = buildChannelOrWedgeLines(pattern);
      } else if (pattern.type === 'cup_and_handle') {
        lines = buildCupAndHandleLines(pattern);
      } else if (pattern.type === 'bull_flag' || pattern.type === 'bear_flag') {
        lines = buildFlagLines(pattern, chartData);
      }

      return { ...pattern, lines };
    })
    .filter(pattern => Array.isArray(pattern.lines) && pattern.lines.length > 0);
};

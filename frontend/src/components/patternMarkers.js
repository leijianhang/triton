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

const shouldRenderPattern = (group, patternName, patternType) => (
  isSelectedPattern(group, patternName, patternType) && !isHiddenPattern(group, patternName, patternType)
);

const getMarkerTime = value => {
  try {
    return normalizeChartTime(value);
  } catch {
    return null;
  }
};

const isWithinMaxTime = (time, maxTime) => maxTime === null || maxTime === undefined || time <= maxTime;

export const getPatternMarkers = (patterns = {}, maxTime = null) => {
  const markers = [];

  patterns.candlePatterns?.patterns?.forEach(item => {
    const time = getMarkerTime(item.time);
    if (time === null || !isWithinMaxTime(time, maxTime)) return;

    item.patterns?.forEach(pattern => {
      if (!shouldRenderPattern(patterns.candlePatterns, pattern.name, pattern.type)) return;
      const signal = pattern.signal;
      markers.push({
        time,
        position: signal === 'bearish' ? 'aboveBar' : 'belowBar',
        color: signal === 'bearish' ? '#ff6b7a' : '#4ee093',
        shape: signal === 'bearish' ? 'arrowDown' : 'arrowUp',
        text: pattern.type || pattern.name || 'Candle'
      });
    });
  });

  return markers;
};

const countCandleMatches = (candlePatterns, selectedName, maxTime = null) => {
  const selectedKey = toPatternKey(selectedName);
  return (candlePatterns?.patterns || []).reduce((count, row) => (
    count + (
      isWithinMaxTime(getMarkerTime(row.time), maxTime)
        ? (row.patterns || []).filter(pattern => (
          toPatternKey(pattern.name) === selectedKey || toPatternKey(pattern.type) === selectedKey
        )).length
        : 0
    )
  ), 0);
};

const countChartMatches = (chartPatterns, selectedName, maxTime = null) => {
  const selectedKey = toPatternKey(selectedName);
  const patternList = Array.isArray(chartPatterns?.patterns) ? chartPatterns.patterns : [];
  return patternList.filter(pattern => (
    isWithinMaxTime(getMarkerTime(pattern.time), maxTime)
    && (toPatternKey(pattern.name) === selectedKey || toPatternKey(pattern.type) === selectedKey)
  )).length;
};

const getSelectedLegendItems = ({ groupKey, groupName, group, selected = [], countMatches }) => (
  selected.map(name => ({
    key: `${groupKey}-${name}`,
    groupKey,
    name,
    groupName,
    count: countMatches(name),
    visible: !isHiddenPattern(group, name)
  }))
);

export const getPatternLegendItems = (patterns = {}, maxTime = null) => [
  ...getSelectedLegendItems({
    groupKey: 'candlestick',
    groupName: 'Candle Pattern',
    group: patterns.candlePatterns,
    selected: patterns.candlePatterns?.selected,
    countMatches: name => countCandleMatches(patterns.candlePatterns, name, maxTime)
  }),
  ...getSelectedLegendItems({
    groupKey: 'chart',
    groupName: 'Chart Pattern',
    group: patterns.chartPatterns,
    selected: patterns.chartPatterns?.selected,
    countMatches: name => countChartMatches(patterns.chartPatterns, name, maxTime)
  })
];

export const hasActivePatterns = (patterns = {}) => (
  Boolean(patterns.candlePatterns?.selected?.length)
  || Boolean(patterns.chartPatterns?.selected?.length)
);

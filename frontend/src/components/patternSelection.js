const collectSelected = (patterns, key) => {
  const selected = patterns?.[key]?.selected;
  return Array.isArray(selected) ? selected.filter(Boolean) : [];
};

export const getStoredPatternSelections = (patterns, category = 'all') => {
  const selections = [];

  if (category === 'all' || category === 'candlestick') {
    selections.push(...collectSelected(patterns, 'candlePatterns'));
  }
  if (category === 'all' || category === 'chart') {
    selections.push(...collectSelected(patterns, 'chartPatterns'));
  }

  return [...new Set(selections)];
};

const clearedPatternGroup = () => ({
  count: 0,
  patterns: [],
  selected: [],
  hidden: []
});

export const clearStoredPatternSelections = (patterns = {}) => ({
  ...patterns,
  candlePatterns: clearedPatternGroup(),
  chartPatterns: clearedPatternGroup(),
  showPatterns: true
});

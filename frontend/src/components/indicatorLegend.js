const formatList = values =>
  values.filter(value => value !== null && value !== undefined).join(' ');

const visibleFor = indicator => indicator?.visible !== false;
const EMPTY_VALUE_LABEL = '-';
const formatValue = value => (Number.isFinite(value) ? value.toFixed(2) : EMPTY_VALUE_LABEL);
const overlayIndicatorColorSets = {
  ma: ['#2196f3', '#ff9800', '#9c27b0', '#4caf50'],
  ema: ['#00bcd4', '#ffc107'],
  boll: ['#7c8cff', '#8d9aa7', '#7c8cff'],
  vwap: ['#e2a044']
};

export const getOverlayIndicatorSeriesColors = (indicatorKey, count = 1) => {
  const colors = overlayIndicatorColorSets[indicatorKey] || ['#88d4ff'];
  return Array.from({ length: count }).map((_, index) => colors[index % colors.length]);
};

const getConfiguredColors = (indicator, indicatorKey, count) => {
  const fallback = getOverlayIndicatorSeriesColors(indicatorKey, count);
  return Array.from({ length: count }).map((_, index) => indicator?.colors?.[index] || fallback[index]);
};

const getLatestClose = data => data?.[data.length - 1]?.close;
const getBarTime = bar => bar?.time ?? bar?.date;

const getDataThroughBar = (data = [], activeBar) => {
  if (!activeBar) return data;
  const activeTime = getBarTime(activeBar);
  const activeIndex = data.findIndex(item => item === activeBar || getBarTime(item) === activeTime);
  return activeIndex >= 0 ? data.slice(0, activeIndex + 1) : data;
};

const calculateLatestMA = (data = [], period) => {
  if (!period || data.length < period) return null;
  const slice = data.slice(data.length - period);
  const sum = slice.reduce((total, item) => total + Number(item.close || 0), 0);
  return sum / period;
};

const calculateLatestBOLL = (data = [], params = {}) => {
  const period = params.period;
  const stdDev = params.stdDev ?? 2;
  const middle = calculateLatestMA(data, period);
  if (!Number.isFinite(middle) || data.length < period) return null;

  const slice = data.slice(data.length - period);
  const variance = slice.reduce((total, item) => {
    const diff = Number(item.close || 0) - middle;
    return total + diff * diff;
  }, 0) / period;
  const deviation = Math.sqrt(variance) * stdDev;

  return {
    upper: middle + deviation,
    middle,
    lower: middle - deviation
  };
};

const calculateLatestEMA = (data = [], period) => {
  if (!period || data.length < period) return null;

  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((total, item) => total + Number(item.close || 0), 0) / period;

  for (let index = period; index < data.length; index += 1) {
    ema = (Number(data[index].close || 0) - ema) * multiplier + ema;
  }

  return ema;
};

const getIndicatorStates = (indicators, indicatorKey) => {
  const indicator = indicators[indicatorKey];
  const activeInstances = indicator?.instances?.filter(instance => instance.enabled);

  if (activeInstances?.length) {
    return activeInstances.map((instance, index) => ({
      key: instance.id,
      baseKey: indicatorKey,
      instanceIndex: index,
      state: instance
    }));
  }

  return indicator?.enabled ? [{
    key: indicatorKey,
    baseKey: indicatorKey,
    instanceIndex: 0,
    state: indicator
  }] : [];
};

export const getOverlayIndicatorLegendItems = (indicators = {}) => {
  const items = [];

  getIndicatorStates(indicators, 'ma').forEach(({ key, baseKey, instanceIndex, state }) => {
    if (!state.periods?.length) return;
    const paramsLabel = formatList(state.periods);
    items.push({
      key,
      baseKey,
      instanceIndex,
      state,
      name: 'MA',
      paramsLabel,
      label: `MA ${paramsLabel}`,
      colors: getConfiguredColors(state, 'ma', state.periods.length),
      visible: visibleFor(state)
    });
  });

  getIndicatorStates(indicators, 'ema').forEach(({ key, baseKey, instanceIndex, state }) => {
    if (!state.periods?.length) return;
    const paramsLabel = formatList(state.periods);
    items.push({
      key,
      baseKey,
      instanceIndex,
      state,
      name: 'EMA',
      paramsLabel,
      label: `EMA ${paramsLabel}`,
      colors: getConfiguredColors(state, 'ema', state.periods.length),
      visible: visibleFor(state)
    });
  });

  getIndicatorStates(indicators, 'boll').forEach(({ key, baseKey, instanceIndex, state }) => {
    if (!state.params) return;
    const paramsLabel = formatList([state.params.period, state.params.stdDev]);
    items.push({
      key,
      baseKey,
      instanceIndex,
      state,
      name: 'BOLL',
      paramsLabel,
      label: `BOLL ${paramsLabel}`,
      colors: getConfiguredColors(state, 'boll', 3),
      visible: visibleFor(state)
    });
  });

  getIndicatorStates(indicators, 'vwap').forEach(({ key, baseKey, instanceIndex, state }) => {
    items.push({
      key,
      baseKey,
      instanceIndex,
      state,
      name: 'VWAP',
      paramsLabel: '',
      label: 'VWAP',
      colors: getConfiguredColors(state, 'vwap', 1),
      visible: visibleFor(state)
    });
  });

  getIndicatorStates(indicators, 'gonogo').forEach(({ key, baseKey, instanceIndex, state }) => {
    items.push({
      key,
      baseKey,
      instanceIndex,
      state,
      name: 'GNG',
      paramsLabel: '',
      label: 'GNG',
      colors: [],
      visible: visibleFor(state)
    });
  });

  return items;
};

export const withOverlayIndicatorValues = (items = [], indicators = {}, data = [], activeBar = null) => {
  const scopedData = getDataThroughBar(data, activeBar);

  return items.map(item => {
    const indicatorState = item.state || indicators[item.baseKey || item.key] || {};
    const colors = item.colors || getOverlayIndicatorSeriesColors(item.baseKey || item.key, 4);

    if ((item.baseKey || item.key) === 'ma') {
      const valueItems = indicatorState.periods
        ?.map((period, index) => ({
          label: `MA${period}`,
          value: formatValue(calculateLatestMA(scopedData, period)),
          color: colors[index] || '#88d4ff'
        }));
      return { ...item, valueItems, valueLabel: valueItems?.map(valueItem => valueItem.value).join(' ') || '' };
    }

    if ((item.baseKey || item.key) === 'ema') {
      const valueItems = indicatorState.periods
        ?.map((period, index) => ({
          label: `EMA${period}`,
          value: formatValue(calculateLatestEMA(scopedData, period)),
          color: colors[index] || '#88d4ff'
        }));
      return { ...item, valueItems, valueLabel: valueItems?.map(valueItem => valueItem.value).join(' ') || '' };
    }

    if ((item.baseKey || item.key) === 'boll') {
      const boll = calculateLatestBOLL(scopedData, indicatorState.params);
      const valueItems = [
        { label: 'Upper', value: formatValue(boll?.upper), color: colors[0] || '#7c8cff' },
        { label: 'Middle', value: formatValue(boll?.middle), color: colors[1] || '#8d9aa7' },
        { label: 'Lower', value: formatValue(boll?.lower), color: colors[2] || '#7c8cff' }
      ];
      return {
        ...item,
        valueItems,
        valueLabel: valueItems.map(valueItem => valueItem.value).join(' ')
      };
    }

    if ((item.baseKey || item.key) === 'vwap') {
      const value = formatValue(getLatestClose(scopedData));
      return {
        ...item,
        valueItems: [{ label: 'VWAP', value, color: colors[0] || '#88d4ff' }],
        valueLabel: value
      };
    }

    return item;
  });
};

export const getOverlayIndicatorEditorRows = (item = {}, draft = null) => {
  const baseKey = item.baseKey || item.key;
  const state = item.state || {};
  const colors = draft?.colors || item.colors || [];

  if (baseKey === 'ma' || baseKey === 'ema') {
    const periods = draft?.periods || state.periods || [];
    const prefix = baseKey.toUpperCase();
    return periods.map((period, index) => ({
      key: `${baseKey}-${index}`,
      label: `${prefix}${period}`,
      period,
      color: colors[index] || getOverlayIndicatorSeriesColors(baseKey, periods.length)[index],
      periodEditable: true
    }));
  }

  if (baseKey === 'boll') {
    const labels = ['Upper', 'Middle', 'Lower'];
    const fallbackColors = getOverlayIndicatorSeriesColors('boll', labels.length);
    return labels.map((label, index) => ({
      key: `boll-${label.toLowerCase()}`,
      label,
      color: colors[index] || fallbackColors[index],
      periodEditable: false
    }));
  }

  if (baseKey === 'vwap') {
    return [{
      key: 'vwap',
      label: 'VWAP',
      color: colors[0] || getOverlayIndicatorSeriesColors('vwap', 1)[0],
      periodEditable: false
    }];
  }

  return [];
};

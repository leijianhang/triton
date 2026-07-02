export const indicatorTypeOptions = [
  { value: 'all', label: '全部指标' },
  { value: 'favorites', label: '收藏' },
  { value: 'technical', label: '技术指标' },
  { value: 'market-breadth', label: '市场宽度' },
  { value: 'price-action', label: '价格行为' },
  { value: 'volume', label: '成交量' }
];

export const indicatorLibrary = [
  {
    key: 'ma',
    type: 'technical',
    name: 'Moving Average',
    shortName: 'MA',
    summary: '简单移动平均线叠加。',
    tags: ['trend', 'overlay', 'average']
  },
  {
    key: 'ema',
    type: 'technical',
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    summary: '加权移动平均线叠加。',
    tags: ['trend', 'overlay', 'average']
  },
  {
    key: 'macd',
    type: 'technical',
    name: 'MACD',
    shortName: 'MACD',
    summary: '基于移动平均线的动量震荡指标。',
    tags: ['momentum', 'oscillator']
  },
  {
    key: 'rsi',
    type: 'technical',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    summary: '显示超买超卖的动量读数。',
    tags: ['momentum', 'oscillator']
  },
  {
    key: 'kdj',
    type: 'technical',
    name: 'KDJ',
    shortName: 'KDJ',
    summary: '随机指标风格的动量震荡指标。',
    tags: ['momentum', 'oscillator']
  },
  {
    key: 'boll',
    type: 'technical',
    name: 'Bollinger Bands',
    shortName: 'BOLL',
    summary: '围绕移动平均线的波动率通道。',
    tags: ['volatility', 'overlay']
  },
  {
    key: 'vwap',
    type: 'volume',
    name: 'VWAP',
    shortName: 'VWAP',
    summary: '成交量加权平均价叠加。',
    tags: ['volume', 'overlay']
  },
  {
    key: 'gonogo',
    type: 'technical',
    name: 'GoNoGo Trend',
    shortName: 'GNG',
    summary: '按当前趋势方向和强度为价格柱着色。',
    tags: ['trend', 'overlay', 'bar color'],
    canHaveOnlyOne: true
  },
  {
    key: 'obv',
    type: 'volume',
    name: 'On Balance Volume',
    shortName: 'OBV',
    summary: '根据成交量跟踪买卖压力。',
    tags: ['volume', 'pressure']
  },
  {
    key: 'newHighLow',
    type: 'market-breadth',
    name: 'New Highs New Lows',
    shortName: 'NHNL',
    summary: '观察创出新高或新低标的的市场宽度。',
    tags: ['breadth', 'high', 'low']
  },
  {
    key: 'insideBar',
    type: 'price-action',
    name: 'Inside Bar',
    shortName: 'IB',
    summary: '价格行为收敛形态。',
    tags: ['pattern', 'candle', 'price']
  }
];

export const getActiveIndicatorRows = indicators =>
  indicatorLibrary.flatMap(item => {
    const indicator = indicators[item.key];
    const activeInstances = indicator?.instances?.filter(instance => instance.enabled);

    if (activeInstances?.length) {
      return activeInstances.map((instance, index) => ({
        ...item,
        key: instance.id,
        baseKey: item.key,
        instanceId: instance.id,
        instanceIndex: index,
        state: instance
      }));
    }

    return indicator?.enabled ? [{ ...item, baseKey: item.key, instanceId: item.key, state: indicator }] : [];
  });

export const hasActiveIndicators = indicators =>
  getActiveIndicatorRows(indicators).length > 0;

export const getFilteredIndicatorRows = ({ indicators = {}, type = 'all', query = '' }) => {
  const normalizedQuery = query.trim().toLowerCase();

  return indicatorLibrary.filter(item => {
    const matchesType =
      type === 'all' ||
      (type === 'favorites' ? (
        indicators[item.key]?.enabled || indicators[item.key]?.instances?.some(instance => instance.enabled)
      ) : item.type === type);

    const searchable = [
      item.name,
      item.shortName,
      item.summary,
      ...item.tags
    ].join(' ').toLowerCase();

    return matchesType && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
};

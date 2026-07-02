export const marketSymbols = [
  {
    symbol: '600519',
    name: '贵州茅台',
    type: 'stock',
    market: 'A股',
    exchange: 'SSE',
    industry: '白酒',
    last: '1680.00',
    change: '+2.18%',
    tone: 'up',
    score: 92,
    setup: 'Daily trend breakout + volume expansion',
    time: '09:42'
  },
  {
    symbol: '000858',
    name: '五粮液',
    type: 'stock',
    market: 'A股',
    exchange: 'SZSE',
    industry: '白酒',
    last: '168.50',
    change: '+0.74%',
    tone: 'up',
    score: 84,
    setup: 'MA alignment on daily chart',
    time: '09:58'
  },
  {
    symbol: '600036',
    name: '招商银行',
    type: 'stock',
    market: 'A股',
    exchange: 'SSE',
    industry: '银行',
    last: '34.20',
    change: '-0.42%',
    tone: 'down',
    score: 63,
    setup: 'Breadth lagging near MA20',
    time: '10:02'
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    type: 'us',
    market: 'US',
    exchange: 'NASDAQ',
    industry: 'Technology',
    last: '213.55',
    change: '+0.82%',
    tone: 'up',
    score: 82,
    setup: 'US large-cap momentum leader',
    time: '09:45'
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    type: 'us',
    market: 'US',
    exchange: 'NASDAQ',
    industry: 'Technology',
    last: '447.67',
    change: '+0.36%',
    tone: 'up',
    score: 80,
    setup: 'Cloud and AI trend holding above support',
    time: '09:46'
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    type: 'us',
    market: 'US',
    exchange: 'NASDAQ',
    industry: 'Semiconductors',
    last: '124.30',
    change: '+1.41%',
    tone: 'up',
    score: 88,
    setup: 'Semiconductor relative strength',
    time: '09:47'
  },
  {
    symbol: '0700.HK',
    name: '腾讯控股',
    type: 'hk',
    market: '港股',
    exchange: 'HKEX',
    industry: '互联网',
    last: '385.80',
    change: '+0.51%',
    tone: 'up',
    score: 79,
    setup: 'Hong Kong tech rebound setup',
    time: '10:03'
  },
  {
    symbol: '9988.HK',
    name: '阿里巴巴-W',
    type: 'hk',
    market: '港股',
    exchange: 'HKEX',
    industry: '互联网',
    last: '76.20',
    change: '-0.26%',
    tone: 'down',
    score: 66,
    setup: 'Range compression near resistance',
    time: '10:04'
  },
  {
    symbol: '3690.HK',
    name: '美团-W',
    type: 'hk',
    market: '港股',
    exchange: 'HKEX',
    industry: '互联网',
    last: '119.50',
    change: '+1.18%',
    tone: 'up',
    score: 77,
    setup: 'Consumer internet momentum improving',
    time: '10:05'
  }
];

const normalize = value => String(value || '').trim().toLowerCase();

const getDefaultTiming = active => ({
  daily: { label: 'Daily Trend', value: active.score >= 80 ? 'Strong' : 'Constructive', score: active.score, detail: 'Price structure and momentum are aligned' },
  hourly: { label: '60m Momentum', value: active.score >= 75 ? 'Rising' : 'Neutral', score: Math.max(40, active.score - 6), detail: 'Intraday momentum context' },
  intraday: { label: '15m Pullback', value: active.tone === 'down' ? 'Weak' : 'Confirming', score: Math.max(35, active.score - 14), detail: 'Short-term pullback status' },
  risk: { label: 'Risk / Reward', value: active.score >= 80 ? '2.1 : 1' : '1.5 : 1', score: Math.max(35, active.score - 12), detail: 'Stop below recent pivot' }
});

export const findSymbol = (symbol) => {
  const target = normalize(symbol);
  return marketSymbols.find(item => normalize(item.symbol) === target) || null;
};

export const searchSymbols = (keyword, type) => {
  const query = normalize(keyword);
  if (!query) return [];

  return marketSymbols.filter(item => {
    const matchesType = type ? item.type === type : true;
    const matchesKeyword =
      normalize(item.symbol).includes(query) ||
      normalize(item.name).includes(query) ||
      normalize(item.setup).includes(query);

    return matchesType && matchesKeyword;
  });
};

export const getScannerRows = (symbols = marketSymbols) => symbols
  .filter(item => item.score >= 70)
  .sort((a, b) => b.score - a.score);

export const getWatchlistRows = (type, symbols = marketSymbols) =>
  symbols.filter(item => item.type === type).slice(0, 3);

export const getAlertRows = (symbol) => {
  const active = findSymbol(symbol) || marketSymbols[0];
  const triggerPrice = active.symbol === '600519' ? '1698.00' : active.last;

  return [
    {
      name: `${active.symbol} breaks active trendline`,
      type: 'Price Alert',
      target: triggerPrice,
      status: active.score >= 80 ? 'Triggered' : 'Armed'
    },
    {
      name: `${active.symbol} timing score above 70`,
      type: 'Scanner Bot',
      target: `Score > ${Math.max(70, active.score - 4)}`,
      status: active.score >= 76 ? 'Armed' : 'Waiting'
    },
    {
      name: `${active.symbol} MA momentum confirmation`,
      type: 'Indicator Bot',
      target: active.type === 'us' ? '60m RSI' : 'Daily MA20',
      status: 'Waiting'
    }
  ];
};

export const getHappeningRows = (symbol) => {
  const active = findSymbol(symbol) || marketSymbols[0];
  const sectorLabel = active.type === 'stock' ? `${active.name} group` : active.name;

  return [
    {
      title: `${active.symbol} ${active.setup}`,
      time: active.time,
      source: 'Scanner',
      tone: active.tone === 'down' ? 'warn' : 'good'
    },
    {
      title: `${sectorLabel} timing score is ${active.score}`,
      time: '10:12',
      source: 'Timing',
      tone: active.score >= 70 ? 'good' : 'warn'
    },
    {
      title: `${active.market} watchlist context updated`,
      time: '10:33',
      source: 'Watchlist',
      tone: 'neutral'
    }
  ];
};

export const getStrategyRows = (symbol) => {
  const active = findSymbol(symbol) || marketSymbols[0];
  const baseProfit = active.score >= 85 ? '+18.4%' : active.score >= 75 ? '+12.7%' : '+4.6%';
  const tradeCount = active.type === 'stock' ? 42 : 36;

  return [
    {
      symbol: active.symbol,
      name: `${active.symbol} Trendline Breakout`,
      trades: tradeCount,
      winRate: active.score >= 80 ? '61.9%' : '56.8%',
      avg: active.score >= 80 ? '2.1R' : '1.5R',
      profit: baseProfit,
      status: active.score >= 70 ? 'Passing' : 'Review'
    },
    {
      symbol: active.symbol,
      name: `${active.symbol} MA Pullback`,
      trades: tradeCount - 6,
      winRate: active.score >= 80 ? '58.3%' : '52.6%',
      avg: '1.7R',
      profit: active.score >= 70 ? '+9.8%' : '+1.9%',
      status: active.score >= 70 ? 'Passing' : 'Review'
    },
    {
      symbol: active.symbol,
      name: `${active.symbol} RSI Reversal`,
      trades: 28,
      winRate: '46.4%',
      avg: '0.8R',
      profit: '-3.2%',
      status: 'Review'
    }
  ];
};

export const getTimingRows = (symbol) => {
  const active = findSymbol(symbol) || marketSymbols[0];
  return Object.values(active.timing || getDefaultTiming(active));
};

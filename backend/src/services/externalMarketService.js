import axios from 'axios';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 60 });
const YAHOO_BASE = 'https://query1.finance.yahoo.com';
const YAHOO_SEARCH_BASE = 'https://query2.finance.yahoo.com';
const EASTMONEY_LIST_BASE = 'https://push2.eastmoney.com/api/qt/clist/get';
const SINA_A_LIST_BASE = 'http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData';
const SINA_HK_LIST_BASE = 'http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHKStockData';
const SINA_US_LIST_BASE = 'http://stock.finance.sina.com.cn/usstock/api/jsonp.php/var%20data=/US_CategoryService.getList';

const defaultSymbolsByType = {
  stock: [
    { symbol: '600519', yahooSymbol: '600519.SS', name: '贵州茅台', market: 'A股', exchange: 'SSE', industry: '白酒' },
    { symbol: '000858', yahooSymbol: '000858.SZ', name: '五粮液', market: 'A股', exchange: 'SZSE', industry: '白酒' },
    { symbol: '600036', yahooSymbol: '600036.SS', name: '招商银行', market: 'A股', exchange: 'SSE', industry: '银行' },
    { symbol: '000001', yahooSymbol: '000001.SZ', name: '平安银行', market: 'A股', exchange: 'SZSE', industry: '银行' },
    { symbol: '300750', yahooSymbol: '300750.SZ', name: '宁德时代', market: 'A股', exchange: 'SZSE', industry: '新能源' }
  ],
  us: [
    { symbol: 'AAPL', yahooSymbol: 'AAPL', name: 'Apple Inc.', market: 'US', exchange: 'NASDAQ', industry: 'Technology' },
    { symbol: 'MSFT', yahooSymbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', exchange: 'NASDAQ', industry: 'Technology' },
    { symbol: 'NVDA', yahooSymbol: 'NVDA', name: 'NVIDIA Corp.', market: 'US', exchange: 'NASDAQ', industry: 'Semiconductors' },
    { symbol: 'TSLA', yahooSymbol: 'TSLA', name: 'Tesla Inc.', market: 'US', exchange: 'NASDAQ', industry: 'Automobiles' },
    { symbol: 'SPY', yahooSymbol: 'SPY', name: 'SPDR S&P 500 ETF', market: 'US', exchange: 'NYSE Arca', industry: 'ETF' }
  ],
  hk: [
    { symbol: '0700.HK', yahooSymbol: '0700.HK', name: '腾讯控股', market: '港股', exchange: 'HKEX', industry: '互联网' },
    { symbol: '9988.HK', yahooSymbol: '9988.HK', name: '阿里巴巴-W', market: '港股', exchange: 'HKEX', industry: '互联网' },
    { symbol: '3690.HK', yahooSymbol: '3690.HK', name: '美团-W', market: '港股', exchange: 'HKEX', industry: '互联网' },
    { symbol: '0005.HK', yahooSymbol: '0005.HK', name: '汇丰控股', market: '港股', exchange: 'HKEX', industry: '金融' },
    { symbol: '1299.HK', yahooSymbol: '1299.HK', name: '友邦保险', market: '港股', exchange: 'HKEX', industry: '保险' }
  ]
};

const supportedTypes = new Set(['stock', 'us', 'hk']);
const searchableTypes = ['stock', 'us', 'hk'];
const eastmoneyFsByType = {
  stock: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
  us: 'm:105,m:106,m:107',
  hk: 'm:128+t:3,m:128+t:4,m:128+t:1,m:128+t:2'
};
const eastmoneyExchangeByType = {
  stock: 'CN',
  us: 'US',
  hk: 'HKEX'
};

const normalizeType = type => (supportedTypes.has(String(type || '').toLowerCase()) ? String(type).toLowerCase() : 'stock');
const normalizeLimit = (value, fallback = 50) => Math.min(Math.max(Number(value) || fallback, 1), 500);
const normalizePage = value => Math.max(Number(value) || 1, 1);
const normalizePageSize = (value, fallback = 20, max = 100) => Math.min(Math.max(Number(value) || fallback, 1), max);
const round = (value, digits = 2) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const sortByNaturalSymbol = items => [...items].sort((left, right) => (
  String(left?.symbol || '').localeCompare(String(right?.symbol || ''), undefined, {
    numeric: true,
    sensitivity: 'base'
  })
));

export const getExternalMarketDefaults = type => defaultSymbolsByType[normalizeType(type)] || defaultSymbolsByType.stock;

export const toYahooSymbol = (symbol, type = 'stock') => {
  const marketType = normalizeType(type);
  const raw = String(symbol || '').trim().toUpperCase();
  if (!raw) return '';
  const preset = getExternalMarketDefaults(marketType).find(item => item.symbol.toUpperCase() === raw || item.yahooSymbol.toUpperCase() === raw);
  if (preset) return preset.yahooSymbol;
  if (marketType === 'hk') return raw.endsWith('.HK') ? raw : `${raw.padStart(4, '0')}.HK`;
  if (marketType === 'us') return raw;
  if (raw.includes('.')) return raw;
  if (raw.startsWith('6')) return `${raw}.SS`;
  if (raw.startsWith('8') || raw.startsWith('4')) return `${raw}.BJ`;
  return `${raw}.SZ`;
};

const fromYahooSymbol = (symbol, type = 'stock') => {
  const value = String(symbol || '').toUpperCase();
  if (normalizeType(type) === 'stock') return value.replace(/\.(SS|SZ|BJ)$/i, '');
  return value;
};

const yahooGet = async (url, config = {}) => {
  const response = await axios.get(url, {
    timeout: 8000,
    ...config,
    headers: {
      'User-Agent': 'Mozilla/5.0 market-data-proxy',
      Accept: 'application/json',
      ...(config.headers || {})
    }
  });
  return response.data;
};

const httpGet = async (url, config = {}) => {
  const response = await axios.get(url, {
    timeout: 10000,
    ...config,
    headers: {
      'User-Agent': 'Mozilla/5.0 market-data-proxy',
      Accept: 'application/json',
      ...(config.headers || {})
    }
  });
  return response.data;
};

const textGet = async (url, params = {}) => {
  const target = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') target.searchParams.set(key, value);
  });
  const response = await fetch(target, {
    headers: {
      'User-Agent': 'Mozilla/5.0 market-data-proxy',
      Accept: '*/*'
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

const parseSinaJsonp = text => {
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  const start = trimmed.indexOf('(');
  const end = trimmed.lastIndexOf(')');
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start + 1, end));
  return JSON.parse(trimmed);
};

const formatChange = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0.00%';
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`;
};

const normalizeQuote = (quote, type, fallback = {}) => {
  const symbol = fromYahooSymbol(quote?.symbol || fallback.yahooSymbol || fallback.symbol, type);
  const price = Number(quote?.regularMarketPrice ?? quote?.postMarketPrice ?? quote?.preMarketPrice);
  const changePercent = Number(quote?.regularMarketChangePercent);

  return {
    symbol,
    yahooSymbol: quote?.symbol || fallback.yahooSymbol || toYahooSymbol(symbol, type),
    name: quote?.shortName || quote?.longName || fallback.name || symbol,
    type: normalizeType(type),
    market: fallback.market || (type === 'stock' ? 'A股' : type === 'hk' ? '港股' : 'US'),
    exchange: quote?.fullExchangeName || quote?.exchange || fallback.exchange || '',
    industry: fallback.industry || '',
    last: Number.isFinite(price) ? String(price) : (fallback.last || ''),
    change: formatChange(changePercent),
    changePercent: Number.isFinite(changePercent) ? changePercent : 0,
    tone: changePercent < 0 ? 'down' : 'up',
    setup: 'Live quote from Yahoo Finance',
    source: 'yahoo-finance',
    score: Math.max(50, Math.min(95, 70 + Math.round((Number(changePercent) || 0) * 4))),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  };
};

const eastmoneyNumber = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= -100000000) return null;
  return round(number / 100, 4);
};

const normalizeEastmoneyItem = (item, type) => {
  const marketType = normalizeType(type);
  const symbol = String(item?.f12 || '').trim().toUpperCase();
  const name = String(item?.f14 || symbol).trim();
  const last = eastmoneyNumber(item?.f2);
  const changePercent = eastmoneyNumber(item?.f3);
  const changeAmount = eastmoneyNumber(item?.f4);
  const industry = String(item?.f100 || '').trim();

  return {
    symbol,
    yahooSymbol: toYahooSymbol(symbol, marketType),
    name,
    type: marketType,
    market: marketType === 'stock' ? 'A股' : marketType === 'hk' ? '港股' : 'US',
    exchange: eastmoneyExchangeByType[marketType],
    industry,
    last: Number.isFinite(last) ? String(last) : '',
    change: Number.isFinite(changePercent) ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '0.00%',
    changeAmount: Number.isFinite(changeAmount) ? changeAmount : null,
    changePercent: Number.isFinite(changePercent) ? changePercent : 0,
    tone: changePercent < 0 ? 'down' : 'up',
    setup: [industry, marketType === 'stock' ? 'A股' : marketType === 'hk' ? '港股' : 'US'].filter(Boolean).join(' · '),
    source: 'eastmoney',
    score: Math.max(50, Math.min(95, 70 + Math.round((Number(changePercent) || 0) * 4))),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  };
};

const normalizeSinaItem = (item, type) => {
  const marketType = normalizeType(type);
  const symbol = String(item?.code || item?.symbol || '').replace(/^(sh|sz|bj)/i, '').trim().toUpperCase();
  const price = Number(item?.trade ?? item?.lasttrade ?? item?.price);
  const changeAmount = Number(item?.pricechange ?? item?.diff);
  const changePercent = Number(item?.changepercent ?? item?.chg);
  const industry = String(item?.category || '').trim();
  const name = String(item?.name || item?.cname || symbol).trim();
  const exchange = marketType === 'stock'
    ? String(item?.symbol || '').slice(0, 2).toUpperCase()
    : (marketType === 'hk' ? 'HKEX' : String(item?.market || 'US').toUpperCase());

  return {
    symbol,
    yahooSymbol: toYahooSymbol(symbol, marketType),
    name,
    type: marketType,
    market: marketType === 'stock' ? 'A股' : marketType === 'hk' ? '港股' : 'US',
    exchange,
    industry,
    last: Number.isFinite(price) ? String(price) : '',
    change: Number.isFinite(changePercent) ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '0.00%',
    changeAmount: Number.isFinite(changeAmount) ? round(changeAmount, 4) : null,
    changePercent: Number.isFinite(changePercent) ? round(changePercent, 4) : 0,
    tone: changePercent < 0 ? 'down' : 'up',
    setup: [industry, marketType === 'stock' ? 'A股' : marketType === 'hk' ? '港股' : 'US'].filter(Boolean).join(' · '),
    source: 'sina-finance',
    score: Math.max(50, Math.min(95, 70 + Math.round((Number(changePercent) || 0) * 4))),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  };
};

const fetchSinaPage = async ({ type = 'stock', page = 1, pageSize = 100 } = {}) => {
  const marketType = normalizeType(type);
  const safePage = normalizePage(page);
  const safePageSize = normalizePageSize(pageSize, 100, 100);
  const cacheKey = `sina_page_${marketType}_${safePage}_${safePageSize}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const params = {
    page: safePage,
    num: safePageSize,
    sort: 'symbol',
    asc: 1
  };
  let raw;
  if (marketType === 'hk') {
    raw = await textGet(SINA_HK_LIST_BASE, { ...params, node: 'qbgg_hk', _s_r_a: 'page' });
  } else if (marketType === 'us') {
    raw = await textGet(SINA_US_LIST_BASE, { ...params, market: '', id: '' });
  } else {
    raw = await textGet(SINA_A_LIST_BASE, { ...params, node: 'hs_a', _s_r_a: 'page' });
  }

  const parsed = parseSinaJsonp(raw);
  const rawItems = Array.isArray(parsed) ? parsed : (parsed?.data || []);
  const items = sortByNaturalSymbol(rawItems.map(item => normalizeSinaItem(item, marketType)).filter(item => item.symbol));
  const total = Number(parsed?.count) || null;
  const result = {
    page: safePage,
    pageSize: safePageSize,
    total: total || items.length,
    data: items
  };
  cache.set(cacheKey, result, 300);
  return result;
};

const fetchAllSinaItemsByType = async type => {
  const marketType = normalizeType(type);
  const cacheKey = `sina_all_${marketType}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const pageSize = marketType === 'us' ? 20 : 100;
  const first = await fetchSinaPage({ type: marketType, page: 1, pageSize });
  const pages = [first];
  const knownTotal = Number(first.total) > first.data.length ? first.total : null;
  const maxPages = knownTotal ? Math.ceil(knownTotal / pageSize) : 300;

  for (let index = 2; index <= maxPages; index += 10) {
    const batch = Array.from({ length: Math.min(10, maxPages - index + 1) }, (_, batchIndex) => (
      fetchSinaPage({ type: marketType, page: index + batchIndex, pageSize })
    ));
    const results = await Promise.all(batch);
    pages.push(...results);
    if (!knownTotal && results.some(page => page.data.length < pageSize)) break;
  }

  const items = sortByNaturalSymbol(pages.flatMap(page => page.data));
  cache.set(cacheKey, items, 300);
  return items;
};

const fetchEastmoneyPage = async ({ type = 'stock', page = 1, pageSize = 20, maxPageSize = 100 } = {}) => {
  const marketType = normalizeType(type);
  const safePage = normalizePage(page);
  const safePageSize = normalizePageSize(pageSize, 20, maxPageSize);
  const cacheKey = `eastmoney_page_${marketType}_${safePage}_${safePageSize}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await httpGet(EASTMONEY_LIST_BASE, {
    params: {
      pn: safePage,
      pz: safePageSize,
      po: 0,
      np: 1,
      fid: 'f12',
      fs: eastmoneyFsByType[marketType],
      fields: 'f12,f13,f14,f2,f3,f4,f100'
    }
  });
  const payload = data?.data || {};
  const items = (payload.diff || [])
    .map(row => normalizeEastmoneyItem(row, marketType))
    .filter(item => item.symbol);
  const result = {
    page: safePage,
    pageSize: safePageSize,
    total: Number(payload.total) || items.length,
    data: items
  };
  cache.set(cacheKey, result);
  return result;
};

const fetchAllEastmoneyItemsByType = async type => {
  const marketType = normalizeType(type);
  const cacheKey = `eastmoney_all_${marketType}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const first = await fetchEastmoneyPage({ type: marketType, page: 1, pageSize: 100 });
  const total = first.total || first.data.length;
  const bulkPageSize = 100;
  const pageCount = Math.max(1, Math.ceil(total / bulkPageSize));
  const pages = [];
  for (let index = 0; index < pageCount; index += 10) {
    const batch = Array.from({ length: Math.min(10, pageCount - index) }, (_, batchIndex) => (
      fetchEastmoneyPage({ type: marketType, page: index + batchIndex + 1, pageSize: bulkPageSize, maxPageSize: bulkPageSize })
    ));
    pages.push(...await Promise.all(batch));
  }
  const items = sortByNaturalSymbol(pages.flatMap(page => page.data));
  cache.set(cacheKey, items, 300);
  return items;
};

const fetchCombinedEastmoneyPage = async ({ page = 1, pageSize = 20 } = {}) => {
  const safePage = normalizePage(page);
  const safePageSize = normalizePageSize(pageSize);
  const [stockItems, hkItems, usMeta] = await Promise.all([
    fetchAllSinaItemsByType('stock'),
    fetchAllSinaItemsByType('hk'),
    fetchSinaPage({ type: 'us', page: 1, pageSize: 20 })
  ]);
  const numericItems = sortByNaturalSymbol([...stockItems, ...hkItems]);
  const total = numericItems.length + usMeta.total;
  const start = (safePage - 1) * safePageSize;

  if (start + safePageSize <= numericItems.length) {
    return {
      page: safePage,
      pageSize: safePageSize,
      total,
      data: numericItems.slice(start, start + safePageSize)
    };
  }

  const rows = numericItems.slice(start, Math.min(numericItems.length, start + safePageSize));
  const usStart = Math.max(start - numericItems.length, 0);
  const usPageSize = 20;
  let usPage = Math.floor(usStart / usPageSize) + 1;
  let usOffset = usStart % usPageSize;

  while (rows.length < safePageSize && (usPage - 1) * usPageSize < usMeta.total) {
    const pageResult = await fetchSinaPage({ type: 'us', page: usPage, pageSize: usPageSize });
    rows.push(...pageResult.data.slice(usOffset, usOffset + safePageSize - rows.length));
    usPage += 1;
    usOffset = 0;
  }

  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    data: rows
  };
};

const filterMarketItems = (items, keyword) => {
  const query = String(keyword || '').trim().toLowerCase();
  if (!query) return items;
  return items.filter(item => (
    item.symbol.toLowerCase().includes(query) ||
    item.name.toLowerCase().includes(query) ||
    String(item.industry || '').toLowerCase().includes(query)
  ));
};

const paginateItems = (items, page, pageSize) => {
  const safePage = normalizePage(page);
  const safePageSize = normalizePageSize(pageSize);
  const start = (safePage - 1) * safePageSize;
  return {
    page: safePage,
    pageSize: safePageSize,
    total: items.length,
    data: items.slice(start, start + safePageSize)
  };
};

export const fetchExternalMarketPage = async ({ type = 'stock', page = 1, pageSize = 20, keyword = '' } = {}) => {
  const marketType = String(type || 'stock').toLowerCase();
  const safePage = normalizePage(page);
  const safePageSize = normalizePageSize(pageSize);
  const query = String(keyword || '').trim();

  if (marketType === 'all') {
    if (!query) return fetchCombinedEastmoneyPage({ page: safePage, pageSize: safePageSize });
    const groups = await Promise.all(searchableTypes.map(itemType => fetchAllSinaItemsByType(itemType)));
    return paginateItems(sortByNaturalSymbol(filterMarketItems(groups.flat(), query)), safePage, safePageSize);
  }

  const normalizedType = normalizeType(marketType);
  if (!query && normalizedType === 'us') return fetchSinaPage({ type: normalizedType, page: safePage, pageSize: safePageSize });

  const items = await fetchAllSinaItemsByType(normalizedType);
  if (!query) return paginateItems(items, safePage, safePageSize);

  return paginateItems(sortByNaturalSymbol(filterMarketItems(items, query)), safePage, safePageSize);
};

const fetchQuotes = async (symbols, type) => {
  const yahooSymbols = symbols.map(item => item.yahooSymbol || toYahooSymbol(item.symbol, type)).filter(Boolean);
  if (!yahooSymbols.length) return [];
  const cacheKey = `quotes_${type}_${yahooSymbols.join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const rows = await Promise.all(symbols.map(async item => {
    const yahooSymbol = item.yahooSymbol || toYahooSymbol(item.symbol, type);
    try {
      const data = await yahooGet(`${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`, {
        params: {
          range: '5d',
          interval: '1d',
          includePrePost: false
        }
      });
      const result = data?.chart?.result?.[0];
      const meta = result?.meta || {};
      const closes = result?.indicators?.quote?.[0]?.close || [];
      const latestClose = [...closes].reverse().find(value => Number.isFinite(Number(value)));
      const previousClose = Number(meta.chartPreviousClose ?? closes[closes.length - 2]);
      const price = Number(meta.regularMarketPrice ?? latestClose);
      const changePercent = Number.isFinite(price) && Number.isFinite(previousClose) && previousClose !== 0
        ? ((price - previousClose) / previousClose) * 100
        : 0;

      return normalizeQuote({
        symbol: meta.symbol || yahooSymbol,
        regularMarketPrice: price,
        regularMarketChangePercent: changePercent,
        fullExchangeName: meta.fullExchangeName || meta.exchangeName,
        exchange: meta.exchangeName
      }, type, item);
    } catch (error) {
      console.error(`Failed to fetch ${type} chart quote for ${yahooSymbol}:`, error.message);
      return normalizeQuote(null, type, item);
    }
  }));

  cache.set(cacheKey, rows);
  return rows;
};

export const fetchExternalMarketList = async ({ type = 'stock', limit = 50 } = {}) => {
  const marketType = normalizeType(type);
  const safeLimit = normalizeLimit(limit);

  try {
    const page = await fetchExternalMarketPage({ type: marketType, page: 1, pageSize: safeLimit });
    if (page.data.length) return page.data;
  } catch (error) {
    console.error(`Failed to fetch ${marketType} Eastmoney list:`, error.message);
  }

  const defaults = getExternalMarketDefaults(marketType).slice(0, safeLimit);

  try {
    return await fetchQuotes(defaults, marketType);
  } catch (error) {
    console.error(`Failed to fetch ${marketType} quotes:`, error.message);
    return defaults.map(item => normalizeQuote(null, marketType, item));
  }
};

const matchesType = (quote, type) => {
  const symbol = String(quote?.symbol || '').toUpperCase();
  if (type === 'hk') return symbol.endsWith('.HK');
  if (type === 'stock') return /\.(SS|SZ|BJ)$/i.test(symbol);
  return !symbol.includes('.') || ['NYSE', 'NMS', 'NGM', 'NCM', 'ASE', 'PCX'].includes(String(quote?.exchange || '').toUpperCase());
};

export const searchExternalMarket = async ({ type = 'stock', keyword = '', limit = 12 } = {}) => {
  const marketType = normalizeType(type);
  const query = String(keyword || '').trim();
  const safeLimit = normalizeLimit(limit, 12);
  if (!query) return fetchExternalMarketList({ type: marketType, limit: safeLimit });

  try {
    const page = await fetchExternalMarketPage({ type: marketType, keyword: query, page: 1, pageSize: safeLimit });
    if (page.data.length) return page.data;
  } catch (error) {
    console.error(`Failed to search ${marketType} Eastmoney list:`, error.message);
  }

  try {
    const data = await yahooGet(`${YAHOO_SEARCH_BASE}/v1/finance/search`, {
      params: { q: query, quotesCount: safeLimit * 3, newsCount: 0, lang: 'zh-CN', region: marketType === 'us' ? 'US' : 'CN' }
    });
    const quotes = (data?.quotes || [])
      .filter(item => ['EQUITY', 'ETF'].includes(item.quoteType))
      .filter(item => matchesType(item, marketType))
      .slice(0, safeLimit)
      .map(item => normalizeQuote(item, marketType));
    if (quotes.length) return quotes;
  } catch (error) {
    console.error(`Failed to search ${marketType} market data:`, error.message);
  }

  const normalizedQuery = query.toLowerCase();
  return (await fetchExternalMarketList({ type: marketType, limit: 100 }))
    .filter(item => item.symbol.toLowerCase().includes(normalizedQuery) || item.name.toLowerCase().includes(normalizedQuery))
    .slice(0, safeLimit);
};

const intervalByPeriod = {
  '1min': '1m',
  '5min': '5m',
  '15min': '15m',
  '30min': '30m',
  '60min': '60m',
  daily: '1d',
  weekly: '1wk',
  monthly: '1mo'
};

const rangeByPeriod = {
  '1min': '7d',
  '5min': '60d',
  '15min': '60d',
  '30min': '60d',
  '60min': '730d',
  daily: '10y',
  weekly: '10y',
  monthly: '20y'
};

const toUnixSeconds = value => {
  if (!value) return null;
  const parsed = Date.parse(String(value).replace(' ', 'T'));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
};

const normalizeChartRows = (result, limit) => {
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const adjclose = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const rows = timestamps.map((timestamp, index) => {
    const open = Number(quote.open?.[index]);
    const high = Number(quote.high?.[index]);
    const low = Number(quote.low?.[index]);
    const close = Number(quote.close?.[index]);
    const adjustedClose = Number(adjclose[index]);
    const volume = Number(quote.volume?.[index]);
    const date = new Date(timestamp * 1000);
    const time = date.toISOString().slice(0, 19).replace('T', ' ');
    return {
      time,
      open,
      high,
      low,
      close,
      adjustedClose: Number.isFinite(adjustedClose) ? adjustedClose : null,
      volume: Number.isFinite(volume) ? volume : 0,
      amount: 0,
      source: 'yahoo-finance'
    };
  }).filter(item => (
    item.time
    && Number.isFinite(item.open)
    && Number.isFinite(item.high)
    && Number.isFinite(item.low)
    && Number.isFinite(item.close)
  ));

  const sliced = rows.slice(-limit);
  return sliced.map((row, index) => {
    const previousClose = Number(sliced[index - 1]?.close);
    const change = Number.isFinite(previousClose) ? row.close - previousClose : 0;
    return {
      ...row,
      change: round(change, 4) || 0,
      pctChange: Number.isFinite(previousClose) && previousClose !== 0 ? round((change / previousClose) * 100, 4) : 0
    };
  });
};

export const fetchExternalMarketKline = async (symbol, period = 'daily', { type = 'stock', limit = 200, before } = {}) => {
  const marketType = normalizeType(type);
  const safeLimit = normalizeLimit(limit, 200);
  const yahooSymbol = toYahooSymbol(symbol, marketType);
  const interval = intervalByPeriod[period] || intervalByPeriod.daily;
  const cacheKey = `chart_${marketType}_${yahooSymbol}_${period}_${safeLimit}_${before || ''}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const period2 = toUnixSeconds(before);
  const params = {
    interval,
    includePrePost: false,
    events: 'div,splits'
  };
  if (period2) {
    params.period1 = Math.max(0, period2 - 3650 * 24 * 60 * 60);
    params.period2 = period2 - 1;
  } else {
    params.range = rangeByPeriod[period] || rangeByPeriod.daily;
  }

  const data = await yahooGet(`${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`, { params });
  const result = data?.chart?.result?.[0];
  if (!result) return [];
  const rows = normalizeChartRows(result, safeLimit);
  cache.set(cacheKey, rows);
  return rows;
};

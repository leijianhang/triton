import { marketAPI } from '../services/api';
import { marketSymbols } from './marketCatalog';

export const assetTypeOptions = [
  { key: 'stock', label: 'A\u80a1' },
  { key: 'us', label: '\u7f8e\u80a1' },
  { key: 'hk', label: '\u6e2f\u80a1' }
];

export const getAssetTypeLabel = type => assetTypeOptions.find(item => item.key === type)?.label || 'A\u80a1';

const normalizeNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeChange = item => {
  if (typeof item.change === 'string' && item.change.includes('%')) return item.change;
  const percent = Number(item.changePercent ?? item.change);
  if (!Number.isFinite(percent)) return '0.00%';
  return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
};

export const normalizeMarketItem = item => {
  const symbol = String(item?.symbol || '').trim();
  const change = normalizeChange(item || {});
  const changePercent = parseFloat(change);

  return {
    ...item,
    symbol,
    name: item?.name || symbol,
    type: item?.type || 'stock',
    market: item?.market || item?.exchange || 'A-Shares',
    exchange: item?.exchange || item?.market || '',
    last: normalizeNumber(item?.last ?? item?.price)?.toString() || item?.last || '',
    change,
    changePercent: Number.isFinite(changePercent) ? changePercent : 0,
    tone: item?.tone || (changePercent < 0 ? 'down' : 'up'),
    setup: item?.setup || (item?.source === 'eastmoney' ? 'Live quote from Eastmoney' : 'Live market quote'),
    score: Number.isFinite(Number(item?.score)) ? Number(item.score) : Math.max(50, Math.min(95, 70 + Math.round((Number(changePercent) || 0) * 4))),
    time: item?.time || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  };
};

export const normalizeMarketItems = items => (
  (items || []).map(normalizeMarketItem).filter(item => item.symbol)
);

export const getFallbackMarketSymbols = () => marketSymbols.map(normalizeMarketItem);

const normalizePagedMarketResponse = (response, fallbackItems = [], page = 1, pageSize = 12) => {
  const items = normalizeMarketItems(response?.data || []);
  return {
    items,
    total: Number.isFinite(Number(response?.total)) ? Number(response.total) : items.length,
    page: Number(response?.page) || page,
    pageSize: Number(response?.pageSize) || pageSize,
    fallback: fallbackItems
  };
};

const fallbackPage = (items, page = 1, pageSize = 12) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.max(Number(pageSize) || 12, 1);
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    total: items.length,
    page: safePage,
    pageSize: safePageSize
  };
};

export const loadPagedSymbolsByType = async (type = 'stock', { page = 1, pageSize = 12, keyword = '' } = {}) => {
  const fallbackItems = getFallbackMarketSymbols().filter(item => item.type === type);
  try {
    const response = keyword
      ? await marketAPI.search(type, keyword, { page, pageSize })
      : await marketAPI.getAll(type, { page, pageSize });
    const result = normalizePagedMarketResponse(response, fallbackItems, page, pageSize);
    if (result.items.length || result.total > 0) return result;
  } catch {
    // Fall through to static market symbols.
  }

  const query = String(keyword || '').trim().toLowerCase();
  const filtered = query
    ? fallbackItems.filter(item => item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query))
    : fallbackItems;
  return fallbackPage(filtered, page, pageSize);
};

export const loadPagedMarketSymbols = async ({ type = 'all', page = 1, pageSize = 12, keyword = '' } = {}) => {
  if (type !== 'all') return loadPagedSymbolsByType(type, { page, pageSize, keyword });

  const fallbackItems = getFallbackMarketSymbols();
  try {
    const response = keyword
      ? await marketAPI.search('all', keyword, { page, pageSize })
      : await marketAPI.getAll('all', { page, pageSize });
    const result = normalizePagedMarketResponse(response, fallbackItems, page, pageSize);
    if (result.items.length || result.total > 0) return result;
  } catch {
    // Fall through to static market symbols.
  }

  const query = String(keyword || '').trim().toLowerCase();
  const filtered = query
    ? fallbackItems.filter(item => item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query))
    : fallbackItems;
  return fallbackPage(filtered, page, pageSize);
};

export const loadLiveSymbolsByType = async (type = 'stock', { limit = 10 } = {}) => {
  try {
    const result = await loadPagedSymbolsByType(type, { page: 1, pageSize: limit });
    if (result.items.length) return result.items;
  } catch {
    // Fall through to static market symbols.
  }

  return getFallbackMarketSymbols()
    .filter(item => item.type === type)
    .slice(0, limit);
};

export const loadLiveMarketSymbols = async ({ limit = 10 } = {}) => {
  try {
    const result = await loadPagedMarketSymbols({ type: 'all', page: 1, pageSize: limit });
    if (result.items.length) return result.items;
  } catch {
    return getFallbackMarketSymbols();
  }
};

export const searchLiveMarketSymbols = async (keyword, { limit = 12 } = {}) => {
  const query = String(keyword || '').trim();
  if (!query) return loadLiveMarketSymbols({ limit });

  try {
    const result = await loadPagedMarketSymbols({ type: 'all', keyword: query, page: 1, pageSize: limit });
    if (result.items.length) return result.items;
  } catch {
    // Fall through to static market symbols.
  }

  const normalizedQuery = query.toLowerCase();
  return getFallbackMarketSymbols().filter(item => (
    item.symbol.toLowerCase().includes(normalizedQuery) ||
    item.name.toLowerCase().includes(normalizedQuery)
  )).slice(0, limit);
};

export const searchLiveSymbolsByType = async (type = 'stock', keyword, { limit = 12 } = {}) => {
  try {
    const result = await loadPagedSymbolsByType(type, { keyword, page: 1, pageSize: limit });
    return result.items;
  } catch {
    const query = String(keyword || '').trim().toLowerCase();
    return getFallbackMarketSymbols().filter(item => (
      item.type === type &&
      (item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query))
    )).slice(0, limit);
  }
};

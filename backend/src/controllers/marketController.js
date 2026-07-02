import {
  fetchExternalMarketKline,
  fetchExternalMarketList,
  fetchExternalMarketPage,
  searchExternalMarket
} from '../services/externalMarketService.js';

export const getMarketList = async (req, res) => {
  try {
    const { type = 'stock' } = req.params;
    const { limit = 50, page, pageSize, keyword = '' } = req.query;
    if (page || pageSize || String(type).toLowerCase() === 'all') {
      const result = await fetchExternalMarketPage({
        type,
        keyword,
        page,
        pageSize: pageSize || limit
      });
      return res.json({ success: true, ...result });
    }

    const rows = await fetchExternalMarketList({ type, limit });
    return res.json({ success: true, data: rows, page: 1, pageSize: Number(limit) || rows.length, total: rows.length });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const searchMarket = async (req, res) => {
  try {
    const { type = 'stock' } = req.params;
    const { keyword = '', limit = 12, page, pageSize } = req.query;
    if (page || pageSize || String(type).toLowerCase() === 'all') {
      const result = await fetchExternalMarketPage({
        type,
        keyword,
        page,
        pageSize: pageSize || limit
      });
      return res.json({ success: true, ...result });
    }

    const rows = await searchExternalMarket({ type, keyword, limit });
    return res.json({ success: true, data: rows, page: 1, pageSize: Number(limit) || rows.length, total: rows.length });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getMarketKline = async (req, res) => {
  try {
    const { type = 'stock', symbol } = req.params;
    const { period = 'daily', limit = 200, before } = req.query;
    if (!symbol) return res.status(400).json({ success: false, error: 'Please provide a symbol' });
    const rows = await fetchExternalMarketKline(symbol, period, { type, limit, before });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

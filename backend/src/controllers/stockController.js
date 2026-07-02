import {
  fetchExternalMarketKline,
  fetchExternalMarketList,
  searchExternalMarket
} from '../services/externalMarketService.js';

export const getStockList = async (req, res) => {
  try {
    const { limit = 500 } = req.query;
    const stocks = await fetchExternalMarketList({ type: 'stock', limit });
    res.json({ success: true, data: stocks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const searchStock = async (req, res) => {
  try {
    const { keyword = '', limit = 500 } = req.query;
    if (!String(keyword).trim()) {
      return res.status(400).json({ success: false, error: 'Please provide a search keyword' });
    }

    const results = await searchExternalMarket({ type: 'stock', keyword, limit });
    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getStockKline = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = 'daily', limit, before } = req.query;

    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Please provide a stock symbol' });
    }

    const klineData = await fetchExternalMarketKline(symbol, period, { type: 'stock', limit, before });
    return res.json({ success: true, data: klineData });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

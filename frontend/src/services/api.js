import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

const RECENT_GET_CACHE_TTL_MS = 500;
const pendingGetRequests = new Map();
const recentGetResponses = new Map();

const getDedupeKey = (url, params = {}) => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));
  return `${url}?${JSON.stringify(entries)}`;
};

const dedupedGet = (url, config = {}) => {
  const key = getDedupeKey(url, config.params);
  if (pendingGetRequests.has(key)) return pendingGetRequests.get(key);

  const cached = recentGetResponses.get(key);
  if (cached && Date.now() - cached.timestamp <= RECENT_GET_CACHE_TTL_MS) {
    return Promise.resolve(cached.data);
  }

  const request = apiClient.get(url, config)
    .then(data => {
      recentGetResponses.set(key, { timestamp: Date.now(), data });
      return data;
    })
    .finally(() => {
      pendingGetRequests.delete(key);
    });
  pendingGetRequests.set(key, request);
  return request;
};

export const marketAPI = {
  getAll: (type = 'stock', options = 50) => {
    const params = typeof options === 'number' ? { limit: options } : options;
    return dedupedGet(`/market/${type}/list`, { params });
  },

  search: (type = 'stock', keyword, options = 12) => {
    const params = typeof options === 'number' ? { keyword, limit: options } : { keyword, ...options };
    return dedupedGet(`/market/${type}/search`, { params });
  },

  getKline: (type = 'stock', symbol, period = 'daily', options = {}) => {
    return dedupedGet(`/market/${type}/kline/${symbol}`, {
      params: { period, ...options }
    });
  }
};

export const patternAPI = {
  scanCandle: (data) => {
    return apiClient.post('/pattern/candle', {
      data
    });
  },

  scanChart: (data) => {
    return apiClient.post('/pattern/chart', {
      data
    });
  },

  scanAll: (data, options) => {
    const payload = typeof options === 'number'
      ? { data, window: options }
      : { data, ...(options || {}) };
    return apiClient.post('/pattern/all', {
      ...payload
    });
  }
};

export default apiClient;

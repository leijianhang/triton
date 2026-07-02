import { create } from 'zustand';
import { findSymbol } from '../data/marketCatalog';
import {
  addWatchlistGroup,
  cloneWatchlistGroup,
  createDefaultWatchlistGroups,
  deleteWatchlistGroup,
  normalizeWatchlistGroups,
  renameWatchlistGroup,
  setGroupSymbolColor,
  toggleGroupSymbol,
  toggleWatchlistSymbol
} from '../data/watchlistModel';
import {
  DRAWING_STORAGE_KEY,
  clearDrawingsForSymbol as clearSymbolDrawings,
  deleteDrawing as removeStoredDrawing,
  updateDrawing as patchStoredDrawing,
  upsertDrawing
} from '../components/drawingTools';

const WATCHLIST_STORAGE_KEY = 'trendspider.watchlistGroups';
const CURRENT_SYMBOL_STORAGE_KEY = 'trendspider.currentSymbol';

const getInitialCurrentSymbol = () => {
  if (typeof window === 'undefined') return { symbol: null, name: '', type: 'stock' };

  try {
    const stored = window.localStorage.getItem(CURRENT_SYMBOL_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    if (!parsed || typeof parsed !== 'object' || !parsed.symbol) {
      return { symbol: null, name: '', type: 'stock' };
    }

    return {
      symbol: String(parsed.symbol),
      name: parsed.name ? String(parsed.name) : '',
      type: ['stock', 'us', 'hk'].includes(parsed.type) ? parsed.type : 'stock'
    };
  } catch {
    return { symbol: null, name: '', type: 'stock' };
  }
};

const persistCurrentSymbol = (item) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CURRENT_SYMBOL_STORAGE_KEY, JSON.stringify(item));
  } catch {
    // Ignore storage failures; the current session still updates normally.
  }
};

const getInitialWatchlistGroups = () => {
  if (typeof window === 'undefined') return createDefaultWatchlistGroups();

  try {
    const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    return stored ? normalizeWatchlistGroups(JSON.parse(stored)) : createDefaultWatchlistGroups();
  } catch {
    return createDefaultWatchlistGroups();
  }
};

const persistWatchlistGroups = (groups) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Ignore storage failures; the in-memory watchlist still works.
  }
};

const getInitialDrawingsBySymbol = () => {
  if (typeof window === 'undefined') return {};

  try {
    const stored = window.localStorage.getItem(DRAWING_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const persistDrawingsBySymbol = (drawingsBySymbol) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(DRAWING_STORAGE_KEY, JSON.stringify(drawingsBySymbol));
  } catch {
    // Ignore storage failures; drawing tools still work for this session.
  }
};

const withPersistedWatchlistGroups = (updater) => (state) => {
  const watchlistGroups = updater(state.watchlistGroups);
  persistWatchlistGroups(watchlistGroups);
  return { watchlistGroups };
};

const initialCurrentSymbol = getInitialCurrentSymbol();

export const useChartStore = create((set) => ({
  currentSymbol: initialCurrentSymbol.symbol,
  currentName: initialCurrentSymbol.name,
  currentType: initialCurrentSymbol.type,

  klineData: [],

  period: 'daily',
  adjust: 'qfq',
  chartStyle: 'candles',
  showVolume: false,
  showIndicators: true,
  scaleMode: 'auto',
  watchlistGroups: getInitialWatchlistGroups(),
  activeDrawingTool: 'select',
  selectedDrawingId: null,
  drawingsBySymbol: getInitialDrawingsBySymbol(),

  indicators: {
    ma: { enabled: false, periods: [5, 10, 20, 60] },
    ema: { enabled: false, periods: [12, 26] },
    vwap: { enabled: false },
    gonogo: { enabled: false },
    macd: { enabled: false, params: { fast: 12, slow: 26, signal: 9 } },
    rsi: { enabled: false, period: 14 },
    kdj: { enabled: false, params: { n: 9, m1: 3, m2: 3 } },
    boll: { enabled: false, params: { period: 20, stdDev: 2 } },
    atr: { enabled: false, period: 14 },
    stochastic: { enabled: false, params: { kPeriod: 14, dPeriod: 3, smooth: 3 } },
    cci: { enabled: false, period: 20 },
    obv: { enabled: false },
    mfi: { enabled: false, period: 14 },
    adx: { enabled: false, period: 14 },
    ichimoku: { enabled: false, params: { tenkan: 9, kijun: 26, senkou: 52 } },
    newHighLow: { enabled: false },
    insideBar: { enabled: false }
  },

  patterns: {
    candlePatterns: null,
    chartPatterns: null,
    showPatterns: true
  },

  loading: false,
  error: null,

  setCurrentSymbol: (symbol, name, type) => {
    const catalogItem = findSymbol(symbol);
    const nextSymbol = {
      currentSymbol: symbol,
      currentName: name || catalogItem?.name || '',
      currentType: type || catalogItem?.type || 'stock'
    };

    persistCurrentSymbol({
      symbol: nextSymbol.currentSymbol,
      name: nextSymbol.currentName,
      type: nextSymbol.currentType
    });
    set(nextSymbol);
  },

  toggleWatchlistSymbol: (item) => set(withPersistedWatchlistGroups(
    groups => toggleWatchlistSymbol(groups, item)
  )),

  toggleWatchlistGroupSymbol: (groupId, item) => set(withPersistedWatchlistGroups(
    groups => toggleGroupSymbol(groups, groupId, item)
  )),

  addWatchlistGroup: (payload) => set(withPersistedWatchlistGroups(
    groups => addWatchlistGroup(groups, payload)
  )),

  deleteWatchlistGroup: (groupId) => set(withPersistedWatchlistGroups(
    groups => deleteWatchlistGroup(groups, groupId)
  )),

  renameWatchlistGroup: (groupId, name) => set(withPersistedWatchlistGroups(
    groups => renameWatchlistGroup(groups, groupId, name)
  )),

  cloneWatchlistGroup: (groupId, name) => set(withPersistedWatchlistGroups(
    groups => cloneWatchlistGroup(groups, groupId, name)
  )),

  setWatchlistSymbolColor: (groupId, symbol, color) => set(withPersistedWatchlistGroups(
    groups => setGroupSymbolColor(groups, groupId, symbol, color)
  )),

  setKlineData: (data) => set(state => ({
    klineData: typeof data === 'function' ? data(state.klineData) : data
  })),

  setPeriod: (period) => set({ period }),

  setAdjust: (adjust) => set({ adjust }),

  setChartStyle: (chartStyle) => set({ chartStyle }),

  toggleVolume: () => set((state) => ({ showVolume: !state.showVolume })),

  toggleIndicatorsVisible: () => set((state) => ({ showIndicators: !state.showIndicators })),

  setIndicatorsVisible: (showIndicators) => set({ showIndicators }),

  toggleScaleMode: () => set((state) => ({
    scaleMode: state.scaleMode === 'auto' ? 'log' : 'auto'
  })),

  toggleIndicator: (indicatorName) => set((state) => ({
    indicators: {
      ...state.indicators,
      [indicatorName]: {
        ...state.indicators[indicatorName],
        enabled: !state.indicators[indicatorName].enabled,
        visible: true
      }
    }
  })),

  setIndicatorVisible: (indicatorName, visible) => set((state) => ({
    indicators: {
      ...state.indicators,
      [indicatorName]: {
        ...state.indicators[indicatorName],
        visible
      }
    }
  })),

  updateIndicatorParams: (indicatorName, params) => set((state) => ({
    indicators: {
      ...state.indicators,
      [indicatorName]: {
        ...state.indicators[indicatorName],
        ...params
      }
    }
  })),

  setPatterns: (patterns) => set({ patterns }),

  toggleShowPatterns: () => set((state) => ({
    patterns: {
      ...state.patterns,
      showPatterns: !state.patterns.showPatterns
    }
  })),

  setActiveDrawingTool: (activeDrawingTool) => set({
    activeDrawingTool,
    selectedDrawingId: null
  }),

  selectDrawing: (selectedDrawingId) => set({ selectedDrawingId }),

  addDrawing: (drawing) => set((state) => {
    const drawingsBySymbol = upsertDrawing(state.drawingsBySymbol, drawing);
    persistDrawingsBySymbol(drawingsBySymbol);
    return {
      drawingsBySymbol,
      selectedDrawingId: drawing.id
    };
  }),

  updateDrawing: (drawingId, patch) => set((state) => {
    const drawingsBySymbol = patchStoredDrawing(state.drawingsBySymbol, drawingId, patch);
    persistDrawingsBySymbol(drawingsBySymbol);
    return { drawingsBySymbol };
  }),

  deleteDrawing: (drawingId) => set((state) => {
    const drawingsBySymbol = removeStoredDrawing(state.drawingsBySymbol, drawingId);
    persistDrawingsBySymbol(drawingsBySymbol);
    return {
      drawingsBySymbol,
      selectedDrawingId: state.selectedDrawingId === drawingId ? null : state.selectedDrawingId
    };
  }),

  clearDrawingsForSymbol: (symbolInput) => set((state) => {
    const drawingsBySymbol = clearSymbolDrawings(state.drawingsBySymbol, symbolInput);
    persistDrawingsBySymbol(drawingsBySymbol);
    return {
      drawingsBySymbol,
      selectedDrawingId: null
    };
  }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error })
}));

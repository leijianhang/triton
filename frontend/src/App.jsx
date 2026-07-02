import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown, Empty, Input, Modal, Pagination, Spin, message } from 'antd';
import {
  AreaChartOutlined,
  BarChartOutlined,
  CaretDownOutlined,
  LineChartOutlined,
  SearchOutlined,
  StockOutlined
} from '@ant-design/icons';
import IndicatorPanel from './components/IndicatorPanel';
import KlineChart from './components/KlineChart';
import SearchPanel from './components/SearchPanel';
import TerminalTopBar from './components/TerminalTopBar';
import ToolRail from './components/ToolRail';
import RightInsightRail from './components/RightInsightRail';
import BottomSignalDock from './components/BottomSignalDock';
import {
  assetTypeOptions,
  getAssetTypeLabel,
  loadPagedMarketSymbols
} from './data/liveMarketData';
import {
  clampReplayIndex,
  getDefaultReplayIndex
} from './data/replayModel';
import {
  chartStyleOptions,
  getChartStyleOption,
  getTimeframeOption,
  timeframeOptions
} from './components/chartControlOptions';
import { getQuoteSnapshotForBar } from './components/chartQuoteFormat';
import { getChartTime, normalizeChartTime, normalizeKlineRows } from './components/chartDataTransform';
import { hasActiveIndicators } from './components/indicatorLibrary';
import { getWorkspaceLayout, getWorkspacePaneCount } from './components/workspaceLayoutOptions';
import { reconcileWorkspacePaneSettings, syncAllPaneSymbols } from './components/workspacePaneSettings';
import { getPaneDataKey, getPaneKlineData, setPaneKlineData } from './components/workspacePaneData';
import { clearStoredPatternSelections, getStoredPatternSelections } from './components/patternSelection';
import { getStrategyTradeMarkers } from './data/strategyTesterModel';
import { useChartStore } from './store/chartStore';
import { marketAPI, patternAPI } from './services/api';
import './App.css';

const dockFeatures = {
  'Market Scanner': 'Market Scanner',
  'Strategy Tester': 'Strategy Tester',
  'Alerts & Bots': 'Alerts & Bots',
  AI: "What's Happening Now",
  MTFA: 'Timing'
};

const dockTabToFeature = {
  'Market Scanner': 'Market Scanner',
  'Strategy Tester': 'Strategy Tester',
  'Alerts & Bots': 'Alerts & Bots',
  "What's Happening Now": 'AI',
  Timing: 'MTFA'
};

const getKlineBatchLimit = period => {
  return 160;
};

const getInitialKlineLimit = period => {
  return 200;
};

const getSymbolChangeKey = item => `${item.type || 'stock'}:${item.symbol}`;

const getLatestDailyChange = rows => {
  const latest = Array.isArray(rows)
    ? rows.reduce((current, row) => {
      if (!current) return row;
      return String(row?.time || '') > String(current?.time || '') ? row : current;
    }, null)
    : null;
  const amount = Number(latest?.change ?? latest?.changeAmount ?? latest?.change_abs);
  const percent = Number(latest?.pctChange ?? latest?.pct_change ?? latest?.pct_chg ?? latest?.changePercent);
  if (!Number.isFinite(amount) && !Number.isFinite(percent)) return null;
  return {
    amount,
    percent,
    tone: (Number.isFinite(amount) ? amount : percent) < 0 ? 'down' : 'up',
    loading: false
  };
};

const getFallbackDailyChange = item => {
  const percent = Number(item.changePercent ?? parseFloat(item.change));
  const last = Number(item.last);
  const amount = Number.isFinite(last) && Number.isFinite(percent)
    ? (last * percent) / 100
    : null;
  return {
    amount,
    percent: Number.isFinite(percent) ? percent : null,
    tone: (Number.isFinite(amount) ? amount : percent) < 0 ? 'down' : 'up',
    loading: false
  };
};

const formatSignedNumber = value => {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
};

const formatSignedPercent = value => {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const THEME_STORAGE_KEY = 'signalforge.themePreference.v1';
const AUTO_FIB_STORAGE_KEY = 'signalforge.autoFibEnabled.v1';
const HEATMAP_STORAGE_KEY = 'signalforge.heatmap.v1';
const AUTO_TRENDS_STORAGE_KEY = 'signalforge.autoTrends.v1';
const SKIP_LOGIN_PAGE = true;
const heatmapTypeOptions = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'depth', label: 'Depth' },
  { value: 'classic', label: 'Trends' },
  { value: 'none', label: 'None' }
];
const getTimeBasedTheme = (timestamp = Date.now()) => {
  const hour = new Date(timestamp).getHours();
  return hour >= 7 && hour < 19 ? 'day' : 'night';
};
const resolveThemePreference = (preference, timestamp) => (preference === 'auto' ? getTimeBasedTheme(timestamp) : preference);

const featurePanelMeta = {
  Layout: { title: '布局', width: 720 },
  'Auto Fib': { title: '自动斐波那契', width: 740 },
  Trends: { title: 'TRENDS', width: 360 },
  Patterns: { title: 'Candle Patterns', width: 560 },
  'Chart Patterns': { title: 'Chart Patterns', width: 560 },
  Heatmap: { title: 'HEATMAP SETTINGS', width: 360 },
  Scripts: { title: '脚本管理', width: 760 },
  Compare: { title: '标的对比', width: 680 },
  'Chart Settings': { title: '图表设置', width: 680 },
  'More Chart Tools': { title: '更多图表工具', width: 680 }
};

const layoutPresets = [
  { name: '单图表', detail: '一个图表，搭配自选列表和底部面板。' },
  { name: '纵向 2 图表', detail: '并排对比标的或周期。' },
  { name: '4 图表网格', detail: '适合盘中多标的监控。' },
  { name: '扫描器 + 图表', detail: '将扫描结果固定在图表旁。' }
];

const fibLevels = ['0.236', '0.382', '0.500', '0.618', '0.786', '1.272'];
const heatmapRows = [
  { name: 'Liquor', value: '+2.4%', tone: 'hot' },
  { name: 'Copper', value: '+1.8%', tone: 'hot' },
  { name: 'Banks', value: '-0.3%', tone: 'cool' },
  { name: 'Gold', value: '+1.1%', tone: 'warm' }
];
const patternCatalog = [
  { name: '1-2D Inside Break', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '1-2U Inside Break', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '1-2U-2D Inside Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '1-2D-2U Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '1-3-1-2D Volatility Expansion', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '1-3-1-2U Volatility Expansion', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2D-1-2D Measured Move Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2D-1-2U Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2U-1-2D Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2U-1-2U Measured Move Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2D-2D Continuation', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2U-2U Continuation', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2D-2U Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2U-2D Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2D-2U Hammer Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2U-2D Shooting Star Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2D-2D Shooting Star Momentum Continuation', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '2U-2U Hammer Momentum Continuation', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '3-2D Range Expansion Continuation', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '3-2U Range Expansion Continuation', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '3-2D-2U Broadening Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: '3-2U-2D Broadening Reversal', category: 'thestrat', status: 'Ready', type: 'TheStrat' },
  { name: 'Hammer', category: 'candlestick', status: 'Ready', type: 'Candlestick', backendType: 'hammer' },
  { name: 'Inverted Hammer', category: 'candlestick', status: 'Ready', type: 'Candlestick', backendType: 'inverted_hammer' },
  { name: 'Shooting Star', category: 'candlestick', status: 'Ready', type: 'Candlestick', backendType: 'shooting_star' },
  { name: 'Hanging Man', category: 'candlestick', status: 'Ready', type: 'Candlestick', backendType: 'hanging_man' },
  { name: 'Doji', category: 'candlestick', status: 'Ready', type: 'Candlestick', backendType: 'doji' },
  { name: 'Bullish Engulfing', category: 'candlestick', status: 'Ready', type: 'Candlestick', backendType: 'bullish_engulfing' },
  { name: 'Bearish Engulfing', category: 'candlestick', status: 'Ready', type: 'Candlestick', backendType: 'bearish_engulfing' },
  { name: 'Morning Star', category: 'candlestick', status: 'Ready', type: 'Candlestick', backendType: 'morning_star' },
  { name: 'Evening Star', category: 'candlestick', status: 'Ready', type: 'Candlestick', backendType: 'evening_star' },
  { name: 'Triangle, Ascending', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'ascending_triangle' },
  { name: 'Triangle, Descending', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'descending_triangle' },
  { name: 'Triangle, Symmetrical', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'symmetrical_triangle' },
  { name: 'Double Top', category: 'chart', status: 'Ready', type: 'Chart', backendType: 'double_top' },
  { name: 'Double Bottom', category: 'chart', status: 'Ready', type: 'Chart', backendType: 'double_bottom' },
  { name: 'Channel, Horizontal', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'horizontal_channel' },
  { name: 'Channel, Ascending', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'ascending_channel' },
  { name: 'Channel, Descending', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'descending_channel' },
  { name: 'Head and Shoulders', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'head_and_shoulders_top' },
  { name: 'Inverse Head and Shoulders', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'head_and_shoulders_bottom' },
  { name: 'Wedge, Rising', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'rising_wedge' },
  { name: 'Wedge, Falling', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'falling_wedge' },
  { name: 'Cup and Handle', category: 'chart', status: 'Ready', type: 'Chart Pattern', backendType: 'cup_and_handle' }
];

const getApiErrorMessage = (error, fallback) =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback;

const getScanPatternList = (response, groupKey) => {
  const patterns = response?.data?.[groupKey]?.patterns;
  return Array.isArray(patterns) ? patterns : [];
};

const getPatternScanData = (rows = []) => {
  if (!Array.isArray(rows)) return [];
  return rows;
};

const CANDLE_PATTERN_INCREMENTAL_OVERLAP = 8;

const getNormalizedPatternTime = value => {
  try {
    return normalizeChartTime(value);
  } catch {
    return value;
  }
};

const getPatternKey = value => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const getSelectedPatternNames = group => (Array.isArray(group?.selected) ? group.selected.filter(Boolean) : []);
const isPatternGroupVisible = (group, showPatterns = true) => {
  const selected = getSelectedPatternNames(group);
  if (!selected.length || showPatterns === false) return false;
  const hiddenKeys = (Array.isArray(group?.hidden) ? group.hidden : []).map(getPatternKey);
  return selected.some(name => !hiddenKeys.includes(getPatternKey(name)));
};

const getCatalogItem = name => patternCatalog.find(item => item.name === name);
const getCatalogItemsFromNames = names => (Array.isArray(names) ? names : []).map(getCatalogItem).filter(Boolean);
const hasCandlePatternSelection = (items = []) => items.some(item => item.category === 'candlestick' || item.category === 'thestrat');
const hasChartPatternSelection = (items = []) => items.some(item => item.category === 'chart');

const getPatternRowTimeKey = row => {
  try {
    return normalizeChartTime(row?.time);
  } catch {
    return null;
  }
};

const normalizeCandlePatternRows = (rows = []) => {
  const rowsByTime = new Map();

  rows.forEach(row => {
    const time = getPatternRowTimeKey(row);
    if (time === null) return;
    const patterns = Array.isArray(row?.patterns) ? row.patterns.filter(Boolean) : [];
    if (!patterns.length) return;

    const existing = rowsByTime.get(time) || { ...row, time, patterns: [] };
    const patternKeys = new Set(existing.patterns.map(pattern => getPatternKey(pattern?.type || pattern?.name)));
    patterns.forEach(pattern => {
      const key = getPatternKey(pattern?.type || pattern?.name);
      if (!key || patternKeys.has(key)) return;
      patternKeys.add(key);
      existing.patterns.push(pattern);
    });
    rowsByTime.set(time, existing);
  });

  return Array.from(rowsByTime.entries())
    .sort(([leftTime], [rightTime]) => leftTime - rightTime)
    .map(([, row]) => row);
};

const countCandlePatternRows = rows => (Array.isArray(rows) ? rows : [])
  .reduce((count, row) => count + (Array.isArray(row?.patterns) ? row.patterns.length : 0), 0);

const mergeCandlePatternGroups = (previousGroup = {}, scannedGroup = {}) => {
  const scannedRows = normalizeCandlePatternRows(scannedGroup.patterns || []);
  const scannedTimes = new Set(scannedRows.map(getPatternRowTimeKey).filter(time => time !== null));
  const previousRows = (previousGroup.patterns || []).filter(row => !scannedTimes.has(getPatternRowTimeKey(row)));
  const patterns = normalizeCandlePatternRows([...scannedRows, ...previousRows]);

  return {
    ...previousGroup,
    ...scannedGroup,
    patterns,
    count: countCandlePatternRows(patterns),
    hidden: previousGroup.hidden || scannedGroup.hidden || []
  };
};

const getFrontAppendedPatternRows = (previousRows = [], currentRows = []) => {
  if (!previousRows.length || currentRows.length <= previousRows.length) return null;

  const appendedCount = currentRows.length - previousRows.length;
  const currentLastTime = getPatternRowTimeKey(currentRows.at(-1));
  const previousLastTime = getPatternRowTimeKey(previousRows.at(-1));
  const currentFirstPreviousTime = getPatternRowTimeKey(currentRows[appendedCount]);
  const previousFirstTime = getPatternRowTimeKey(previousRows[0]);

  if (
    currentLastTime === null
    || previousLastTime === null
    || currentFirstPreviousTime === null
    || previousFirstTime === null
  ) {
    return null;
  }

  if (currentLastTime !== previousLastTime || currentFirstPreviousTime !== previousFirstTime) return null;

  return currentRows.slice(0, Math.min(currentRows.length, appendedCount + CANDLE_PATTERN_INCREMENTAL_OVERLAP));
};

const emptyPatternResponse = {
  success: true,
  data: {
    candlePatterns: { count: 0, patterns: [] },
    chartPatterns: { count: 0, patterns: [] },
    total: 0
  },
  errors: {
    candlePatterns: null,
    chartPatterns: null
  }
};

const scanSelectedPatternGroups = (rows, selectedItems, options = {}) => {
  const candleRequest = hasCandlePatternSelection(selectedItems)
    ? patternAPI.scanCandle(options.candleRows || rows)
    : null;
  const chartRequest = hasChartPatternSelection(selectedItems)
    ? patternAPI.scanChart(rows)
    : null;

  if (!candleRequest && !chartRequest) return Promise.resolve(emptyPatternResponse);
  if (candleRequest && !chartRequest) return candleRequest;
  if (!candleRequest && chartRequest) return chartRequest;

  return Promise.all([candleRequest, chartRequest]).then(([candleResponse, chartResponse]) => {
    const candlePatterns = candleResponse?.data?.candlePatterns || emptyPatternResponse.data.candlePatterns;
    const chartPatterns = chartResponse?.data?.chartPatterns || emptyPatternResponse.data.chartPatterns;
    return {
      success: candleResponse?.success !== false && chartResponse?.success !== false,
      data: {
        candlePatterns,
        chartPatterns,
        total: (candlePatterns.count || 0) + (chartPatterns.count || 0)
      },
      errors: {
        candlePatterns: candleResponse?.errors?.candlePatterns ?? null,
        chartPatterns: chartResponse?.errors?.chartPatterns ?? null
      }
    };
  });
};
const candlePanelCatalogItems = patternCatalog.filter(item => item.category === 'candlestick' || item.category === 'thestrat');
const chartPatternCatalogItems = patternCatalog.filter(item => item.category === 'chart');
const chartPatternTypes = chartPatternCatalogItems.map(item => item.backendType);
const getChartPatternCatalogItemByType = type => chartPatternCatalogItems.find(item => item.backendType === type);

const normalizeChartPatternMatch = (pattern, data = []) => {
  const catalogItem = getChartPatternCatalogItemByType(pattern.type);
  return {
    ...pattern,
    name: catalogItem?.name || pattern.name,
    label: catalogItem?.name || pattern.name,
    time: getNormalizedPatternTime(getChartPatternTime(pattern, data))
  };
};

const getChartPatternTime = (pattern, data = []) => {
  const candidateIndex =
    pattern.handleEnd?.index ??
    pattern.rightRim?.index ??
    pattern.rightShoulder?.index ??
    pattern.secondTop?.index ??
    pattern.secondBottom?.index ??
    pattern.flagEnd ??
    pattern.poleEnd ??
    pattern.highs?.at?.(-1)?.index ??
    pattern.lows?.at?.(-1)?.index ??
    pattern.support?.at?.(-1)?.index ??
    pattern.resistance?.at?.(-1)?.index;

  if (Number.isInteger(candidateIndex) && data[candidateIndex]) return data[candidateIndex].time;
  return data.at?.(-1)?.time;
};

const buildSelectedPatternGroups = ({ response, selectedItems, klineData, previousPatterns = {} }) => {
  const selectedTheStratNames = selectedItems.filter(item => item.category === 'thestrat').map(item => item.name);
  const selectedCandleTypes = selectedItems.filter(item => item.category === 'candlestick').map(item => item.backendType);
  const selectedChartTypes = selectedItems.filter(item => item.category === 'chart').map(item => item.backendType);
  const selectedCandleRows = getScanPatternList(response, 'candlePatterns')
    .map(row => ({
      ...(row || {}),
      patterns: Array.isArray(row?.patterns)
        ? row.patterns.filter(pattern => (
          selectedCandleTypes.includes(pattern?.type)
          || selectedTheStratNames.includes(pattern?.name)
        ))
        : []
    }))
    .filter(row => row.patterns.length > 0);
  const selectedChartMatches = getScanPatternList(response, 'chartPatterns')
    .filter(pattern => selectedChartTypes.includes(pattern?.type))
    .map(pattern => normalizeChartPatternMatch(pattern, klineData));
  const mergedCandleRows = normalizeCandlePatternRows(selectedCandleRows);

  return {
    candlePatterns: {
      count: countCandlePatternRows(mergedCandleRows),
      patterns: mergedCandleRows,
      selected: selectedItems.filter(item => item.category === 'candlestick' || item.category === 'thestrat').map(item => item.name),
      hidden: previousPatterns.candlePatterns?.hidden || []
    },
    chartPatterns: {
      count: selectedChartMatches.length,
      patterns: selectedChartMatches,
      selected: selectedItems.filter(item => item.category === 'chart').map(item => item.name),
      hidden: previousPatterns.chartPatterns?.hidden || []
    }
  };
};

const SYMBOL_SEARCH_PAGE_SIZE = 2;
const symbolTypeTabs = [
  { key: 'all', label: '全部' },
  ...assetTypeOptions
];
const normalizeAssetType = type => (assetTypeOptions.some(option => option.key === type) ? type : 'stock');
const getSymbolSearchTypeLabel = type => (type === 'all' ? '全部' : getAssetTypeLabel(type));
const fetchMarketKline = (type, symbol, period, options = {}) =>
  marketAPI.getKline(normalizeAssetType(type), symbol, period, options);

function FeaturePanel({
  feature,
  currentSymbol,
  currentName,
  period,
  klineData = [],
  autoFibEnabled = false,
  autoTrendSettings = { analysisType: 'standard', drawingInput: 'wick', enabled: false, islands: 'respect', quality: 'relevant' },
  heatmapType = 'horizontal',
  onAutoFibToggle,
  onAutoTrendSettingsChange,
  onHeatmapTypeChange,
  onClose
}) {
  const [patternCategory, setPatternCategory] = useState('chart');
  const [patternQuery, setPatternQuery] = useState('');
  const [patternScanState, setPatternScanState] = useState({ loading: false, result: null, error: null });
  const [heatmapDraftType, setHeatmapDraftType] = useState(heatmapType);
  const [autoTrendDraft, setAutoTrendDraft] = useState(autoTrendSettings);
  const storedPatterns = useChartStore(state => state.patterns);
  const setPatterns = useChartStore(state => state.setPatterns);
  const [selectedPatterns, setSelectedPatterns] = useState(() => getStoredPatternSelections(storedPatterns));
  const activeContext = currentSymbol
    ? `${currentSymbol} ${currentName || ''} 路 ${period}`
    : `未加载标的 路 ${period}`;

  useEffect(() => {
    if (feature === 'Patterns') {
      setPatternCategory('all');
      setSelectedPatterns(getStoredPatternSelections(storedPatterns));
    }
    if (feature === 'Chart Patterns') {
      setPatternCategory('chart');
      setSelectedPatterns(getStoredPatternSelections(storedPatterns, 'chart'));
    }
    if (feature === 'Heatmap') {
      setHeatmapDraftType(heatmapType);
    }
    if (feature === 'Trends') {
      setAutoTrendDraft(autoTrendSettings);
    }
  }, [autoTrendSettings, feature, heatmapType, storedPatterns]);

  if (feature === 'Layout') {
    return (
      <div className="feature-modal-body layout-panel">
        <p>在当前终端内保存、拆分和恢复图表工作区。</p>
        <div className="layout-preset-grid">
          {layoutPresets.map(item => (
            <button key={item.name} type="button">
              <span>{item.name}</span>
              <small>{item.detail}</small>
            </button>
          ))}
        </div>
        <div className="feature-status-strip">
          <span>当前：单图表</span>
          <span>{activeContext}</span>
          <span>自动保存：开启</span>
          <span>云同步：就绪</span>
        </div>
      </div>
    );
  }

  if (feature === 'Auto Fib') {
    return (
      <div className="feature-modal-body fib-panel">
        <p>自动识别摆动点，并在可见图表上投射回撤区域。</p>
        <div className="fib-preview">
          {fibLevels.map((level, index) => (
            <div className="fib-level" key={level} style={{ top: `${14 + index * 12}%` }}>
              <span>{level}</span>
            </div>
          ))}
        </div>
        <div className="feature-option-grid compact">
          <button
            className={autoFibEnabled ? 'active' : ''}
            type="button"
            onClick={() => onAutoFibToggle?.()}
          >
            <span>自动绘制</span>
            <em>{autoFibEnabled ? '已开启' : '已关闭'}</em>
          </button>
          {['可见区间', '向右延伸水平位', '显示 38.2-61.8 区域'].map(item => (
            <button key={item} type="button"><span>{item}</span><em>已启用</em></button>
          ))}
        </div>
        <div className="feature-status-strip">
          <span>{activeContext}</span>
          <span>状态：{autoFibEnabled ? '自动斐波那契开启' : '自动斐波那契关闭'}</span>
          <span>摆动来源：当前可见图表</span>
        </div>
      </div>
    );
  }

  if (feature === 'Trends') {
    const analysisOptions = [
      { value: 'original', label: 'Original' },
      { value: 'standard', label: 'Standard' },
      { value: 'enhanced', label: 'Enhanced' }
    ];
    const drawingInputOptions = [
      { value: 'wick', label: 'Wick (H/L)' },
      { value: 'body', label: 'Body (O/C)' }
    ];
    const islandOptions = [
      { value: 'respect', label: 'Respect' },
      { value: 'ignore', label: 'Ignore' }
    ];
    const qualityOptions = [
      { value: 'relevant', label: 'Most Relevant' },
      { value: 'more', label: 'More Lines' },
      { value: 'all', label: 'All' }
    ];
    const updateAutoTrendDraft = patch => {
      setAutoTrendDraft(draft => ({
        ...draft,
        ...patch
      }));
    };
    const applyAutoTrendSettings = () => {
      onAutoTrendSettingsChange?.({
        ...autoTrendDraft,
        appliedAt: Date.now(),
        enabled: true
      });
      onClose?.();
    };

    return (
      <div className="feature-modal-body trendspider-settings-panel">
        <h3>AUTOMATED TREND LINES SETTINGS</h3>
        <div className="trendspider-settings-list">
          <label className="trendspider-settings-row">
            <span>Analysis Type</span>
            <select
              value={autoTrendDraft.analysisType}
              onChange={event => updateAutoTrendDraft({ analysisType: event.target.value })}
            >
              {analysisOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="trendspider-settings-row">
            <span>Drawing Input</span>
            <select
              value={autoTrendDraft.drawingInput}
              onChange={event => updateAutoTrendDraft({ drawingInput: event.target.value })}
            >
              {drawingInputOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="trendspider-settings-row">
            <span>Islands (Gaps)</span>
            <select
              value={autoTrendDraft.islands}
              onChange={event => updateAutoTrendDraft({ islands: event.target.value })}
            >
              {islandOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="trendspider-settings-row">
            <span>Quality</span>
            <select
              value={autoTrendDraft.quality}
              onChange={event => updateAutoTrendDraft({ quality: event.target.value })}
            >
              {qualityOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="trendspider-settings-actions">
          <button
            className="secondary"
            type="button"
          >
            ADVANCED
          </button>
          <button type="button" onClick={applyAutoTrendSettings}>APPLY</button>
        </div>
      </div>
    );
  }

  if (feature === 'Patterns' || feature === 'Chart Patterns') {
    const isChartPatternPanel = feature === 'Chart Patterns';
    const panelCategoryOptions = isChartPatternPanel
      ? [{ value: 'chart', label: 'Chart Patterns' }]
      : [{ value: 'all', label: 'Candle Patterns' }];
    const patternSource = isChartPatternPanel ? chartPatternCatalogItems : candlePanelCatalogItems;
    const normalizedQuery = patternQuery.trim().toLowerCase();
    const visiblePatterns = patternSource.filter(item => (
      (patternCategory === 'all' || item.category === patternCategory)
      && (!normalizedQuery || item.name.toLowerCase().includes(normalizedQuery) || item.type.toLowerCase().includes(normalizedQuery))
    ));
    const activePattern = visiblePatterns.find(item => selectedPatterns.includes(item.name));
    const selectedItems = selectedPatterns.map(getCatalogItem).filter(Boolean);
    const hasChartData = Array.isArray(klineData) && klineData.length > 1;
    const togglePatternSelection = (name) => {
      setSelectedPatterns(current =>
        current.includes(name)
          ? current.filter(item => item !== name)
          : [...current, name]
      );
    };
    const applyPattern = async () => {
      if (selectedItems.length === 0) {
        if (isChartPatternPanel) {
          setPatterns({
            ...storedPatterns,
            chartPatterns: {
              count: 0,
              patterns: [],
              selected: [],
              hidden: []
            },
            showPatterns: true
          });
        } else {
          setPatterns(clearStoredPatternSelections(storedPatterns));
        }
        setPatternScanState({ loading: false, result: { count: 0 }, error: null });
        onClose?.();
        return;
      }
      if (!hasChartData) {
        setPatternScanState({ loading: false, result: null, error: '应用形态前请先加载图表。' });
        return;
      }
      setPatternScanState({ loading: true, result: null, error: null });
      try {
        const response = await scanSelectedPatternGroups(getPatternScanData(klineData), selectedItems);
        if (!response.success) throw new Error(response.error || '形态扫描失败');
        const nextGroups = buildSelectedPatternGroups({
          response,
          selectedItems,
          klineData,
          previousPatterns: storedPatterns
        });
        if (isChartPatternPanel) {
          const nextPatterns = {
            ...storedPatterns,
            chartPatterns: nextGroups.chartPatterns,
            showPatterns: true
          };
          setPatterns(nextPatterns);
          setPatternScanState({ loading: false, result: { count: nextGroups.chartPatterns.count }, error: null });
          onClose?.();
          return;
        }
        const nextPatterns = {
          ...storedPatterns,
          candlePatterns: nextGroups.candlePatterns,
          showPatterns: true
        };
        setPatterns(nextPatterns);
        setPatternScanState({ loading: false, result: { count: nextGroups.candlePatterns.count }, error: null });
        onClose?.();
      } catch (error) {
        setPatternScanState({ loading: false, result: null, error: getApiErrorMessage(error, '形态扫描失败') });
      }
    };

    return (
      <div className="feature-modal-body pattern-selector-panel">
        <div className="pattern-selector-toolbar">
          <Input
            allowClear
            className="pattern-search-input"
            onChange={event => setPatternQuery(event.target.value)}
            placeholder={isChartPatternPanel ? '搜索 Chart Patterns' : '搜索形态'}
            prefix={<SearchOutlined />}
            value={patternQuery}
          />
        </div>
        <div className="pattern-selector-list" role="listbox" aria-label={isChartPatternPanel ? 'Chart Patterns 列表' : '形态列表'}>
          {visiblePatterns.length > 0 ? (
            visiblePatterns.map(item => (
              <button
                className={selectedPatterns.includes(item.name) ? 'active' : ''}
                key={item.name}
                onClick={() => togglePatternSelection(item.name)}
                type="button"
              >
                <strong><i />{item.name}</strong>
                <span>{item.type}</span>
                <em>{selectedPatterns.includes(item.name) ? '已选择' : (item.status === 'Ready' ? '就绪' : item.status)}</em>
              </button>
            ))
          ) : (
            <div className="pattern-selector-empty">没有匹配的形态。</div>
          )}
        </div>
        <div className="pattern-selector-message">
          {!hasChartData ? <span className="error">应用形态前请先加载图表。</span> : null}
          {patternScanState.result ? <span>当前图表找到 {patternScanState.result.count} 个匹配。</span> : null}
          {patternScanState.error ? <span className="error">{patternScanState.error}</span> : null}
        </div>
        <div className="pattern-selector-footer">
          <span>
            {activePattern ? <strong>{activePattern.name}</strong> : null}
            <em>{selectedPatterns.length} 个已选择 路 {panelCategoryOptions.find(item => item.value === patternCategory)?.label} 路 {activeContext}</em>
          </span>
          <div>
            <button className="secondary" onClick={onClose} type="button">取消</button>
            <button disabled={patternScanState.loading || !hasChartData} onClick={applyPattern} type="button">
              {patternScanState.loading ? '应用中...' : '应用'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (feature === 'Heatmap') {
    const applyHeatmapSettings = () => {
      onHeatmapTypeChange?.(heatmapDraftType);
      onClose?.();
    };

    return (
      <div className="feature-modal-body heatmap-panel">
        <div className="trendspider-settings-list">
          <label className="trendspider-settings-row">
            <span>Heatmap Type</span>
            <select
              value={heatmapDraftType}
              onChange={event => setHeatmapDraftType(event.target.value)}
            >
              {heatmapTypeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="pattern-selector-footer heatmap-settings-footer">
          <span>
            <strong>HEATMAP SETTINGS</strong>
            <em>{activeContext}</em>
          </span>
          <div>
            <button className="secondary" onClick={onClose} type="button">Cancel</button>
            <button onClick={applyHeatmapSettings} type="button">Apply</button>
          </div>
        </div>
      </div>
    );
  }

  if (feature === 'Scripts') {
    return (
      <div className="feature-modal-body scripts-panel">
        <p>为指标、提醒、扫描器和策略构建自定义条件。</p>
        <div className="script-builder">
          <div><span>如果</span><strong>收盘价上穿 MA20</strong></div>
          <div><span>并且</span><strong>成交量 &gt; 1.5 倍均量</strong></div>
          <div><span>则</span><strong>加入扫描器并布防提醒</strong></div>
        </div>
        <div className="feature-status-strip">
          <span>{activeContext}</span>
          <span>已保存公式：12</span>
          <span>语法有效</span>
        </div>
      </div>
    );
  }

  const fallbackPanels = {
    Compare: {
      lead: '将另一个 A 股、美股或港股标的叠加到当前图表上对比。',
      items: ['添加 A 股标的', '添加美股标的', '添加港股标的', '归一化表现']
    },
    'Chart Settings': {
      lead: '控制图表显示、坐标轴、交易时段和画线行为。',
      items: ['交易时段', '价格轴', '水印', '画线默认值']
    },
    'More Chart Tools': {
      lead: '打开次级图表工具，不占用主工具栏空间。',
      items: ['数据窗口', '测量涨跌幅', '回放模式', '导出图片']
    }
  };

  const currentPanel = fallbackPanels[feature];
  if (!currentPanel) return null;

  return (
    <div className="feature-modal-body">
      <p>{currentPanel.lead}</p>
      <div className="feature-option-grid">
        {currentPanel.items.map(item => (
          <button key={item} type="button">
            <span>{item}</span>
            <em>配置</em>
          </button>
        ))}
      </div>
      <div className="feature-status-strip">
        <span>{activeContext}</span>
      </div>
    </div>
  );
}

function ReplayControls({
  enabled,
  index,
  length,
  playing,
  selecting = false,
  speed,
  currentTime,
  onBack,
  onClose,
  onForward,
  onGoLive,
  onIndexChange,
  onPlayToggle,
  onReset,
  onSpeedChange
}) {
  if (!enabled || length <= 0) return null;

  const maxIndex = Math.max(0, length - 1);
  const safeIndex = clampReplayIndex(index, length);
  const progressLabel = `${safeIndex + 1} / ${length}`;
  const handleIndexInput = event => {
    onIndexChange?.(Number(event.target.value));
  };

  return (
    <div className="replay-control-bar" role="region" aria-label="K线回放控制">
      <div className="replay-status">
        <strong>Bar Replay</strong>
        <span>{selecting ? '在图表上点击选择起点' : (currentTime || '—')}</span>
      </div>
      <button onClick={onReset} title="回到起点" type="button">|&lt;</button>
      <button onClick={onBack} title="上一根K线" type="button">&lt;</button>
      <button className="replay-play-button" disabled={selecting} onClick={onPlayToggle} type="button">
        {selecting ? '选择中' : playing ? '暂停' : '播放'}
      </button>
      <button onClick={onForward} title="下一根K线" type="button">&gt;</button>
      <input
        aria-label="回放进度"
        max={maxIndex}
        min={0}
        onChange={handleIndexInput}
        onInput={handleIndexInput}
        type="range"
        value={safeIndex}
      />
      <span className="replay-progress">{progressLabel}</span>
      <select
        aria-label="回放速度"
        onChange={event => onSpeedChange?.(Number(event.target.value))}
        value={speed}
      >
        <option value={0.5}>0.5x</option>
        <option value={1}>1x</option>
        <option value={2}>2x</option>
        <option value={4}>4x</option>
      </select>
      <button className="replay-live-button" onClick={onGoLive} title="跳转到实时图表并重新选择回放起点" type="button">实时</button>
      <button className="replay-close-button" onClick={onClose} title="关闭回放" type="button">关闭</button>
    </div>
  );
}

function ChartWorkspace({
  currentSymbol,
  currentName,
  currentType,
  currentPeriod,
  adjust,
  klineData,
  activeDrawingTool,
  addDrawing,
  deleteDrawing,
  drawingsBySymbol,
  updateDrawing,
  paneDataCache,
  indicators,
  patterns,
  paneSettings,
  scaleMode,
  selectedDrawingId,
  selectDrawing,
  workspaceLayout,
  strategyMarkers,
  theme,
  autoFibonacciEnabled,
  autoTrendSettings,
  heatmapEnabled,
  heatmapType,
  replayBoundaryTime,
  replaySelecting,
  replayLiveJumpKey,
  replayResetAlignKey,
  replayResetTargetTime,
  replaySeekAlignKey,
  replayStartAlignKey,
  replayTimelineData,
  onReplayTimeSelect,
  onVisibleRightTimeChange,
  onPaneSettingChange,
  onIndicatorSettings,
  onLoadOlderData
}) {
  const [lowerLegendCollapsed, setLowerLegendCollapsed] = useState({});
  const activeLayout = getWorkspaceLayout(workspaceLayout);
  const paneCount = getWorkspacePaneCount(workspaceLayout);
  const panes = reconcileWorkspacePaneSettings({
    previous: paneSettings,
    count: paneCount,
    defaults: { symbol: currentSymbol, name: currentName, type: currentType, period: 'daily', chartStyle: 'candles', showVolume: false }
  });
  const mainKlineData = Array.isArray(klineData) ? klineData : [];

  if (currentSymbol && mainKlineData.length > 0) {
    return (
      <div className={`chart-workspace ${activeLayout.className}`}>
        {panes.map((pane, index) => (
          <WorkspaceChartPane
            adjust={adjust}
            currentName={pane.name || currentName}
            currentSymbol={pane.symbol || currentSymbol}
            currentType={pane.type || currentType}
            data={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod
              ? mainKlineData
              : (getPaneKlineData(paneDataCache, {
                paneId: pane.id,
                symbol: pane.symbol || currentSymbol,
                period: pane.period,
                adjust: (pane.type || currentType) === 'stock' ? adjust : ''
              }) || [])}
            replayBoundaryTime={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod
              ? replayBoundaryTime
              : null}
            replaySelecting={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod
              ? replaySelecting
              : false}
            replayLiveJumpKey={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod
              ? replayLiveJumpKey
              : 0}
            replayResetAlignKey={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod
              ? replayResetAlignKey
              : 0}
            replayResetTargetTime={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod
              ? replayResetTargetTime
              : null}
            replaySeekAlignKey={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod
              ? replaySeekAlignKey
              : 0}
            replayStartAlignKey={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod
              ? replayStartAlignKey
              : 0}
            replayTimelineData={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod
              ? replayTimelineData
              : []}
            indicators={indicators}
            patterns={patterns}
            strategyMarkers={index === 0 ? strategyMarkers : []}
            activeDrawingTool={activeDrawingTool}
            addDrawing={addDrawing}
            autoFibonacciEnabled={autoFibonacciEnabled}
            autoTrendSettings={autoTrendSettings}
            heatmapEnabled={heatmapEnabled}
            heatmapType={heatmapType}
            deleteDrawing={deleteDrawing}
            drawingsBySymbol={drawingsBySymbol}
            updateDrawing={updateDrawing}
            index={index}
            key={`${activeLayout.value}-${pane.id}`}
            pane={pane}
            scaleMode={scaleMode}
            theme={theme}
            selectedDrawingId={selectedDrawingId}
            selectDrawing={selectDrawing}
            lowerLegendCollapsed={lowerLegendCollapsed}
            onLowerLegendCollapsedChange={setLowerLegendCollapsed}
            onChange={(patch) => onPaneSettingChange?.(pane.id, patch)}
            onIndicatorSettings={onIndicatorSettings}
            onReplayTimeSelect={onReplayTimeSelect}
            onVisibleRightTimeChange={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod && index === 0
              ? onVisibleRightTimeChange
              : undefined}
            onLoadOlderData={(pane.symbol || currentSymbol) === currentSymbol && pane.period === currentPeriod
              ? onLoadOlderData
              : undefined}
            onSymbolChange={(item) => onPaneSettingChange?.(pane.id, {
              symbol: item.symbol,
              name: item.name,
              type: item.type
            })}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="empty-container">
      <div className="empty-chart-panel">
        <span>未加载标的</span>
        <strong>请选择 A 股、美股或港股标的</strong>
        <p>可通过顶部搜索、右侧自选列表或下方扫描结果加载图表。</p>
      </div>
    </div>
  );
}

function WorkspaceChartPane({
  currentSymbol,
  currentName,
  currentType,
  data,
  indicators,
  patterns,
  index,
  pane,
  scaleMode,
  theme,
  strategyMarkers = [],
  activeDrawingTool,
  addDrawing,
  autoFibonacciEnabled,
  autoTrendSettings,
  heatmapEnabled,
  heatmapType,
  replayBoundaryTime,
  replaySelecting,
  replayLiveJumpKey,
  replayResetAlignKey,
  replayResetTargetTime,
  replaySeekAlignKey,
  replayStartAlignKey,
  replayTimelineData,
  deleteDrawing,
  drawingsBySymbol,
  selectedDrawingId,
  selectDrawing,
  updateDrawing,
  lowerLegendCollapsed,
  onLowerLegendCollapsedChange,
  onChange,
  onIndicatorSettings,
  onReplayTimeSelect,
  onVisibleRightTimeChange,
  onLoadOlderData,
  onSymbolChange
}) {
  const [hoverBar, setHoverBar] = useState(null);
  const chartData = Array.isArray(data) ? data : [];
  useEffect(() => {
    setHoverBar(null);
  }, [data]);
  const quote = getQuoteSnapshotForBar(chartData, hoverBar);

  return (
    <div className="workspace-chart-pane">
            <div className="workspace-pane-header">
              <div className="workspace-pane-symbol">
                <SearchPanel onSelect={onSymbolChange} triggerClassName="pane-symbol-button">
                  <strong>{currentSymbol}</strong>
                  <span>{currentName}</span>
                </SearchPanel>
                <em>开 {quote.open}</em>
                <em>高 {quote.high}</em>
                <em>低 {quote.low}</em>
                <em className="workspace-quote-close">
                  收 {quote.close}
                  <span className={`workspace-quote-change ${quote.tone}`}>
                    {quote.change} / {quote.pctChange}
                  </span>
                </em>
              </div>
              <PaneControls
                pane={pane}
                onChange={onChange}
              />
            </div>
            {chartData.length > 0 ? (
              <KlineChart
                data={chartData}
                currentSymbol={currentSymbol}
                currentType={currentType}
                period={pane.period}
                indicators={indicators}
                patterns={patterns}
                strategyMarkers={strategyMarkers}
                chartStyle={pane.chartStyle}
                showVolume={pane.showVolume}
                scaleMode={scaleMode}
                theme={theme}
                activeDrawingTool={activeDrawingTool}
                addDrawing={addDrawing}
                autoFibonacciEnabled={autoFibonacciEnabled}
                autoTrendSettings={autoTrendSettings}
	                heatmapEnabled={heatmapEnabled}
	                heatmapType={heatmapType}
	                replayBoundaryTime={replayBoundaryTime}
	                replaySelecting={replaySelecting}
	                replayLiveJumpKey={replayLiveJumpKey}
	                replayResetAlignKey={replayResetAlignKey}
	                replayResetTargetTime={replayResetTargetTime}
	                replaySeekAlignKey={replaySeekAlignKey}
	                replayStartAlignKey={replayStartAlignKey}
	                replayTimelineData={replayTimelineData}
	                deleteDrawing={deleteDrawing}
                drawingsBySymbol={drawingsBySymbol}
                selectedDrawingId={selectedDrawingId}
                selectDrawing={selectDrawing}
                updateDrawing={updateDrawing}
                lowerLegendCollapsed={lowerLegendCollapsed}
                onLowerLegendCollapsedChange={onLowerLegendCollapsedChange}
	                onHoverBar={setHoverBar}
	                onIndicatorSettings={onIndicatorSettings}
	                onReplayTimeSelect={onReplayTimeSelect}
	                onVisibleRightTimeChange={onVisibleRightTimeChange}
	                onLoadOlderData={onLoadOlderData}
              />
            ) : (
              <div className="pane-loading-state">正在加载标的数据...</div>
            )}
          </div>
  );
}

function PaneSymbolSearch({ currentSymbol, currentName, currentType, onSelect }) {
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [symbols, setSymbols] = useState([]);
  const [total, setTotal] = useState(0);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const [dailyChangeBySymbol, setDailyChangeBySymbol] = useState({});

  useEffect(() => {
    if (!open) setActiveType('all');
  }, [currentType, open]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoadingSymbols(true);

    loadPagedMarketSymbols({
      type: activeType,
      keyword: query.trim(),
      page,
      pageSize: SYMBOL_SEARCH_PAGE_SIZE
    })
      .then(result => {
        if (!cancelled) {
          setSymbols(result.items);
          setTotal(result.total);
          if (result.page !== page) setPage(result.page);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSymbols(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeType, open, page, query]);

  const pageModel = React.useMemo(() => ({
    items: symbols,
    page,
    total
  }), [page, symbols, total]);

  useEffect(() => {
    if (!open || !pageModel.items.length) return undefined;

    let cancelled = false;
    const missingItems = pageModel.items.filter(item => !dailyChangeBySymbol[getSymbolChangeKey(item)]);
    if (!missingItems.length) return undefined;

    setDailyChangeBySymbol(current => {
      const next = { ...current };
      missingItems.forEach(item => {
        next[getSymbolChangeKey(item)] = { ...getFallbackDailyChange(item), loading: true };
      });
      return next;
    });

    Promise.all(missingItems.map(async item => {
      const key = getSymbolChangeKey(item);
      try {
        const response = await fetchMarketKline(item.type, item.symbol, 'daily', { limit: 1 });
        return [key, getLatestDailyChange(response?.data) || getFallbackDailyChange(item)];
      } catch {
        return [key, getFallbackDailyChange(item)];
      }
    })).then(entries => {
      if (cancelled) return;
      setDailyChangeBySymbol(current => ({
        ...current,
        ...Object.fromEntries(entries)
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [open, pageModel.items]);

  const handleTypeChange = (type) => {
    setActiveType(type);
    setQuery('');
    setPage(1);
  };

  const handleSelect = (item) => {
    onSelect?.(item);
    setOpen(false);
  };

  const getDailyChangeDisplay = item => {
    const change = dailyChangeBySymbol[getSymbolChangeKey(item)] || getFallbackDailyChange(item);
    return {
      ...change,
      amountText: change.loading ? '—' : formatSignedNumber(change.amount),
      percentText: change.loading ? '—' : formatSignedPercent(change.percent)
    };
  };

  return (
    <>
      <button
        className="pane-symbol-button"
        onClick={() => {
          setQuery('');
          setPage(1);
          setActiveType('all');
          setOpen(true);
        }}
        type="button"
      >
        <strong>{currentSymbol}</strong>
        <span>{currentName}</span>
      </button>
      <Modal
        className="symbol-search-modal"
        centered
        footer={null}
        open={open}
        title="选择标的"
        width={680}
        onCancel={() => setOpen(false)}
      >
        <div className="symbol-search-shell">
          <Input
            autoFocus
            allowClear
            className="symbol-search-input"
            placeholder="按代码或名称搜索标的"
            prefix={<SearchOutlined />}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />

          <div aria-label="标的类型" className="symbol-search-filter-row" role="tablist">
            {symbolTypeTabs.map(option => (
              <button
                aria-selected={activeType === option.key}
                className={activeType === option.key ? 'active' : ''}
                key={option.key}
                onClick={() => handleTypeChange(option.key)}
                role="tab"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="symbol-search-list" role="listbox">
            {pageModel.items.length > 0 ? (
              pageModel.items.map(item => (
                <button
                  className={item.symbol === currentSymbol ? 'symbol-result-row active' : 'symbol-result-row'}
                  key={item.symbol}
                  onClick={() => handleSelect(item)}
                  type="button"
                >
                  <span className="symbol-result-main">
                    <strong>{item.symbol}</strong>
                    <span>{item.name}</span>
                  </span>
                  <span className="symbol-result-setup">{item.setup}</span>
                  <span className={getDailyChangeDisplay(item).tone === 'down' ? 'symbol-result-change down' : 'symbol-result-change'}>
                    <strong>{getDailyChangeDisplay(item).amountText}</strong>
                    <small>{getDailyChangeDisplay(item).percentText}</small>
                  </span>
                </button>
              ))
            ) : (
              <Empty description="没有匹配的标的" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>

          <div className="symbol-search-footer">
            <span>{getSymbolSearchTypeLabel(activeType)}列表 · {pageModel.total} 条结果</span>
            <Pagination
              current={pageModel.page}
              pageSize={SYMBOL_SEARCH_PAGE_SIZE}
              showSizeChanger={false}
              size="small"
              total={pageModel.total}
              onChange={setPage}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

function PaneControls({ pane, onChange }) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const activeTimeframe = getTimeframeOption(pane.period);
  const activeChartStyle = getChartStyleOption(pane.chartStyle);
  const chartStyleIcon = {
    candles: <StockOutlined />,
    heikinAshi: <StockOutlined />,
    bars: <BarChartOutlined />,
    line: <LineChartOutlined />,
    area: <AreaChartOutlined />
  }[activeChartStyle.value];

  const timeframeItems = timeframeOptions.map(item => ({
    key: item.value,
    label: item.label,
    className: pane.period === item.value ? 'active-chart-menu-item' : ''
  }));
  const chartStyleItems = chartStyleOptions.map(item => ({
    key: item.value,
    label: item.label,
    icon: {
      candles: <StockOutlined />,
      heikinAshi: <StockOutlined />,
      bars: <BarChartOutlined />,
      line: <LineChartOutlined />,
      area: <AreaChartOutlined />
    }[item.value],
    className: pane.chartStyle === item.value ? 'active-chart-menu-item' : ''
  }));

  return (
    <div className="workspace-pane-controls">
      <Dropdown
        destroyOnHidden
        menu={{
          items: timeframeItems,
          onClick: ({ key }) => {
            onChange({ period: key });
            setOpenDropdown(null);
          }
        }}
        open={openDropdown === 'period'}
        overlayClassName="chart-control-dropdown period-dropdown pane-control-dropdown"
        placement="bottomRight"
        trigger={['click']}
        onOpenChange={(open) => setOpenDropdown(open ? 'period' : null)}
      >
        <button className="pane-folded-control period-control" type="button">
          <span>{activeTimeframe.label}</span>
          <CaretDownOutlined />
        </button>
      </Dropdown>

      <Dropdown
        destroyOnHidden
        menu={{
          items: chartStyleItems,
          onClick: ({ key }) => {
            onChange({ chartStyle: key });
            setOpenDropdown(null);
          }
        }}
        open={openDropdown === 'style'}
        overlayClassName="chart-control-dropdown style-dropdown pane-control-dropdown"
        placement="bottomRight"
        trigger={['click']}
        onOpenChange={(open) => setOpenDropdown(open ? 'style' : null)}
      >
        <button className="pane-folded-control style-control" type="button">
          {chartStyleIcon}
          <span>{activeChartStyle.label}</span>
          <CaretDownOutlined />
        </button>
      </Dropdown>

      <button
        className={pane.showVolume ? 'pane-icon-control active' : 'pane-icon-control'}
        title="成交量"
        type="button"
        onClick={() => onChange({ showVolume: !pane.showVolume })}
      >
        <BarChartOutlined />
      </button>
    </div>
  );
}

function AppShell({ onLogout }) {
  const [currentUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(window.sessionStorage.getItem('signalforge.user.v1') || 'null');
    } catch {
      return null;
    }
  });
  const [activeDockTab, setActiveDockTab] = useState('Market Scanner');
  const [themePreference, setThemePreference] = useState(() => {
    if (typeof window === 'undefined') return 'night';
    return window.localStorage.getItem(THEME_STORAGE_KEY) || 'night';
  });
  const [autoFibEnabled, setAutoFibEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(AUTO_FIB_STORAGE_KEY) === 'true';
  });
  const [autoTrendSettings, setAutoTrendSettings] = useState(() => {
    if (typeof window === 'undefined') {
      return { algorithmVersion: 3, analysisType: 'standard', appliedAt: 0, drawingInput: 'wick', enabled: false, islands: 'respect', quality: 'relevant' };
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(AUTO_TRENDS_STORAGE_KEY) || '{}');
      const isCurrentAlgorithm = parsed.algorithmVersion === 3;
      return {
        algorithmVersion: 3,
        analysisType: ['original', 'standard', 'enhanced'].includes(parsed.analysisType) ? parsed.analysisType : 'standard',
        appliedAt: isCurrentAlgorithm && Number.isFinite(parsed.appliedAt) ? parsed.appliedAt : Date.now(),
        drawingInput: ['wick', 'body'].includes(parsed.drawingInput) ? parsed.drawingInput : 'wick',
        enabled: parsed.enabled === true,
        islands: ['respect', 'ignore'].includes(parsed.islands) ? parsed.islands : 'respect',
        quality: isCurrentAlgorithm && ['relevant', 'more', 'all'].includes(parsed.quality) ? parsed.quality : 'relevant'
      };
    } catch {
      return { algorithmVersion: 3, analysisType: 'standard', appliedAt: 0, drawingInput: 'wick', enabled: false, islands: 'respect', quality: 'relevant' };
    }
  });
  const [heatmapSettings, setHeatmapSettings] = useState(() => {
    if (typeof window === 'undefined') return { enabled: false, type: 'horizontal' };
    try {
      const parsed = JSON.parse(window.localStorage.getItem(HEATMAP_STORAGE_KEY) || '{}');
      const storedType = parsed.type === 'trends' ? 'classic' : parsed.type;
      const type = heatmapTypeOptions.some(option => option.value === storedType) ? storedType : 'horizontal';
      return {
        enabled: parsed.enabled === true && type !== 'none',
        type
      };
    } catch {
      return { enabled: false, type: 'horizontal' };
    }
  });
  const [replayState, setReplayState] = useState({
    enabled: false,
    index: 0,
    playing: false,
    selecting: false,
    speed: 1,
    startIndex: 0
  });
  const [replayLiveJumpKey, setReplayLiveJumpKey] = useState(0);
  const [replayResetAlignKey, setReplayResetAlignKey] = useState(0);
  const [replaySeekAlignKey, setReplaySeekAlignKey] = useState(0);
  const [replayStartAlignKey, setReplayStartAlignKey] = useState(0);
  const [themeClock, setThemeClock] = useState(() => Date.now());
  const [activeFeaturePanel, setActiveFeaturePanel] = useState(null);
  const [activeFeature, setActiveFeature] = useState('Market Scanner');
  const [activeIndicatorKey, setActiveIndicatorKey] = useState(null);
  const [workspaceLayout, setWorkspaceLayout] = useState('single');
  const [strategyTesterRunState, setStrategyTesterRunState] = useState('idle');
  const [strategyTesterRunResult, setStrategyTesterRunResult] = useState(null);
  const [paneDataCache, setPaneDataCache] = useState({});
  const paneDataCacheRef = useRef({});
  const paneDataRequestKeysRef = useRef(new Set());
  const klineRequestSeqRef = useRef(0);
  const patternRescanSeqRef = useRef(0);
  const patternsRef = useRef(null);
  const patternKlineRowsRef = useRef([]);
  const olderKlineLoadingRef = useRef(false);
  const olderKlineExhaustedRef = useRef(false);
  const visibleRightReplayTimeRef = useRef(null);
  const [paneSettings, setPaneSettings] = useState(() => reconcileWorkspacePaneSettings({
    previous: [],
    count: 1,
    defaults: { period: 'daily', chartStyle: 'candles', showVolume: false }
  }));
  const {
    currentSymbol,
    currentName,
    currentType,
    period,
    adjust,
    klineData,
    indicators,
    patterns,
    showIndicators,
    chartStyle,
    showVolume,
    scaleMode,
    loading,
    activeDrawingTool,
    selectedDrawingId,
    drawingsBySymbol,
    setActiveDrawingTool,
    selectDrawing,
    addDrawing,
    deleteDrawing,
    updateDrawing,
    clearDrawingsForSymbol,
    setKlineData,
    setLoading,
    setError,
    setPeriod,
    setPatterns,
    toggleIndicatorsVisible
  } = useChartStore();
  const indicatorsActive = hasActiveIndicators(indicators);
  const candlePatternsActive = isPatternGroupVisible(patterns.candlePatterns, patterns.showPatterns);
  const chartPatternsActive = isPatternGroupVisible(patterns.chartPatterns, patterns.showPatterns);
  const visibleIndicators = showIndicators ? indicators : {};
  const resolvedTheme = useMemo(() => resolveThemePreference(themePreference, themeClock), [themeClock, themePreference]);
  const candlePatternSelectionKey = getSelectedPatternNames(patterns.candlePatterns).join('|');
  const chartPatternSelectionKey = getSelectedPatternNames(patterns.chartPatterns).join('|');
  const klineDataSignature = `${Array.isArray(klineData) ? klineData.length : 0}:${klineData?.[0]?.time || ''}:${klineData?.at?.(-1)?.time || ''}`;
  const replaySourceRows = Array.isArray(klineData) ? klineData : [];
  const replayLength = replaySourceRows.length;
  const replayIndex = clampReplayIndex(replayState.index, replayLength);
  const replayStartIndex = clampReplayIndex(replayState.startIndex, replayLength);
  const replayActive = replayState.enabled && !replayState.selecting && replayLength > 0;
  const replayKlineData = replaySourceRows;
  const replayCurrentTime = replaySourceRows[replayIndex]?.time || '';
  const replayResetTargetTime = replaySourceRows[replayStartIndex]?.time || null;

  useEffect(() => {
    patternsRef.current = patterns;
  }, [patterns]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    if (themePreference !== 'auto') return undefined;

    const timer = window.setInterval(() => setThemeClock(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUTO_FIB_STORAGE_KEY, autoFibEnabled ? 'true' : 'false');
  }, [autoFibEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUTO_TRENDS_STORAGE_KEY, JSON.stringify(autoTrendSettings));
  }, [autoTrendSettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(HEATMAP_STORAGE_KEY, JSON.stringify(heatmapSettings));
  }, [heatmapSettings]);

  useEffect(() => {
    visibleRightReplayTimeRef.current = null;
    setReplayState(state => (
      state.enabled
        ? { ...state, enabled: false, playing: false, selecting: false, index: 0 }
        : state
    ));
  }, [currentSymbol, currentType, period]);

  useEffect(() => {
    setReplayState(state => {
      if (!state.enabled) return state;
      if (replayLength <= 0) return { ...state, enabled: false, playing: false, selecting: false, index: 0 };

      const nextIndex = clampReplayIndex(state.index, replayLength);
      const nextPlaying = state.playing && !state.selecting && nextIndex < replayLength - 1;
      if (nextIndex === state.index && nextPlaying === state.playing) return state;
      return { ...state, index: nextIndex, playing: nextPlaying };
    });
  }, [replayLength]);

  useEffect(() => {
    if (!replayState.enabled || replayState.selecting || !replayState.playing || replayLength <= 0) return undefined;
    const intervalMs = Math.max(120, Math.round(900 / (Number(replayState.speed) || 1)));
    const timer = window.setInterval(() => {
      setReplayState(state => {
        if (!state.enabled || state.selecting || !state.playing) return state;
        const nextIndex = clampReplayIndex(state.index + 1, replayLength);
        return {
          ...state,
          index: nextIndex,
          playing: nextIndex < replayLength - 1
        };
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [replayLength, replayState.enabled, replayState.playing, replayState.selecting, replayState.speed]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.classList.toggle('theme-day', resolvedTheme === 'day');
    document.body.classList.toggle('theme-night', resolvedTheme === 'night');
    return () => {
      document.body.classList.remove('theme-day', 'theme-night');
    };
  }, [resolvedTheme]);

  useEffect(() => {
    setPaneSettings(previous => reconcileWorkspacePaneSettings({
      previous,
      count: getWorkspacePaneCount(workspaceLayout),
      defaults: { symbol: currentSymbol, name: currentName, type: currentType, period, chartStyle, showVolume }
    }));
  }, [chartStyle, currentName, currentSymbol, currentType, period, showVolume, workspaceLayout]);

  useEffect(() => {
    if (!currentSymbol) return;

    setPaneSettings(previous => syncAllPaneSymbols(previous, {
      symbol: currentSymbol,
      name: currentName,
      type: currentType
    }));
  }, [currentName, currentSymbol, currentType]);

  useEffect(() => {
    if (!currentSymbol) return undefined;

    let cancelled = false;
    const activePaneSettings = reconcileWorkspacePaneSettings({
      previous: paneSettings,
      count: getWorkspacePaneCount(workspaceLayout),
      defaults: { symbol: currentSymbol, name: currentName, type: currentType, period, chartStyle, showVolume }
    });

    activePaneSettings.forEach((pane) => {
      const paneSymbol = pane.symbol || currentSymbol;
      const paneType = pane.type || currentType;
      const paneAdjust = paneType === 'stock' ? adjust : '';
      const usesMainKlineData = paneSymbol === currentSymbol
        && paneType === currentType
        && pane.period === period
        && paneAdjust === (currentType === 'stock' ? adjust : '');
      const keyParams = {
        paneId: pane.id,
        symbol: paneSymbol,
        period: pane.period,
        adjust: paneAdjust
      };
      const paneDataKey = getPaneDataKey(keyParams);

      if (usesMainKlineData) return;
      if (!paneSymbol || getPaneKlineData(paneDataCacheRef.current, keyParams)) return;
      if (paneDataRequestKeysRef.current.has(paneDataKey)) return;

      paneDataRequestKeysRef.current.add(paneDataKey);
      fetchMarketKline(
        paneType,
        paneSymbol,
        pane.period,
        { limit: getInitialKlineLimit(pane.period) }
      ).then(response => {
        if (cancelled || !response.success) return;
        setPaneDataCache(previous => {
          const nextCache = setPaneKlineData(previous, {
            ...keyParams,
            data: normalizeKlineRows(response.data)
          });
          paneDataCacheRef.current = nextCache;
          return nextCache;
        });
      }).catch(error => {
        console.error('Pane K-line data request failed:', error);
      }).finally(() => {
        paneDataRequestKeysRef.current.delete(paneDataKey);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    adjust,
    chartStyle,
    currentName,
    currentSymbol,
    currentType,
    paneSettings,
    period,
    showVolume,
    workspaceLayout
  ]);

  useEffect(() => {
    paneDataCacheRef.current = paneDataCache;
  }, [paneDataCache]);

  useEffect(() => {
    if (!currentSymbol) return;

    const requestSeq = klineRequestSeqRef.current + 1;
    klineRequestSeqRef.current = requestSeq;
    olderKlineExhaustedRef.current = false;
    olderKlineLoadingRef.current = false;

    const loadKlineData = async () => {
      setLoading(true);
      setKlineData([]);
      try {
        const response = await fetchMarketKline(
          currentType,
          currentSymbol,
          period,
          { limit: getInitialKlineLimit(period) }
        );

        if (klineRequestSeqRef.current !== requestSeq) return;

        if (response.success) {
          setKlineData(normalizeKlineRows(response.data));
        } else {
          message.error('行情数据加载失败，请稍后重试');
        }
      } catch (error) {
        if (klineRequestSeqRef.current !== requestSeq) return;
        console.error('K-line data request failed:', error);
        message.error('行情数据请求失败，请检查服务连接。');
        setError(error.message);
      } finally {
        if (klineRequestSeqRef.current === requestSeq) {
          setLoading(false);
        }
      }
    };

    loadKlineData();
  }, [currentSymbol, period, adjust, currentType, setError, setKlineData, setLoading]);

  useEffect(() => {
    const currentRows = getPatternScanData(klineData);
    if (currentRows.length <= 1) {
      patternKlineRowsRef.current = currentRows;
      return undefined;
    }

    const currentPatterns = patternsRef.current || {};
    const selectedNames = [
      ...getSelectedPatternNames(currentPatterns.candlePatterns),
      ...getSelectedPatternNames(currentPatterns.chartPatterns)
    ];
    const selectedItems = getCatalogItemsFromNames([...new Set(selectedNames)]);
    if (!selectedItems.length) {
      patternKlineRowsRef.current = currentRows;
      return undefined;
    }

    const previousRows = patternKlineRowsRef.current || [];
    const frontAppendedRows = getFrontAppendedPatternRows(previousRows, currentRows);
    const shouldScanCandle = hasCandlePatternSelection(selectedItems);
    const shouldScanChart = hasChartPatternSelection(selectedItems);

    let cancelled = false;
    const requestSeq = patternRescanSeqRef.current + 1;
    patternRescanSeqRef.current = requestSeq;

    scanSelectedPatternGroups(currentRows, selectedItems, {
      candleRows: shouldScanCandle && frontAppendedRows ? frontAppendedRows : currentRows
    })
      .then(response => {
        if (cancelled || patternRescanSeqRef.current !== requestSeq) return;
        if (!response.success) throw new Error(response.error || '形态扫描失败');

        const latestPatterns = patternsRef.current || {};
        const nextGroups = buildSelectedPatternGroups({
          response,
          selectedItems,
          klineData: currentRows,
          previousPatterns: latestPatterns
        });

        const nextPatterns = {
          ...latestPatterns,
          showPatterns: latestPatterns.showPatterns !== false
        };
        if (shouldScanCandle) {
          nextPatterns.candlePatterns = frontAppendedRows
            ? mergeCandlePatternGroups(latestPatterns.candlePatterns, nextGroups.candlePatterns)
            : nextGroups.candlePatterns;
        }
        if (shouldScanChart) {
          nextPatterns.chartPatterns = nextGroups.chartPatterns;
        }

        patternKlineRowsRef.current = currentRows;
        setPatterns(nextPatterns);
      })
      .catch(error => {
        if (!cancelled) {
          console.error('Pattern rescan failed:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    candlePatternSelectionKey,
    chartPatternSelectionKey,
    klineDataSignature,
    setPatterns
  ]);

  const handleLoadOlderKlineData = async () => {
    if (!currentSymbol || !klineData.length) return;
    if (olderKlineLoadingRef.current || olderKlineExhaustedRef.current) return;

    olderKlineLoadingRef.current = true;
    const requestSeq = klineRequestSeqRef.current;
    const before = klineData[0]?.time;

    try {
      const response = await fetchMarketKline(currentType, currentSymbol, period, {
        limit: getKlineBatchLimit(period),
        before
      });
      if (klineRequestSeqRef.current !== requestSeq || !response.success) return;

      const olderRows = Array.isArray(response.data) ? response.data : [];
      if (olderRows.length === 0) {
        olderKlineExhaustedRef.current = true;
        return;
      }

      let prependedCount = 0;
      setKlineData(previous => {
        const previousRows = Array.isArray(previous) ? previous : [];
        const existingTimes = new Set();
        previousRows.forEach(row => {
          try {
            existingTimes.add(getChartTime(row));
          } catch {
            // Ignore rows the charting library cannot render.
          }
        });
        const uniqueOlderRows = olderRows.filter(row => {
          try {
            return !existingTimes.has(getChartTime(row));
          } catch {
            return false;
          }
        });
        if (!uniqueOlderRows.length) {
          olderKlineExhaustedRef.current = true;
          return previousRows;
        }
        prependedCount = uniqueOlderRows.length;
        return normalizeKlineRows([...uniqueOlderRows, ...previousRows]);
      });
      if (prependedCount > 0) {
        setReplayState(state => (
          state.enabled
            ? {
              ...state,
              index: clampReplayIndex(state.index + prependedCount, replayLength + prependedCount),
              startIndex: clampReplayIndex(state.startIndex + prependedCount, replayLength + prependedCount)
            }
            : state
        ));
      }
    } catch (error) {
      console.error('Older K-line data request failed:', error);
    } finally {
      olderKlineLoadingRef.current = false;
    }
  };

  const handleFeatureSelect = (feature) => {
    setActiveFeature(feature);

    if (feature === 'Crosshair') {
      setActiveFeaturePanel(null);
      return;
    }

    if (feature === 'Auto Fib') {
      setAutoFibEnabled(enabled => !enabled);
      setActiveFeaturePanel(null);
      return;
    }

    if (feature === 'Heatmap') {
      setHeatmapSettings(settings => ({
        ...settings,
        enabled: settings.type === 'none' ? false : !settings.enabled
      }));
      setActiveFeaturePanel(null);
      return;
    }

    if (feature === 'Trends') {
      setAutoTrendSettings(settings => ({
        ...settings,
        appliedAt: settings.enabled ? settings.appliedAt : Date.now(),
        enabled: !settings.enabled
      }));
      setActiveFeaturePanel(null);
      return;
    }

    if (feature === 'Indicators') {
      if (indicatorsActive) toggleIndicatorsVisible();
      setActiveFeaturePanel(null);
      return;
    }

    if (dockFeatures[feature]) {
      setActiveDockTab(dockFeatures[feature]);
      return;
    }

    setActiveFeaturePanel(feature);
  };

  const togglePatternGroupVisible = groupKey => {
    const group = patterns[groupKey];
    const selected = getSelectedPatternNames(group);
    if (!selected.length) return;

    const visible = isPatternGroupVisible(group, patterns.showPatterns);
    setPatterns({
      ...patterns,
      [groupKey]: {
        ...group,
        hidden: visible ? selected : []
      },
      showPatterns: true
    });
  };

  const handleCandlePatternToggle = () => {
    togglePatternGroupVisible('candlePatterns');
  };

  const handleChartPatternToggle = () => {
    togglePatternGroupVisible('chartPatterns');
  };

  const handlePatternMenuOpen = () => {
    setActiveFeature('Patterns');
    setActiveFeaturePanel('Patterns');
  };

  const handleChartPatternMenuOpen = () => {
    setActiveFeature('Chart Patterns');
    setActiveFeaturePanel('Chart Patterns');
  };

  const handleHeatmapMenuOpen = () => {
    setActiveFeature('Heatmap');
    setActiveFeaturePanel('Heatmap');
  };

  const handleHeatmapTypeChange = (type) => {
    setHeatmapSettings({
      type,
      enabled: type !== 'none'
    });
  };

  const handleIndicatorMenuOpen = () => {
    setActiveFeature('Indicators');
    setActiveIndicatorKey(null);
    setActiveFeaturePanel('Indicators');
  };

  const handleIndicatorSettingsOpen = (indicatorKey) => {
    setActiveFeature('Indicators');
    setActiveIndicatorKey(indicatorKey);
    setActiveFeaturePanel('Indicators');
  };

  const handleDockTabChange = (tab) => {
    setActiveDockTab(tab);
    setActiveFeature(dockTabToFeature[tab] || tab);
  };

  const closeFeaturePanel = () => setActiveFeaturePanel(null);
  const modalMeta = featurePanelMeta[activeFeaturePanel] || {};
  const handleVisibleRightTimeChange = (time) => {
    visibleRightReplayTimeRef.current = time;
  };
  const handlePaneSettingChange = (paneId, patch) => {
    if (paneId === 'pane-1' && patch.period && getWorkspacePaneCount(workspaceLayout) === 1) {
      setPeriod(patch.period);
    }

    setPaneSettings(previous => previous.map(pane =>
      pane.id === paneId ? { ...pane, ...patch } : pane
    ));
  };

  const handleReplayToggle = () => {
    if (replayState.enabled) {
      setReplayState(state => ({ ...state, enabled: false, playing: false, selecting: false, index: 0 }));
      return;
    }

    if (!currentSymbol || replayLength < 2) {
      message.warning('当前图表数据不足，无法回放。');
      return;
    }

    setActiveFeature('Replay');
    setActiveDrawingTool('select');
    const visibleRightTime = visibleRightReplayTimeRef.current;
    const visibleRightIndex = replaySourceRows.findIndex(row => {
      try {
        return getChartTime(row) === visibleRightTime;
      } catch {
        return false;
      }
    });
    const initialReplayIndex = visibleRightIndex >= 0
      ? visibleRightIndex
      : getDefaultReplayIndex(replayLength);
    setReplayState(state => ({
      ...state,
      enabled: true,
      playing: false,
      selecting: true,
      index: clampReplayIndex(initialReplayIndex, replayLength),
      startIndex: clampReplayIndex(initialReplayIndex, replayLength)
    }));
  };

  const stepReplay = (delta) => {
    setReplayState(state => {
      if (!state.enabled) return state;
      const nextIndex = clampReplayIndex(state.index + delta, replayLength);
      return {
        ...state,
        index: nextIndex,
        playing: false,
        selecting: false
      };
    });
  };

  const setReplayIndex = (index) => {
    setReplaySeekAlignKey(key => key + 1);
    setReplayState(state => (
      state.enabled
        ? { ...state, index: clampReplayIndex(index, replayLength), playing: false, selecting: false }
        : state
    ));
  };

  const resetReplay = () => {
    setReplayResetAlignKey(key => key + 1);
    setReplayState(state => (
      state.enabled
        ? {
          ...state,
          index: clampReplayIndex(state.startIndex, replayLength),
          playing: false,
          selecting: false
        }
        : state
    ));
  };

  const jumpReplayToLiveSelection = () => {
    if (replayLength <= 0) return;
    setReplayLiveJumpKey(key => key + 1);
    setReplayState(state => (
      state.enabled
        ? {
          ...state,
          index: clampReplayIndex(replayLength - 1, replayLength),
          playing: false,
          selecting: true,
          startIndex: clampReplayIndex(replayLength - 1, replayLength)
        }
        : state
    ));
  };

  const closeReplay = () => {
    setReplayState(state => ({
      ...state,
      enabled: false,
      playing: false,
      selecting: false,
      index: 0,
      startIndex: 0
    }));
  };

  const handleReplayTimeSelect = (time) => {
    if (!replayState.enabled) return;
    const selectedIndex = replaySourceRows.findIndex(row => {
      try {
        return getChartTime(row) === time;
      } catch {
        return false;
      }
    });

    if (selectedIndex < 0) return;
    setReplayStartAlignKey(key => key + 1);
    setReplayState(state => ({
      ...state,
      enabled: true,
      playing: false,
      selecting: false,
      index: clampReplayIndex(selectedIndex, replayLength),
      startIndex: clampReplayIndex(selectedIndex, replayLength)
    }));
  };

  return (
    <div className={`terminal-app theme-${resolvedTheme}`}>
      <TerminalTopBar
        currentSymbol={currentSymbol}
        currentName={currentName}
        currentType={currentType}
        period={period}
        workspaceLayout={workspaceLayout}
        activeFeature={activeFeature}
        autoFibActive={autoFibEnabled}
        heatmapActive={heatmapSettings.enabled && heatmapSettings.type !== 'none'}
        replayActive={replayState.enabled}
        trendsActive={autoTrendSettings.enabled}
        indicatorsActive={indicatorsActive && showIndicators}
        patternsActive={candlePatternsActive}
        chartPatternsActive={chartPatternsActive}
        onLayoutChange={setWorkspaceLayout}
        onAutoFibToggle={() => setAutoFibEnabled(enabled => !enabled)}
        onChartPatternMenuOpen={handleChartPatternMenuOpen}
        onChartPatternToggle={handleChartPatternToggle}
        onIndicatorMenuOpen={handleIndicatorMenuOpen}
        onIndicatorToggle={() => {
          if (indicatorsActive) toggleIndicatorsVisible();
        }}
        onPatternMenuOpen={handlePatternMenuOpen}
        onPatternToggle={handleCandlePatternToggle}
        onHeatmapMenuOpen={handleHeatmapMenuOpen}
        onHeatmapToggle={() => {
          setHeatmapSettings(settings => ({
            ...settings,
            enabled: settings.type === 'none' ? false : !settings.enabled
          }));
        }}
        onReplayToggle={handleReplayToggle}
        onTrendMenuOpen={() => {
          setActiveFeature('Trends');
          setActiveFeaturePanel('Trends');
        }}
        onTrendToggle={() => {
          setAutoTrendSettings(settings => ({
            ...settings,
            appliedAt: settings.enabled ? settings.appliedAt : Date.now(),
            enabled: !settings.enabled
          }));
        }}
        onFeatureSelect={handleFeatureSelect}
        themePreference={themePreference}
        resolvedTheme={resolvedTheme}
        onThemePreferenceChange={setThemePreference}
        onLogout={onLogout}
        currentUser={currentUser}
      />

      <div className="terminal-body">
        <ToolRail
          activeDrawingTool={activeDrawingTool}
          drawingsDisabled={!currentSymbol}
          selectedDrawingId={selectedDrawingId}
          onClearDrawings={() => clearDrawingsForSymbol({ symbol: currentSymbol, symbolType: currentType })}
          onDeleteDrawing={() => {
            if (selectedDrawingId) deleteDrawing(selectedDrawingId);
          }}
          onDrawingToolSelect={setActiveDrawingTool}
        />

        <main className="terminal-main">
          <section className="terminal-chart-area">
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
              </div>
            ) : currentSymbol && replayKlineData.length > 0 ? (
              <ChartWorkspace
                currentSymbol={currentSymbol}
                currentName={currentName}
                currentType={currentType}
                currentPeriod={period}
                adjust={currentType === 'stock' ? adjust : ''}
                klineData={replayKlineData}
                activeDrawingTool={activeDrawingTool}
                addDrawing={addDrawing}
                deleteDrawing={deleteDrawing}
                drawingsBySymbol={drawingsBySymbol}
                updateDrawing={updateDrawing}
                paneDataCache={paneDataCache}
                indicators={visibleIndicators}
                patterns={patterns}
                paneSettings={paneSettings}
                scaleMode={scaleMode}
                selectedDrawingId={selectedDrawingId}
                selectDrawing={selectDrawing}
                workspaceLayout={workspaceLayout}
                strategyMarkers={activeDockTab === 'Strategy Tester' && strategyTesterRunState === 'done' ? getStrategyTradeMarkers(strategyTesterRunResult) : []}
                theme={resolvedTheme}
                autoFibonacciEnabled={autoFibEnabled}
                autoTrendSettings={autoTrendSettings}
                heatmapEnabled={heatmapSettings.enabled && heatmapSettings.type !== 'none'}
                heatmapType={heatmapSettings.type}
                replayBoundaryTime={replayState.enabled && !replayState.selecting ? replayCurrentTime : null}
                replaySelecting={replayState.enabled && replayState.selecting}
                replayLiveJumpKey={replayLiveJumpKey}
                replayResetAlignKey={replayResetAlignKey}
                replayResetTargetTime={replayResetTargetTime}
                replayStartAlignKey={replayStartAlignKey}
                replayTimelineData={replayState.enabled ? replaySourceRows : []}
                onPaneSettingChange={handlePaneSettingChange}
                onIndicatorSettings={handleIndicatorSettingsOpen}
                onReplayTimeSelect={handleReplayTimeSelect}
                onVisibleRightTimeChange={handleVisibleRightTimeChange}
                onLoadOlderData={handleLoadOlderKlineData}
              />
            ) : (
              <div className="empty-container">
                <div className="empty-chart-panel">
                  <span>未加载标的</span>
                  <strong>请选择 A 股、美股或港股标的</strong>
                  <p>可通过顶部搜索、右侧自选列表或下方扫描结果加载图表。</p>
                </div>
              </div>
            )}
            <ReplayControls
              currentTime={replayCurrentTime}
              enabled={replayState.enabled}
              index={replayIndex}
              length={replayLength}
              playing={replayState.playing}
              selecting={replayState.selecting}
              speed={replayState.speed}
              onBack={() => stepReplay(-1)}
              onClose={closeReplay}
              onForward={() => stepReplay(1)}
              onGoLive={jumpReplayToLiveSelection}
              onIndexChange={setReplayIndex}
              onPlayToggle={() => {
                setReplayState(state => (
                  state.enabled && !state.selecting
                    ? { ...state, playing: state.index < replayLength - 1 ? !state.playing : false }
                    : state
                ));
              }}
              onReset={resetReplay}
              onSpeedChange={speed => {
                setReplayState(state => ({ ...state, speed: Number(speed) || 1 }));
              }}
            />
          </section>

          <BottomSignalDock
            activeTab={activeDockTab}
            onTabChange={handleDockTabChange}
            onStrategyRunStateChange={(state, result) => {
              setStrategyTesterRunState(state);
              setStrategyTesterRunResult(result);
            }}
          />
        </main>

        <RightInsightRail />
      </div>

      <Modal
        title={activeFeaturePanel === 'Trends' ? null : (activeFeaturePanel === 'Indicators' ? '指标' : modalMeta.title)}
        open={Boolean(activeFeaturePanel)}
        onCancel={closeFeaturePanel}
        footer={null}
        width={activeFeaturePanel === 'Trends' ? 322 : (activeFeaturePanel === 'Indicators' ? 860 : (modalMeta.width || 680))}
        centered={activeFeaturePanel !== 'Trends'}
        closable={activeFeaturePanel !== 'Trends'}
        mask={activeFeaturePanel !== 'Trends'}
        className={
          activeFeaturePanel === 'Trends'
            ? 'terminal-feature-modal trend-settings-modal'
            : activeFeaturePanel === 'Patterns' || activeFeaturePanel === 'Chart Patterns'
            ? 'terminal-feature-modal pattern-selector-modal'
            : 'terminal-feature-modal'
        }
        destroyOnHidden
      >
        {activeFeaturePanel === 'Indicators' ? (
          <>
            <div className="feature-status-strip modal-context-strip">
              <span>{currentSymbol ? `${currentSymbol} ${currentName || ''} 路 ${period}` : `未加载标的 路 ${period}`}</span>
              <span>指标范围：当前图表</span>
            </div>
            <IndicatorPanel
              initialIndicatorKey={activeIndicatorKey}
              onCancel={closeFeaturePanel}
              onConfirm={closeFeaturePanel}
            />
          </>
        ) : (
          <FeaturePanel
            feature={activeFeaturePanel}
            currentSymbol={currentSymbol}
            currentName={currentName}
            period={period}
            klineData={klineData}
            autoFibEnabled={autoFibEnabled}
            autoTrendSettings={autoTrendSettings}
            heatmapType={heatmapSettings.type}
            onAutoFibToggle={() => setAutoFibEnabled(enabled => !enabled)}
            onAutoTrendSettingsChange={setAutoTrendSettings}
            onHeatmapTypeChange={handleHeatmapTypeChange}
            onClose={closeFeaturePanel}
          />
        )}
      </Modal>
    </div>
  );
}

function BrandSpark({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L14.8 9H9.2L12 2Z" />
      <path d="M12 22L9.2 15H14.8L12 22Z" />
      <path d="M2 12L9 9.2V14.8L2 12Z" />
      <path d="M22 12L15 14.8V9.2L22 12Z" />
    </svg>
  );
}

function EyeIcon({ hidden }) {
  if (hidden) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17.9 17.9A10.2 10.2 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5-5.9" />
        <path d="M9.9 4.2A9.8 9.8 0 0 1 12 4c7 0 11 8 11 8a18.4 18.4 0 0 1-2.2 3.2" />
        <path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" />
        <path d="M1 1l22 22" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LoginCharacterScene({ mood, cursor }) {
  const faceX = Math.max(-14, Math.min(14, (cursor.x - 50) / 2.5));
  const faceY = Math.max(-9, Math.min(9, (cursor.y - 50) / 4));
  const skew = Math.max(-6, Math.min(6, (50 - cursor.x) / 10));

  return (
    <div
      className={`login-character-scene login-character-scene-${mood}`}
      style={{
        '--face-x': `${faceX}px`,
        '--face-y': `${faceY}px`,
        '--body-skew': `${skew}deg`
      }}
      aria-hidden="true"
    >
      <div className="login-character login-character-purple">
        <div className="login-eyes login-eyes-white login-purple-eyes">
          <span><i /></span>
          <span><i /></span>
        </div>
      </div>
      <div className="login-character login-character-black">
        <div className="login-eyes login-eyes-white login-black-eyes">
          <span><i /></span>
          <span><i /></span>
        </div>
      </div>
      <div className="login-character login-character-orange">
        <div className="login-eyes login-eyes-dot login-orange-eyes">
          <span />
          <span />
        </div>
        <div className="login-orange-mouth" />
      </div>
      <div className="login-character login-character-yellow">
        <div className="login-eyes login-eyes-dot login-yellow-eyes">
          <span />
          <span />
        </div>
        <div className="login-yellow-mouth" />
      </div>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cursor, setCursor] = useState({ x: 50, y: 42 });

  const mood = error
    ? 'error'
    : focusedField === 'password' && !showPassword
      ? 'away'
      : showPassword && password
        ? 'peek'
        : focusedField === 'username'
          ? 'typing'
          : 'idle';

  const handleSubmit = async event => {
    event.preventDefault();
    const trimmedUsername = username.trim();
    setError('');

    if (!trimmedUsername) {
      setError('请输入用户名。');
      return;
    }

    if (!password) {
      setError('请输入密码。');
      return;
    }

    try {
      setSubmitting(true);
      if (remember) {
        window.localStorage.setItem('signalforge.loginRemembered.v1', 'true');
      }
      onLogin({ username: trimmedUsername });
    } catch (error) {
      setError(error?.response?.data?.error || error?.message || '登录失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const updateCursor = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCursor({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    });
  };

  return (
    <main className="login-page" onMouseMove={updateCursor}>
      <section className="login-art-panel" aria-label="Triton 登录插画">
        <div className="login-brand">
          <BrandSpark />
          <span>Triton</span>
        </div>

        <div className="login-characters-wrap">
          <LoginCharacterScene mood={mood} cursor={cursor} />
        </div>

        <nav className="login-footer-links" aria-label="相关链接">
          <a href="#">隐私政策</a>
          <a href="#">服务条款</a>
          <a href="#">联系我们</a>
        </nav>
      </section>

      <section className="login-form-panel">
        <div className="login-form-container">
          <div className="login-spark">
            <BrandSpark />
          </div>

          <header className="login-form-header">
            <h1>欢迎回来！</h1>
            <p>请输入您的登录信息</p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className={`login-field ${error && !username.trim() ? 'login-field-error' : ''}`}>
              <span>用户名</span>
              <input
                type="text"
                value={username}
                placeholder="请输入用户名"
                autoComplete="username"
                onChange={event => setUsername(event.target.value)}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
              />
            </label>

            <label className={`login-field ${error && !password ? 'login-field-error' : ''}`}>
              <span>密码</span>
              <div className="login-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  onChange={event => setPassword(event.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword(value => !value)}
                >
                  <EyeIcon hidden={showPassword} />
                </button>
              </div>
            </label>

            <div className="login-options">
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={event => setRemember(event.target.checked)}
                />
                <span>记住登录状态</span>
              </label>
              <a href="#">忘记密码？</a>
            </div>

            {error ? <div className="login-error" role="alert">{error}</div> : null}

            <button className="login-submit" type="submit" disabled={submitting}>
              <span className="login-btn-text">{submitting ? '登录中...' : '登录'}</span>
              <span className="login-btn-hover">
                登录
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </span>
            </button>
          </form>

          <p className="login-signup">还没有账号？<a href="#">注册</a></p>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (SKIP_LOGIN_PAGE) return true;
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('signalforge.authenticated.v1') === 'true';
  });

  const handleLogin = user => {
    window.sessionStorage.setItem('signalforge.authenticated.v1', 'true');
    if (user) {
      window.sessionStorage.setItem('signalforge.user.v1', JSON.stringify(user));
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    window.sessionStorage.removeItem('signalforge.authenticated.v1');
    window.sessionStorage.removeItem('signalforge.user.v1');
    setIsAuthenticated(false);
  };

  return SKIP_LOGIN_PAGE || isAuthenticated ? <AppShell onLogout={handleLogout} /> : <LoginPage onLogin={handleLogin} />;
}

export default App;

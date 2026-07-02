import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  CompressOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExpandOutlined,
  FilterOutlined,
  MoreOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { getScannerRows, getTimingRows } from '../data/marketCatalog';
import { getFallbackMarketSymbols } from '../data/liveMarketData';
import {
  STRATEGY_STORAGE_KEY,
  addStrategyNestedRule,
  addStrategyNestedRuleGroup,
  addStrategyRule,
  addStrategyRuleGroup,
  addStrategyScript,
  cloneStrategy,
  createDefaultStrategy,
  createNewStrategy,
  deserializeStrategies,
  downloadBacktestCsv,
  duplicateStrategyScript,
  exitModeOptions,
  removeStrategyRule,
  removeStrategyNestedRule,
  removeStrategyScript,
  runStrategyBacktest,
  serializeStrategies,
  strategyFieldOptions,
  strategyNoteOptions,
  strategyOperatorOptions,
  strategyTargetOptions,
  strategyTimeframeOptions,
  updateStrategyRule,
  updateStrategyRuleGroup,
  updateStrategyNestedRule,
  updateStrategyScript,
  updateStrategySettings
} from '../data/strategyTesterModel';
import {
  getScannerIndicatorFamily,
  scannerLowerIndicatorOptions,
  scannerOverlayIndicatorOptions
} from '../data/scannerIndicatorOptions';
import {
  deleteSavedScanner,
  executeScannerScan,
  filterScannerLibrary,
  getVisibleScannerRows,
  loadSavedScanners,
  mergeScannerLibrary,
  persistSavedScanners,
  saveScanner,
  shouldShowScannerResults
} from '../data/scannerModel';
import {
  getScannerWatchlistOptions,
  resolveScannerWatchlistSelection
} from '../data/scannerWatchlistOptions';
import { useChartStore } from '../store/chartStore';
import { timeframeOptions } from './chartControlOptions';
import './BottomSignalDock.css';

const tabs = [
  'Market Scanner',
  'Strategy Tester',
  'Alerts & Bots',
  "What's Happening Now",
  'Timing'
];

const tabLabels = {
  'Market Scanner': 'Market Scanner',
  'Strategy Tester': 'Strategy Tester',
  'Alerts & Bots': 'Alerts & Bots',
  "What's Happening Now": "What's Happening Now",
  Timing: 'Timing'
};

const SCANNER_DOCK_HEIGHT = 420;
const DEFAULT_DOCK_HEIGHT = SCANNER_DOCK_HEIGHT;

const alertRows = [
  { name: '600519 Broke Upper Trendline', type: 'Price Alert', target: '1698.00', status: 'Triggered' },
  { name: '000858 MACD Crossed Above Signal', type: 'Indicator Bot', target: 'Daily MACD', status: 'Armed' },
  { name: 'CU2406 Entered Scan Results', type: 'Scanner Bot', target: 'Score > 80', status: 'Waiting' }
];

const happeningRows = [
  { title: 'Large-cap liquor names leading intraday strength', time: '09:45', source: 'Scanner', tone: 'good' },
  { title: 'US and HK tech volatility expanding', time: '10:12', source: 'Volatility', tone: 'good' },
  { title: 'Banking stocks lagging MA20 market breadth', time: '10:33', source: 'Market Breadth', tone: 'warn' }
];

const actionLabels = {
  'Market Scanner': 'Scanner Results',
  'Strategy Tester': 'Backtest Run',
  'Alerts & Bots': 'Automation',
  "What's Happening Now": "What's Happening Now",
  Timing: 'Timing'
};

const prebuiltScannerLibrary = [
  { id: 'prebuilt-bullish-continuation', name: 'Bullish Continuation', owner: 'TrendSpider', type: 'Pre-built', matches: 18 },
  { id: 'prebuilt-breakout-volume', name: 'Breakout With Volume', owner: 'TrendSpider', type: 'Pre-built', matches: 11 },
  { id: 'prebuilt-current-candle-reversals', name: 'Current Candle Reversals', owner: 'TrendSpider', type: 'Pre-built', matches: 9 }
];

const scannerConditions = [
  {
    id: 'price-trend',
    type: 'Condition',
    timeframe: 'daily',
    source: 'Price',
    conditionType: 'Technical Condition',
    leftSource: 'Price',
    rightSource: 'Indicators',
    left: 'Close',
    operator: 'is above',
    right: 'EMA(21)',
    leftOffsetMode: 'last',
    leftOffsetCandles: 1,
    rightOffsetMode: 'last',
    rightOffsetCandles: 1,
    thresholdPercent: 0
  },
  {
    id: 'volume-expansion',
    type: 'Condition',
    timeframe: 'daily',
    source: 'Indicators',
    conditionType: 'Technical Condition',
    leftSource: 'Indicators',
    rightSource: 'Value',
    left: 'Volume',
    operator: 'is above',
    right: '30',
    leftOffsetMode: 'last',
    leftOffsetCandles: 1,
    rightOffsetMode: 'last',
    rightOffsetCandles: 1,
    thresholdPercent: 0
  },
  {
    id: 'momentum-confirm',
    type: 'Condition',
    timeframe: '60min',
    source: 'Indicators',
    conditionType: 'Technical Condition',
    leftSource: 'Indicators',
    rightSource: 'Value',
    left: 'RSI(14)',
    operator: 'crossed above',
    right: '50',
    leftOffsetMode: 'last',
    leftOffsetCandles: 1,
    rightOffsetMode: 'last',
    rightOffsetCandles: 1
  }
];

const cloneConditions = conditions => JSON.parse(JSON.stringify(conditions));

const priceOperandOptions = ['Open', 'High', 'Low', 'Close'];
const overlayIndicatorOptions = scannerOverlayIndicatorOptions;
const lowerIndicatorOptions = scannerLowerIndicatorOptions;
const patternOperandOptions = ['Hammer', 'Bullish Engulfing', 'Inside Bar', 'Trendline Breakout', 'Ascending Triangle'];
const numericThresholdOptions = ['0', '20', '30', '50', '70', '80', '100'];
const scannerSourceOptions = ['Price', 'Indicators', 'Patterns'];
const comparisonOperatorOptions = ['is above', 'is below', 'is equal to', 'is not equal to', 'crossed above', 'crossed below'];
const valueOperatorOptions = ['is above', 'is below', 'is equal to', 'is not equal to'];
const patternOperatorOptions = ['is detected', 'is not detected'];
const normalizeTechnicalSource = source => {
  if (source === 'Indicator' || source === 'Main Indicator' || source === 'Lower Indicator') return 'Indicators';
  if (source === 'Pattern') return 'Patterns';
  return source || 'Price';
};
const getIndicatorFamily = operand => {
  return getScannerIndicatorFamily(operand);
};
const getRightSourceOptions = condition => {
  const leftSource = normalizeTechnicalSource(condition.leftSource || condition.source);
  if (leftSource === 'Patterns') return ['Price', 'Indicators'];
  if (leftSource === 'Indicators' && getIndicatorFamily(condition.left) === 'lower') return ['Indicators', 'Value'];
  return ['Price', 'Indicators', 'Value'];
};
const getOperandOptions = (source, condition, side = 'left') => {
  if (source === 'Value') return numericThresholdOptions;
  if (source === 'Indicators') {
    if (side === 'left') return [...overlayIndicatorOptions, ...lowerIndicatorOptions];

    const leftSource = normalizeTechnicalSource(condition?.leftSource || condition?.source);
    const leftIndicatorFamily = getIndicatorFamily(condition?.left);
    if (condition?.rightSource === source && (leftSource === 'Price' || leftSource === 'Patterns')) {
      return overlayIndicatorOptions;
    }
    if (condition?.rightSource === source && leftSource === 'Indicators' && leftIndicatorFamily === 'lower') {
      return lowerIndicatorOptions;
    }
    if (condition?.rightSource === source && leftSource === 'Indicators' && leftIndicatorFamily === 'overlay') {
      return overlayIndicatorOptions;
    }
    return [...overlayIndicatorOptions, ...lowerIndicatorOptions];
  }
  if (source === 'Patterns') return patternOperandOptions;
  return priceOperandOptions;
};
const getOperatorOptions = condition => {
  const leftSource = normalizeTechnicalSource(condition?.leftSource || condition?.source);
  if (leftSource === 'Patterns') return patternOperatorOptions;
  if (condition?.rightSource === 'Value') return valueOperatorOptions;
  return comparisonOperatorOptions;
};
const shouldShowPercentThreshold = condition => (
  ['is above', 'is below'].includes(condition?.operator) && condition?.rightSource !== 'Value'
);
const getDefaultRightSource = source => (source === 'Price' ? 'Indicators' : 'Price');
const getDefaultOperand = (source, condition = {}, side = 'left') => getOperandOptions(source, condition, side)[0] || '';
const getDefaultOperator = condition => getOperatorOptions(condition)[0] || '';
const getDefaultCondition = id => {
  const condition = {
    id,
    type: 'Condition',
    timeframe: 'daily',
    source: 'Price',
    conditionType: 'Technical Condition',
    leftSource: 'Price',
    rightSource: 'Indicators',
    left: 'Close',
    operator: 'is above',
    right: 'EMA(21)',
    leftOffsetMode: 'last',
    leftOffsetCandles: 1,
    rightOffsetMode: 'last',
    rightOffsetCandles: 1,
    thresholdPercent: 0
  };
  return condition;
};

const getDefaultConditionGroup = id => ({
  id,
  type: 'Condition Group',
  logic: 'all',
  timingMode: 'happened',
  timingCandles: 20,
  comment: '',
  commentOpen: false,
  conditions: [getDefaultCondition(`${id}-condition-1`)]
});

const getDefaultScannerSettings = scanUniverse => ({
  scanUniverse,
  scanChartType: 'candles',
  scanExtHours: false,
  scanCurrentCandle: true,
  groupLogic: 'all',
  groupTimingMode: 'happened',
  groupTimingCandles: 20,
  groupComment: '',
  groupCommentOpen: false
});

const updateConditionTree = (items, targetId, updater) =>
  items.map(item => {
    if (item.id === targetId) return updater(item);
    if (item.type !== 'Condition Group') return item;
    return {
      ...item,
      conditions: updateConditionTree(item.conditions, targetId, updater)
    };
  });

const removeFromConditionTree = (items, targetId) =>
  items
    .filter(item => item.id !== targetId)
    .map(item => {
      if (item.type !== 'Condition Group') return item;
      const nextConditions = removeFromConditionTree(item.conditions, targetId);
      return {
        ...item,
        conditions: nextConditions.length ? nextConditions : [getDefaultCondition(`${item.id}-condition-${Date.now()}`)]
      };
    });

const OffsetControl = ({ mode, candles, onChange }) => (
  <label className="condition-offset-field">
    <span>Offset</span>
    <select
      value={mode || 'last'}
      onChange={event => onChange({
        mode: event.target.value,
        candles: candles || 1
      })}
    >
      <option value="last">Last</option>
      <option value="candlesAgo">Candles ago</option>
    </select>
    {(mode || 'last') === 'candlesAgo' && (
      <input
        min="1"
        type="number"
        value={candles || 1}
        onChange={event => onChange({
          mode: mode || 'candlesAgo',
          candles: Math.max(1, Number(event.target.value) || 1)
        })}
      />
    )}
  </label>
);

const ConditionRow = ({ condition, onChange, onRemove }) => {
  const leftSource = normalizeTechnicalSource(condition.leftSource || condition.source);
  const rightSourceOptions = getRightSourceOptions(condition);
  const rightSource = rightSourceOptions.includes(normalizeTechnicalSource(condition.rightSource || condition.source))
    ? normalizeTechnicalSource(condition.rightSource || condition.source)
    : rightSourceOptions[0];
  const leftOptions = getOperandOptions(leftSource, condition, 'left');
  const rightOptions = getOperandOptions(rightSource, { ...condition, rightSource }, 'right');
  const operatorOptions = getOperatorOptions({ ...condition, rightSource });
  const operator = operatorOptions.includes(condition.operator) ? condition.operator : operatorOptions[0];
  const effectiveCondition = { ...condition, operator, rightSource };
  const showPercentThreshold = shouldShowPercentThreshold(effectiveCondition);

  return (
    <div className="scanner-condition-block">
      <div className="condition-block-body">
        <label className="condition-source-field">
          <span>Source</span>
          <select
            value={leftSource}
            onChange={event => {
              const nextLeftSource = event.target.value;
              const nextLeft = getDefaultOperand(nextLeftSource, { ...condition, leftSource: nextLeftSource }, 'left');
              const nextRightSource = getDefaultRightSource(nextLeftSource);
              const nextCondition = {
                ...condition,
                leftSource: nextLeftSource,
                left: nextLeft,
                rightSource: nextRightSource
              };
              const nextRight = getDefaultOperand(nextRightSource, nextCondition, 'right');
              const nextCompleteCondition = {
                ...nextCondition,
                right: nextRight
              };
              onChange({
                leftSource: nextLeftSource,
                left: nextLeft,
                leftOffsetMode: 'last',
                leftOffsetCandles: 1,
                rightSource: nextRightSource,
                right: nextRight,
                rightOffsetMode: 'last',
                rightOffsetCandles: 1,
                operator: getDefaultOperator(nextCompleteCondition)
              });
            }}
          >
            {scannerSourceOptions.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </label>
        <label className="condition-timeframe-field">
          <span>Timeframe</span>
          <select value={condition.timeframe} onChange={event => onChange({ timeframe: event.target.value })}>
            {timeframeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="condition-left-field">
          <span>Left</span>
          <select
            value={condition.left}
            onChange={event => {
              const nextLeft = event.target.value;
              const nextCondition = { ...condition, left: nextLeft };
              const nextRightSourceOptions = getRightSourceOptions(nextCondition);
              const nextRightSource = nextRightSourceOptions.includes(rightSource)
                ? rightSource
                : nextRightSourceOptions[0];
              const nextRightOptions = getOperandOptions(nextRightSource, {
                ...nextCondition,
                rightSource: nextRightSource
              }, 'right');
              const nextRight = nextRightSource === rightSource && nextRightOptions.includes(condition.right)
                ? condition.right
                : nextRightOptions[0] || '';
              const nextCompleteCondition = {
                ...nextCondition,
                rightSource: nextRightSource,
                right: nextRight
              };
              const nextOperatorOptions = getOperatorOptions(nextCompleteCondition);
              onChange({
                left: nextLeft,
                rightSource: nextRightSource,
                right: nextRight,
                operator: nextOperatorOptions.includes(condition.operator)
                  ? condition.operator
                  : nextOperatorOptions[0] || ''
              });
            }}
          >
            <option value="" disabled>Select parameter</option>
            {condition.left && <option>{condition.left}</option>}
            {leftOptions.filter(option => option !== condition.left).map(option => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <OffsetControl
          mode={condition.leftOffsetMode || condition.offsetMode || 'last'}
          candles={condition.leftOffsetCandles || condition.offsetCandles || 1}
          onChange={({ mode, candles }) => onChange({
            leftOffsetMode: mode,
            leftOffsetCandles: candles
          })}
        />
        <label className="condition-operator-field">
          <span>Operator</span>
          <select value={operator} onChange={event => onChange({ operator: event.target.value })}>
            <option value="" disabled>Select operator</option>
            {operatorOptions.map(option => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="condition-right-source-field">
          <span>Right Source</span>
          <select
            value={rightSource}
            onChange={event => {
              const nextRightSource = event.target.value;
              const nextRight = getDefaultOperand(nextRightSource, { ...condition, rightSource: nextRightSource }, 'right');
              const nextCondition = {
                ...condition,
                rightSource: nextRightSource,
                right: nextRight
              };
              const nextOperatorOptions = getOperatorOptions(nextCondition);
              onChange({
                rightSource: nextRightSource,
                right: nextRight,
                operator: nextOperatorOptions.includes(condition.operator)
                  ? condition.operator
                  : nextOperatorOptions[0] || ''
              });
            }}
          >
            {rightSourceOptions.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </label>
        <label className="condition-right-field">
          <span>Right</span>
          {rightSource === 'Value' ? (
            <input
              inputMode="decimal"
              placeholder="Value"
              value={condition.right}
              onChange={event => onChange({ right: event.target.value })}
            />
          ) : (
            <select value={condition.right} onChange={event => onChange({ right: event.target.value })}>
              <option value="" disabled>Select comparison</option>
              {condition.right && <option>{condition.right}</option>}
              {rightOptions.filter(option => option !== condition.right).map(option => (
                <option key={option}>{option}</option>
              ))}
            </select>
          )}
        </label>
        {rightSource !== 'Value' && (
          <OffsetControl
            mode={condition.rightOffsetMode || 'last'}
            candles={condition.rightOffsetCandles || 1}
            onChange={({ mode, candles }) => onChange({
              rightOffsetMode: mode,
              rightOffsetCandles: candles
            })}
          />
        )}
        {showPercentThreshold && (
          <label className="condition-threshold-field">
            <span>At Least</span>
            <em>At least</em>
            <input
              min="0"
              step="0.1"
              type="number"
              value={condition.thresholdPercent ?? 0}
              onChange={event => onChange({
                thresholdPercent: Math.max(0, Number(event.target.value) || 0)
              })}
            />
            <b>%</b>
          </label>
        )}
      </div>
      <button
        className="condition-remove-button"
        type="button"
        aria-label="Remove condition"
        title="Remove condition"
        onClick={onRemove}
      >
        <CloseOutlined />
      </button>
    </div>
  );
};

const GroupLogicControls = ({
  logic,
  timingMode,
  timingCandles,
  comment = '',
  commentOpen = false,
  conditionCount,
  onChange
}) => (
  <div className="scanner-group-head">
    <div className="scanner-script-logic">
      <span className="scanner-rule-label">Script Passes When</span>
      <select value={logic} onChange={event => onChange({ logic: event.target.value })}>
        <option value="all">All conditions below are met</option>
        <option value="any">Any condition below is met</option>
        <option value="none">None of the conditions below are met</option>
      </select>
      <strong>is true</strong>
      <small>{conditionCount ? `${conditionCount} parameter${conditionCount === 1 ? '' : 's'}` : 'No parameters'}</small>
    </div>
    <div className="scanner-script-controls">
      <label className="scanner-timing-control">
        <span>Timing</span>
        <select value={timingMode} onChange={event => onChange({ timingMode: event.target.value })}>
          <option value="happened">Happened</option>
          <option value="within">Happened within</option>
        </select>
      </label>
      {timingMode === 'within' && (
        <label className="scanner-happened-within">
          <span>Range</span>
          <input
            min="1"
            type="number"
            value={timingCandles}
            onChange={event => onChange({ timingCandles: Math.max(1, Number(event.target.value) || 1) })}
          />
          <em>candles</em>
        </label>
      )}
      <button className={commentOpen || comment ? 'active' : ''} type="button" onClick={() => onChange({ commentOpen: !commentOpen })}>Comment</button>
    </div>
    {commentOpen && (
      <div className="scanner-comment-row">
        <input
          autoFocus
          placeholder="Add comment"
          value={comment}
          onBlur={() => onChange({ commentOpen: false })}
          onChange={event => onChange({ comment: event.target.value })}
          onKeyDown={event => {
            if (event.key === 'Enter') onChange({ commentOpen: false });
          }}
        />
      </div>
    )}
  </div>
);

const ConditionTreeItem = ({
  item,
  groupAddMenuOpen,
  onAddMenu,
  onConditionChange,
  onGroupChange,
  onRemove,
  onAddConditionToGroup,
  onAddGroupToGroup
}) => {
  if (item.type !== 'Condition Group') {
    return (
      <ConditionRow
        condition={item}
        onChange={patch => onConditionChange(item.id, patch)}
        onRemove={() => onRemove(item.id)}
      />
    );
  }

  return (
    <div className="scanner-nested-group">
      <div className="scanner-nested-group-header">
        <GroupLogicControls
          comment={item.comment}
          commentOpen={item.commentOpen}
          logic={item.logic}
          timingMode={item.timingMode}
          timingCandles={item.timingCandles}
          conditionCount={item.conditions.length}
          onChange={patch => onGroupChange(item.id, patch)}
        />
        <button
          className="condition-remove-button"
          type="button"
          aria-label="Remove condition group"
          title="Remove condition group"
          onClick={() => onRemove(item.id)}
        >
          <CloseOutlined />
        </button>
      </div>
      <div className="scanner-nested-group-body">
        {item.conditions.map(child => (
          <ConditionTreeItem
            groupAddMenuOpen={groupAddMenuOpen}
            item={child}
            key={child.id}
            onAddConditionToGroup={onAddConditionToGroup}
            onAddGroupToGroup={onAddGroupToGroup}
            onAddMenu={onAddMenu}
            onConditionChange={onConditionChange}
            onGroupChange={onGroupChange}
            onRemove={onRemove}
          />
        ))}
        <div className="nested-add-parameter">
          <button
            className="nested-add-condition"
            type="button"
          onClick={() => {
              onAddMenu(item.id);
            }}
          >
            <PlusOutlined /> add parameter here
          </button>
          {groupAddMenuOpen === item.id && (
            <div className="scanner-add-menu nested">
              <button type="button" onClick={() => onAddConditionToGroup(item.id)}>Condition</button>
              <button type="button" onClick={() => onAddGroupToGroup(item.id)}>Condition Group</button>
              <button type="button">Load from template</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DockConfigPanel = ({ mode, activeTab }) => {
  if (!mode) return null;

  if (mode === 'filters') {
    return (
      <div className="dock-config-panel">
        <button type="button"><span>Universe</span><strong>A-Shares + Futures</strong></button>
        <button type="button"><span>Pattern</span><strong>Trend + Volume</strong></button>
        <button type="button"><span>Min Score</span><strong>70+</strong></button>
        <button type="button"><span>Timeframe</span><strong>{activeTab === 'Timing' ? 'Multi-timeframe' : 'Daily'}</strong></button>
      </div>
    );
  }

  return (
    <div className="dock-config-panel">
      {['Symbol', 'Pattern', 'Last', 'Change', 'Score', 'Status'].map(column => (
        <button key={column} type="button">
          <span>{column}</span>
          <strong>Show</strong>
        </button>
      ))}
    </div>
  );
};

const DockActionBar = ({ activeTab, configMode, runState, onConfigMode, onRun }) => (
  <>
    <div className="dock-action-bar">
      <div className="dock-context">
        <strong>{actionLabels[activeTab]}</strong>
        <span>Live workspace · A-Shares + Futures</span>
        {runState === 'done' && <em><CheckCircleOutlined /> Updated just now</em>}
        {runState === 'running' && <em className="running">Running...</em>}
      </div>
      <div className="dock-filters">
        <button
          className={configMode === 'filters' ? 'active' : ''}
          onClick={() => onConfigMode(configMode === 'filters' ? null : 'filters')}
          type="button"
        >
          <FilterOutlined /> Filters
        </button>
        <button
          className={configMode === 'columns' ? 'active' : ''}
          onClick={() => onConfigMode(configMode === 'columns' ? null : 'columns')}
          type="button"
        >
          <SettingOutlined /> Columns
        </button>
        <button onClick={onRun} type="button"><ReloadOutlined /> Refresh</button>
        <button className="primary" onClick={onRun} type="button"><PlayCircleOutlined /> Run</button>
      </div>
    </div>
    <DockConfigPanel mode={configMode} activeTab={activeTab} />
  </>
);

const ScannerPanel = () => {
  const { addWatchlistGroup, currentSymbol, setCurrentSymbol, watchlistGroups } = useChartStore();
  const [marketSymbols, setMarketSymbols] = useState(getFallbackMarketSymbols);
  const scannerRows = getScannerRows(marketSymbols);
  const initialScanUniverse = resolveScannerWatchlistSelection('', useChartStore.getState().watchlistGroups);
  const [savedScanners, setSavedScanners] = useState(() => loadSavedScanners());
  const scannerLibrary = mergeScannerLibrary(prebuiltScannerLibrary, savedScanners);
  const [query, setQuery] = useState('');
  const [scannerLibraryFilter, setScannerLibraryFilter] = useState('all');
  const [activeScanner, setActiveScanner] = useState(scannerLibrary[0]?.id || null);
  const [editorMode, setEditorMode] = useState('saved');
  const [draftName, setDraftName] = useState(scannerLibrary[0]?.name || 'New Scanner');
  const [draftConditions, setDraftConditions] = useState(() => cloneConditions(scannerConditions));
  const [addParameterMenuOpen, setAddParameterMenuOpen] = useState(false);
  const [groupAddMenuOpen, setGroupAddMenuOpen] = useState(null);
  const [scanUniverse, setScanUniverse] = useState(initialScanUniverse);
  const [scanChartType, setScanChartType] = useState('candles');
  const [scanExtHours, setScanExtHours] = useState(false);
  const [scanCurrentCandle, setScanCurrentCandle] = useState(true);
  const [scannedScannerId, setScannedScannerId] = useState(null);
  const [scanResultRows, setScanResultRows] = useState([]);
  const [groupLogic, setGroupLogic] = useState('all');
  const [groupTimingMode, setGroupTimingMode] = useState('happened');
  const [groupTimingCandles, setGroupTimingCandles] = useState(20);
  const [groupComment, setGroupComment] = useState('');
  const [groupCommentOpen, setGroupCommentOpen] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [scannerLibraryOpen, setScannerLibraryOpen] = useState(true);
  const [scannerMenuOpen, setScannerMenuOpen] = useState(false);
  const [resultsNotice, setResultsNotice] = useState('');
  const resultsNoticeTimerRef = useRef(null);
  const filteredScanners = filterScannerLibrary(scannerLibrary, scannerLibraryFilter, query);
  const scanListOptions = getScannerWatchlistOptions(watchlistGroups);
  const selectedScanner = scannerLibrary.find(item => item.id === activeScanner);
  const displayScannerName = draftName || activeScanner;
  const activeConditions = draftConditions;
  const visibleScannerRows = getVisibleScannerRows(scanResultRows, {
    editorMode,
    activeScannerId: activeScanner,
    scannedScannerId,
    conditions: activeConditions
  });
  const scannerResultsVisible = shouldShowScannerResults({
    editorMode,
    activeScannerId: activeScanner,
    scannedScannerId,
    conditions: activeConditions
  });

  useEffect(() => {
    setScanUniverse(previous => resolveScannerWatchlistSelection(previous, watchlistGroups));
  }, [watchlistGroups]);

  const applyScannerToEditor = scanner => {
    const settings = {
      ...getDefaultScannerSettings(initialScanUniverse),
      ...(scanner?.settings || {})
    };

    setActiveScanner(scanner?.id || null);
    setScannedScannerId(null);
    setScanResultRows([]);
    setDraftName(scanner?.name || 'New Scanner');
    setDraftConditions(cloneConditions(scanner?.conditions?.length ? scanner.conditions : scannerConditions));
    setScanUniverse(resolveScannerWatchlistSelection(settings.scanUniverse, watchlistGroups));
    setScanChartType(settings.scanChartType);
    setScanExtHours(Boolean(settings.scanExtHours));
    setScanCurrentCandle(Boolean(settings.scanCurrentCandle));
    setAddParameterMenuOpen(false);
    setGroupAddMenuOpen(null);
    setScannerMenuOpen(false);
    setGroupLogic(settings.groupLogic);
    setGroupTimingMode(settings.groupTimingMode);
    setGroupTimingCandles(settings.groupTimingCandles);
    setGroupComment(settings.groupComment);
    setGroupCommentOpen(Boolean(settings.groupCommentOpen));
    setEditorMode('saved');
  };

  const getScannerSettings = () => ({
    scanUniverse,
    scanChartType,
    scanExtHours,
    scanCurrentCandle,
    groupLogic,
    groupTimingMode,
    groupTimingCandles,
    groupComment,
    groupCommentOpen
  });

  const handleSaveScanner = () => {
    const result = saveScanner(savedScanners, {
      id: selectedScanner?.id,
      owner: selectedScanner?.owner,
      type: selectedScanner?.type,
      name: draftName,
      conditions: draftConditions,
      settings: getScannerSettings(),
      matches: selectedScanner?.matches || scannerRows.length
    });

    setSavedScanners(result.scanners);
    persistSavedScanners(result.scanners);
    setActiveScanner(result.scanner.id);
    setScannedScannerId(null);
    setScanResultRows([]);
    setDraftName(result.scanner.name);
    setEditorMode('saved');
  };

  const handleCloneScanner = () => {
    const result = saveScanner(savedScanners, {
      name: `${draftName || selectedScanner?.name || 'Scanner'} Copy`,
      conditions: draftConditions,
      settings: getScannerSettings(),
      matches: selectedScanner?.matches || scannerRows.length
    });

    setSavedScanners(result.scanners);
    persistSavedScanners(result.scanners);
    setActiveScanner(result.scanner.id);
    setScannedScannerId(null);
    setScanResultRows([]);
    setDraftName(result.scanner.name);
    setEditorMode('saved');
    setScannerMenuOpen(false);
  };

  const handleRunScanner = () => {
    if (!activeScanner || activeConditions.length === 0) return;
    const rows = executeScannerScan({
      rows: marketSymbols,
      watchlistGroups,
      scanUniverse,
      conditions: activeConditions,
      logic: groupLogic
    });
    setScanResultRows(rows);
    setScannedScannerId(activeScanner);
  };

  const saveResultsAsWatchlist = () => {
    if (!visibleScannerRows.length) return;
    const watchlistName = `${draftName || 'Scanner'} Results`;
    addWatchlistGroup({
      name: watchlistName,
      type: 'mixed',
      symbols: visibleScannerRows.map(row => row.symbol)
    });
    setResultsNotice(`Saved "${watchlistName}" to watchlists`);
    window.clearTimeout(resultsNoticeTimerRef.current);
    resultsNoticeTimerRef.current = window.setTimeout(() => setResultsNotice(''), 2600);
  };

  const invalidateScannerResults = () => {
    setScannedScannerId(null);
    setScanResultRows([]);
  };

  const handleDeleteScanner = scannerId => {
    const nextSavedScanners = deleteSavedScanner(savedScanners, scannerId);
    const nextScannerLibrary = mergeScannerLibrary(prebuiltScannerLibrary, nextSavedScanners);

    setSavedScanners(nextSavedScanners);
    persistSavedScanners(nextSavedScanners);

    if (activeScanner !== scannerId) return;

    const nextActiveScanner = nextScannerLibrary[0];
    if (nextActiveScanner) {
      applyScannerToEditor(nextActiveScanner);
      return;
    }

    setActiveScanner(null);
    setScannedScannerId(null);
    setScanResultRows([]);
    setDraftName('New Scanner');
    setDraftConditions([]);
    setEditorMode('start');
    setScannerMenuOpen(false);
  };

  const startNewScanner = () => {
    const settings = getDefaultScannerSettings(resolveScannerWatchlistSelection('', watchlistGroups));
    setActiveScanner(null);
    setScannedScannerId(null);
    setDraftName('New Scanner');
    setDraftConditions([]);
    setAddParameterMenuOpen(false);
    setGroupAddMenuOpen(null);
    setScanUniverse(settings.scanUniverse);
    setScanChartType(settings.scanChartType);
    setScanExtHours(settings.scanExtHours);
    setScanCurrentCandle(settings.scanCurrentCandle);
    setGroupLogic(settings.groupLogic);
    setGroupTimingMode(settings.groupTimingMode);
    setGroupTimingCandles(settings.groupTimingCandles);
    setGroupComment(settings.groupComment);
    setGroupCommentOpen(settings.groupCommentOpen);
    setScannerMenuOpen(false);
    setEditorMode('start');
  };

  const updateDraftCondition = (id, patch) => {
    invalidateScannerResults();
    setDraftConditions(previous => previous.map(condition =>
      condition.id === id ? { ...condition, ...patch } : condition
    ));
  };
  const updateDraftGroup = (id, patch) => {
    invalidateScannerResults();
    setDraftConditions(previous => updateConditionTree(previous, id, item => ({ ...item, ...patch })));
  };
  const updateDraftGroupCondition = (groupId, conditionId, patch) => {
    invalidateScannerResults();
    setDraftConditions(previous => updateConditionTree(previous, conditionId, condition => ({ ...condition, ...patch })));
  };
  const removeDraftItem = id => {
    invalidateScannerResults();
    setDraftConditions(previous => removeFromConditionTree(previous, id));
  };
  const removeDraftGroupCondition = (groupId, conditionId) => {
    invalidateScannerResults();
    setDraftConditions(previous => removeFromConditionTree(previous, conditionId));
  };
  const addDraftCondition = () => {
    invalidateScannerResults();
    setDraftConditions(previous => [
      ...previous,
      getDefaultCondition(`draft-${Date.now()}-${previous.length}`)
    ]);
    setAddParameterMenuOpen(false);
  };
  const addDraftConditionGroup = () => {
    invalidateScannerResults();
    setDraftConditions(previous => [
      ...previous,
      getDefaultConditionGroup(`group-${Date.now()}-${previous.length}`)
    ]);
    setAddParameterMenuOpen(false);
  };
  const addConditionToGroup = groupId => {
    invalidateScannerResults();
    setDraftConditions(previous => updateConditionTree(previous, groupId, item => ({
      ...item,
      conditions: [
        ...item.conditions,
        getDefaultCondition(`${groupId}-condition-${Date.now()}-${item.conditions.length}`)
      ]
    })));
    setGroupAddMenuOpen(null);
  };
  const addGroupToGroup = groupId => {
    invalidateScannerResults();
    setDraftConditions(previous => updateConditionTree(previous, groupId, item => ({
      ...item,
      conditions: [
        ...item.conditions,
        getDefaultConditionGroup(`${groupId}-group-${Date.now()}-${item.conditions.length}`)
      ]
    })));
    setGroupAddMenuOpen(null);
  };

  return (
    <div className={`dock-content market-scanner-workspace ${resultsExpanded ? 'results-expanded' : ''} ${scannerLibraryOpen ? '' : 'library-collapsed'}`}>
      <button className="scanner-list-edge-toggle" onClick={() => setScannerLibraryOpen(open => !open)} type="button">{scannerLibraryOpen ? '<' : '>'}</button>
      <aside className="scanner-library-pane">
        <label className="scanner-library-search">
          <SearchOutlined />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search scanners" />
        </label>
        <div className="scanner-library-tabs">
          <button
            className={scannerLibraryFilter === 'all' ? 'active' : ''}
            onClick={() => setScannerLibraryFilter('all')}
            type="button"
          >
            All
          </button>
          <button
            className={scannerLibraryFilter === 'yours' ? 'active' : ''}
            onClick={() => setScannerLibraryFilter('yours')}
            type="button"
          >
            Yours
          </button>
          <button
            className={scannerLibraryFilter === 'prebuilt' ? 'active' : ''}
            onClick={() => setScannerLibraryFilter('prebuilt')}
            type="button"
          >
            Pre-built
          </button>
        </div>
        <div className="scanner-library-list">
          {filteredScanners.map(item => (
            <div
              className={`scanner-library-item ${editorMode === 'saved' && activeScanner === item.id ? 'active' : ''}`}
              key={item.id}
            >
              <button
                className="scanner-library-select"
                onClick={() => applyScannerToEditor(item)}
                type="button"
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.owner} / {item.type}</small>
                </span>
              </button>
            </div>
          ))}
        </div>
        <div className="scanner-new-row">
          <button type="button" onClick={startNewScanner}>
            <PlusOutlined /> New Scanner
          </button>
        </div>
      </aside>

      <section className="scanner-builder-pane">
        {editorMode === 'start' ? (
          <div className="new-scanner-start">
            <div className="new-scanner-title">
              <strong>New Scanner</strong>
              <span>Start with the point-and-click editor.</span>
            </div>
            <div className="new-scanner-options">
              <button type="button" onClick={() => setEditorMode('point')}>
                <strong>Point-and-click Editor</strong>
                <span>Build conditions manually with dropdowns and parameter groups.</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="scanner-builder-header">
              <div className="scanner-title-control">
                <input
                  aria-label="Scanner name"
                  className="scanner-name-input"
                  value={displayScannerName}
                  onChange={event => setDraftName(event.target.value)}
                />
              </div>
              <div className="scanner-header-actions">
                <button type="button" onClick={handleSaveScanner}><SaveOutlined /> Save</button>
                <button type="button"><ClockCircleOutlined /> Schedule</button>
                <button className="primary" onClick={handleRunScanner} type="button"><PlayCircleOutlined /> Scan</button>
                <div className="scanner-action-menu-wrap">
                  <button className="scanner-more-button" onClick={() => setScannerMenuOpen(open => !open)} title="More scanner actions" type="button">...</button>
                  {scannerMenuOpen && (
                    <div className="scanner-action-menu">
                      <button type="button" onClick={handleCloneScanner}>Clone Scanner</button>
                      <button type="button" onClick={() => setScannerMenuOpen(false)}>Share Scanner</button>
                      <button
                        disabled={!(selectedScanner?.owner === 'Mine' && selectedScanner?.type === 'Saved')}
                        type="button"
                        onClick={() => handleDeleteScanner(activeScanner)}
                      >
                        Delete Scanner
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="scanner-settings-strip">
              <span className="scanner-settings-kicker">Scan</span>
              <label className="scanner-universe-field">
                <span>Scan List</span>
                <select
                  disabled={!scanListOptions.length}
                  value={scanUniverse}
                  onChange={event => {
                    invalidateScannerResults();
                    setScanUniverse(event.target.value);
                  }}
                >
                  {scanListOptions.length ? scanListOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.count})
                    </option>
                  )) : (
                    <option value="">No watchlists available</option>
                  )}
                </select>
              </label>
              <label className="scanner-chart-type-field">
                <span>Chart Type</span>
                <select value={scanChartType} onChange={event => {
                  invalidateScannerResults();
                  setScanChartType(event.target.value);
                }}>
                  <option value="candles">Candles</option>
                  <option value="heikin">Heikin Ashi</option>
                  <option value="raindrop">Raindrop</option>
                </select>
              </label>
              <label className="scanner-toggle">
                <input
                  checked={scanExtHours}
                  onChange={event => {
                    invalidateScannerResults();
                    setScanExtHours(event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>Extended Hours</span>
              </label>
              <label className="scanner-toggle">
                <input
                  checked={scanCurrentCandle}
                  onChange={event => {
                    invalidateScannerResults();
                    setScanCurrentCandle(event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>Current Candle</span>
              </label>
            </div>

            <div className="scanner-condition-builder">
              <>
                <div className="scanner-script-card">
                  <div className="scanner-script-header">
              <GroupLogicControls
                comment={groupComment}
                commentOpen={groupCommentOpen}
                logic={groupLogic}
                timingMode={groupTimingMode}
                timingCandles={groupTimingCandles}
                conditionCount={activeConditions.length}
                onChange={patch => {
                  invalidateScannerResults();
                  if (patch.logic) setGroupLogic(patch.logic);
                  if (patch.timingMode) setGroupTimingMode(patch.timingMode);
                  if (patch.timingCandles) setGroupTimingCandles(patch.timingCandles);
                  if (Object.prototype.hasOwnProperty.call(patch, 'comment')) setGroupComment(patch.comment);
                  if (Object.prototype.hasOwnProperty.call(patch, 'commentOpen')) setGroupCommentOpen(patch.commentOpen);
                }}
              />
            </div>

            <div className="scanner-condition-stack">
              {activeConditions.length > 0 ? activeConditions.map(item => (
                <ConditionTreeItem
                  groupAddMenuOpen={groupAddMenuOpen}
                  item={item}
                  key={item.id}
                  onAddConditionToGroup={addConditionToGroup}
                  onAddGroupToGroup={addGroupToGroup}
                onAddMenu={id => setGroupAddMenuOpen(value => (value === id ? null : id))}
                  onConditionChange={updateDraftCondition}
                  onGroupChange={updateDraftGroup}
                  onRemove={removeDraftItem}
                />
              )) : (
                <div className="scanner-empty-conditions">
                  <span>No parameters yet. Add parameters below to build the script.</span>
                </div>
              )}
            </div>

            <div className="scanner-add-parameter">
              <button
                type="button"
                onClick={() => {
                  setAddParameterMenuOpen(value => !value);
                }}
              >
                <PlusOutlined /> Add parameter here
              </button>
              {addParameterMenuOpen && (
                <div className="scanner-add-menu">
                  <button type="button" onClick={addDraftCondition}>Condition</button>
                  <button type="button" onClick={addDraftConditionGroup}>Condition Group</button>
                  <button type="button">Load from template</button>
                </div>
              )}
            </div>
          </div>
              </>
            </div>
          </>
        )}
      </section>

      <aside className={`scanner-results-pane ${scannerResultsVisible ? '' : 'empty'}`}>
        {scannerResultsVisible && (
          <>
            <div className="scanner-results-title">
              <span>
                <strong>Scan Results</strong>
                <small className={resultsNotice ? 'success' : ''}>{resultsNotice || `${visibleScannerRows.length} matches`}</small>
              </span>
              <div className="scanner-results-actions">
                <button type="button" title="Save results as watchlist" onClick={saveResultsAsWatchlist}>
                  <SaveOutlined />
                </button>
                <button type="button" title="Rerun scanner" onClick={handleRunScanner}>
                  <ReloadOutlined />
                </button>
                <button
                  className={resultsExpanded ? 'active' : ''}
                  type="button"
                  title={resultsExpanded ? 'Collapse results' : 'Expand results'}
                  onClick={() => setResultsExpanded(expanded => !expanded)}
                >
                  {resultsExpanded ? <CompressOutlined /> : <ExpandOutlined />}
                </button>
              </div>
            </div>
            <div className="scanner-results-list">
              {visibleScannerRows.map((row, index) => (
                <button
                  className={`scanner-result-row ${currentSymbol === row.symbol ? 'active' : ''} ${index < 2 ? 'new' : 'kept'}`}
                  key={row.symbol}
                  onClick={() => setCurrentSymbol(row.symbol, row.name, row.type)}
                  type="button"
                >
                  <i />
                  <span className="scanner-result-symbol">
                    <strong>{row.symbol}</strong>
                    <small>{row.name}</small>
                  </span>
                  <span className="scanner-result-price">
                    <strong>{row.last}</strong>
                    <em>{row.change}</em>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
};

const StrategyPerformanceChart = ({ points }) => {
  if (!points?.length) {
    return (
      <div className="strategy-performance-chart empty" aria-label="Equity curve">
        <span>No run data</span>
      </div>
    );
  }

  const max = Math.max(...points.map(point => point.value));
  const min = Math.min(...points.map(point => point.value));
  const range = Math.max(1, max - min);
  const polyline = points
    .map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 88 - ((point.value - min) / range) * 70;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="strategy-performance-chart" aria-label="Equity curve">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
        <polyline points={polyline} />
      </svg>
      <div className="strategy-chart-labels">
        {points.map(point => <span key={point.label}>{point.label}</span>)}
      </div>
    </div>
  );
};

const StrategyLogicRow = ({ count }) => (
  <div className="ts-logic-row">
    <select value="All of the following" onChange={() => {}}>
      <option value="All of the following">All of the following</option>
      <option value="Any of the following">Any of the following</option>
      <option value="None of the following">None of the following</option>
    </select>
    <strong>is true</strong>
    <span>{count} parameters</span>
  </div>
);

const StrategyConditionLine = ({ row, note }) => (
  <div className="ts-condition-line">
    <button type="button">{row.timeframe}</button>
    <button type="button">{row.left}</button>
    <button type="button">{row.operator}</button>
    <button type="button">{row.right}</button>
    <button type="button">{note}</button>
    <button aria-label="Remove condition" className="ts-condition-remove" type="button"><CloseOutlined /></button>
  </div>
);

const StrategyScriptBox = ({ title, children }) => (
  <section className="ts-condition-section">
    <strong className="ts-condition-section-title">{title}</strong>
    {children}
  </section>
);

const normalizeStrategyTimeframe = period => period === 'daily' ? 'Daily' : period;

const cleanUserStrategies = strategies => {
  const seen = new Set();
  return (strategies || [])
    .filter(strategy => {
      const key = strategy?.id;
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const loadInitialStrategies = ({ currentSymbol, period }) => {
  const fallbackStrategy = createDefaultStrategy({ symbol: currentSymbol, timeframe: normalizeStrategyTimeframe(period) });
  if (typeof window === 'undefined') {
    return [fallbackStrategy];
  }

  const saved = cleanUserStrategies(deserializeStrategies(window.localStorage.getItem(STRATEGY_STORAGE_KEY)));
  if (saved.length) {
    window.localStorage.setItem(STRATEGY_STORAGE_KEY, serializeStrategies(saved));
    return saved;
  } else {
    window.localStorage.setItem(STRATEGY_STORAGE_KEY, serializeStrategies([fallbackStrategy]));
  }
  return [fallbackStrategy];
};

const StrategyOptionSelect = ({ label, value, options, onChange }) => (
  <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
    {options.map(option => <option key={option} value={option}>{option}</option>)}
  </select>
);

const StrategyRuleLine = ({ rule, onChange, onRemove }) => (
  <div className="scanner-condition-block ts-condition-line">
    <div className="condition-block-body">
      <label className="condition-timeframe-field">
        <span>Timeframe</span>
        <select aria-label="Rule timeframe" value={rule.timeframe} onChange={event => onChange({ timeframe: event.target.value })}>
          {[...strategyTimeframeOptions, 'Risk'].map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="condition-left-field">
        <span>Left</span>
        <select aria-label="Rule field" value={rule.left} onChange={event => onChange({ left: event.target.value })}>
          {strategyFieldOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="condition-offset-field">
        <span>Left Offset</span>
        <select aria-label="Rule execution note" value={rule.note} onChange={event => onChange({ note: event.target.value })}>
          {strategyNoteOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="condition-operator-field">
        <span>Operator</span>
        <select aria-label="Rule operator" value={rule.operator} onChange={event => onChange({ operator: event.target.value })}>
          {strategyOperatorOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="condition-right-field">
        <span>Right</span>
        <select aria-label="Rule target" value={rule.right} onChange={event => onChange({ right: event.target.value })}>
          {strategyTargetOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="condition-offset-field">
        <span>Right Offset</span>
        <select aria-label="Rule target note" value={rule.note} onChange={event => onChange({ note: event.target.value })}>
          {strategyNoteOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    </div>
    <button aria-label="Remove condition" className="condition-remove-button" onClick={onRemove} type="button"><CloseOutlined /></button>
  </div>
);

const StrategyRuleGroup = ({ group, onGroupChange, onRuleChange, onChildRemove, onAddChild, onAddGroup, onRemove }) => {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  return (
  <div className="scanner-nested-group ts-nested-condition-group">
    <div className="scanner-nested-group-header">
      <div className="ts-nested-group-controls">
        <select aria-label="Nested condition group logic" value={group.logic || 'All of the following'} onChange={event => onGroupChange(group.id, { logic: event.target.value })}>
          <option value="All of the following">All of the following</option>
          <option value="Any of the following">Any of the following</option>
          <option value="None of the following">None of the following</option>
        </select>
        <select aria-label="Nested condition group timing" value={group.timing || 'happened'} onChange={event => onGroupChange(group.id, { timing: event.target.value })}>
          <option value="happened">Happened</option>
          <option value="happened within">Happened within</option>
          <option value="did not happen">Did not happen</option>
        </select>
        <select aria-label="Nested condition group symbol" value={group.symbolScope || 'On Current Symbol'} onChange={event => onGroupChange(group.id, { symbolScope: event.target.value })}>
          <option value="On Current Symbol">On Current Symbol</option>
          <option value="On Other Symbol">On Other Symbol</option>
        </select>
        {group.symbolScope === 'On Other Symbol' && (
          <input aria-label="Nested condition group symbol code" placeholder="Symbol" value={group.symbol || ''} onChange={event => onGroupChange(group.id, { symbol: event.target.value.toUpperCase() })} />
        )}
      </div>
      <button aria-label="Remove condition group" className="condition-remove-button" onClick={onRemove} type="button"><CloseOutlined /></button>
    </div>
    <div className="scanner-nested-group-body">
      {(group.rules || []).map(rule => (
        <StrategyRuleItem
          key={rule.id}
          rule={rule}
          onAddChild={onAddChild}
          onAddGroup={onAddGroup}
          onChildRemove={onChildRemove}
          onGroupChange={onGroupChange}
          onRemove={() => onChildRemove(group.id, rule.id)}
          onRuleChange={onRuleChange}
        />
      ))}
      <div className="nested-add-parameter">
        <button className="nested-add-condition" onClick={() => setAddMenuOpen(open => !open)} type="button">Add Condition</button>
        {addMenuOpen && (
          <div className="ts-add-parameter-menu">
            <button type="button" onClick={() => {
              onAddChild(group.id);
              setAddMenuOpen(false);
            }}>
              <strong>Condition</strong>
              <span>Add a parameter inside the current group.</span>
            </button>
            <button type="button" onClick={() => {
              onAddGroup(group.id);
              setAddMenuOpen(false);
            }}>
              <strong>Condition Group</strong>
              <span>Add parameters to a nested group.</span>
            </button>
            <button type="button" onClick={() => setAddMenuOpen(false)}>
              <strong>Load from Template</strong>
              <span>Choose a saved script template.</span>
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
  );
};

const StrategyRuleItem = ({ rule, onRuleChange, onGroupChange, onRemove, onChildRemove, onAddChild, onAddGroup }) => (
  rule.type === 'Condition Group' ? (
    <StrategyRuleGroup
      group={rule}
      onAddChild={onAddChild}
      onAddGroup={onAddGroup}
      onChildRemove={onChildRemove}
      onGroupChange={onGroupChange}
      onRemove={onRemove}
      onRuleChange={onRuleChange}
    />
  ) : (
    <StrategyRuleLine rule={rule} onChange={patch => onRuleChange(rule.id, patch)} onRemove={onRemove} />
  )
);

const getExitModeSummary = mode => {
  if (mode === 'Take Profit') return 'Exit when the position reaches the configured profit target.';
  if (mode === 'Stop Loss') return 'Exit when price moves against the position by the configured risk amount.';
  if (mode === 'Trailing Stop') return 'Trail the stop from the best price reached after entry.';
  if (mode === 'Entry Invalidated') return 'Exit when the original entry condition is no longer true.';
  if (mode === '# Candles Passed') return 'Exit after a fixed holding period, optionally gated by current PnL.';
  if (mode === 'List of Signals') return 'Use explicit triggering candle timestamps instead of visual rules.';
  return '';
};

const StrategySignalsEditor = ({ script, onScriptChange, kind }) => (
  <div className="ts-signal-list-editor ts-trendspider-editor-block">
    <div className="ts-signals-head">
      <strong>{getTrendSpiderModeLabel('List of Signals')}</strong>
      <span>One triggering candle open timestamp per line. Order does not matter; empty lines and # comments are ignored.</span>
    </div>
    <textarea
      aria-label={`${kind} signal timestamps`}
      placeholder={'2023-05-10T21:54:49.486Z\n1683755663\n23 Aug 2022 09:00 EST\n# one signal per line'}
      value={script.signalList || ''}
      onChange={event => onScriptChange({ signalList: event.target.value })}
    />
    <div className="ts-signal-format-grid">
      <span>Unix timestamp</span>
      <span>JS timestamp</span>
      <span>ISO datetime</span>
      <span>Human readable date</span>
    </div>
    <div className="ts-signal-list-actions">
      <button type="button" onClick={() => onScriptChange({ signalList: `${script.signalList || ''}${script.signalList ? '\n' : ''}2024-05-21 09:30` })}>
        <PlusOutlined /> Add signal timestamp
      </button>
      <span>{kind === 'exit' ? 'Every listed signal exits the full position.' : 'Entry signals are ignored while already in position.'}</span>
    </div>
  </div>
);

const StrategyExitModePanel = ({ script, onScriptChange }) => {
  const config = script.exitConfig || {};
  const patchConfig = patch => onScriptChange({ exitConfig: { ...config, ...patch } });

  if (script.mode === 'List of Signals') {
    return <StrategySignalsEditor script={script} onScriptChange={onScriptChange} kind="exit" />;
  }

  const renderExitBlock = children => (
    <div className="ts-exit-condition-body ts-exit-condition-inline">
      {children}
    </div>
  );

  if (script.mode === 'Entry Invalidated') {
    return renderExitBlock(
      <>
        <div className="ts-exit-rule-line">
          <span>Exit when entry conditions are invalidated</span>
          <select value={config.invalidatedTiming || 'After candle close'} onChange={event => patchConfig({ invalidatedTiming: event.target.value })}>
            <option>After candle close</option>
            <option>Intrabar</option>
          </select>
        </div>
        <label className="ts-inline-check">
          <input checked={config.requireConfirmedClose !== false} onChange={event => patchConfig({ requireConfirmedClose: event.target.checked })} type="checkbox" />
          <span>Require confirmed candle close</span>
        </label>
      </>
    );
  }

  if (script.mode === '# Candles Passed') {
    return renderExitBlock(
      <>
        <div className="ts-exit-rule-line">
          <span>Exit after</span>
          <input value={config.candles || 10} onChange={event => patchConfig({ candles: event.target.value })} />
          <span>candles have passed</span>
          <select value={config.pnlOperator || 'Any PnL'} onChange={event => patchConfig({ pnlOperator: event.target.value })}>
            <option>Any PnL</option>
            <option>PnL above</option>
            <option>PnL below</option>
          </select>
          <input value={config.pnlPercent || '1.0%'} onChange={event => patchConfig({ pnlPercent: event.target.value })} />
        </div>
        <div className="ts-exit-rule-line">
          <span>Simulate exit at</span>
          <select value={config.fill || 'After candle close'} onChange={event => patchConfig({ fill: event.target.value })}>
            <option>After candle close</option>
            <option>Next open</option>
          </select>
        </div>
      </>
    );
  }

  if (['Take Profit', 'Stop Loss', 'Trailing Stop'].includes(script.mode)) {
    const action = script.mode === 'Take Profit' ? 'gained' : script.mode === 'Stop Loss' ? 'lost' : 'moved back';
    const defaultValue = script.mode === 'Take Profit' ? '4.0' : script.mode === 'Stop Loss' ? '1.5' : '2.0';
    return renderExitBlock(
      <>
        <div className="ts-exit-rule-line">
          <span>Exit if {action} more than</span>
          <input value={config.value || defaultValue} onChange={event => patchConfig({ value: event.target.value })} />
          <select value={config.type || 'Percent'} onChange={event => patchConfig({ type: event.target.value })}>
            <option>Percent</option>
            <option>Price units</option>
            <option>ATR</option>
          </select>
          <span>from</span>
          <select value={config.basis || 'Entry price'} onChange={event => patchConfig({ basis: event.target.value })}>
            <option>Entry price</option>
            <option>Entry candle open</option>
            <option>Entry candle close</option>
            <option>Previous candle close</option>
          </select>
        </div>
        <div className="ts-exit-check-row">
          <label><input checked={Boolean(config.afterCandleCloses)} onChange={event => patchConfig({ afterCandleCloses: event.target.checked })} type="checkbox" /> <span>After candle closes</span></label>
          <label><input checked={Boolean(config.canExitAtEntryCandle)} onChange={event => patchConfig({ canExitAtEntryCandle: event.target.checked })} type="checkbox" /> <span>Can exit at entry candle</span></label>
        </div>
      </>
    );
  }

  return null;
};

const getTrendSpiderModeLabel = mode => {
  if (mode === 'Entry Invalidated') return 'Entry Invalidated';
  if (mode === '# Candles Passed') return '# Candles Passed';
  if (mode === 'Take Profit') return 'Take Profit';
  if (mode === 'Stop Loss') return 'Stop Loss';
  if (mode === 'Trailing Stop') return 'Trailing Stop';
  if (mode === 'List of Signals') return 'List of Signals';
  if (mode === 'Script') return 'Script';
  return mode;
};

const StrategyModeMenu = ({ modes, activeMode, onSelect }) => (
  <div className="ts-condition-type-menu">
    {modes.map(mode => (
      <button className={activeMode === mode ? 'active' : ''} key={mode} onClick={() => onSelect(mode)} type="button">
        <span aria-hidden="true">•</span>
        {getTrendSpiderModeLabel(mode)}
      </button>
    ))}
  </div>
);

const strategySubjectPresets = {
  Price: { left: 'Close', operator: 'is above', right: 'SMA(20)' },
  Indicator: { left: 'RSI(14)', operator: 'crosses above', right: 'RSI 50' },
  'Candlestick pattern': { left: '4 Green Candles', operator: 'is detected', right: 'Current Candle' }
};

const StrategyScriptEditor = ({ script, kind, onScriptChange, onRuleChange, onRuleGroupChange, onAddRule, onAddRuleGroup, onRemoveRule, onNestedRuleChange, onAddNestedRule, onAddNestedRuleGroup, onRemoveNestedRule, onDuplicateScript }) => {
  const [draftMode, setDraftMode] = useState(null);
  const [humanCondition, setHumanCondition] = useState('');
  const [conditionBuilderStage, setConditionBuilderStage] = useState(null);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [pendingAddTarget, setPendingAddTarget] = useState(null);
  const [scriptMenuOpen, setScriptMenuOpen] = useState(false);
  const [conditionDraft, setConditionDraft] = useState({
    timeframe: script.rules[0]?.timeframe || 'Daily',
    left: script.rules[0]?.left || 'Close',
    operator: script.rules[0]?.operator || 'is above',
    right: script.rules[0]?.right || 'SMA(20)',
    note: script.rules[0]?.note || 'last'
  });
  const applyTemplate = template => {
    onAddRule();
    setDraftMode(null);
  };
  const applyConditionDraft = () => {
    if (pendingAddTarget) {
      onAddNestedRule(pendingAddTarget, conditionDraft);
    } else {
      onAddRule(conditionDraft);
    }
    setConditionBuilderStage(null);
    setPendingAddTarget(null);
  };
  const addConditionWithTimeframe = timeframe => {
    const nextDraft = { ...conditionDraft, timeframe };
    if (pendingAddTarget) {
      onAddNestedRule(pendingAddTarget, nextDraft);
    } else {
      onAddRule(nextDraft);
    }
    setConditionDraft(nextDraft);
    setConditionBuilderStage(null);
    setPendingAddTarget(null);
  };
  const chooseSubject = subject => {
    setConditionDraft(previous => ({ ...previous, ...strategySubjectPresets[subject] }));
    setConditionBuilderStage('timeframe');
  };
  const visibleSubjects = Object.keys(strategySubjectPresets).filter(subject => subject.toLowerCase().includes(subjectSearch.trim().toLowerCase()));

  return (
  <div className="ts-trendspider-editor-block">
    <div className="ts-script-logic-bar">
      <div className="ts-script-logic-left">
        <select value={script.logic} onChange={event => onScriptChange({ logic: event.target.value })}>
          <option value="All of the following">All of the following</option>
          <option value="Any of the following">Any of the following</option>
          <option value="None of the following">None of the following</option>
        </select>
        <select value="happened" onChange={() => {}}>
          <option value="happened">Happened</option>
          <option value="did not happen">Did not happen</option>
        </select>
      </div>
      <div className="ts-script-tools">
        <input
          aria-label="Script name"
          value={script.name || (kind === 'exit' ? 'Papa' : 'Bravo')}
          onChange={event => onScriptChange({ name: event.target.value })}
        />
        <button
          className="ts-ai-mini"
          onClick={() => {
            setConditionBuilderStage(null);
            setDraftMode(draftMode === 'human' ? null : 'human');
          }}
          title="AI"
          type="button"
        >
          <RobotOutlined />
        </button>
        <div className="ts-script-more-wrap">
          <button className="ts-script-more" onClick={() => setScriptMenuOpen(open => !open)} title="More actions" type="button"><span className="ts-more-dots" aria-hidden="true">...</span></button>
          {scriptMenuOpen && (
            <div className="ts-script-action-menu">
              <button type="button" onClick={() => {
                onDuplicateScript();
                setScriptMenuOpen(false);
              }}>Duplicate Script</button>
              <button type="button" onClick={() => {
                setDraftMode('template');
                setScriptMenuOpen(false);
              }}>Save / Load Template</button>
              <button type="button" onClick={() => {
                onScriptChange({ commentOpen: !script.commentOpen });
                setScriptMenuOpen(false);
              }}>{script.commentOpen ? 'Hide Comment' : 'Add Comment'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
    <div className="ts-editor-help-line">
      <span>Describe what you are looking for by defining conditions.</span>
      <a href="https://help.trendspider.com/kb/strategy-tester/understanding-strategy-tester-from-trendspider" rel="noreferrer" target="_blank">Read Docs ↗</a>
      <button type="button">Jump to Editor</button>
    </div>
    <div className="ts-script-editor-surface">
      {script.rules.length > 0 && (
        <div className="ts-condition-list">
          {script.rules.map(rule => (
            <StrategyRuleItem
              key={rule.id}
              rule={rule}
              onRemove={() => onRemoveRule(rule.id)}
              onAddChild={groupId => {
                setPendingAddTarget(groupId);
                setDraftMode(null);
                setConditionBuilderStage('subject');
              }}
              onAddGroup={onAddNestedRuleGroup}
              onChildRemove={onRemoveNestedRule}
              onGroupChange={onRuleGroupChange}
              onRuleChange={onRuleChange}
            />
          ))}
        </div>
      )}
      {script.commentOpen && (
        <textarea
          aria-label="Script comment"
          className="ts-script-comment"
          placeholder="Comment on this script block"
          value={script.comment || ''}
          onChange={event => onScriptChange({ comment: event.target.value })}
        />
      )}
      <div className={`ts-script-choice-stack ${script.rules.length ? 'compact' : ''}`}>
        <button type="button" onClick={() => {
          setDraftMode(null);
          setConditionBuilderStage(stage => (stage ? null : 'menu'));
        }}>Add Condition</button>
        {!script.rules.length && (
          <>
            <button type="button" onClick={() => setDraftMode(draftMode === 'human' ? null : 'human')}>Add Natural Language Condition</button>
            <button type="button" onClick={() => setDraftMode(draftMode === 'template' ? null : 'template')}>Load from Template</button>
          </>
        )}
      </div>
      {conditionBuilderStage === 'menu' && (
        <div className="ts-add-parameter-menu">
          <button type="button" onClick={() => setConditionBuilderStage('subject')}>
            <strong>Condition</strong>
            <span>Add a parameter inside the current group.</span>
          </button>
          <button type="button" onClick={() => {
            onAddRuleGroup();
            setConditionBuilderStage(null);
            setPendingAddTarget(null);
          }}>
            <strong>Condition Group</strong>
            <span>Add parameters inside a nested AND/OR group.</span>
          </button>
          <button type="button" onClick={() => {
            setConditionBuilderStage(null);
            setDraftMode('template');
          }}>
            <strong>Load from Template</strong>
            <span>Choose a saved script template.</span>
          </button>
        </div>
      )}
      {conditionBuilderStage === 'subject' && (
        <div className="ts-subject-picker">
          <div className="ts-subject-picker-line">
            <span>Choose Subject</span>
            <button type="button">GPT condition</button>
          </div>
          <div className="ts-subject-picker-menu">
            <input aria-label="Search subjects" value={subjectSearch} onChange={event => setSubjectSearch(event.target.value)} />
            {visibleSubjects.map(subject => (
              <button key={subject} type="button" onClick={() => chooseSubject(subject)}>{subject}</button>
            ))}
          </div>
        </div>
      )}
      {conditionBuilderStage === 'timeframe' && (
        <div className="ts-timeframe-picker">
          <div className="ts-subject-picker-line">
            <span>Choose Timeframe</span>
            <button type="button" onClick={() => setConditionBuilderStage('subject')}>Change Subject</button>
          </div>
          <div className="ts-timeframe-picker-grid">
            {strategyTimeframeOptions.map(timeframe => (
              <button key={timeframe} type="button" onClick={() => addConditionWithTimeframe(timeframe)}>{timeframe}</button>
            ))}
          </div>
        </div>
      )}
      {conditionBuilderStage === 'editor' && (
        <div className="ts-visual-condition-builder">
          <div className="ts-condition-builder-row">
            <StrategyOptionSelect label="Condition timeframe" value={conditionDraft.timeframe} options={[...strategyTimeframeOptions, 'Risk']} onChange={value => setConditionDraft(previous => ({ ...previous, timeframe: value }))} />
            <StrategyOptionSelect label="Condition field" value={conditionDraft.left} options={strategyFieldOptions} onChange={value => setConditionDraft(previous => ({ ...previous, left: value }))} />
            <StrategyOptionSelect label="Condition operator" value={conditionDraft.operator} options={strategyOperatorOptions} onChange={value => setConditionDraft(previous => ({ ...previous, operator: value }))} />
            <StrategyOptionSelect label="Condition target" value={conditionDraft.right} options={strategyTargetOptions} onChange={value => setConditionDraft(previous => ({ ...previous, right: value }))} />
            <StrategyOptionSelect label="Condition note" value={conditionDraft.note} options={strategyNoteOptions} onChange={value => setConditionDraft(previous => ({ ...previous, note: value }))} />
          </div>
          <div className="ts-condition-builder-actions">
            <button type="button" onClick={applyConditionDraft}>Add Condition</button>
            <button type="button" onClick={() => setConditionBuilderStage('subject')}>Back</button>
            <button type="button" onClick={() => setConditionBuilderStage(null)}>Cancel</button>
          </div>
        </div>
      )}
      {draftMode === 'human' && (
        <div className="ts-human-condition-editor">
          <textarea
            aria-label="Human language condition"
            placeholder="Example: close crosses above SMA 20 while RSI is below 70"
            value={humanCondition}
            onChange={event => setHumanCondition(event.target.value)}
          />
          <div>
            <button type="button" onClick={() => {
              onAddRule();
              setHumanCondition('');
              setDraftMode(null);
            }}>
              Add condition
            </button>
            <button type="button" onClick={() => setDraftMode(null)}>Cancel</button>
          </div>
        </div>
      )}
      {draftMode === 'template' && (
        <div className="ts-template-condition-menu">
          {['Price crosses moving average', 'RSI exits oversold', 'Volume expansion breakout'].map(template => (
            <button key={template} type="button" onClick={() => applyTemplate(template)}>
              <strong>{template}</strong>
              <span>{template === 'Price crosses moving average' ? 'Close crosses above SMA(20)' : template === 'RSI exits oversold' ? 'RSI(14) crosses above RSI 50' : 'Volume is above previous high'}</span>
            </button>
          ))}
        </div>
      )}
      {kind === 'exit' && <span className="ts-script-footnote">Any exit condition can close the current position.</span>}
    </div>
  </div>
  );
};

const StrategyEditorBlock = ({ kind, script, onScriptChange, onRuleChange, onRuleGroupChange, onAddRule, onAddRuleGroup, onRemoveRule, onNestedRuleChange, onAddNestedRule, onAddNestedRuleGroup, onRemoveNestedRule, onDuplicateScript, onRemoveScript }) => (
    <div className="ts-condition-block-shell">
      {script.mode === 'Script' ? (
        <>
          <div className="ts-condition-mode-row">
            <strong className="ts-condition-mode-title">Script</strong>
            <button aria-label="Remove script condition" onClick={onRemoveScript} type="button"><CloseOutlined /></button>
          </div>
          <StrategyScriptEditor
            kind={kind}
            script={script}
            onAddRule={onAddRule}
            onAddRuleGroup={onAddRuleGroup}
            onAddNestedRule={onAddNestedRule}
            onAddNestedRuleGroup={onAddNestedRuleGroup}
            onDuplicateScript={onDuplicateScript}
            onNestedRuleChange={onNestedRuleChange}
            onRemoveNestedRule={onRemoveNestedRule}
            onRemoveRule={onRemoveRule}
            onRuleChange={onRuleChange}
            onRuleGroupChange={onRuleGroupChange}
            onScriptChange={onScriptChange}
          />
        </>
      ) : kind === 'entry' || script.mode === 'List of Signals' ? (
        <>
          <div className="ts-condition-mode-row">
            <strong className="ts-condition-mode-title">List of Signals</strong>
            <button aria-label="Remove signal condition" onClick={onRemoveScript} type="button"><CloseOutlined /></button>
          </div>
          <StrategySignalsEditor script={script} onScriptChange={onScriptChange} kind={kind} />
        </>
      ) : (
        <>
          <div className="ts-condition-mode-row">
            <strong className="ts-condition-mode-title">{getTrendSpiderModeLabel(script.mode)}</strong>
            <button aria-label="Remove exit condition" onClick={onRemoveScript} type="button"><CloseOutlined /></button>
          </div>
          <StrategyExitModePanel script={script} onScriptChange={onScriptChange} />
        </>
      )}
    </div>
);

const StrategyConditionsSection = ({ kind, scripts, title, modeTabs, onScriptChange, onRuleChange, onRuleGroupChange, onAddRule, onAddRuleGroup, onRemoveRule, onNestedRuleChange, onAddNestedRule, onAddNestedRuleGroup, onRemoveNestedRule, onAddScript, onDuplicateScript, onRemoveScript }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const addLabel = kind === 'entry' ? 'Add Entry Condition...' : 'Add Exit Condition...';

  const handleModeSelect = mode => {
    onAddScript(mode);
    setMenuOpen(false);
  };

  return (
    <StrategyScriptBox title={title}>
      {scripts.map(script => (
        <StrategyEditorBlock
          key={script.id}
          kind={kind}
          script={script}
          onScriptChange={patch => onScriptChange(script.id, patch)}
          onRuleChange={(ruleId, patch) => onRuleChange(script.id, ruleId, patch)}
          onRuleGroupChange={(groupId, patch) => onRuleGroupChange(script.id, groupId, patch)}
          onAddRule={overrides => onAddRule(script.id, overrides)}
          onAddRuleGroup={() => onAddRuleGroup(script.id)}
          onRemoveRule={ruleId => onRemoveRule(script.id, ruleId)}
          onNestedRuleChange={(groupId, ruleId, patch) => onNestedRuleChange(script.id, groupId, ruleId, patch)}
          onAddNestedRule={(groupId, overrides) => onAddNestedRule(script.id, groupId, overrides)}
          onAddNestedRuleGroup={groupId => onAddNestedRuleGroup(script.id, groupId)}
          onRemoveNestedRule={(groupId, ruleId) => onRemoveNestedRule(script.id, groupId, ruleId)}
          onDuplicateScript={() => onDuplicateScript(script.id)}
          onRemoveScript={() => onRemoveScript(script.id)}
        />
      ))}
      <div className="ts-add-condition-wrap">
        <button className="ts-add-condition-button" onClick={() => setMenuOpen(open => !open)} type="button">{addLabel}</button>
        {menuOpen && (
          <StrategyModeMenu
            activeMode=""
            modes={modeTabs}
            onSelect={handleModeSelect}
          />
        )}
      </div>
    </StrategyScriptBox>
  );
};

const StrategyPbeView = ({ result }) => {
  const groups = [
    ['All Positions', result?.pbe?.all || []],
    ['Winning Trades', result?.pbe?.winners || []],
    ['Losing Trades', result?.pbe?.losers || []]
  ];

  return (
    <div className="ts-pbe-grid">
      {groups.map(([label, points]) => {
        const average = points.length ? points.reduce((sum, point) => sum + point.y, 0) / points.length : 0;
        return (
          <div key={label}>
            <span>{label}</span>
            <strong>{points.length ? `${average >= 0 ? '+' : ''}${average.toFixed(2)}%` : '-'}</strong>
            <i style={{ width: `${Math.min(100, Math.abs(average) * 14)}%` }} />
            <em>{points.length} samples</em>
          </div>
        );
      })}
    </div>
  );
};

const StrategyTabularView = ({ trades }) => (
  <div className="ts-tabular-data">
    <div className="ts-tabular-head">
      <span>Entry</span>
      <span>Exit</span>
      <span>Return</span>
      <span>Drawdown</span>
      <span>Reason</span>
    </div>
    {trades.map(trade => (
      <div className={`ts-tabular-row ${trade.status.toLowerCase()}`} key={trade.id}>
        <span>{trade.entryTime}</span>
        <span>{trade.exitTime}</span>
        <strong>{trade.returnPercent >= 0 ? '+' : ''}{trade.returnPercent}%</strong>
        <span>{trade.maxDrawdownPercent}%</span>
        <em>{trade.exitReason}</em>
      </div>
    ))}
  </div>
);

const StrategyPanel = ({ runState, runResult, onRun, onClearRun, maximized, onToggleMaximized }) => {
  const { currentSymbol, currentName, period, klineData } = useChartStore();
  const [strategies, setStrategies] = useState(() => loadInitialStrategies({ currentSymbol, period }));
  const [activeStrategyId, setActiveStrategyId] = useState(() => strategies[0]?.id);
  const [resultTab, setResultTab] = useState('Price Behavior Explorer');
  const [tradeFilter, setTradeFilter] = useState('All');
  const [listFilter, setListFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dirty, setDirty] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [strategyListOpen, setStrategyListOpen] = useState(true);
  const userStrategies = useMemo(() => cleanUserStrategies(strategies), [strategies]);
  const builtInStrategies = useMemo(() => ['SMA Cross #pre-built', 'RSI Reversal #pre-built'].map(name => updateStrategySettings(
    createDefaultStrategy({ symbol: currentSymbol, timeframe: normalizeStrategyTimeframe(period) }),
    { name }
  )), [currentSymbol, period]);
  const activeStrategy = useMemo(
    () => userStrategies.find(strategy => strategy.id === activeStrategyId) || builtInStrategies.find(strategy => strategy.id === activeStrategyId) || userStrategies[0] || builtInStrategies[0],
    [activeStrategyId, builtInStrategies, userStrategies]
  );
  const activeIsUserStrategy = Boolean(activeStrategy && userStrategies.some(strategy => strategy.id === activeStrategy.id));
  const resultVisible = runState === 'done' && Boolean(runResult);
  const filteredTrades = (runResult?.trades || []).filter(trade => tradeFilter === 'All' || trade.status === tradeFilter);
  useEffect(() => {
    if (userStrategies.length === strategies.length && userStrategies.every((strategy, index) => strategy.id === strategies[index]?.id)) return;
    setStrategies(userStrategies);
    if (!userStrategies.some(strategy => strategy.id === activeStrategyId)) {
      setActiveStrategyId(userStrategies[0]?.id || null);
    }
    if (typeof window !== 'undefined') {
      if (userStrategies.length) {
        window.localStorage.setItem(STRATEGY_STORAGE_KEY, serializeStrategies(userStrategies));
      } else {
        window.localStorage.removeItem(STRATEGY_STORAGE_KEY);
      }
    }
  }, [activeStrategyId, strategies, userStrategies]);

  const visibleStrategies = userStrategies.filter(strategy => `${strategy.name} ${(strategy.tags || []).join(' ')}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const strategyListTabs = [
    { value: 'all', label: 'All' },
    { value: 'yours', label: 'Mine' },
    { value: 'built-in', label: 'Built-in' }
  ];
  const displayedStrategies = (() => {
    if (listFilter === 'all') return [...visibleStrategies, ...builtInStrategies];
    if (listFilter === 'yours') return visibleStrategies;
    if (listFilter === 'built-in') return builtInStrategies;
    return [];
  })();

  const persistStrategies = nextStrategies => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STRATEGY_STORAGE_KEY, serializeStrategies(nextStrategies));
    }
  };

  const updateActiveStrategy = updater => {
    setStrategies(previous => previous.map(strategy => (
      strategy.id === activeStrategy.id ? (typeof updater === 'function' ? updater(strategy) : updater) : strategy
    )));
    setDirty(true);
  };

  const handleSave = () => {
    if (!activeIsUserStrategy) {
      handleClone(activeStrategy);
      return;
    }
    persistStrategies(strategies);
    setDirty(false);
  };

  const handleCreate = () => {
    const created = createNewStrategy({ symbol: currentSymbol, timeframe: normalizeStrategyTimeframe(period) });
    const nextStrategies = cleanUserStrategies([created, ...strategies]);
    setStrategies(nextStrategies);
    setActiveStrategyId(created.id);
    setSearchTerm('');
    setListFilter('yours');
    onClearRun?.();
    persistStrategies(nextStrategies);
    setDirty(false);
  };

  const handleClone = strategy => {
    const cloned = cloneStrategy(strategy || activeStrategy);
    const nextStrategies = cleanUserStrategies([cloned, ...strategies]);
    setStrategies(nextStrategies);
    setActiveStrategyId(cloned.id);
    persistStrategies(nextStrategies);
    setDirty(false);
  };

  const handleDeleteStrategy = strategyId => {
    const removable = userStrategies.some(strategy => strategy.id === strategyId);
    if (!removable) return;
    const remaining = strategies.filter(strategy => strategy.id !== strategyId);
    const nextStrategies = cleanUserStrategies(remaining);
    setStrategies(nextStrategies);
    if (activeStrategy?.id === strategyId) {
      const nextVisibleUserStrategies = nextStrategies.filter(strategy => `${strategy.name} ${(strategy.tags || []).join(' ')}`.toLowerCase().includes(searchTerm.toLowerCase()));
      const nextDisplayedStrategies = listFilter === 'all'
        ? [...nextVisibleUserStrategies, ...builtInStrategies]
        : listFilter === 'yours'
          ? nextVisibleUserStrategies
          : builtInStrategies;
      setActiveStrategyId(nextDisplayedStrategies[0]?.id || builtInStrategies[0]?.id || null);
      onClearRun?.();
    }
    if (nextStrategies.length) {
      persistStrategies(nextStrategies);
    } else if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STRATEGY_STORAGE_KEY);
    }
    setDirty(false);
  };

  const handleDelete = () => handleDeleteStrategy(activeStrategy.id);

  const handleRun = () => {
    onRun(runStrategyBacktest({
      strategy: updateStrategySettings(activeStrategy, { symbol: currentSymbol }),
      bars: klineData,
      symbol: currentSymbol
    }));
  };

  if (!activeStrategy) return null;

  return (
    <div className="dock-content ts-strategy-widget">
      <main className={`ts-body-layout ${strategyListOpen ? '' : 'list-collapsed'}`}>
        <button className="ts-list-edge-toggle" onClick={() => setStrategyListOpen(open => !open)} type="button">{strategyListOpen ? '<' : '>'}</button>
        <aside className="ts-strategy-list">
          <label className="scanner-library-search ts-strategy-search">
            <SearchOutlined />
            <input aria-label="Search strategies" placeholder="Search strategies" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
          </label>
          <div className="scanner-library-tabs ts-list-tabs">
            {strategyListTabs.map(tab => (
              <button className={listFilter === tab.value ? 'active' : ''} key={tab.value} onClick={() => setListFilter(tab.value)} type="button">{tab.label}</button>
            ))}
          </div>
          <div className="scanner-library-list ts-list-items">
            {displayedStrategies.map(strategy => {
              const mineStrategy = visibleStrategies.some(item => item.id === strategy.id);
              return (
              <div className={strategy.id === activeStrategy.id ? 'scanner-library-item ts-list-item active' : 'scanner-library-item ts-list-item'} key={strategy.id}>
                <button
                  className="scanner-library-select ts-list-item-select"
                  onClick={() => {
                  setActiveStrategyId(strategy.id);
                }}
                  type="button"
                >
                  <strong>{strategy.name}</strong>
                  <span>{mineStrategy ? '#Mine' : '#Built-in'}</span>
                </button>
              </div>
              );
            })}
            {!displayedStrategies.length && <span className="ts-list-empty">No strategies</span>}
          </div>
          <div className="scanner-new-row ts-new-strategy-row">
            <button className="ts-new-strategy-button" type="button" onClick={handleCreate}><PlusOutlined /> New Strategy</button>
          </div>
        </aside>

        <section className="ts-strategy-main">
          <div className="ts-settings-row">
            <div className="ts-settings-left-tools">
              <input className="ts-strategy-name-input" value={activeStrategy.name} onChange={event => updateActiveStrategy(strategy => updateStrategySettings(strategy, { name: event.target.value }))} />
              <StrategyOptionSelect label="Timeframe" value={activeStrategy.timeframe} options={strategyTimeframeOptions} onChange={value => updateActiveStrategy(strategy => updateStrategySettings(strategy, { timeframe: value }))} />
              <select
                className="ts-depth-select"
                value={activeStrategy.depthMode === 'dateRange' ? 'Date Range' : `${activeStrategy.candleDepth} Candles`}
                onChange={event => updateActiveStrategy(strategy => updateStrategySettings(strategy, event.target.value === 'Date Range'
                  ? { depthMode: 'dateRange' }
                  : { depthMode: 'candles', candleDepth: Number(event.target.value.split(' ')[0]) }))}
              >
                <option value="300 Candles">300 Candles</option>
                <option value="7000 Candles">7000 Candles</option>
                <option value="Date Range">Date Range</option>
              </select>
              {activeStrategy.depthMode === 'dateRange' && (
                <>
                  <input className="ts-date-range-input" aria-label="Start date" value={activeStrategy.dateRange.start} onChange={event => updateActiveStrategy(strategy => updateStrategySettings(strategy, { dateRange: { ...strategy.dateRange, start: event.target.value } }))} placeholder="YYYY-MM-DD" />
                  <input className="ts-date-range-input" aria-label="End date" value={activeStrategy.dateRange.end} onChange={event => updateActiveStrategy(strategy => updateStrategySettings(strategy, { dateRange: { ...strategy.dateRange, end: event.target.value } }))} placeholder="YYYY-MM-DD" />
                </>
              )}
              <div className="ts-settings-popover-wrap">
                <button className={settingsOpen ? 'active' : ''} onClick={() => setSettingsOpen(open => !open)} type="button"><SettingOutlined /> Settings...</button>
                {settingsOpen && (
                  <div className="ts-settings-popover">
                    <label><span>Direction</span><StrategyOptionSelect label="Direction" value={activeStrategy.direction} options={['Long', 'Short']} onChange={value => updateActiveStrategy(strategy => updateStrategySettings(strategy, { direction: value }))} /></label>
                    <label><span>Trade By</span><StrategyOptionSelect label="Trade By" value={activeStrategy.tradeBy} options={['Next Open', 'Next Close', 'High', 'Low']} onChange={value => updateActiveStrategy(strategy => updateStrategySettings(strategy, { tradeBy: value }))} /></label>
                    <label><span>Trade Cost %</span><input aria-label="Trade cost percentage" value={activeStrategy.tradeCostPercent} onChange={event => updateActiveStrategy(strategy => updateStrategySettings(strategy, { tradeCostPercent: event.target.value }))} /></label>
                    <label className="ts-settings-check"><input checked={activeStrategy.extendedHours} onChange={event => updateActiveStrategy(strategy => updateStrategySettings(strategy, { extendedHours: event.target.checked }))} type="checkbox" /><span>Extended Hours</span></label>
                  </div>
                )}
              </div>
            </div>
            <div className="ts-settings-actions">
              <button className="ts-run-button" onClick={handleRun} type="button"><PlayCircleOutlined /> {runState === 'running' ? 'Running...' : 'Run'}</button>
              <button type="button" onClick={handleSave}><SaveOutlined /> Save{dirty ? '*' : ''}</button>
              <div className="ts-save-menu-wrap">
                <button className="ts-save-more-button" onClick={() => setSaveMenuOpen(open => !open)} title="More strategy actions" type="button">...</button>
                {saveMenuOpen && (
                  <div className="ts-save-action-menu">
                    <button type="button" onClick={() => { handleClone(activeStrategy); setSaveMenuOpen(false); }}>Clone Strategy</button>
                    <button disabled={!activeIsUserStrategy} type="button" onClick={() => { handleDelete(); setSaveMenuOpen(false); }}>Delete Strategy</button>
                    <button type="button" onClick={() => setSaveMenuOpen(false)}>Share Strategy</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <section className="ts-editor-scroll">
          <StrategyConditionsSection
            kind="entry"
            scripts={activeStrategy.entryScripts}
            title="Entry Conditions:"
            modeTabs={['Script', 'List of Signals']}
            onScriptChange={(scriptId, patch) => updateActiveStrategy(strategy => updateStrategyScript(strategy, 'entry', scriptId, patch))}
            onRuleChange={(scriptId, ruleId, patch) => updateActiveStrategy(strategy => updateStrategyRule(strategy, 'entry', scriptId, ruleId, patch))}
            onRuleGroupChange={(scriptId, groupId, patch) => updateActiveStrategy(strategy => updateStrategyRuleGroup(strategy, 'entry', scriptId, groupId, patch))}
            onAddRule={(scriptId, overrides) => updateActiveStrategy(strategy => addStrategyRule(strategy, 'entry', scriptId, overrides))}
            onAddRuleGroup={scriptId => updateActiveStrategy(strategy => addStrategyRuleGroup(strategy, 'entry', scriptId))}
            onRemoveRule={(scriptId, ruleId) => updateActiveStrategy(strategy => removeStrategyRule(strategy, 'entry', scriptId, ruleId))}
            onNestedRuleChange={(scriptId, groupId, ruleId, patch) => updateActiveStrategy(strategy => updateStrategyNestedRule(strategy, 'entry', scriptId, groupId, ruleId, patch))}
            onAddNestedRule={(scriptId, groupId, overrides) => updateActiveStrategy(strategy => addStrategyNestedRule(strategy, 'entry', scriptId, groupId, overrides))}
            onAddNestedRuleGroup={(scriptId, groupId) => updateActiveStrategy(strategy => addStrategyNestedRuleGroup(strategy, 'entry', scriptId, groupId))}
            onRemoveNestedRule={(scriptId, groupId, ruleId) => updateActiveStrategy(strategy => removeStrategyNestedRule(strategy, 'entry', scriptId, groupId, ruleId))}
            onAddScript={mode => updateActiveStrategy(strategy => addStrategyScript(strategy, 'entry', mode))}
            onDuplicateScript={scriptId => updateActiveStrategy(strategy => duplicateStrategyScript(strategy, 'entry', scriptId))}
            onRemoveScript={scriptId => updateActiveStrategy(strategy => removeStrategyScript(strategy, 'entry', scriptId))}
          />

          <StrategyConditionsSection
            kind="exit"
            scripts={activeStrategy.exitScripts}
            title="Exit Conditions (any can trigger):"
            modeTabs={exitModeOptions}
            onScriptChange={(scriptId, patch) => updateActiveStrategy(strategy => updateStrategyScript(strategy, 'exit', scriptId, patch))}
            onRuleChange={(scriptId, ruleId, patch) => updateActiveStrategy(strategy => updateStrategyRule(strategy, 'exit', scriptId, ruleId, patch))}
            onRuleGroupChange={(scriptId, groupId, patch) => updateActiveStrategy(strategy => updateStrategyRuleGroup(strategy, 'exit', scriptId, groupId, patch))}
            onAddRule={(scriptId, overrides) => updateActiveStrategy(strategy => addStrategyRule(strategy, 'exit', scriptId, overrides))}
            onAddRuleGroup={scriptId => updateActiveStrategy(strategy => addStrategyRuleGroup(strategy, 'exit', scriptId))}
            onRemoveRule={(scriptId, ruleId) => updateActiveStrategy(strategy => removeStrategyRule(strategy, 'exit', scriptId, ruleId))}
            onNestedRuleChange={(scriptId, groupId, ruleId, patch) => updateActiveStrategy(strategy => updateStrategyNestedRule(strategy, 'exit', scriptId, groupId, ruleId, patch))}
            onAddNestedRule={(scriptId, groupId, overrides) => updateActiveStrategy(strategy => addStrategyNestedRule(strategy, 'exit', scriptId, groupId, overrides))}
            onAddNestedRuleGroup={(scriptId, groupId) => updateActiveStrategy(strategy => addStrategyNestedRuleGroup(strategy, 'exit', scriptId, groupId))}
            onRemoveNestedRule={(scriptId, groupId, ruleId) => updateActiveStrategy(strategy => removeStrategyNestedRule(strategy, 'exit', scriptId, groupId, ruleId))}
            onAddScript={mode => updateActiveStrategy(strategy => addStrategyScript(strategy, 'exit', mode))}
            onDuplicateScript={scriptId => updateActiveStrategy(strategy => duplicateStrategyScript(strategy, 'exit', scriptId))}
            onRemoveScript={scriptId => updateActiveStrategy(strategy => removeStrategyScript(strategy, 'exit', scriptId))}
          />

          <section className={`ts-results ${resultVisible ? 'ready' : ''}`}>
            <div className="ts-results-tabs">
              {['Price Behavior Explorer', 'Performance Chart', 'Tabular Data'].map(tab => (
                <button className={resultTab === tab ? 'active' : ''} key={tab} onClick={() => setResultTab(tab)} type="button">{tab}</button>
              ))}
              <span>{resultVisible ? 'Results painted on chart while this widget is open' : 'Run the test to visualize results'}</span>
              <button type="button" onClick={() => resultVisible && downloadBacktestCsv(runResult)}><DownloadOutlined /> CSV</button>
            </div>
            <div className="ts-results-body">
              <div className="ts-metrics-strip">
                <div><span>Net Profit</span><strong>{resultVisible ? runResult.metrics.netProfit : '-'}</strong></div>
                <div><span>Win Rate</span><strong>{resultVisible ? runResult.metrics.winRate : '-'}</strong></div>
                <div><span>Max Drawdown</span><strong>{resultVisible ? runResult.metrics.maxDrawdown : '-'}</strong></div>
                <div><span>Positions</span><strong>{resultVisible ? runResult.metrics.trades : '-'}</strong></div>
              </div>
              {resultTab === 'Price Behavior Explorer' && <StrategyPbeView result={resultVisible ? runResult : null} />}
              {resultTab === 'Performance Chart' && <div className="ts-result-chart"><StrategyPerformanceChart points={resultVisible ? runResult.performance : []} /></div>}
              {resultTab === 'Tabular Data' && <StrategyTabularView trades={resultVisible ? filteredTrades : []} />}
              <div className="ts-positions-table">
                <div className="ts-trade-filter">
                  {['All', 'Win', 'Loss'].map(filter => (
                    <button className={tradeFilter === filter ? 'active' : ''} key={filter} onClick={() => setTradeFilter(filter)} type="button">{filter}</button>
                  ))}
                </div>
                {filteredTrades.slice(0, 6).map(trade => (
                  <button className={trade.status.toLowerCase()} key={trade.id} type="button">
                    <span>{trade.entryTime}</span>
                    <span>{trade.exitTime}</span>
                    <strong>{resultVisible ? trade.result : '-'}</strong>
                  </button>
                ))}
                {!filteredTrades.length && <span className="ts-empty-result">{resultVisible ? 'No positions match this filter' : 'No run yet'}</span>}
              </div>
            </div>
            </section>
          </section>
        </section>
      </main>
    </div>
  );
};

const AlertsPanel = () => (
  <div className="dock-content alerts-layout">
    <div className="alert-grid">
      {alertRows.map(row => (
        <div className="alert-row" key={row.name}>
          <BellOutlined />
          <strong>{row.name}</strong>
          <span>{row.type}</span>
          <span>{row.target}</span>
          <em>{row.status}</em>
        </div>
      ))}
    </div>
    <div className="automation-strip">
      <button type="button"><CaretRightOutlined /> Arm Selected</button>
      <button type="button"><PauseOutlined /> Pause All</button>
      <button type="button"><SettingOutlined /> Bot Settings</button>
    </div>
  </div>
);

const HappeningPanel = () => (
  <div className="dock-content happening-layout">
    <div className="happening-grid">
      {happeningRows.map(row => (
        <div className={`happening-row ${row.tone}`} key={row.title}>
          <strong>{row.time}</strong>
          <span>{row.title}</span>
          <em>{row.source}</em>
        </div>
      ))}
    </div>
  </div>
);

const TimingPanel = () => {
  const { currentSymbol, currentName, period } = useChartStore();
  const activeTimingRows = getTimingRows(currentSymbol);

  return (
    <div className="dock-content timing-grid">
      <div className="timing-card current-symbol">
        <span>Current Symbol</span>
        <strong>{currentSymbol ? `${currentSymbol} ${currentName}` : 'No symbol selected'}</strong>
        <p>{period.toUpperCase()} · Multi-timeframe timing model</p>
        <div className="timing-meter">
          <i style={{ width: currentSymbol ? '78%' : '18%' }} />
        </div>
      </div>
      {activeTimingRows.map(row => (
        <div className="timing-card" key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          <p>{row.detail}</p>
          <div className="timing-meter">
            <i style={{ width: `${row.score}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const renderPanel = ({ activeTab, runState, runResult, onRun, onClearRun, strategyMaximized, onStrategyMaximized }) => {
  if (activeTab === 'Strategy Tester') {
    return (
      <StrategyPanel
        runState={runState}
        runResult={runResult}
        onRun={onRun}
        onClearRun={onClearRun}
        maximized={strategyMaximized}
        onToggleMaximized={onStrategyMaximized}
      />
    );
  }
  if (activeTab === 'Alerts & Bots') return <AlertsPanel />;
  if (activeTab === "What's Happening Now") return <HappeningPanel />;
  if (activeTab === 'Timing') return <TimingPanel />;
  return <ScannerPanel />;
};

const BottomSignalDock = ({ activeTab: controlledTab, onTabChange, onStrategyRunStateChange }) => {
  const [internalTab, setInternalTab] = useState('Market Scanner');
  const [open, setOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_DOCK_HEIGHT);
  const [resizing, setResizing] = useState(false);
  const [configMode, setConfigMode] = useState(null);
  const [runState, setRunState] = useState('idle');
  const [runResult, setRunResult] = useState(null);
  const [strategyMaximized, setStrategyMaximized] = useState(false);
  const resizeStartRef = useRef({ y: 0, height: DEFAULT_DOCK_HEIGHT });
  const activeTab = controlledTab || internalTab;

  useEffect(() => {
    if (!resizing) return undefined;

    const handlePointerMove = (event) => {
      const maxHeight = Math.max(240, Math.min(window.innerHeight - 150, 620));
      const nextHeight = resizeStartRef.current.height + (resizeStartRef.current.y - event.clientY);
      setPanelHeight(Math.min(maxHeight, Math.max(180, nextHeight)));
    };

    const handlePointerUp = () => setResizing(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    document.body.classList.add('resizing-bottom-dock');

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.classList.remove('resizing-bottom-dock');
    };
  }, [resizing]);

  const handleTabChange = (tab) => {
    if (open && activeTab === tab) {
      setOpen(false);
      setConfigMode(null);
      return;
    }
    setInternalTab(tab);
    setOpen(true);
    setPanelHeight(DEFAULT_DOCK_HEIGHT);
    setConfigMode(null);
    onTabChange?.(tab);
  };

  const handleRun = (nextResult = null) => {
    setRunState('running');
    setRunResult(null);
    onStrategyRunStateChange?.('running', null);
    window.setTimeout(() => {
      setRunState('done');
      setRunResult(nextResult);
      onStrategyRunStateChange?.('done', nextResult);
    }, 450);
  };

  const handleClearRun = () => {
    setRunState('idle');
    setRunResult(null);
    onStrategyRunStateChange?.('idle', null);
  };

  const handleResizeStart = (event) => {
    event.preventDefault();
    resizeStartRef.current = { y: event.clientY, height: panelHeight };
    setResizing(true);
  };

  const handleStrategyMaximized = () => {
    const nextMaximized = !strategyMaximized;
    setStrategyMaximized(nextMaximized);
    setPanelHeight(nextMaximized ? Math.max(SCANNER_DOCK_HEIGHT, window.innerHeight - 160) : SCANNER_DOCK_HEIGHT);
  };

  return (
    <section
      className={`bottom-signal-dock ${open ? 'open' : 'collapsed'} ${activeTab === 'Market Scanner' ? 'scanner-mode' : ''} ${activeTab === 'Strategy Tester' ? 'strategy-mode' : ''} ${strategyMaximized && activeTab === 'Strategy Tester' ? 'strategy-maximized' : ''} ${resizing ? 'resizing' : ''} ${configMode ? 'has-config' : ''}`}
      style={open ? { '--dock-height': `${panelHeight}px` } : undefined}
    >
      {open && (
        <button
          aria-label="Resize bottom panel"
          className="dock-resize-handle"
          onPointerDown={handleResizeStart}
          type="button"
        />
      )}
      <div className="dock-tabs-bar">
        {tabs.map(tab => (
          <button
            key={tab}
            className={open && activeTab === tab ? 'active' : ''}
            onClick={() => handleTabChange(tab)}
            type="button"
          >
            {tabLabels[tab] || tab}
          </button>
        ))}
      </div>

      {open && (
        <>
          {activeTab !== 'Market Scanner' && activeTab !== 'Strategy Tester' && (
            <div className="dock-panel-header">
              <span>
                <strong>{tabLabels[activeTab] || activeTab}</strong>
                <em>{actionLabels[activeTab]}</em>
              </span>
              <div>
                <button type="button" aria-label="Close bottom panel" onClick={() => { setOpen(false); setConfigMode(null); }}>
                  <CloseOutlined />
                </button>
              </div>
            </div>
          )}
          {activeTab !== 'Market Scanner' && activeTab !== 'Strategy Tester' && (
            <DockActionBar
              activeTab={activeTab}
              configMode={configMode}
              runState={runState}
              onConfigMode={setConfigMode}
              onRun={handleRun}
            />
          )}
          {renderPanel({
            activeTab,
            runState,
            runResult,
            onRun: handleRun,
            onClearRun: handleClearRun,
            strategyMaximized,
            onStrategyMaximized: handleStrategyMaximized
          })}
        </>
      )}
    </section>
  );
};

export default BottomSignalDock;

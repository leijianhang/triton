# Trading Terminal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current trading app into a chart-first terminal with left tools, right watchlist/alerts, and bottom scanner/timing/strategy panels.

**Architecture:** Keep the existing Zustand store, data services, search flow, and `KlineChart` component. Add focused presentational components for the terminal chrome so `App.jsx` coordinates data loading and layout without owning every panel's markup.

**Tech Stack:** React 18, Vite, Ant Design, Zustand, lightweight-charts, CSS modules via plain component CSS.

---

## File Structure

- Create `frontend/src/components/TerminalTopBar.jsx`: top product/symbol controls and status chips.
- Create `frontend/src/components/TerminalTopBar.css`: top bar styling.
- Create `frontend/src/components/ToolRail.jsx`: compact left analysis tool rail.
- Create `frontend/src/components/ToolRail.css`: tool rail styling.
- Create `frontend/src/components/RightInsightRail.jsx`: watchlist and alerts panel.
- Create `frontend/src/components/RightInsightRail.css`: right rail styling.
- Create `frontend/src/components/BottomSignalDock.jsx`: scanner, timing, and strategy result dock.
- Create `frontend/src/components/BottomSignalDock.css`: bottom dock styling.
- Modify `frontend/src/App.jsx`: replace the Ant Design layout shell with the terminal layout, keep data loading intact.
- Modify `frontend/src/App.css`: global app layout, responsive grid, and dark terminal theme overrides.

## Tasks

### Task 1: Add Terminal Top Bar

**Files:**
- Create: `frontend/src/components/TerminalTopBar.jsx`
- Create: `frontend/src/components/TerminalTopBar.css`

- [ ] **Step 1: Create the top bar component**

```jsx
import React from 'react';
import './TerminalTopBar.css';

const TerminalTopBar = ({ currentSymbol, currentName, currentType, period }) => {
  const displaySymbol = currentSymbol ? `${currentSymbol} ${currentName || ''}`.trim() : '未选择品种';
  const typeLabel = currentType === 'us' ? 'US' : currentType === 'hk' ? 'HK' : 'A股';

  return (
    <header className="terminal-topbar">
      <div className="topbar-brand">
        <span className="brand-mark">SF</span>
        <div>
          <div className="brand-name">SignalForge</div>
          <div className="brand-subtitle">智能交易分析终端</div>
        </div>
      </div>

      <div className="topbar-symbol">
        <span className="symbol-primary">{displaySymbol}</span>
        <span className="status-chip">{typeLabel}</span>
        <span className="status-chip">{period}</span>
      </div>

      <nav className="topbar-actions" aria-label="终端功能">
        <button>自动趋势线</button>
        <button>指标</button>
        <button>扫描器</button>
        <button>提醒</button>
      </nav>
    </header>
  );
};

export default TerminalTopBar;
```

- [ ] **Step 2: Add top bar styles**

```css
.terminal-topbar {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 16px;
  background: #111821;
  border-bottom: 1px solid #263442;
}

.topbar-brand,
.topbar-symbol,
.topbar-actions {
  display: flex;
  align-items: center;
}

.topbar-brand {
  gap: 10px;
  min-width: 240px;
}

.brand-mark {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: #1c3a2c;
  color: #4ee093;
  font-size: 12px;
  font-weight: 800;
}

.brand-name {
  color: #eef4f8;
  font-weight: 800;
  line-height: 1.1;
}

.brand-subtitle {
  margin-top: 2px;
  color: #7f8b98;
  font-size: 11px;
}

.topbar-symbol {
  flex: 1;
  gap: 8px;
  min-width: 0;
}

.symbol-primary {
  color: #eef4f8;
  font-weight: 700;
  white-space: nowrap;
}

.status-chip {
  padding: 4px 8px;
  border: 1px solid #2d3d4c;
  border-radius: 5px;
  background: #17222d;
  color: #b6c1cc;
  font-size: 12px;
}

.topbar-actions {
  gap: 8px;
}

.topbar-actions button {
  height: 30px;
  padding: 0 10px;
  border: 1px solid #2d3d4c;
  border-radius: 5px;
  background: #151f29;
  color: #c8d2dc;
  cursor: pointer;
}

.topbar-actions button:hover {
  border-color: #2dbf78;
  color: #eafff5;
}
```

- [ ] **Step 3: Build check**

Run: `npm run build` from `frontend`.

Expected: build succeeds.

### Task 2: Add Left Tool Rail

**Files:**
- Create: `frontend/src/components/ToolRail.jsx`
- Create: `frontend/src/components/ToolRail.css`

- [ ] **Step 1: Create the tool rail component**

```jsx
import React from 'react';
import {
  AimOutlined,
  LineChartOutlined,
  FundProjectionScreenOutlined,
  BellOutlined,
  SettingOutlined
} from '@ant-design/icons';
import './ToolRail.css';

const tools = [
  { label: '十字光标', icon: <AimOutlined />, active: true },
  { label: '趋势线', icon: <LineChartOutlined /> },
  { label: '形态识别', icon: <FundProjectionScreenOutlined /> },
  { label: '提醒', icon: <BellOutlined /> },
  { label: '设置', icon: <SettingOutlined /> }
];

const ToolRail = () => (
  <aside className="tool-rail" aria-label="图表工具栏">
    {tools.map(tool => (
      <button
        key={tool.label}
        className={tool.active ? 'tool-button active' : 'tool-button'}
        title={tool.label}
        aria-label={tool.label}
      >
        {tool.icon}
      </button>
    ))}
  </aside>
);

export default ToolRail;
```

- [ ] **Step 2: Add tool rail styles**

```css
.tool-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding: 10px 7px;
  background: #0f171f;
  border-right: 1px solid #263442;
}

.tool-button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid #253542;
  border-radius: 6px;
  background: #151f29;
  color: #8d9aa7;
  cursor: pointer;
}

.tool-button:hover,
.tool-button.active {
  border-color: #2dbf78;
  background: #173426;
  color: #4ee093;
}
```

- [ ] **Step 3: Build check**

Run: `npm run build` from `frontend`.

Expected: build succeeds.

### Task 3: Add Right Insight Rail

**Files:**
- Create: `frontend/src/components/RightInsightRail.jsx`
- Create: `frontend/src/components/RightInsightRail.css`

- [ ] **Step 1: Create right rail component**

```jsx
import React from 'react';
import './RightInsightRail.css';

const watchlist = [
  { symbol: '600519', name: '贵州茅台', change: '+2.18%', tone: 'up' },
  { symbol: '000858', name: '五粮液', change: '+0.74%', tone: 'up' },
  { symbol: '600036', name: '招商银行', change: '-0.42%', tone: 'down' },
  { symbol: 'CU2406', name: '沪铜', change: '+1.06%', tone: 'up' }
];

const alerts = [
  { title: '突破趋势线', status: '已触发', tone: 'up' },
  { title: 'RSI 回到强势区', status: '等待', tone: 'neutral' },
  { title: '跌破止损位', status: '未触发', tone: 'down' }
];

const RightInsightRail = () => (
  <aside className="right-insight-rail">
    <section className="rail-section">
      <div className="rail-title">Watchlist</div>
      <div className="rail-list">
        {watchlist.map(item => (
          <div className={`insight-row ${item.tone}`} key={item.symbol}>
            <div>
              <strong>{item.symbol}</strong>
              <span>{item.name}</span>
            </div>
            <em>{item.change}</em>
          </div>
        ))}
      </div>
    </section>

    <section className="rail-section">
      <div className="rail-title">Alerts</div>
      <div className="rail-list">
        {alerts.map(item => (
          <div className={`insight-row ${item.tone}`} key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  </aside>
);

export default RightInsightRail;
```

- [ ] **Step 2: Add right rail styles**

```css
.right-insight-rail {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
  padding: 12px;
  background: #0f171f;
  border-left: 1px solid #263442;
}

.rail-section {
  min-height: 0;
  overflow: hidden;
}

.rail-title {
  margin-bottom: 9px;
  color: #7f8b98;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.rail-list {
  display: grid;
  gap: 7px;
}

.insight-row {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 9px;
  border: 1px solid #263542;
  border-radius: 6px;
  background: #141e27;
}

.insight-row strong {
  display: block;
  color: #dfe7ee;
  font-size: 12px;
}

.insight-row span {
  display: block;
  margin-top: 3px;
  color: #83919e;
  font-size: 11px;
}

.insight-row em {
  color: #cbd5df;
  font-style: normal;
  font-size: 12px;
  font-weight: 700;
}

.insight-row.up {
  border-color: #26734f;
  background: #13261e;
}

.insight-row.up em {
  color: #4ee093;
}

.insight-row.down {
  border-color: #743438;
  background: #28181c;
}

.insight-row.down em {
  color: #ff7474;
}
```

- [ ] **Step 3: Build check**

Run: `npm run build` from `frontend`.

Expected: build succeeds.

### Task 4: Add Bottom Signal Dock

**Files:**
- Create: `frontend/src/components/BottomSignalDock.jsx`
- Create: `frontend/src/components/BottomSignalDock.css`

- [ ] **Step 1: Create bottom dock component**

```jsx
import React from 'react';
import './BottomSignalDock.css';

const scannerRows = [
  { symbol: '600519', setup: '趋势线突破 + 放量', signal: '买入候选', score: 92 },
  { symbol: '000858', setup: '均线多头排列', signal: '观察', score: 84 },
  { symbol: 'IF2405', setup: '回踩支撑区', signal: '等待', score: 76 },
  { symbol: 'AU2406', setup: '波动率扩张', signal: '关注', score: 71 }
];

const BottomSignalDock = () => (
  <section className="bottom-signal-dock">
    <div className="dock-panel scanner-panel">
      <div className="dock-tabs">
        <span className="active">扫描器</span>
        <span>自选池</span>
        <span>条件模板</span>
      </div>
      <div className="scanner-table">
        {scannerRows.map(row => (
          <div className="scanner-row" key={row.symbol}>
            <strong>{row.symbol}</strong>
            <span>{row.setup}</span>
            <em>{row.signal}</em>
            <b>{row.score}</b>
          </div>
        ))}
      </div>
    </div>

    <div className="dock-panel">
      <div className="dock-tabs">
        <span className="active">择时信号</span>
        <span>多周期</span>
      </div>
      <div className="timing-row good"><span>日线趋势</span><strong>强势</strong></div>
      <div className="timing-row good"><span>60分动量</span><strong>转强</strong></div>
      <div className="timing-row"><span>15分回踩</span><strong>等待确认</strong></div>
      <div className="score-bar"><span style={{ width: '82%' }} /></div>
    </div>

    <div className="dock-panel">
      <div className="dock-tabs">
        <span className="active">策略结果</span>
        <span>提醒机器人</span>
      </div>
      <div className="timing-row good"><span>趋势突破策略</span><strong>通过</strong></div>
      <div className="timing-row"><span>风险收益比</span><strong>2.4 : 1</strong></div>
      <div className="timing-row bad"><span>财报窗口</span><strong>需注意</strong></div>
      <div className="score-bar"><span style={{ width: '68%' }} /></div>
    </div>
  </section>
);

export default BottomSignalDock;
```

- [ ] **Step 2: Add bottom dock styles**

```css
.bottom-signal-dock {
  display: grid;
  grid-template-columns: 1.25fr .9fr .9fr;
  min-height: 176px;
  border-top: 1px solid #263442;
  background: #101820;
}

.dock-panel {
  min-width: 0;
  padding: 12px 14px;
  border-right: 1px solid #263442;
  overflow: hidden;
}

.dock-panel:last-child {
  border-right: 0;
}

.dock-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.dock-tabs span {
  padding: 5px 9px;
  border-radius: 5px;
  background: #17222d;
  color: #aeb9c4;
  font-size: 12px;
}

.dock-tabs .active {
  border: 1px solid #2dbf78;
  background: #173426;
  color: #eafff5;
}

.scanner-table {
  display: grid;
  gap: 6px;
}

.scanner-row {
  min-height: 28px;
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 76px 40px;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border-radius: 5px;
  background: #121b24;
  color: #cdd7e1;
  font-size: 12px;
}

.scanner-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scanner-row em {
  justify-self: start;
  padding: 3px 7px;
  border-radius: 999px;
  background: #173426;
  color: #55d895;
  font-style: normal;
  font-size: 11px;
}

.scanner-row b {
  color: #e2a044;
}

.timing-row {
  min-height: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
  padding: 0 9px;
  border: 1px solid #263542;
  border-radius: 6px;
  background: #141e27;
  color: #cdd7e1;
  font-size: 12px;
}

.timing-row.good {
  border-color: #26734f;
  background: #13261e;
}

.timing-row.bad {
  border-color: #743438;
  background: #28181c;
}

.score-bar {
  height: 8px;
  margin-top: 10px;
  border-radius: 999px;
  background: #26323d;
  overflow: hidden;
}

.score-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #e2a044, #2dbf78);
}
```

- [ ] **Step 3: Build check**

Run: `npm run build` from `frontend`.

Expected: build succeeds.

### Task 5: Integrate Terminal Shell

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Replace `App.jsx` shell**

```jsx
import React, { useEffect } from 'react';
import { Spin, message } from 'antd';
import SearchPanel from './components/SearchPanel';
import Toolbar from './components/Toolbar';
import KlineChart from './components/KlineChart';
import IndicatorPanel from './components/IndicatorPanel';
import TerminalTopBar from './components/TerminalTopBar';
import ToolRail from './components/ToolRail';
import RightInsightRail from './components/RightInsightRail';
import BottomSignalDock from './components/BottomSignalDock';
import { useChartStore } from './store/chartStore';
import { marketAPI } from './services/api';
import './App.css';

function App() {
  const {
    currentSymbol,
    currentName,
    currentType,
    period,
    adjust,
    klineData,
    indicators,
    loading,
    setKlineData,
    setLoading,
    setError
  } = useChartStore();

  useEffect(() => {
    if (!currentSymbol) return;

    const loadKlineData = async () => {
      setLoading(true);
      try {
        const response = await marketAPI.getKline(currentType, currentSymbol, period, { adjust });

        if (response.success) {
          setKlineData(response.data);
        } else {
          message.error('加载行情数据失败');
        }
      } catch (error) {
        console.error('加载K线数据失败:', error);
        message.error('加载行情数据失败，请检查网络连接');
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadKlineData();
  }, [currentSymbol, period, adjust, currentType, setError, setKlineData, setLoading]);

  return (
    <div className="terminal-app">
      <TerminalTopBar
        currentSymbol={currentSymbol}
        currentName={currentName}
        currentType={currentType}
        period={period}
      />

      <div className="terminal-body">
        <ToolRail />

        <main className="terminal-main">
          <div className="terminal-chart-toolbar">
            <SearchPanel />
            <Toolbar />
          </div>

          <section className="terminal-chart-area">
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
              </div>
            ) : currentSymbol && klineData.length > 0 ? (
              <KlineChart data={klineData} indicators={indicators} />
            ) : (
              <div className="empty-container">
                <p>Please search and select an A-share, US stock, or Hong Kong stock symbol.</p>
              </div>
            )}
          </section>

          <BottomSignalDock />
        </main>

        <RightInsightRail />

        <aside className="terminal-indicators">
          <IndicatorPanel />
        </aside>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Replace `App.css` layout styles**

```css
.terminal-app {
  height: 100vh;
  min-width: 0;
  overflow: hidden;
  background: #080b0f;
  color: #eef4f8;
}

.terminal-body {
  height: calc(100vh - 52px);
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 260px 260px;
  min-width: 0;
}

.terminal-main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
  background: #080b0f;
}

.terminal-chart-toolbar {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  border-bottom: 1px solid #263442;
  background: #101820;
}

.terminal-chart-toolbar .search-panel {
  border-right: 1px solid #263442;
}

.terminal-chart-area {
  position: relative;
  min-height: 0;
  background: #080b0f;
}

.terminal-indicators {
  min-width: 0;
  overflow-y: auto;
  background: #0f171f;
  border-left: 1px solid #263442;
}

.loading-container,
.empty-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-container {
  color: #7f8b98;
  font-size: 15px;
}

.ant-input,
.ant-input-number,
.ant-select-selector {
  background: #151f29 !important;
  border-color: #2d3d4c !important;
  color: #d9e2ea !important;
}

.ant-input::placeholder {
  color: #7f8b98;
}

.ant-radio-button-wrapper {
  background: #151f29;
  border-color: #2d3d4c;
  color: #aeb9c4;
}

.ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) {
  border-color: #2dbf78;
  color: #eafff5;
  background: #173426;
}

.ant-checkbox-wrapper,
.ant-input-number-input {
  color: #d9e2ea;
}

.ant-divider {
  border-color: #263442;
}

@media (max-width: 1180px) {
  .terminal-body {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .right-insight-rail,
  .terminal-indicators {
    display: none;
  }
}

@media (max-width: 760px) {
  .terminal-chart-toolbar {
    grid-template-columns: 1fr;
  }

  .bottom-signal-dock {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
}
```

- [ ] **Step 3: Build check**

Run: `npm run build` from `frontend`.

Expected: build succeeds.

### Task 6: Browser Verification

**Files:**
- No source changes unless verification reveals a bug.

- [ ] **Step 1: Open the running app**

Run: `npx --yes --package @playwright/cli playwright-cli open http://localhost:3000`

Expected: browser opens the app.

- [ ] **Step 2: Verify initial UI**

Run: `npx --yes --package @playwright/cli playwright-cli snapshot`

Expected snapshot includes `SignalForge`, `扫描器`, `择时信号`, `策略结果`, and `未选择品种`.

- [ ] **Step 3: Verify search and chart load**

Run: `npx --yes --package @playwright/cli playwright-cli fill <search-ref> 600519`, then snapshot, then click the `贵州茅台` list item.

Expected: chart area renders TradingView lightweight chart table, top bar shows `600519 贵州茅台`, and no chart crash appears.

- [ ] **Step 4: Final build**

Run: `npm run build` from `frontend`.

Expected: build succeeds. Chunk size warnings are acceptable for this pass.

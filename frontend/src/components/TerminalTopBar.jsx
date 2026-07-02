import React, { useState } from 'react';
import { Dropdown } from 'antd';
import {
  LogoutOutlined,
  SettingOutlined
} from '@ant-design/icons';
import SearchPanel from './SearchPanel';
import { getWorkspaceLayout, workspaceLayoutOptions } from './workspaceLayoutOptions';
import './TerminalTopBar.css';

const featureButtons = [
  { key: 'Auto Fib', label: '自动斐波那契' },
  { key: 'Trends', label: '趋势' },
  { key: 'Indicators', label: '指标' },
  { key: 'Patterns', label: 'Candle Patterns' },
  { key: 'Chart Patterns', label: 'Chart Patterns' },
  { key: 'Heatmap', label: '热力图' },
  { key: 'Replay', label: '回放' }
];

const TopbarMoreIcon = () => (
  <span className="topbar-more-vertical" aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

const TerminalTopBar = ({
  currentSymbol,
  currentName,
  workspaceLayout,
  activeFeature,
  autoFibActive = false,
  heatmapActive = false,
  replayActive = false,
  trendsActive = false,
  indicatorsActive,
  patternsActive,
  chartPatternsActive,
  onLayoutChange,
  onAutoFibToggle,
  onChartPatternMenuOpen,
  onChartPatternToggle,
  onHeatmapMenuOpen,
  onHeatmapToggle,
  onReplayToggle,
  onIndicatorMenuOpen,
  onIndicatorToggle,
  onPatternMenuOpen,
  onPatternToggle,
  onTrendMenuOpen,
  onTrendToggle,
  onFeatureSelect,
  themePreference = 'night',
  resolvedTheme = 'night',
  onThemePreferenceChange,
  onLogout,
  currentUser
}) => {
  const [activeSettingsMenu, setActiveSettingsMenu] = useState(null);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const displaySymbol = currentSymbol ? `${currentSymbol} ${currentName || ''}`.trim() : '搜索标的';
  const activeLayout = getWorkspaceLayout(workspaceLayout);

  const layoutOverlay = (
    <div className="workspace-layout-menu">
      <div className="workspace-layout-grid">
        {workspaceLayoutOptions.map(item => (
          <button
            className={activeLayout.value === item.value ? 'active' : ''}
            key={item.value}
            onClick={() => {
              onLayoutChange?.(item.value);
              setLayoutMenuOpen(false);
            }}
            type="button"
          >
            <span className={`layout-icon ${item.className}`}>
              {Array.from({ length: item.panes }).map((_, index) => <i key={index} />)}
            </span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>
    </div>
  );

  const themeOptions = [
    { value: 'night', label: '夜间', detail: '深色交易工作区' },
    { value: 'day', label: '日间', detail: '浅色交易工作区' },
    { value: 'auto', label: '自动', detail: '07:00-18:59 使用日间模式' }
  ];

  const settingsOverlay = (
    <div className="topbar-settings-menu">
      <div className="topbar-settings-title">
        <strong>设置</strong>
        <span>{resolvedTheme === 'day' ? '日间模式' : '夜间模式'}</span>
      </div>
      <div className="settings-hover-shell" onMouseLeave={() => setActiveSettingsMenu(null)}>
        <div className="settings-menu-list">
          <button
            className={activeSettingsMenu === 'theme' ? 'active' : ''}
            onFocus={() => setActiveSettingsMenu('theme')}
            onMouseEnter={() => setActiveSettingsMenu('theme')}
            type="button"
          >
            <strong>主题设置</strong>
            <span>夜间、日间、自动</span>
          </button>
          <button
            className={activeSettingsMenu === 'account' ? 'active' : ''}
            onFocus={() => setActiveSettingsMenu('account')}
            onMouseEnter={() => setActiveSettingsMenu('account')}
            type="button"
          >
            <strong>账户</strong>
            <span>退出当前登录</span>
          </button>
        </div>
        {activeSettingsMenu === 'theme' ? (
          <div className="settings-submenu-panel">
            <div className="theme-option-list">
              {themeOptions.map(option => (
                <button
                  className={themePreference === option.value ? 'active' : ''}
                  key={option.value}
                  onClick={() => onThemePreferenceChange?.(option.value)}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {activeSettingsMenu === 'account' ? (
          <div className="settings-submenu-panel account-submenu-panel">
            <div className="account-current-user">
              <span>当前用户</span>
              <strong>{currentUser?.account || currentUser?.username || '未登录'}</strong>
            </div>
            <button className="topbar-logout-button" onClick={() => onLogout?.()} type="button">
              <LogoutOutlined />
              <span>退出登录</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <header className="terminal-topbar">
      <div className="topbar-brand">
        <span className="brand-mark">T</span>
        <span className="brand-name">Triton</span>
      </div>

      <div className="topbar-search">
        <SearchPanel compact placeholder={displaySymbol} />
      </div>

      <nav className="topbar-feature-strip" aria-label="分析功能">
        <Dropdown
          align={{ offset: [0, -26] }}
          onOpenChange={setLayoutMenuOpen}
          open={layoutMenuOpen}
          overlayClassName="workspace-layout-dropdown"
          placement="bottomLeft"
          popupRender={() => layoutOverlay}
          trigger={['click']}
        >
          <button
            className="layout-button"
            title="Workspace Layout"
            type="button"
          >
            <span className={`layout-icon topbar-layout-icon ${activeLayout.className}`}>
              {Array.from({ length: activeLayout.panes }).map((_, index) => <i key={index} />)}
            </span>
            <span className="layout-dropdown-caret" aria-hidden="true" />
          </button>
        </Dropdown>
        {featureButtons.map(item => (
          item.key === 'Auto Fib' ? (
            <button
              key={item.key}
              className={autoFibActive ? 'active' : ''}
              title={item.label}
              onClick={() => onAutoFibToggle?.()}
              type="button"
            >
              <span>{item.label}</span>
            </button>
          ) : item.key === 'Trends' ? (
            <span className="split-topbar-control" key={item.key}>
              <button
                className={trendsActive ? 'active split-main-button' : 'split-main-button'}
                title={item.label}
                onClick={() => onTrendToggle?.()}
                type="button"
              >
                <span>{item.label}</span>
              </button>
              <button
                className="split-more-topbar-button"
                title="配置自动趋势线"
                onClick={() => onTrendMenuOpen?.()}
                type="button"
              >
                <TopbarMoreIcon />
              </button>
            </span>
          ) : item.key === 'Replay' ? (
            <button
              key={item.key}
              className={replayActive ? 'active' : ''}
              title="Bar Replay"
              onClick={() => onReplayToggle?.()}
              type="button"
            >
              <span>{item.label}</span>
            </button>
          ) : item.key === 'Indicators' || item.key === 'Patterns' || item.key === 'Chart Patterns' || item.key === 'Heatmap' ? (
            <span className="split-topbar-control" key={item.key}>
              <button
                className={
                  item.key === 'Indicators'
                    ? (indicatorsActive ? 'active split-main-button' : 'split-main-button')
                    : item.key === 'Chart Patterns'
                      ? (chartPatternsActive ? 'active split-main-button' : 'split-main-button')
                      : item.key === 'Heatmap'
                        ? (heatmapActive ? 'active split-main-button' : 'split-main-button')
                        : (patternsActive ? 'active split-main-button' : 'split-main-button')
                }
                title={item.label}
                onClick={() => {
                  if (item.key === 'Indicators') onIndicatorToggle?.();
                  else if (item.key === 'Chart Patterns') onChartPatternToggle?.();
                  else if (item.key === 'Heatmap') onHeatmapToggle?.();
                  else onPatternToggle?.();
                }}
                type="button"
              >
                <span>{item.label}</span>
              </button>
              {item.key === 'Indicators' ? (
                <button
                  className="split-more-topbar-button"
                  title="添加、配置或删除指标"
                  onClick={() => onIndicatorMenuOpen?.()}
                  type="button"
                >
                  <TopbarMoreIcon />
                </button>
              ) : item.key === 'Chart Patterns' ? (
                <button
                  className="split-more-topbar-button"
                  title="选择并应用 Chart Patterns"
                  onClick={() => onChartPatternMenuOpen?.()}
                  type="button"
                >
                  <TopbarMoreIcon />
                </button>
              ) : item.key === 'Heatmap' ? (
                <button
                  className="split-more-topbar-button"
                  title="Heatmap Settings"
                  onClick={() => onHeatmapMenuOpen?.()}
                  type="button"
                >
                  <TopbarMoreIcon />
                </button>
              ) : (
                <button
                  className="split-more-topbar-button"
                  title="选择并应用 Candle Patterns"
                  onClick={() => onPatternMenuOpen?.()}
                  type="button"
                >
                  <TopbarMoreIcon />
                </button>
              )}
            </span>
          ) : (
            <button
              key={item.key}
              className={activeFeature === item.key ? 'active' : ''}
              title={item.label}
              onClick={() => onFeatureSelect?.(item.key)}
              type="button"
            >
              <span>{item.label}</span>
            </button>
          )
        ))}
      </nav>
      <Dropdown
        overlayClassName="topbar-settings-dropdown"
        placement="bottomRight"
        popupRender={() => settingsOverlay}
        onOpenChange={open => {
          if (!open) setActiveSettingsMenu(null);
        }}
        trigger={['click']}
      >
        <button className="topbar-settings-button" title="显示设置" type="button">
          <SettingOutlined />
        </button>
      </Dropdown>
    </header>
  );
};

export default TerminalTopBar;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'antd';
import {
  BellOutlined,
  DownOutlined,
  LineChartOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  SortAscendingOutlined,
  StarFilled,
  ThunderboltOutlined
} from '@ant-design/icons';
import { getFallbackMarketSymbols, loadLiveMarketSymbols } from '../data/liveMarketData';
import { getWatchlistCsv, getWatchlistRowsFromGroups } from '../data/watchlistModel';
import { useChartStore } from '../store/chartStore';
import './RightInsightRail.css';

const columnOptions = [
  { key: 'lastColored', label: '最新价/颜色', shortLabel: '最新' },
  { key: 'change', label: '涨跌幅', shortLabel: '涨跌%' },
  { key: 'changeAbs', label: '涨跌额', shortLabel: '涨跌额' },
  { key: 'week52Range', label: '52周区间', shortLabel: '52周' },
  { key: 'vs52High', label: '距52周高点涨跌幅', shortLabel: '52高%' },
  { key: 'vs52Low', label: '距52周低点涨跌幅', shortLabel: '52低%' }
];

const columnTracks = {
  lastColored: '50px',
  change: '48px',
  changeAbs: '42px',
  week52Range: '58px',
  vs52High: '54px',
  vs52Low: '54px'
};

const colorOrder = {
  red: 1,
  orange: 2,
  yellow: 3,
  green: 4,
  blue: 5,
  purple: 6
};

const colorOptions = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

const widgets = [
  { icon: <ThunderboltOutlined />, title: '市场脉搏', value: '6 个标的触发扫描条件', meta: '15分钟趋势 + 成交量，2 个新形态', tone: 'up' },
  { icon: <BellOutlined />, title: '提醒', value: '3 个活跃提醒接近触发', meta: '600519, AAPL, 0700.HK', tone: 'neutral' },
  { icon: <LineChartOutlined />, title: '择时', value: '自选列表 62% 位于 MA20 上方', meta: '市场宽度偏建设性', tone: 'up' }
];

const news = [
  { time: '10:21', text: '扫描器发现新的趋势延续形态。' },
  { time: '10:09', text: '美股与港股核心标的动能改善。' },
  { time: '09:58', text: '大盘股自选列表仍位于短期支撑上方。' }
];

const getSortValue = (row, key) => {
  if (key === 'symbol') return row.symbol;
  if (key === 'lastColored') return Number(row.last);
  if (key === 'change') return parseFloat(row.change);
  if (key === 'changeAbs') return getChangeAbs(row);
  if (key === 'week52Range') return getWeek52Range(row).position;
  if (key === 'vs52High') return getWeek52Range(row).vsHigh;
  if (key === 'vs52Low') return getWeek52Range(row).vsLow;
  return '';
};

const getChangeAbs = row => {
  const last = Number(row.last);
  const changePct = parseFloat(row.change);
  if (!Number.isFinite(last) || !Number.isFinite(changePct)) return 0;
  return (last * changePct) / 100;
};

const formatCellValue = (row, key) => {
  if (key === 'lastColored') return row.last;
  if (key === 'change') return row.change;
  if (key === 'changeAbs') {
    const value = getChangeAbs(row);
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}`;
  }
  if (key === 'vs52High') return `${getWeek52Range(row).vsHigh.toFixed(1)}%`;
  if (key === 'vs52Low') return `+${getWeek52Range(row).vsLow.toFixed(1)}%`;
  return row[key];
};

const getWeek52Range = row => {
  const last = Number(row.last);
  const score = Number(row.score) || 70;
  const highSpread = row.type === 'us' || row.type === 'hk' ? 0.08 : 0.06;
  const lowSpread = row.type === 'us' || row.type === 'hk' ? 0.18 : 0.16;
  const high = last * (1 + highSpread + (100 - score) / 1200);
  const low = last * (1 - lowSpread - (100 - score) / 1500);
  const position = Math.max(0, Math.min(1, (last - low) / (high - low)));

  return {
    high,
    low,
    position,
    vsHigh: ((last - high) / high) * 100,
    vsLow: ((last - low) / low) * 100
  };
};

const renderColumnCell = (item, column) => {
  if (column.key === 'lastColored') {
    return (
      <span className="watchlist-last-colored" key={column.key}>
        <i className={item.colorFlag || 'none'} />
        <span>{formatCellValue(item, column.key)}</span>
      </span>
    );
  }

  if (column.key === 'week52Range') {
    const range = getWeek52Range(item);
    return (
      <span
        className="watchlist-52-range"
        key={column.key}
      title={`52周低点 ${range.low.toFixed(2)} / 高点 ${range.high.toFixed(2)}`}
      >
        <i style={{ left: `${range.position * 100}%` }} />
      </span>
    );
  }

  if (column.key === 'change' || column.key === 'changeAbs' || column.key === 'vs52High' || column.key === 'vs52Low') {
    return <em key={column.key}>{formatCellValue(item, column.key)}</em>;
  }

  return <span key={column.key}>{formatCellValue(item, column.key)}</span>;
};

const isSymbolInGroup = (group, symbol) => (
  Boolean(symbol) && (group.symbols || []).some(value => value.toUpperCase() === symbol.toUpperCase())
);

const RightInsightRail = () => {
  const [activeGroupId, setActiveGroupId] = useState('stock-default');
  const [filter, setFilter] = useState('');
  const [sortState, setSortState] = useState({ key: null, direction: 'desc' });
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [listPickerSearch, setListPickerSearch] = useState('');
  const [listPickerFilter, setListPickerFilter] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [draftVisibleColumns, setDraftVisibleColumns] = useState([]);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareAccess, setShareAccess] = useState('link');
  const [shareEmails, setShareEmails] = useState('');
  const [sharedGroupIds, setSharedGroupIds] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [watchlistName, setWatchlistName] = useState('');
  const [draftSymbols, setDraftSymbols] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(['lastColored', 'change', 'week52Range']);
  const [rowMenuSymbol, setRowMenuSymbol] = useState(null);
  const [colorSortActive, setColorSortActive] = useState(false);
  const [marketSymbols, setMarketSymbols] = useState(getFallbackMarketSymbols);
  const listPickerRef = useRef(null);
  const menuRef = useRef(null);
  const rowMenuRef = useRef(null);
  const {
    currentSymbol,
    currentType,
    setCurrentSymbol,
    toggleWatchlistGroupSymbol,
    addWatchlistGroup,
    deleteWatchlistGroup,
    renameWatchlistGroup,
    cloneWatchlistGroup,
    setWatchlistSymbolColor,
    watchlistGroups
  } = useChartStore();

  const activeGroup = watchlistGroups.find(group => group.id === activeGroupId) || watchlistGroups[0];
  const activeRows = getWatchlistRowsFromGroups(watchlistGroups, activeGroup?.id, marketSymbols);
  const addRemoveGroups = watchlistGroups.filter(group => (
    group.type === 'mixed' || group.type === currentType
  ));
  const visibleColumnDefs = columnOptions.filter(column => visibleColumns.includes(column.key));
  const dataColumnTracks = visibleColumnDefs.map(column => columnTracks[column.key]).join(' ');
  const rowGrid = `18px minmax(52px, 1fr) ${dataColumnTracks} 20px`;
  const shareUrl = activeGroup?.id
    ? `${window.location.origin}${window.location.pathname}?watchlist=${encodeURIComponent(activeGroup.id)}`
    : `${window.location.origin}${window.location.pathname}`;

  const pickedGroups = watchlistGroups.filter(group => {
    const query = listPickerSearch.trim().toLowerCase();
    const matchesSearch = !query || group.name.toLowerCase().includes(query);
    const matchesFilter =
      listPickerFilter === 'all'
      || (listPickerFilter === 'premade' && group.system)
      || (listPickerFilter === 'yours' && !group.system);
    return matchesSearch && matchesFilter;
  });

  const filteredRows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const rows = activeRows.filter(item => (
      !query || item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query)
    ));

    if (colorSortActive) {
      return [...rows].sort((a, b) => (
        (colorOrder[a.colorFlag] || 99) - (colorOrder[b.colorFlag] || 99)
        || a.symbol.localeCompare(b.symbol)
      ));
    }

    if (!sortState.key) return rows;

    return [...rows].sort((a, b) => {
      const aValue = getSortValue(a, sortState.key);
      const bValue = getSortValue(b, sortState.key);
      const result = typeof aValue === 'string'
        ? aValue.localeCompare(String(bValue))
        : Number(aValue) - Number(bValue);
      return sortState.direction === 'asc' ? result : -result;
    });
  }, [activeRows, colorSortActive, filter, sortState]);

  useEffect(() => {
    if (watchlistGroups.some(group => group.id === activeGroupId)) return;
    setActiveGroupId(watchlistGroups[0]?.id || 'stock-default');
  }, [activeGroupId, watchlistGroups]);

  useEffect(() => {
    if (!listPickerOpen && !editorOpen) return undefined;

    let cancelled = false;
    loadLiveMarketSymbols().then(rows => {
      if (!cancelled) setMarketSymbols(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sharedWatchlistId = new URLSearchParams(window.location.search).get('watchlist');
    if (!sharedWatchlistId) return;
    if (!watchlistGroups.some(group => group.id === sharedWatchlistId)) return;
    setActiveGroupId(sharedWatchlistId);
  }, [watchlistGroups]);

  const closeFloatingMenus = () => {
    setListPickerOpen(false);
    setMenuOpen(false);
    setRowMenuSymbol(null);
  };

  useEffect(() => {
    if (!listPickerOpen && !menuOpen && !rowMenuSymbol) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      const insideListPicker = listPickerRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      const insideRowMenu = rowMenuRef.current?.contains(target);

      if (insideListPicker || insideMenu || insideRowMenu) return;
      closeFloatingMenus();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeFloatingMenus();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [listPickerOpen, menuOpen, rowMenuSymbol]);

  const toggleSort = (key) => {
    setColorSortActive(false);
    setSortState(current => (
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' }
    ));
  };

  const getSortMark = key => (sortState.key === key ? (sortState.direction === 'asc' ? 'up' : 'down') : '');

  const openEditor = (mode, includeCurrentSymbol = false) => {
    closeFloatingMenus();
    setMembershipOpen(false);
    setEditorMode(mode);

    if (mode === 'edit') {
      setWatchlistName(activeGroup?.name || '');
      setDraftSymbols([...(activeGroup?.symbols || [])]);
    } else if (mode === 'clone') {
      setWatchlistName(activeGroup ? `${activeGroup.name} 副本` : '');
      setDraftSymbols([...(activeGroup?.symbols || [])]);
    } else {
      setWatchlistName('');
      setDraftSymbols(includeCurrentSymbol && currentSymbol ? [currentSymbol] : []);
    }

    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setWatchlistName('');
    setDraftSymbols([]);
  };

  const submitEditor = () => {
    const name = watchlistName.trim();
    if (!name) return;

    if (editorMode === 'edit' && activeGroup) {
      renameWatchlistGroup(activeGroup.id, name);
      const currentSymbols = activeGroup.symbols || [];
      draftSymbols.forEach(symbol => {
        if (!currentSymbols.includes(symbol)) {
          toggleWatchlistGroupSymbol(activeGroup.id, { symbol, type: activeGroup.type });
        }
      });
      currentSymbols.forEach(symbol => {
        if (!draftSymbols.includes(symbol)) {
          toggleWatchlistGroupSymbol(activeGroup.id, { symbol, type: activeGroup.type });
        }
      });
    } else if (editorMode === 'clone' && activeGroup) {
      cloneWatchlistGroup(activeGroup.id, name);
    } else {
      addWatchlistGroup({ name, symbols: draftSymbols });
    }

    closeEditor();
  };

  const toggleColumn = (key) => {
    setDraftVisibleColumns(current => (
      current.includes(key)
        ? current.filter(item => item !== key)
        : [...current, key]
    ));
  };

  const openColumnsModal = () => {
    closeFloatingMenus();
    setDraftVisibleColumns(visibleColumns);
    setColumnsOpen(true);
  };

  const closeColumnsModal = () => {
    setColumnsOpen(false);
    setDraftVisibleColumns([]);
  };

  const applyColumns = () => {
    setVisibleColumns(draftVisibleColumns);
    closeColumnsModal();
  };

  const resetColumns = () => {
    setDraftVisibleColumns(['lastColored', 'change', 'week52Range']);
  };

  const downloadCsv = () => {
    const csv = getWatchlistCsv(watchlistGroups, activeGroup?.id, marketSymbols);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeGroup?.name || 'watchlist'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    closeFloatingMenus();
  };

  const removeFromActiveGroup = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    if (!activeGroup) return;
    toggleWatchlistGroupSymbol(activeGroup.id, item);
    setRowMenuSymbol(null);
  };

  const deleteActiveGroup = () => {
    if (!activeGroup || activeGroup.system) return;
    deleteWatchlistGroup(activeGroup.id);
    setDeleteConfirmOpen(false);
    closeFloatingMenus();
  };

  const openShareModal = () => {
    closeFloatingMenus();
    setShareAccess(sharedGroupIds.includes(activeGroup?.id) ? 'link' : 'private');
    setShareOpen(true);
  };

  const submitShare = () => {
    if (!activeGroup || activeGroup.system) return;
    setSharedGroupIds(current => (
      shareAccess === 'private'
        ? current.filter(id => id !== activeGroup.id)
        : [...new Set([...current, activeGroup.id])]
    ));
    const url = new URL(window.location.href);
    if (shareAccess === 'private') url.searchParams.delete('watchlist');
    else url.searchParams.set('watchlist', activeGroup.id);
    window.history.replaceState(null, '', url);
    setShareOpen(false);
  };

  const editorTitle = editorMode === 'edit'
    ? '编辑自选列表'
    : editorMode === 'clone'
      ? '复制自选列表'
      : '新建自选列表';

  const editorPrimaryLabel = editorMode === 'edit' ? '保存' : '创建';

  return (
    <aside className="right-insight-rail">
      <section className="rail-section watchlist-section">
        <div className="watchlist-widget-header">
          <div className="watchlist-picker-wrap" ref={listPickerRef}>
            <button
              aria-expanded={listPickerOpen}
              aria-label="选择自选列表"
              className="watchlist-picker-trigger"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setRowMenuSymbol(null);
                setListPickerOpen(open => !open);
              }}
            >
              <span>{activeGroup?.name || '自选列表'}</span>
              <DownOutlined />
            </button>
            {listPickerOpen && (
              <div className="watchlist-picker-menu">
                <label className="watchlist-picker-search">
                  <SearchOutlined />
                  <input
                    autoFocus
                    placeholder="搜索自选列表"
                    value={listPickerSearch}
                    onChange={event => setListPickerSearch(event.target.value)}
                  />
                </label>
                <div className="watchlist-picker-tabs">
                  {[
                    ['all', '全部'],
                    ['yours', '我的'],
                    ['premade', '预设']
                  ].map(([key, label]) => (
                    <button
                      className={listPickerFilter === key ? 'active' : ''}
                      key={key}
                      type="button"
                      onClick={() => setListPickerFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {pickedGroups.map(group => (
                  <button
                    className={`watchlist-picker-option ${group.id === activeGroup?.id ? 'active' : ''}`}
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setActiveGroupId(group.id);
                      const url = new URL(window.location.href);
                      url.searchParams.set('watchlist', group.id);
                      window.history.replaceState(null, '', url);
                      setListPickerOpen(false);
                    }}
                  >
                    <span>
                      <strong>{group.name}</strong>
                      {!group.system && <em>自定义</em>}
                      {sharedGroupIds.includes(group.id) && <em>公开</em>}
                    </span>
                    <small>{(group.symbols || []).length}</small>
                  </button>
                ))}
                {pickedGroups.length === 0 && <div className="watchlist-picker-empty">没有自选列表</div>}
              </div>
            )}
          </div>

          <div className="rail-actions watchlist-actions">
            <button
              className="watchlist-add-remove"
              type="button"
              title="添加或移除当前标的"
              onClick={() => {
                closeFloatingMenus();
                setMembershipOpen(true);
              }}
            >
              添加/移除
            </button>
            <button type="button" title="新建自选列表" onClick={() => openEditor('create')}>
              <PlusOutlined />
            </button>
            <button
              className={colorSortActive ? 'active' : ''}
              type="button"
              title="按颜色排序"
              onClick={() => {
                closeFloatingMenus();
                setColorSortActive(active => !active);
              }}
            >
              <SortAscendingOutlined />
            </button>
            <div className="watchlist-menu-wrap" ref={menuRef}>
              <button
                type="button"
                title="自选列表菜单"
                onClick={() => {
                  setListPickerOpen(false);
                  setRowMenuSymbol(null);
                  setMenuOpen(open => !open);
                }}
              >
                <MoreOutlined />
              </button>
              {menuOpen && (
                <div className="watchlist-menu">
                  <button type="button" onClick={() => openEditor('create')}>新建自选列表</button>
                  <button type="button" onClick={() => openEditor('edit')} disabled={activeGroup?.system}>编辑自选列表</button>
                  <button type="button" onClick={() => openEditor('clone')}>复制列表</button>
                  <button type="button" onClick={() => { setDeleteConfirmOpen(true); setMenuOpen(false); }} disabled={activeGroup?.system}>删除列表</button>
                  <button type="button" onClick={openShareModal} disabled={activeGroup?.system}>分享列表</button>
                  <button type="button" onClick={downloadCsv}>下载 CSV</button>
                  <button type="button" onClick={openColumnsModal}>管理列</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="watchlist-toolbar">
          <label>
            <SearchOutlined />
            <input value={filter} placeholder="搜索列表" onChange={event => setFilter(event.target.value)} />
          </label>
        </div>

        <div className="watchlist-table">
          <div className="watchlist-head" style={{ gridTemplateColumns: rowGrid }}>
            <span />
            <button type="button" onClick={() => toggleSort('symbol')}>代码 {getSortMark('symbol')}</button>
            {visibleColumnDefs.map(column => (
              <button key={column.key} type="button" onClick={() => toggleSort(column.key)}>
                {column.shortLabel || column.label} {getSortMark(column.key)}
              </button>
            ))}
            <span />
          </div>

          {filteredRows.map(item => (
            <button
              className={`watchlist-row ${item.tone} ${currentSymbol === item.symbol ? 'selected' : ''}`}
              key={item.symbol}
              onClick={() => setCurrentSymbol(item.symbol, item.name, item.type)}
              style={{ gridTemplateColumns: rowGrid }}
              type="button"
            >
              <span
                className="watchlist-star"
                role="button"
                tabIndex={0}
                title="从当前自选列表移除"
                onClick={(event) => removeFromActiveGroup(event, item)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  removeFromActiveGroup(event, item);
                }}
              >
                <StarFilled />
              </span>
              <div>
                <strong>{item.symbol}</strong>
                <small>{item.name}</small>
              </div>
              {visibleColumnDefs.map(column => renderColumnCell(item, column))}
              <span className="watchlist-row-menu-wrap" ref={rowMenuSymbol === item.symbol ? rowMenuRef : null}>
                <i
                  role="button"
                  tabIndex={0}
                  title="标的菜单"
                  onClick={(event) => {
                    event.stopPropagation();
                    setRowMenuSymbol(rowMenuSymbol === item.symbol ? null : item.symbol);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.stopPropagation();
                    setRowMenuSymbol(rowMenuSymbol === item.symbol ? null : item.symbol);
                  }}
                >
                  <MoreOutlined />
                </i>
                {rowMenuSymbol === item.symbol && (
                  <div className="watchlist-row-menu" onClick={event => event.stopPropagation()}>
                    <button type="button" onClick={(event) => removeFromActiveGroup(event, item)}>从列表移除</button>
                    <span>添加颜色标记</span>
                    <div className="watchlist-row-colors">
                      {colorOptions.map(color => (
                        <button
                          className={item.colorFlag === color ? `active ${color}` : color}
                          key={color}
                          title={color}
                          type="button"
                          onClick={() => {
                            setWatchlistSymbolColor(activeGroup.id, item.symbol, item.colorFlag === color ? null : color);
                            setRowMenuSymbol(null);
                          }}
                        />
                      ))}
                    </div>
                    {item.colorFlag && (
                      <button
                        type="button"
                        onClick={() => {
                          setWatchlistSymbolColor(activeGroup.id, item.symbol, null);
                          setRowMenuSymbol(null);
                        }}
                      >
                        移除颜色标记
                      </button>
                    )}
                  </div>
                )}
              </span>
            </button>
          ))}

          {filteredRows.length === 0 && (
            <div className="watchlist-empty">
              <strong>当前自选列表没有标的</strong>
              <span>使用添加/移除，或新建包含标的的列表。</span>
            </div>
          )}
        </div>
      </section>

      <section className="rail-section widget-section">
        <div className="rail-header">
          <span>组件</span>
          <div className="rail-actions">
            <button type="button" title="组件设置"><SettingOutlined /></button>
          </div>
        </div>
        <div className="widget-stack">
          {widgets.map(item => (
            <div className={`widget-card ${item.tone}`} key={item.title}>
              <div className="widget-title">
                {item.icon}
                <strong>{item.title}</strong>
              </div>
              <span>{item.value}</span>
              <small>{item.meta}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="rail-section news-section">
        <div className="rail-header">
          <span>资讯</span>
        </div>
        <div className="news-feed">
          {news.map(item => (
            <div className="news-item" key={`${item.time}-${item.text}`}>
              <strong>{item.time}</strong>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      <Modal
        centered
        className="watchlist-flow-modal"
        footer={null}
        open={membershipOpen}
        title="添加或移出自选列表"
        width={420}
        onCancel={() => setMembershipOpen(false)}
      >
        <div className="watchlist-modal-body">
          <strong>{currentSymbol || '未选择标的'}</strong>
          {addRemoveGroups.map(group => (
            <label className="watchlist-modal-check" key={group.id}>
              <input
                checked={isSymbolInGroup(group, currentSymbol)}
                disabled={!currentSymbol}
                type="checkbox"
                onChange={() => {
                  if (!currentSymbol) return;
                  toggleWatchlistGroupSymbol(group.id, { symbol: currentSymbol, type: currentType });
                }}
              />
              <span>{group.name}</span>
            </label>
          ))}
          <button className="watchlist-modal-link" type="button" onClick={() => openEditor('create', true)}>
            新建自选列表
          </button>
        </div>
      </Modal>

      <Modal
        centered
        className="watchlist-flow-modal"
        footer={null}
        open={columnsOpen}
        title="管理列"
        width={430}
        onCancel={closeColumnsModal}
      >
        <div className="watchlist-modal-body">
          <span className="watchlist-modal-copy">选择当前自选列表中显示哪些列。</span>
          <div className="watchlist-column-modal-list">
            <label className="locked">
              <input checked disabled type="checkbox" />
              <span>
                <strong>代码</strong>
                <small>主标的列</small>
              </span>
            </label>
            {columnOptions.map(column => (
              <label key={column.key}>
                <input checked={draftVisibleColumns.includes(column.key)} type="checkbox" onChange={() => toggleColumn(column.key)} />
                <span>
                  <strong>{column.label}</strong>
                  <small>行情数据列</small>
                </span>
              </label>
            ))}
          </div>
          <div className="watchlist-modal-actions split">
            <button type="button" onClick={resetColumns}>重置</button>
            <span />
            <button type="button" onClick={closeColumnsModal}>取消</button>
            <button type="button" onClick={applyColumns}>保存</button>
          </div>
        </div>
      </Modal>

      <Modal
        centered
        className="watchlist-flow-modal"
        footer={null}
        open={shareOpen}
        title="分享自选列表"
        width={460}
        onCancel={() => setShareOpen(false)}
      >
        <div className="watchlist-modal-body">
          <strong>{activeGroup?.name}</strong>
          <label className="watchlist-modal-field">
            <span>访问权限</span>
            <select value={shareAccess} onChange={event => setShareAccess(event.target.value)}>
              <option value="private">私有</option>
              <option value="link">知道链接的人可访问</option>
              <option value="specific">仅指定人员可访问</option>
            </select>
          </label>
          {shareAccess === 'specific' && (
            <label className="watchlist-modal-field">
              <span>邮箱邀请</span>
              <input value={shareEmails} placeholder="name@example.com, trader@example.com" onChange={event => setShareEmails(event.target.value)} />
            </label>
          )}
          {shareAccess === 'link' && (
            <div className="watchlist-share-link">
              {shareUrl}
            </div>
          )}
          <span className="watchlist-modal-copy">公开自选列表会显示公开标签，订阅者会收到列表变更更新。</span>
          <div className="watchlist-modal-actions">
            <button type="button" onClick={() => setShareOpen(false)}>取消</button>
            <button type="button" onClick={submitShare}>分享</button>
          </div>
        </div>
      </Modal>

      <Modal
        centered
        className="watchlist-flow-modal"
        footer={null}
        open={editorOpen}
        title={editorTitle}
        width={560}
        onCancel={closeEditor}
      >
        <div className="watchlist-modal-body">
          <label className="watchlist-modal-field">
            <span>自选列表名称</span>
            <input value={watchlistName} onChange={event => setWatchlistName(event.target.value)} />
          </label>
          {editorMode === 'create' && draftSymbols.length > 0 && (
            <span className="watchlist-modal-copy">当前标的会添加到新的自选列表。</span>
          )}
          {editorMode === 'clone' && (
            <span className="watchlist-modal-copy">复制后的自选列表会包含相同标的和颜色标记。</span>
          )}
          <div className="watchlist-modal-actions">
            <button type="button" onClick={closeEditor}>取消</button>
            <button type="button" onClick={submitEditor}>{editorPrimaryLabel}</button>
          </div>
        </div>
      </Modal>

      <Modal
        centered
        className="watchlist-flow-modal"
        footer={null}
        open={deleteConfirmOpen}
        title="删除自选列表"
        width={380}
        onCancel={() => setDeleteConfirmOpen(false)}
      >
        <div className="watchlist-modal-body">
          <strong>{activeGroup?.name}</strong>
          <span className="watchlist-modal-copy">这会移除该自选列表，不会从平台删除标的。</span>
          <div className="watchlist-modal-actions">
            <button type="button" onClick={() => setDeleteConfirmOpen(false)}>取消</button>
            <button type="button" onClick={deleteActiveGroup}>删除</button>
          </div>
        </div>
      </Modal>
    </aside>
  );
};

export default RightInsightRail;

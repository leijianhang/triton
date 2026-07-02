import React, { useEffect, useState } from 'react';
import { Empty, Input, Modal, Pagination } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import {
  assetTypeOptions,
  getAssetTypeLabel,
  loadPagedMarketSymbols
} from '../data/liveMarketData';
import { useChartStore } from '../store/chartStore';
import './SearchPanel.css';

const SYMBOL_SEARCH_PAGE_SIZE = 20;
const symbolSearchTypeOptions = [
  { key: 'all', label: '全部' },
  ...assetTypeOptions
];
const getSearchTypeLabel = type => (type === 'all' ? '全部' : getAssetTypeLabel(type));

const SearchPanel = ({ children, compact = false, onSelect, placeholder, triggerClassName }) => {
  const {
    currentSymbol,
    currentName,
    setCurrentSymbol
  } = useChartStore();
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [symbols, setSymbols] = useState([]);
  const [total, setTotal] = useState(0);
  const [loadingSymbols, setLoadingSymbols] = useState(false);

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
        if (cancelled) return;
        setSymbols(result.items);
        setTotal(result.total);
        if (result.page !== page) setPage(result.page);
      })
      .finally(() => {
        if (!cancelled) setLoadingSymbols(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeType, open, page, query]);

  const displaySymbol = currentSymbol ? `${currentSymbol} ${currentName || ''}`.trim() : '';
  const triggerLabel = placeholder || displaySymbol || '搜索标的';
  const activeTypeLabel = getSearchTypeLabel(activeType);

  const handleOpen = () => {
    setActiveType('all');
    setQuery('');
    setPage(1);
    setOpen(true);
  };

  const handleTypeChange = (type) => {
    setActiveType(type);
    setQuery('');
    setPage(1);
  };

  const handleQueryChange = (event) => {
    setQuery(event.target.value);
    setPage(1);
  };

  const handleSelectItem = (item) => {
    if (onSelect) onSelect(item);
    else setCurrentSymbol(item.symbol, item.name, item.type);
    setOpen(false);
  };

  const getResultMeta = item => [item.industry, item.market].filter(Boolean).join(' · ') || item.setup;

  return (
    <div className={compact ? 'search-panel compact' : 'search-panel'}>
      <button className={triggerClassName || 'symbol-search-trigger'} onClick={handleOpen} type="button">
        {children || (
          <>
            <SearchOutlined />
            <span className="symbol-search-text">{triggerLabel}</span>
          </>
        )}
      </button>

      <Modal
        centered
        className="symbol-search-modal"
        footer={null}
        open={open}
        title="搜索标的"
        width={840}
        onCancel={() => setOpen(false)}
      >
        <div className="symbol-search-shell">
          <Input
            allowClear
            autoFocus
            className="symbol-search-input"
            placeholder={`按代码或名称搜索${activeTypeLabel}`}
            prefix={<SearchOutlined />}
            value={query}
            onChange={handleQueryChange}
          />

          <div aria-label="标的类型" className="symbol-search-filter-row" role="tablist">
            {symbolSearchTypeOptions.map(option => (
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
            {symbols.length > 0 ? (
              symbols.map(item => (
                <div
                  aria-selected={item.symbol === currentSymbol}
                  className={item.symbol === currentSymbol ? 'symbol-result-row active' : 'symbol-result-row'}
                  key={`${item.type}:${item.symbol}`}
                  onClick={() => handleSelectItem(item)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    handleSelectItem(item);
                  }}
                  role="option"
                  tabIndex={0}
                >
                  <span className="symbol-result-main">
                    <strong>{item.symbol}</strong>
                    <span>{item.name}</span>
                  </span>
                  <span className="symbol-result-setup">{getResultMeta(item)}</span>
                </div>
              ))
            ) : (
              <Empty description={loadingSymbols ? '正在加载标的...' : '未找到标的'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>

          <div className="symbol-search-footer">
            <span>{activeTypeLabel}结果：{total}</span>
            <Pagination
              current={page}
              pageSize={SYMBOL_SEARCH_PAGE_SIZE}
              showSizeChanger={false}
              size="small"
              total={total}
              onChange={setPage}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SearchPanel;

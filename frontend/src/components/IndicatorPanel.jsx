import React, { useMemo, useState } from 'react';
import { Input, InputNumber, Select } from 'antd';
import {
  CheckOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useChartStore } from '../store/chartStore';
import {
  getActiveIndicatorRows,
  getFilteredIndicatorRows,
  indicatorLibrary,
  indicatorTypeOptions
} from './indicatorLibrary';
import './IndicatorPanel.css';

const indicatorDisplayTypes = {
  ma: '主图',
  ema: '主图',
  boll: '主图',
  vwap: '主图',
  gonogo: '主图',
  macd: '副图',
  rsi: '副图',
  kdj: '副图',
  obv: '副图',
  newHighLow: '宽度',
  insideBar: '形态'
};

const cloneIndicators = (indicators = {}) => Object.fromEntries(
  Object.entries(indicators).map(([key, value]) => [
    key,
    {
      ...value,
      periods: Array.isArray(value.periods) ? [...value.periods] : value.periods,
      params: value.params ? { ...value.params } : value.params,
      colors: Array.isArray(value.colors) ? [...value.colors] : value.colors
    }
  ])
);

const createInstanceFromIndicator = (indicator = {}, id) => {
  const { instances, ...rest } = indicator;
  return {
    ...rest,
    id,
    enabled: true,
    visible: true,
    periods: Array.isArray(rest.periods) ? [...rest.periods] : rest.periods,
    params: rest.params ? { ...rest.params } : rest.params,
    colors: Array.isArray(rest.colors) ? [...rest.colors] : rest.colors
  };
};

const getNextInstanceId = (key, instances = []) => {
  let index = instances.length + 1;
  const ids = new Set(instances.map(instance => instance.id));
  while (ids.has(`${key}-${index}`)) index += 1;
  return `${key}-${index}`;
};

const IndicatorPanel = ({ initialIndicatorKey, onCancel, onConfirm }) => {
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState(initialIndicatorKey || null);
  const [draftIndicators, setDraftIndicators] = useState(() => cloneIndicators(useChartStore.getState().indicators));
  const { indicators, setIndicatorsVisible, updateIndicatorParams } = useChartStore();

  React.useEffect(() => {
    if (initialIndicatorKey) setSelectedKey(initialIndicatorKey);
  }, [initialIndicatorKey]);

  React.useEffect(() => {
    setDraftIndicators(cloneIndicators(indicators));
  }, [indicators]);

  const filteredRows = useMemo(
    () => getFilteredIndicatorRows({ indicators: draftIndicators, type, query }),
    [draftIndicators, query, type]
  );
  const activeRows = useMemo(() => getActiveIndicatorRows(draftIndicators), [draftIndicators]);
  const selectedRow =
    activeRows.find(item => item.key === selectedKey) ||
    indicatorLibrary.find(item => item.key === selectedKey) ||
    null;

  const updateDraftIndicator = (key, patch) => {
    setDraftIndicators(current => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch
      }
    }));
  };

  const updateDraftIndicatorInstance = (row, patch) => {
    const baseKey = row.baseKey || row.key;
    const indicator = draftIndicators[baseKey];

    if (indicator?.instances?.length) {
      updateDraftIndicator(baseKey, {
        instances: indicator.instances.map(instance =>
          instance.id === row.instanceId
            ? {
              ...instance,
              ...patch,
              params: patch.params ? { ...patch.params } : instance.params,
              periods: patch.periods ? [...patch.periods] : instance.periods,
              colors: patch.colors ? [...patch.colors] : instance.colors
            }
            : instance
        )
      });
      return;
    }

    updateDraftIndicator(baseKey, patch);
  };

  const addIndicator = (key) => {
    const indicator = draftIndicators[key] || {};
    const definition = indicatorLibrary.find(item => item.key === key);

    if (definition?.canHaveOnlyOne) {
      updateDraftIndicator(key, { enabled: true, visible: true, instances: [] });
      setSelectedKey(key);
      return;
    }

    const existingInstances = indicator.instances?.length
      ? indicator.instances
      : (indicator.enabled ? [createInstanceFromIndicator(indicator, `${key}-1`)] : []);
    const nextId = getNextInstanceId(key, existingInstances);
    const nextInstance = createInstanceFromIndicator(indicator, nextId);

    updateDraftIndicator(key, {
      enabled: true,
      visible: true,
      instances: [...existingInstances, nextInstance]
    });
    setSelectedKey(nextId);
  };

  const removeIndicator = (row) => {
    const baseKey = row.baseKey || row.key;
    const indicator = draftIndicators[baseKey];

    if (indicator?.instances?.length) {
      const nextInstances = indicator.instances.filter(instance => instance.id !== row.instanceId);
      updateDraftIndicator(baseKey, {
        enabled: nextInstances.length > 0,
        instances: nextInstances
      });
    } else {
      updateDraftIndicator(baseKey, { enabled: false, visible: true });
    }

    if (selectedKey === row.key) {
      const nextActive = activeRows.find(item => item.key !== row.key);
      setSelectedKey(nextActive?.key || null);
    }
  };

  const confirmPanelChanges = () => {
    Object.entries(draftIndicators).forEach(([key, value]) => {
      updateIndicatorParams(key, cloneIndicators({ [key]: value })[key]);
    });
    setIndicatorsVisible(Object.values(draftIndicators).some(item => item.enabled));
    onConfirm?.();
  };

  const cancelPanelChanges = () => {
    setDraftIndicators(cloneIndicators(indicators));
    onCancel?.();
  };

  const renderSettings = (editingRow) => {
    const baseKey = editingRow.baseKey || editingRow.key;
    const state = editingRow.state || draftIndicators[baseKey];
    if (!state) return null;

    if (baseKey === 'ma' || baseKey === 'ema') {
      return (
        <div className="indicator-settings-card">
          <div className="indicator-settings-title">
            <strong>{editingRow.shortName} 设置</strong>
            <span>{editingRow.name}</span>
          </div>
          <div className="indicator-style-row">
            <label>
              <span>Line</span>
              <select defaultValue="solid">
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
              </select>
            </label>
            <label>
              <span>Width</span>
              <InputNumber min={1} max={5} size="small" defaultValue={1} />
            </label>
          </div>
          <div className="indicator-settings-section-label">Inputs</div>
          <div className="indicator-period-grid">
            {(state.periods || []).map((period, index) => (
              <label key={index}>
                <span>{editingRow.shortName}{period}</span>
                <InputNumber
                  min={1}
                  max={250}
                  size="small"
                  value={period}
                  onChange={(value) => {
                    const nextPeriods = [...state.periods];
                    nextPeriods[index] = value || 1;
                    updateDraftIndicatorInstance(editingRow, { periods: nextPeriods });
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (baseKey === 'macd') {
      return (
        <div className="indicator-settings-card">
          <div className="indicator-settings-title">
            <strong>MACD 设置</strong>
            <span>Fast, slow, and signal periods</span>
          </div>
          <div className="indicator-style-row">
            <label>
              <span>Histogram</span>
              <select defaultValue="on">
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </label>
          </div>
          <div className="indicator-settings-section-label">Inputs</div>
          {[
            ['Fast', 'fast'],
            ['Slow', 'slow'],
            ['Signal', 'signal']
          ].map(([label, key]) => (
            <label className="indicator-param-row" key={key}>
              <span>{label}</span>
              <InputNumber
                min={1}
                max={100}
                size="small"
                value={state.params[key]}
                onChange={(value) =>
                  updateDraftIndicatorInstance(editingRow, {
                    params: { ...state.params, [key]: value || 1 }
                  })
                }
              />
            </label>
          ))}
        </div>
      );
    }

    if (baseKey === 'rsi') {
      return (
        <div className="indicator-settings-card">
          <div className="indicator-settings-title">
            <strong>RSI 设置</strong>
            <span>Momentum lookback period</span>
          </div>
          <div className="indicator-style-row">
            <label>
              <span>Levels</span>
              <select defaultValue="70/30">
                <option value="70/30">70 / 30</option>
                <option value="80/20">80 / 20</option>
              </select>
            </label>
          </div>
          <div className="indicator-settings-section-label">Inputs</div>
          <label className="indicator-param-row">
            <span>Period</span>
            <InputNumber
              min={1}
              max={100}
              size="small"
              value={state.period}
              onChange={(value) => updateDraftIndicatorInstance(editingRow, { period: value || 1 })}
            />
          </label>
        </div>
      );
    }

    if (baseKey === 'boll') {
      return (
        <div className="indicator-settings-card">
          <div className="indicator-settings-title">
            <strong>布林带设置</strong>
            <span>Band period and standard deviation</span>
          </div>
          <div className="indicator-style-row">
            <label>
              <span>Basis</span>
              <select defaultValue="sma">
                <option value="sma">SMA</option>
                <option value="ema">EMA</option>
              </select>
            </label>
            <label>
              <span>Fill</span>
              <select defaultValue="on">
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </label>
          </div>
          <div className="indicator-settings-section-label">Inputs</div>
          <label className="indicator-param-row">
            <span>Period</span>
            <InputNumber
              min={1}
              max={100}
              size="small"
              value={state.params.period}
              onChange={(value) =>
                updateDraftIndicatorInstance(editingRow, {
                  params: { ...state.params, period: value || 1 }
                })
              }
            />
          </label>
          <label className="indicator-param-row">
            <span>Std Dev</span>
            <InputNumber
              min={0.1}
              max={5}
              step={0.1}
              size="small"
              value={state.params.stdDev}
              onChange={(value) =>
                updateDraftIndicatorInstance(editingRow, {
                  params: { ...state.params, stdDev: value || 0.1 }
                })
              }
            />
          </label>
        </div>
      );
    }

    return (
      <div className="indicator-settings-card">
        <div className="indicator-settings-title">
          <strong>{editingRow.shortName} 设置</strong>
          <span>This indicator uses default parameters in the current build.</span>
        </div>
        <div className="indicator-style-row">
          <label>
            <span>Visible</span>
            <select defaultValue="on">
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="indicator-panel">
      <div className="indicator-modal-toolbar">
        <Select
          className="indicator-type-select"
          options={indicatorTypeOptions}
          value={type}
          onChange={setType}
        />
        <Input
          allowClear
          className="indicator-search-input"
          placeholder="搜索指标"
          prefix={<SearchOutlined />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="indicator-modal-grid">
        <section className="indicator-library-table" aria-label="指标库">
          <div className="indicator-table-head">
            <span>名称</span>
            <span>类型</span>
            <span />
          </div>
          <div className="indicator-table-body">
            {filteredRows.map(item => {
              const enabled = draftIndicators[item.key]?.enabled || draftIndicators[item.key]?.instances?.some(instance => instance.enabled);
              const selected = selectedRow ? (selectedRow.baseKey || selectedRow.key) === item.key : false;
              return (
                <button
                  className={[
                    'indicator-library-row',
                    enabled ? 'active' : '',
                    selected ? 'selected' : ''
                  ].filter(Boolean).join(' ')}
                  key={item.key}
                  type="button"
                  onClick={() => addIndicator(item.key)}
                >
                  <span className="indicator-name-cell">
                    <strong>{item.name}</strong>
                    <em>{item.summary}</em>
                  </span>
                  <span>{indicatorDisplayTypes[item.key] || '指标'}</span>
                  <span className="indicator-action-cell">
                    {enabled ? <CheckOutlined /> : <PlusOutlined />}
                  </span>
                </button>
              );
            })}
            {!filteredRows.length && (
              <div className="indicator-empty-state">没有匹配的指标。</div>
            )}
          </div>
        </section>

        <aside className="active-indicator-panel">
          <div className="active-indicator-header">
            <strong>已启用指标</strong>
            <span>{activeRows.length}</span>
          </div>

          <div className="active-indicator-list">
            {activeRows.map(item => (
              <div className={selectedRow?.key === item.key ? 'active-indicator-card editing' : 'active-indicator-card'} key={item.key}>
                <div className="active-indicator-row">
                  <button className="active-indicator-select" type="button" onClick={() => setSelectedKey(item.key)}>
                    <SettingOutlined />
                  </button>
                  <button className="active-indicator-name" type="button" onClick={() => setSelectedKey(item.key)}>
                    <strong>{item.shortName}</strong>
                    <em>{item.name}</em>
                  </button>
                  <button
                    className="indicator-delete-button"
                    title={`移除 ${item.name}`}
                    type="button"
                    onClick={() => removeIndicator(item)}
                  >
                    <DeleteOutlined />
                  </button>
                </div>
                {selectedRow?.key === item.key && (
                  <div className="active-indicator-settings">
                    {renderSettings(item)}
                  </div>
                )}
              </div>
            ))}
            {!activeRows.length && (
              <div className="indicator-empty-state">
                从指标库添加指标。新增指标会显示在这里，可继续设置或移除。
              </div>
            )}
          </div>

        </aside>
      </div>

      <div className="indicator-panel-actions">
        <button className="indicator-action-confirm" type="button" onClick={confirmPanelChanges}>
          确认
        </button>
        <button className="indicator-action-cancel" type="button" onClick={cancelPanelChanges}>
          取消
        </button>
      </div>
    </div>
  );
};

export default IndicatorPanel;

import { findSymbol, marketSymbols } from './marketCatalog.js';

const assetTypes = ['stock', 'us', 'hk'];
const normalizeSymbol = value => String(value || '').trim().toUpperCase();
const normalizeAssetType = type => (assetTypes.includes(type) ? type : 'stock');
const getSymbolType = item => normalizeAssetType(item?.type);

export const createDefaultWatchlistSymbols = () => ({
  stock: marketSymbols.filter(item => item.type === 'stock').slice(0, 3).map(item => item.symbol),
  us: marketSymbols.filter(item => item.type === 'us').slice(0, 3).map(item => item.symbol),
  hk: marketSymbols.filter(item => item.type === 'hk').slice(0, 3).map(item => item.symbol)
});

const createGroup = ({ id, name, type, symbols = [], system = false, colorFlags = {} }) => ({
  id,
  name,
  type,
  symbols,
  colorFlags,
  system
});

export const createDefaultWatchlistGroups = () => {
  const defaults = createDefaultWatchlistSymbols();

  return [
    createGroup({
      id: 'stock-default',
      name: 'A股核心',
      type: 'stock',
      symbols: defaults.stock,
      system: true
    }),
    createGroup({
      id: 'us-default',
      name: 'US Large Caps',
      type: 'us',
      symbols: defaults.us,
      system: true
    }),
    createGroup({
      id: 'hk-default',
      name: '港股核心',
      type: 'hk',
      symbols: defaults.hk,
      system: true
    })
  ];
};

export const normalizeWatchlistGroups = (groups, legacySymbols) => {
  const normalizedGroups = Array.isArray(groups) && groups.length > 0
    ? groups
      .map(group => createGroup({
        ...group,
        type: group.type === 'mixed' ? 'mixed' : normalizeAssetType(group.type)
      }))
    : [];

  const defaultGroups = createDefaultWatchlistGroups();
  const byId = new Map(normalizedGroups.map(group => [group.id, group]));
  defaultGroups.forEach(group => {
    if (!byId.has(group.id)) byId.set(group.id, group);
  });

  if (normalizedGroups.length > 0) return Array.from(byId.values());

  if (legacySymbols && !Array.isArray(legacySymbols)) {
    return defaultGroups.map(group => ({
      ...group,
      symbols: legacySymbols[group.type] || group.symbols
    }));
  }

  return defaultGroups;
};

const normalizeGroupType = type => (
  type === 'mixed' || assetTypes.includes(type) ? type : 'mixed'
);

const createGroupId = (name, type, groups = []) => {
  const base = `${type}-${String(name || 'list').trim().toLowerCase().replace(/\s+/g, '-') || 'list'}`;
  let candidate = base;
  let index = 2;
  while (groups.some(group => group.id === candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
};

const getDefaultGroupId = type => `${normalizeAssetType(type)}-default`;
const getGroupById = (groups = [], groupId) => groups.find(group => group.id === groupId);

const findSymbolInCatalog = (symbol, symbols = marketSymbols) => {
  const target = normalizeSymbol(symbol);
  return symbols.find(item => normalizeSymbol(item.symbol) === target) || findSymbol(symbol);
};

export const isSymbolWatched = (watchlistState = {}, item) => {
  const type = getSymbolType(item);
  const symbol = normalizeSymbol(item?.symbol);

  if (Array.isArray(watchlistState)) {
    return watchlistState
      .filter(group => group.type === type || group.type === 'mixed')
      .some(group => (group.symbols || []).map(normalizeSymbol).includes(symbol));
  }

  return (watchlistState[type] || []).map(normalizeSymbol).includes(symbol);
};

export const toggleWatchlistSymbol = (watchlistState = {}, item) => {
  const type = getSymbolType(item);
  const symbol = normalizeSymbol(item?.symbol);
  if (!symbol) return watchlistState;

  if (Array.isArray(watchlistState)) {
    const watched = watchlistState
      .filter(group => group.type === type || group.type === 'mixed')
      .some(group => (group.symbols || []).map(normalizeSymbol).includes(symbol));

    if (!watched) {
      return toggleGroupSymbol(watchlistState, getDefaultGroupId(type), item);
    }

    return watchlistState.map(group => {
      if (group.type !== type && group.type !== 'mixed') return group;
      const hasSymbol = (group.symbols || []).map(normalizeSymbol).includes(symbol);
      if (!hasSymbol) return group;

      const colorFlags = { ...(group.colorFlags || {}) };
      delete colorFlags[symbol];

      return {
        ...group,
        symbols: group.symbols.filter(value => normalizeSymbol(value) !== symbol),
        colorFlags
      };
    });
  }

  const current = watchlistState[type] || [];
  const exists = current.map(normalizeSymbol).includes(symbol);

  return {
    ...watchlistState,
    [type]: exists
      ? current.filter(value => normalizeSymbol(value) !== symbol)
      : [...current, symbol]
  };
};

export const getWatchlistRowsFromSymbols = (watchlistSymbols = {}, type = 'stock', symbols = marketSymbols) => {
  const targetType = normalizeAssetType(type);
  return (watchlistSymbols[targetType] || [])
    .map(symbol => findSymbolInCatalog(symbol, symbols))
    .filter(item => item?.type === targetType);
};

export const getWatchlistRowsFromGroups = (groups = [], groupId, symbols = marketSymbols) => {
  const group = getGroupById(groups, groupId) || groups[0];
  if (!group) return [];

  return (group.symbols || [])
    .map(symbol => findSymbolInCatalog(symbol, symbols))
    .filter(item => group.type === 'mixed' ? Boolean(item) : item?.type === group.type)
    .map(item => ({
      ...item,
      colorFlag: group.colorFlags?.[normalizeSymbol(item.symbol)] || null
    }));
};

export const addWatchlistGroup = (groups = [], { name, type = 'mixed', symbols = [], colorFlags = {} }) => {
  const groupName = String(name || '').trim();
  if (!groupName) return groups;
  const normalizedType = normalizeGroupType(type);
  const normalizedSymbols = [...new Set((symbols || []).map(normalizeSymbol).filter(Boolean))];

  return [
    ...groups,
    createGroup({
      id: createGroupId(groupName, normalizedType, groups),
      name: groupName,
      type: normalizedType,
      symbols: normalizedSymbols,
      colorFlags
    })
  ];
};

export const renameWatchlistGroup = (groups = [], groupId, name) => {
  const nextName = String(name || '').trim();
  if (!nextName) return groups;

  return groups.map(group => (
    group.id === groupId && !group.system ? { ...group, name: nextName } : group
  ));
};

export const cloneWatchlistGroup = (groups = [], groupId, name) => {
  const source = getGroupById(groups, groupId);
  if (!source) return groups;

  const cloneName = String(name || '').trim() || `${source.name} Copy`;
  return [
    ...groups,
    createGroup({
      id: createGroupId(cloneName, source.type, groups),
      name: cloneName,
      type: 'mixed',
      symbols: [...(source.symbols || [])],
      colorFlags: { ...(source.colorFlags || {}) }
    })
  ];
};

export const deleteWatchlistGroup = (groups = [], groupId) => (
  groups.filter(group => group.id !== groupId || group.system)
);

export const toggleGroupSymbol = (groups = [], groupId, item) => {
  const symbol = normalizeSymbol(item?.symbol);
  if (!symbol) return groups;

  return groups.map(group => {
    if (group.id !== groupId) return group;
    if (group.type !== 'mixed' && group.type !== getSymbolType(item)) return group;

    const exists = (group.symbols || []).map(normalizeSymbol).includes(symbol);
    const symbols = exists
      ? group.symbols.filter(value => normalizeSymbol(value) !== symbol)
      : [...(group.symbols || []), symbol];
    const colorFlags = { ...(group.colorFlags || {}) };
    if (exists) delete colorFlags[symbol];

    return { ...group, symbols, colorFlags };
  });
};

export const setGroupSymbolColor = (groups = [], groupId, symbol, color) => {
  const normalizedSymbol = normalizeSymbol(symbol);

  return groups.map(group => {
    if (group.id !== groupId) return group;
    const colorFlags = { ...(group.colorFlags || {}) };
    if (color) colorFlags[normalizedSymbol] = color;
    else delete colorFlags[normalizedSymbol];
    return { ...group, colorFlags };
  });
};

export const getWatchlistCsv = (groups = [], groupId, symbols = marketSymbols) => {
  const rows = getWatchlistRowsFromGroups(groups, groupId, symbols);
  const header = 'Symbol,Name,Last,Change,Score,Color';
  const body = rows.map(row => [
    row.symbol,
    row.name,
    row.last,
    row.change,
    row.score,
    row.colorFlag || ''
  ].map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','));

  return [header, ...body].join('\n');
};

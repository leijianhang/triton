import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addWatchlistGroup,
  cloneWatchlistGroup,
  createDefaultWatchlistGroups,
  createDefaultWatchlistSymbols,
  deleteWatchlistGroup,
  getWatchlistCsv,
  getWatchlistRowsFromGroups,
  getWatchlistRowsFromSymbols,
  isSymbolWatched,
  normalizeWatchlistGroups,
  renameWatchlistGroup,
  setGroupSymbolColor,
  toggleGroupSymbol,
  toggleWatchlistSymbol
} from './watchlistModel.js';

test('toggles symbols in and out of a typed watchlist', () => {
  const watchlist = createDefaultWatchlistSymbols();

  const added = toggleWatchlistSymbol(watchlist, { symbol: '300750', type: 'stock' });
  assert.equal(isSymbolWatched(added, { symbol: '300750', type: 'stock' }), true);

  const removed = toggleWatchlistSymbol(added, { symbol: '300750', type: 'stock' });
  assert.equal(isSymbolWatched(removed, { symbol: '300750', type: 'stock' }), false);
});

test('builds watchlist rows from watched symbols', () => {
  const rows = getWatchlistRowsFromSymbols({
    stock: ['600519', '000858'],
    us: ['AAPL']
  }, 'stock');

  assert.deepEqual(rows.map(row => row.symbol), ['600519', '000858']);
});

test('creates custom watchlist groups and adds symbols to a selected group', () => {
  const groups = addWatchlistGroup(createDefaultWatchlistGroups(), {
    name: 'Breakouts',
    type: 'stock'
  });
  const customGroup = groups.find(group => group.name === 'Breakouts');

  const updated = toggleGroupSymbol(groups, customGroup.id, { symbol: '600519', type: 'stock' });
  const rows = getWatchlistRowsFromGroups(updated, customGroup.id);

  assert.deepEqual(rows.map(row => row.symbol), ['600519']);
});

test('creates custom watchlist groups with initial symbols', () => {
  const groups = addWatchlistGroup(createDefaultWatchlistGroups(), {
    name: 'US Momentum',
    type: 'us',
    symbols: ['AAPL', 'NVDA']
  });
  const customGroup = groups.find(group => group.name === 'US Momentum');

  assert.deepEqual(
    getWatchlistRowsFromGroups(groups, customGroup.id).map(row => row.symbol),
    ['AAPL', 'NVDA']
  );
});

test('custom watchlist groups can mix symbols from different asset classes', () => {
  const groups = addWatchlistGroup(createDefaultWatchlistGroups(), {
    name: 'Mixed',
    symbols: ['600519', 'AAPL']
  });
  const customGroup = groups.find(group => group.name === 'Mixed');

  assert.equal(customGroup.type, 'mixed');
  assert.deepEqual(
    getWatchlistRowsFromGroups(groups, customGroup.id).map(row => row.symbol),
    ['600519', 'AAPL']
  );

  const updated = toggleGroupSymbol(groups, customGroup.id, { symbol: '0700.HK', type: 'hk' });
  assert.deepEqual(
    getWatchlistRowsFromGroups(updated, customGroup.id).map(row => row.symbol),
    ['600519', 'AAPL', '0700.HK']
  );
});

test('global watchlist toggle removes a symbol from every watched group', () => {
  const groups = addWatchlistGroup(createDefaultWatchlistGroups(), {
    name: 'Mixed',
    symbols: ['600519', 'AAPL']
  });

  assert.equal(isSymbolWatched(groups, { symbol: '600519', type: 'stock' }), true);

  const updated = toggleWatchlistSymbol(groups, { symbol: '600519', type: 'stock' });

  assert.equal(isSymbolWatched(updated, { symbol: '600519', type: 'stock' }), false);
  assert.deepEqual(getWatchlistRowsFromGroups(updated, 'stock-default').map(row => row.symbol), ['000858', '600036']);
  assert.deepEqual(
    getWatchlistRowsFromGroups(updated, updated.find(group => group.name === 'Mixed').id).map(row => row.symbol),
    ['AAPL']
  );
});

test('deletes custom watchlist groups but keeps default groups', () => {
  const groups = addWatchlistGroup(createDefaultWatchlistGroups(), {
    name: 'Temporary',
    type: 'hk'
  });
  const customGroup = groups.find(group => group.name === 'Temporary');

  assert.equal(deleteWatchlistGroup(groups, customGroup.id).some(group => group.id === customGroup.id), false);
  assert.equal(deleteWatchlistGroup(groups, 'stock-default').some(group => group.id === 'stock-default'), true);
});

test('normalizes missing or legacy watchlist state into groups with rows', () => {
  const groups = normalizeWatchlistGroups(undefined, {
    stock: ['600519'],
    us: ['AAPL'],
    hk: ['0700.HK']
  });

  assert.deepEqual(getWatchlistRowsFromGroups(groups, 'stock-default').map(row => row.symbol), ['600519']);
  assert.deepEqual(getWatchlistRowsFromGroups(groups, 'us-default').map(row => row.symbol), ['AAPL']);
  assert.deepEqual(getWatchlistRowsFromGroups(groups, 'hk-default').map(row => row.symbol), ['0700.HK']);
});

test('renames and clones custom watchlists', () => {
  const groups = addWatchlistGroup(createDefaultWatchlistGroups(), { name: 'Observe', type: 'stock' });
  const customGroup = groups.find(group => group.name === 'Observe');
  const withSymbol = toggleGroupSymbol(groups, customGroup.id, { symbol: '600519', type: 'stock' });
  const renamed = renameWatchlistGroup(withSymbol, customGroup.id, 'Core Observe');
  const cloned = cloneWatchlistGroup(renamed, customGroup.id, 'Core Observe Copy');

  assert.equal(renamed.find(group => group.id === customGroup.id).name, 'Core Observe');
  assert.deepEqual(
    getWatchlistRowsFromGroups(cloned, cloned.find(group => group.name === 'Core Observe Copy').id).map(row => row.symbol),
    ['600519']
  );
});

test('cloned watchlists become mixed custom lists and can add other asset classes', () => {
  const groups = cloneWatchlistGroup(createDefaultWatchlistGroups(), 'us-default', 'US Copy');
  const clonedGroup = groups.find(group => group.name === 'US Copy');

  assert.equal(clonedGroup.type, 'mixed');

  const updated = toggleGroupSymbol(groups, clonedGroup.id, { symbol: '0700.HK', type: 'hk' });

  assert.deepEqual(
    getWatchlistRowsFromGroups(updated, clonedGroup.id).map(row => row.symbol),
    ['AAPL', 'MSFT', 'NVDA', '0700.HK']
  );
});

test('stores color flags and exports csv', () => {
  const groups = setGroupSymbolColor(createDefaultWatchlistGroups(), 'stock-default', '600519', 'green');
  const rows = getWatchlistRowsFromGroups(groups, 'stock-default');
  const csv = getWatchlistCsv(groups, 'stock-default');

  assert.equal(rows.find(row => row.symbol === '600519').colorFlag, 'green');
  assert.equal(csv.includes('"600519"'), true);
  assert.equal(csv.includes('"green"'), true);
});

import assert from 'node:assert/strict';
import {
  createWorkspacePaneSettings,
  reconcileWorkspacePaneSettings,
  syncAllPaneSymbols
} from './workspacePaneSettings.js';

const first = createWorkspacePaneSettings({
  id: 'pane-1',
  symbol: '600519',
  name: '贵州茅台',
  type: 'stock',
  period: 'daily',
  chartStyle: 'candles',
  showVolume: true
});

assert.deepEqual(first, {
  id: 'pane-1',
  symbol: '600519',
  name: '贵州茅台',
  type: 'stock',
  period: 'daily',
  chartStyle: 'candles',
  showVolume: true
});

const reconciled = reconcileWorkspacePaneSettings({
  previous: [
    { id: 'pane-1', symbol: '600519', name: '贵州茅台', type: 'stock', period: '60min', chartStyle: 'line', showVolume: false }
  ],
  count: 3,
  defaults: { symbol: '000858', name: '五粮液', type: 'stock', period: 'daily', chartStyle: 'candles', showVolume: true }
});

assert.equal(reconciled.length, 3);
assert.equal(reconciled[0].symbol, '600519');
assert.equal(reconciled[0].period, '60min');
assert.equal(reconciled[0].chartStyle, 'line');
assert.equal(reconciled[0].showVolume, false);
assert.equal(reconciled[1].symbol, '000858');
assert.equal(reconciled[1].period, 'daily');
assert.equal(reconciled[2].id, 'pane-3');

const reduced = reconcileWorkspacePaneSettings({
  previous: reconciled,
  count: 1,
  defaults: { symbol: 'AAPL', name: 'Apple Inc.', type: 'us', period: 'weekly', chartStyle: 'area', showVolume: false }
});

assert.equal(reduced.length, 1);
assert.equal(reduced[0].id, 'pane-1');
assert.equal(reduced[0].period, '60min');

const synced = syncAllPaneSymbols(reconciled, {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  type: 'us'
});

assert.equal(synced[0].symbol, 'AAPL');
assert.equal(synced[0].name, 'Apple Inc.');
assert.equal(synced[0].type, 'us');
assert.equal(synced[0].period, '60min');
assert.equal(synced[1].symbol, 'AAPL');
assert.equal(synced[2].symbol, 'AAPL');

console.log('workspacePaneSettings tests passed');

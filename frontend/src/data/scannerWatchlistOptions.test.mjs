import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getScannerWatchlistOptions,
  resolveScannerWatchlistSelection
} from './scannerWatchlistOptions.js';

test('scanner list options come from watchlist groups', () => {
  const groups = [
    { id: 'stock-default', name: 'A-share Core', symbols: ['600519', '000858'] },
    { id: 'us-default', name: 'US Large Caps', symbols: ['AAPL'] },
    { id: 'hk-default', name: 'Hong Kong Core', symbols: ['0700.HK'] }
  ];

  assert.deepEqual(getScannerWatchlistOptions(groups), [
    { value: 'stock-default', label: 'A-share Core', count: 2 },
    { value: 'us-default', label: 'US Large Caps', count: 1 },
    { value: 'hk-default', label: 'Hong Kong Core', count: 1 }
  ]);
});

test('scanner list selection falls back to the first watchlist when current list is missing', () => {
  const groups = [
    { id: 'stock-default', name: 'A-share Core', symbols: [] },
    { id: 'us-default', name: 'US Large Caps', symbols: [] }
  ];

  assert.equal(resolveScannerWatchlistSelection('deleted-list', groups), 'stock-default');
});

test('scanner list selection is empty when there are no watchlists', () => {
  assert.equal(resolveScannerWatchlistSelection('deleted-list', []), '');
});

import assert from 'node:assert/strict';
import {
  findSymbol,
  getAlertRows,
  getHappeningRows,
  getScannerRows,
  getStrategyRows,
  getWatchlistRows,
  searchSymbols
} from './marketCatalog.js';

const maotai = findSymbol('600519');
assert.equal(maotai.symbol, '600519');
assert.equal(maotai.type, 'stock');

const usResults = searchSymbols('aapl', 'us');
assert.equal(usResults[0].symbol, 'AAPL');
assert.equal(usResults[0].type, 'us');

const hkResults = searchSymbols('0700', 'hk');
assert.equal(hkResults[0].symbol, '0700.HK');
assert.equal(hkResults[0].type, 'hk');

const scannerRows = getScannerRows();
assert.equal(scannerRows.some(row => row.symbol === 'NVDA' && row.type === 'us'), true);
assert.equal(scannerRows.some(row => row.symbol === '0700.HK' && row.type === 'hk'), true);

const hkWatchlist = getWatchlistRows('hk');
assert.deepEqual(hkWatchlist.map(row => row.symbol), ['0700.HK', '9988.HK', '3690.HK']);

const maotaiAlerts = getAlertRows('600519');
assert.equal(maotaiAlerts[0].name.includes('600519'), true);
assert.equal(maotaiAlerts[0].target, '1698.00');

const appleFeed = getHappeningRows('AAPL');
assert.equal(appleFeed[0].title.includes('AAPL'), true);
assert.equal(appleFeed[0].source, 'Scanner');

const hkStrategies = getStrategyRows('0700.HK');
assert.equal(hkStrategies[0].symbol, '0700.HK');
assert.equal(hkStrategies[0].status, 'Passing');

console.log('marketCatalog tests passed');

import assert from 'node:assert/strict';
import { marketSymbols } from './marketCatalog.js';
import { getSymbolSearchPage } from './symbolSearchModel.js';

const firstStockPage = getSymbolSearchPage({
  symbols: marketSymbols,
  type: 'stock',
  query: '',
  page: 1,
  pageSize: 2
});

assert.equal(firstStockPage.total, 3);
assert.equal(firstStockPage.page, 1);
assert.deepEqual(firstStockPage.items.map(item => item.symbol), ['600519', '000858']);

const secondStockPage = getSymbolSearchPage({
  symbols: marketSymbols,
  type: 'stock',
  query: '',
  page: 2,
  pageSize: 2
});

assert.deepEqual(secondStockPage.items.map(item => item.symbol), ['600036']);

const usSearch = getSymbolSearchPage({
  symbols: marketSymbols,
  type: 'us',
  query: 'AAPL',
  page: 1,
  pageSize: 5
});

assert.equal(usSearch.total, 1);
assert.equal(usSearch.items[0].symbol, 'AAPL');

const correctedPage = getSymbolSearchPage({
  symbols: marketSymbols,
  type: 'hk',
  query: '',
  page: 9,
  pageSize: 2
});

assert.equal(correctedPage.page, 2);
assert.deepEqual(correctedPage.items.map(item => item.symbol), ['3690.HK']);

console.log('symbolSearchModel tests passed');

import assert from 'node:assert/strict';
import {
  clearDrawingsForSymbol,
  createDrawing,
  deleteDrawing,
  getDrawingSymbolKey,
  getDrawingsForSymbol,
  updateDrawing,
  upsertDrawing
} from './drawingTools.js';

const symbol = { symbol: '600519', symbolType: 'stock' };
const key = getDrawingSymbolKey(symbol);

assert.equal(key, 'stock:600519');
assert.equal(getDrawingSymbolKey({ symbol: 'AAPL', type: 'us' }), 'us:AAPL');
assert.equal(getDrawingSymbolKey({ symbol: '' }), null);

const drawing = createDrawing({
  id: 'drawing-1',
  tool: 'segment',
  symbol: symbol.symbol,
  symbolType: symbol.symbolType,
  anchors: [
    { time: 1714465800, price: 10 },
    { time: 1714469400, price: 11.5 }
  ],
  now: 1000
});

assert.deepEqual(drawing, {
  id: 'drawing-1',
  type: 'segment',
  symbol: '600519',
  symbolType: 'stock',
  anchors: [
    { time: 1714465800, price: 10 },
    { time: 1714469400, price: 11.5 }
  ],
  text: '',
  style: {
    color: '#4ee093',
    width: 2,
    dash: 'solid'
  },
  createdAt: 1000,
  updatedAt: 1000
});

const withDrawing = upsertDrawing({}, drawing);
assert.equal(getDrawingsForSymbol(withDrawing, symbol).length, 1);
assert.equal(getDrawingsForSymbol(withDrawing, { symbol: '000858', symbolType: 'stock' }).length, 0);

const deleted = deleteDrawing(withDrawing, 'drawing-1');
assert.equal(getDrawingsForSymbol(deleted, symbol).length, 0);

const restored = upsertDrawing(withDrawing, {
  ...drawing,
  id: 'drawing-2'
});
assert.equal(clearDrawingsForSymbol(restored, symbol)[key], undefined);

const moved = updateDrawing(withDrawing, 'drawing-1', {
  anchors: [
    { time: 1714465800, price: 12 },
    { time: 1714469400, price: 13.5 },
    { time: Number.NaN, price: 99 }
  ]
}, 2000);
assert.deepEqual(getDrawingsForSymbol(moved, symbol)[0].anchors, [
  { time: 1714465800, price: 12 },
  { time: 1714469400, price: 13.5 }
]);
assert.equal(getDrawingsForSymbol(moved, symbol)[0].updatedAt, 2000);

console.log('drawingTools tests passed');

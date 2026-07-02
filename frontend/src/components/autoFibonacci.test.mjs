import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatAutoFibonacciLevel,
  getAutoFibonacciModel,
  getAutoFibonacciWindow
} from './autoFibonacci.js';

const makeBar = (index, high, low, close = (high + low) / 2) => ({
  time: 1700000000 + index * 86400,
  open: close,
  high,
  low,
  close
});

test('auto fibonacci uses the current visible window', () => {
  const data = Array.from({ length: 12 }, (_, index) => makeBar(index, 100 + index, 90 + index));
  const windowRows = getAutoFibonacciWindow(data, { from: 4.2, to: 8.6 });

  assert.deepEqual(windowRows.map(row => row.index), [4, 5, 6, 7, 8, 9]);
});

test('auto fibonacci returns chronological swing anchors and levels', () => {
  const data = [
    makeBar(0, 102, 96),
    makeBar(1, 101, 95),
    makeBar(2, 104, 94),
    makeBar(3, 108, 99),
    makeBar(4, 112, 103),
    makeBar(5, 110, 104),
    makeBar(6, 116, 106),
    makeBar(7, 114, 105)
  ];

  const model = getAutoFibonacciModel(data, { from: 0, to: 6 });

  assert.equal(model.start.index, 2);
  assert.equal(model.start.type, 'low');
  assert.equal(model.end.index, 6);
  assert.equal(model.end.type, 'high');
  assert.equal(model.direction, 'up');
  assert.equal(model.analysis.time, data[6].time);
  assert.equal(model.levels.length, 18);
  assert.deepEqual(model.levels.map(item => item.level), [
    -1,
    -0.786,
    -0.618,
    -0.5,
    -0.382,
    -0.236,
    0,
    0.236,
    0.382,
    0.5,
    0.618,
    0.786,
    1,
    1.382,
    1.618,
    2,
    2.618,
    4.236
  ]);
  assert.equal(model.levels.find(item => item.level === 0.5).price, 105);
});

test('auto fibonacci formats percentage labels', () => {
  assert.equal(formatAutoFibonacciLevel(-0.786), '-0.786');
  assert.equal(formatAutoFibonacciLevel(0.236), '0.236');
  assert.equal(formatAutoFibonacciLevel(0.5), '0.5');
  assert.equal(formatAutoFibonacciLevel(4.236), '4.236');
  assert.equal(formatAutoFibonacciLevel(1), '1');
});

import assert from 'node:assert/strict';
import {
  chartStyleOptions,
  getChartStyleOption,
  getTimeframeOption,
  timeframeOptions
} from './chartControlOptions.js';

assert.equal(timeframeOptions.length, 8);
assert.equal(getTimeframeOption('60min').label, '1h');
assert.equal(getTimeframeOption('unknown').label, 'D');

assert.deepEqual(chartStyleOptions.map(item => item.value), ['candles', 'heikinAshi', 'bars', 'line', 'area']);
assert.equal(getChartStyleOption('candles').label, 'Candles');
assert.equal(getChartStyleOption('heikinAshi').label, 'Heikin Ashi');
assert.equal(getChartStyleOption('bars').label, 'Bars');
assert.equal(getChartStyleOption('missing').value, 'candles');

console.log('chartControlOptions tests passed');

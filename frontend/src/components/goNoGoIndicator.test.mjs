import assert from 'node:assert/strict';
import {
  applyGoNoGoColors,
  calculateGoNoGoStates,
  GO_NO_GO_COLORS
} from './goNoGoIndicator.js';

const rising = Array.from({ length: 80 }, (_, index) => ({
  time: index + 1,
  open: 100 + index,
  high: 102 + index,
  low: 99 + index,
  close: 101 + index
}));
const falling = rising.map((item, index) => ({
  ...item,
  open: 200 - index,
  high: 201 - index,
  low: 198 - index,
  close: 199 - index
}));

assert.equal(calculateGoNoGoStates(rising).at(-1).state, 'strongGo');
assert.equal(calculateGoNoGoStates(falling).at(-1).state, 'strongNoGo');
assert.equal(calculateGoNoGoStates(rising).length, rising.length);

const coloredCandles = applyGoNoGoColors(rising);
assert.equal(coloredCandles.at(-1).color, GO_NO_GO_COLORS.strongGo);
assert.equal(coloredCandles.at(-1).wickColor, GO_NO_GO_COLORS.strongGo);

const coloredBars = applyGoNoGoColors(falling, false);
assert.equal(coloredBars.at(-1).color, GO_NO_GO_COLORS.strongNoGo);
assert.equal('wickColor' in coloredBars.at(-1), false);

console.log('GoNoGo indicator tests passed');

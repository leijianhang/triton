import assert from 'node:assert/strict';
import {
  clampReplayIndex,
  getDefaultReplayIndex,
  getReplaySlice
} from './replayModel.js';

assert.equal(getDefaultReplayIndex(0), 0);
assert.equal(getDefaultReplayIndex(10), 9);
assert.equal(getDefaultReplayIndex(200), 70);

assert.equal(clampReplayIndex(-10, 20), 0);
assert.equal(clampReplayIndex(25, 20), 19);
assert.equal(clampReplayIndex(4.8, 20), 4);

const rows = Array.from({ length: 6 }, (_, index) => ({ time: index + 1 }));
assert.deepEqual(getReplaySlice(rows, 2).map(row => row.time), [1, 2, 3]);
assert.deepEqual(getReplaySlice(rows, 99).map(row => row.time), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(getReplaySlice([], 1), []);

console.log('replayModel tests passed');

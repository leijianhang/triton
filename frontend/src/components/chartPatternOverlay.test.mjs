import assert from 'node:assert/strict';
import test from 'node:test';
import { getChartPatternOverlayItems, shouldRenderChartPattern } from './chartPatternOverlay.js';

const shanghaiTime = value => Math.floor(Date.parse(value.replace(' ', 'T') + '+08:00') / 1000);

test('filters chart pattern overlays by selected and hidden state', () => {
  assert.equal(shouldRenderChartPattern({ selected: ['Double Top'] }, 'Double Top', 'double_top'), true);
  assert.equal(shouldRenderChartPattern({ selected: ['Double Top'], hidden: ['double_top'] }, 'Double Top', 'double_top'), false);
  assert.equal(shouldRenderChartPattern({ selected: [] }, 'Double Top', 'double_top'), false);
});

test('ignores malformed chart pattern collections', () => {
  assert.deepEqual(getChartPatternOverlayItems({
    showPatterns: true,
    chartPatterns: {
      selected: ['Double Top'],
      patterns: { type: 'double_top' }
    }
  }), []);
});

test('creates structure lines for double top chart patterns', () => {
  const [pattern] = getChartPatternOverlayItems({
    showPatterns: true,
    chartPatterns: {
      selected: ['Double Top'],
      patterns: [{
        type: 'double_top',
        name: 'Double Top',
        signal: 'bearish',
        firstTop: { time: 1, price: 120 },
        secondTop: { time: 3, price: 121 },
        neckline: 104,
        target: 88
      }]
    }
  });

  assert.deepEqual(pattern.lines.map(line => line.kind), ['outline', 'neckline', 'target']);
  assert.deepEqual(pattern.lines[0].points, [{ time: 1, price: 120 }, { time: 3, price: 121 }]);
  assert.deepEqual(pattern.lines[1].points, [{ time: 1, price: 104 }, { time: 3, price: 104 }]);
});

test('creates structure lines when double top and double bottom are selected together', () => {
  const overlays = getChartPatternOverlayItems({
    showPatterns: true,
    chartPatterns: {
      selected: ['Double Top', 'Double Bottom'],
      patterns: [
        {
          type: 'double_top',
          name: 'Double Top',
          signal: 'bearish',
          firstTop: { time: 1, price: 120 },
          secondTop: { time: 3, price: 121 },
          neckline: 104,
          target: 88
        },
        {
          type: 'double_bottom',
          name: 'Double Bottom',
          signal: 'bullish',
          firstBottom: { time: 4, price: 90 },
          secondBottom: { time: 8, price: 91 },
          neckline: 108,
          target: 126
        }
      ]
    }
  });

  assert.equal(overlays.length, 2);
  assert.deepEqual(overlays[1].lines.map(line => line.kind), ['outline', 'neckline', 'target']);
  assert.deepEqual(overlays[1].lines[0].points, [{ time: 4, price: 90 }, { time: 8, price: 91 }]);
});

test('creates support and resistance lines for triangle chart patterns', () => {
  const [pattern] = getChartPatternOverlayItems({
    showPatterns: true,
    chartPatterns: {
      selected: ['Triangle, Ascending'],
      patterns: [{
        type: 'ascending_triangle',
        name: 'Triangle, Ascending',
        signal: 'bullish',
        resistance: 100,
        support: [
          { time: 1, price: 86 },
          { time: 2, price: 90 },
          { time: 3, price: 94 }
        ],
        breakoutTarget: 114
      }]
    }
  });

  assert.deepEqual(pattern.lines.map(line => line.kind), ['resistance', 'support', 'target']);
  assert.deepEqual(pattern.lines[0].points, [{ time: 1, price: 100 }, { time: 3, price: 100 }]);
  assert.deepEqual(pattern.lines[1].points.at(-1), { time: 3, price: 94 });
});

test('converts intraday chart pattern anchor times before drawing overlays', () => {
  const [pattern] = getChartPatternOverlayItems({
    showPatterns: true,
    chartPatterns: {
      selected: ['Double Top'],
      patterns: [{
        type: 'double_top',
        name: 'Double Top',
        signal: 'bearish',
        firstTop: { time: '2025-08-06 13:07:00', price: 120 },
        secondTop: { time: '2025-08-06 13:15:00', price: 121 },
        neckline: 104,
        target: 88
      }]
    }
  });

  assert.equal(pattern.lines[0].points[0].time, shanghaiTime('2025-08-06 13:07:00'));
  assert.equal(typeof pattern.lines[0].points[0].time, 'number');
});

test('creates boundary lines for channel and wedge chart patterns', () => {
  const [pattern] = getChartPatternOverlayItems({
    showPatterns: true,
    chartPatterns: {
      selected: ['Channel, Ascending'],
      patterns: [{
        type: 'ascending_channel',
        name: 'Channel, Ascending',
        signal: 'neutral',
        resistance: [
          { time: 1, price: 110 },
          { time: 3, price: 118 }
        ],
        support: [
          { time: 1, price: 96 },
          { time: 3, price: 104 }
        ]
      }]
    }
  });

  assert.deepEqual(pattern.lines.map(line => line.kind), ['resistance', 'support']);
  assert.deepEqual(pattern.lines[0].points.at(-1), { time: 3, price: 118 });
});

test('creates outline and neckline lines for cup and handle chart patterns', () => {
  const [pattern] = getChartPatternOverlayItems({
    showPatterns: true,
    chartPatterns: {
      selected: ['Cup and Handle'],
      patterns: [{
        type: 'cup_and_handle',
        name: 'Cup and Handle',
        signal: 'bullish',
        leftRim: { time: 1, price: 120 },
        cupLow: { time: 2, price: 92 },
        rightRim: { time: 3, price: 119 },
        handleEnd: { time: 4, price: 112 },
        neckline: 120,
        target: 148
      }]
    }
  });

  assert.deepEqual(pattern.lines.map(line => line.kind), ['outline', 'neckline', 'target']);
  assert.deepEqual(pattern.lines[0].points.map(point => point.time), [1, 2, 3, 4]);
});

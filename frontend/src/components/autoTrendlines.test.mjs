import assert from 'node:assert/strict';
import { getAutoTrendlines } from './autoTrendlines.js';

const rows = Array.from({ length: 80 }, (_, index) => {
  const support = 10 + index * 0.08;
  const resistance = 18 + index * 0.09;
  const wave = Math.sin(index / 3) * 1.8;
  const low = support + Math.abs(wave) * 0.2;
  const high = resistance - Math.abs(wave) * 0.2;
  return {
    time: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
    open: low + 1,
    high,
    low,
    close: low + (high - low) * 0.52
  };
});

rows[8].low = 10;
rows[24].low = 11.3;
rows[42].low = 12.65;
rows[63].low = 14.2;
rows[12].high = 19.2;
rows[30].high = 20.8;
rows[48].high = 22.4;
rows[70].high = 24.3;

const relevant = getAutoTrendlines(rows, { quality: 'relevant' });
assert.ok(relevant.length > 0, 'finds automatic trendlines');
assert.ok(relevant.length <= 7, 'most relevant selects from the seven TrendSpider ranking clusters');
assert.ok(relevant.every(line => line.categoryId), 'ranked lines identify their ranking cluster');
assert.ok(relevant.every(line => Number.isFinite(line.strength?.violations)), 'ranked lines expose TrendSpider strength metrics');

const more = getAutoTrendlines(rows, { quality: 'more' });
assert.ok(more.length >= relevant.length, 'more quality returns at least as many lines');
assert.ok(more.every(line => line.categoryId), 'more lines remain ranked by cluster');

const all = getAutoTrendlines(rows, { quality: 'all' });
assert.ok(all.length >= more.length, 'all quality returns at least as many lines');
assert.ok(all.length <= 2000, 'all quality follows the platform rendering bound');

console.log('autoTrendlines tests passed');

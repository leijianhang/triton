import assert from 'node:assert/strict';
import test from 'node:test';
import { clearStoredPatternSelections, getStoredPatternSelections } from './patternSelection.js';

test('uses chart-applied pattern selections when opening Patterns', () => {
  const selected = getStoredPatternSelections({
    candlePatterns: {
      selected: ['Hammer', 'Doji', '2U-2D Reversal']
    },
    chartPatterns: {
      selected: ['Double Top']
    }
  });

  assert.deepEqual(selected, ['Hammer', 'Doji', '2U-2D Reversal', 'Double Top']);
});

test('uses no default selection when no chart pattern selection exists', () => {
  assert.deepEqual(getStoredPatternSelections({}), []);
});

test('clears all applied pattern selections and scan results', () => {
  const cleared = clearStoredPatternSelections({
    candlePatterns: { selected: ['Hammer', '2U-2D Reversal'], hidden: ['Hammer'], patterns: [{ time: '2026-05-17' }], count: 1 },
    chartPatterns: { selected: ['Double Top'], hidden: [], patterns: [{ time: '2026-05-16' }], count: 1 },
    showPatterns: true
  });

  assert.deepEqual(cleared, {
    candlePatterns: { selected: [], hidden: [], patterns: [], count: 0 },
    chartPatterns: { selected: [], hidden: [], patterns: [], count: 0 },
    showPatterns: true
  });
});

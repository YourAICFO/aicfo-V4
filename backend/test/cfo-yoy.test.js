const test = require('node:test');
const assert = require('node:assert/strict');
const { computeYoYGrowth, getRetentionWindow } = require('../src/services/monthlySnapshotService');

test('computeYoYGrowth returns null when prior year is missing or zero', () => {
  assert.equal(computeYoYGrowth(100, null), null);
  assert.equal(computeYoYGrowth(100, 0), null);
});

test('computeYoYGrowth returns ratio vs last year', () => {
  const ratio = computeYoYGrowth(120, 100);
  assert.ok(Math.abs(ratio - 0.2) < 1e-9);
});

test('getRetentionWindow returns 25 months range', () => {
  const { keys } = getRetentionWindow('2026-02');
  assert.equal(keys.length, 25);
  assert.equal(keys[0], '2024-03');
  assert.equal(keys[keys.length - 1], '2026-03');
});

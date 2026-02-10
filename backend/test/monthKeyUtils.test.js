const test = require('node:test');
const assert = require('node:assert/strict');
const { listMonthKeysBetween } = require('../src/utils/monthKeyUtils');

test('listMonthKeysBetween returns inclusive keys', () => {
  const keys = listMonthKeysBetween('2025-01', '2025-03');
  assert.deepEqual(keys, ['2025-01', '2025-02', '2025-03']);
});

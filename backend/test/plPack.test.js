const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPlPackWithDrivers,
  getPlMonths,
  getRemarks,
  buildDriverLists,
  getFyStartMonthKey,
  getLastFySamePeriod,
  safePctChange
} = require('../src/services/plPackService');

test('buildDriverLists returns topPositive and topNegative', () => {
  const deltas = { A: 10, B: -5, C: 3 };
  const { topPositive, topNegative } = buildDriverLists(deltas, 5);
  assert.ok(Array.isArray(topPositive));
  assert.ok(Array.isArray(topNegative));
  assert.equal(topPositive.length, 2);
  assert.equal(topNegative.length, 1);
  assert.equal(topPositive[0].key, 'A');
  assert.equal(topPositive[0].amount, 10);
  assert.equal(topNegative[0].key, 'B');
  assert.equal(topNegative[0].amount, -5);
});

test('buildDriverLists respects limit', () => {
  const deltas = { A: 1, B: 2, C: 3, D: 4, E: 5 };
  const { topPositive } = buildDriverLists(deltas, 2);
  assert.equal(topPositive.length, 2);
});

test('getFyStartMonthKey Apr–Mar: Apr–Dec same FY', () => {
  assert.equal(getFyStartMonthKey('2025-04'), '2025-04');
  assert.equal(getFyStartMonthKey('2025-06'), '2025-04');
  assert.equal(getFyStartMonthKey('2025-12'), '2025-04');
});

test('getFyStartMonthKey Apr–Mar: Jan–Mar prior FY', () => {
  assert.equal(getFyStartMonthKey('2025-01'), '2024-04');
  assert.equal(getFyStartMonthKey('2025-02'), '2024-04');
  assert.equal(getFyStartMonthKey('2025-03'), '2024-04');
});

test('getLastFySamePeriod aligns same period prior FY', () => {
  const june = getLastFySamePeriod('2025-06');
  assert.equal(june.start, '2024-04');
  assert.equal(june.end, '2024-06');
  const feb = getLastFySamePeriod('2025-02');
  assert.equal(feb.start, '2023-04');
  assert.equal(feb.end, '2024-02');
  const apr = getLastFySamePeriod('2025-04');
  assert.equal(apr.start, '2024-04');
  assert.equal(apr.end, '2024-04');
});

test('safePctChange returns null when prev is 0', () => {
  assert.equal(safePctChange(0, 100), null);
  assert.equal(safePctChange(0, 0), null);
});

test('safePctChange returns number when prev non-zero', () => {
  assert.equal(safePctChange(100, 120), 20);
  assert.equal(safePctChange(100, 80), -20);
  assert.equal(safePctChange(100, 100), 0);
});

test('safePctChange returns null for non-finite', () => {
  assert.equal(safePctChange(NaN, 100), null);
  assert.equal(safePctChange(100, NaN), null);
});

function isDbUnavailable(err) {
  const name = err?.name || '';
  const msg = String(err?.message || '');
  return !process.env.DATABASE_URL || name === 'SequelizeHostNotFoundError' || name === 'SequelizeConnectionRefusedError' || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED');
}

test('getPlPackWithDrivers response shape (v2, DB)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  try {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const monthKey = '2025-01';
    const data = await getPlPackWithDrivers(companyId, monthKey);
    assert.ok(data);
    assert.equal(data.month, monthKey);
    assert.ok(data.current && typeof data.current.totalRevenue === 'number');
    assert.ok(data.variances && typeof data.variances.revenue === 'number');
    assert.ok('revenuePct' in data.variances);
    assert.ok(data.ytd && typeof data.ytd.totalRevenue === 'number');
    assert.ok(data.ytd.grossProfit !== undefined);
    assert.ok(data.ytdLastFy && typeof data.ytdLastFy.totalRevenue === 'number');
    assert.ok(data.ytdVarianceAmount && typeof data.ytdVarianceAmount.revenue === 'number');
    assert.ok(data.ytdVariancePct && (typeof data.ytdVariancePct.revenue === 'number' || data.ytdVariancePct.revenue === null));
    assert.ok(data.drivers);
  } catch (err) {
    if (isDbUnavailable(err)) {
      t.skip('Database not available');
      return;
    }
    throw err;
  }
});

test('getRemarks returns empty shape when no row', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  try {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const monthKey = '2099-12';
    const data = await getRemarks(companyId, monthKey);
    assert.ok(data);
    assert.ok('text' in data && 'aiDraftText' in data && 'updatedAt' in data);
    assert.equal(data.text, null);
    assert.equal(data.aiDraftText, null);
  } catch (err) {
    if (isDbUnavailable(err)) {
      t.skip('Database not available');
      return;
    }
    throw err;
  }
});

test('getPlMonths returns shape (DB)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  try {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const data = await getPlMonths(companyId);
    assert.ok(data);
    assert.ok(Array.isArray(data.months));
    assert.ok(data.latest === null || typeof data.latest === 'string');
  } catch (err) {
    if (isDbUnavailable(err)) {
      t.skip('Database not available');
      return;
    }
    throw err;
  }
});

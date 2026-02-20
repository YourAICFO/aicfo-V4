const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeRunwayFromSeries,
  getCashBankSeries,
  getRunway,
  LABEL_GROWING,
  LABEL_INSUFFICIENT,
  LABEL_CRITICAL,
  MIN_MONTHS_FOR_RUNWAY
} = require('../src/services/runwayService');

test('computeRunwayFromSeries: negative avg => numeric runway', () => {
  const r = computeRunwayFromSeries(600000, 6, -100000);
  assert.equal(r.runwayMonths, 6);
  assert.equal(r.status, 'GREEN');
  assert.ok(r.statusLabel.includes('months'));
});

test('computeRunwayFromSeries: negative avg => AMBER at 3–6 months', () => {
  const r = computeRunwayFromSeries(400000, 5, -100000);
  assert.equal(r.runwayMonths, 4);
  assert.equal(r.status, 'AMBER');
});

test('computeRunwayFromSeries: negative avg => RED below 3 months', () => {
  const r = computeRunwayFromSeries(200000, 5, -100000);
  assert.equal(r.runwayMonths, 2);
  assert.equal(r.status, 'RED');
});

test('computeRunwayFromSeries: positive avg => Growing', () => {
  const r = computeRunwayFromSeries(500000, 6, 50000);
  assert.equal(r.runwayMonths, null);
  assert.equal(r.status, 'GREEN');
  assert.equal(r.statusLabel, LABEL_GROWING);
});

test('computeRunwayFromSeries: zero avg => Growing', () => {
  const r = computeRunwayFromSeries(500000, 6, 0);
  assert.equal(r.runwayMonths, null);
  assert.equal(r.statusLabel, LABEL_GROWING);
});

test('computeRunwayFromSeries: insufficient data (< 3 months)', () => {
  const r = computeRunwayFromSeries(500000, 2, -100000);
  assert.equal(r.runwayMonths, null);
  assert.equal(r.status, 'UNKNOWN');
  assert.equal(r.statusLabel, LABEL_INSUFFICIENT);
});

test('computeRunwayFromSeries: zero cash => Critical', () => {
  const r = computeRunwayFromSeries(0, 6, -100000);
  assert.equal(r.runwayMonths, 0);
  assert.equal(r.status, 'RED');
  assert.equal(r.statusLabel, LABEL_CRITICAL);
});

test('computeRunwayFromSeries: negative cash => Critical', () => {
  const r = computeRunwayFromSeries(-50000, 6, -100000);
  assert.equal(r.runwayMonths, 0);
  assert.equal(r.statusLabel, LABEL_CRITICAL);
});

test('getRunway returns shape and explainability fields (DB)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  try {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const r = await getRunway(companyId);
    assert.ok(typeof r.currentCashBankClosing === 'number');
    assert.ok(typeof r.cashBase === 'number');
    assert.ok(r.avgNetCashChange6M === null || typeof r.avgNetCashChange6M === 'number');
    assert.ok(r.runwayMonths === null || typeof r.runwayMonths === 'number');
    assert.ok(typeof r.status === 'string');
    assert.ok(typeof r.statusLabel === 'string');
    assert.ok(Array.isArray(r.runwaySeries));
    assert.ok(r.runwaySeries.length <= 6);
    r.runwaySeries.forEach((s) => {
      assert.ok(typeof s.month === 'string');
      assert.ok(typeof s.netChange === 'number');
      assert.ok(typeof s.closing === 'number');
    });
  } catch (err) {
    if (err?.name === 'SequelizeHostNotFoundError' || err?.message?.includes('ENOTFOUND') || err?.message?.includes('ECONNREFUSED')) {
      t.skip('Database not available');
      return;
    }
    throw err;
  }
});

test('getCashBankSeries returns shape (DB)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  try {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const r = await getCashBankSeries(companyId, 6);
    assert.ok(Array.isArray(r.months));
    assert.ok(Array.isArray(r.series));
    r.series.forEach((s) => {
      assert.ok(typeof s.month === 'string');
      assert.ok(typeof s.opening === 'number');
      assert.ok(typeof s.closing === 'number');
      assert.ok(typeof s.netChange === 'number');
    });
  } catch (err) {
    if (err?.name === 'SequelizeHostNotFoundError' || err?.message?.includes('ENOTFOUND') || err?.message?.includes('ECONNREFUSED')) {
      t.skip('Database not available');
      return;
    }
    throw err;
  }
});

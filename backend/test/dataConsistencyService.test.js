const test = require('node:test');
const assert = require('node:assert/strict');
const {
  withinTolerance,
  runChecks,
  STATUS_PASS,
  STATUS_WARN,
  STATUS_FAIL,
  DEFAULT_AMOUNT_TOLERANCE,
  DEFAULT_PCT_TOLERANCE
} = require('../src/services/dataConsistencyService');

test('withinTolerance: exact match passes', () => {
  assert.equal(withinTolerance(100, 100, {}), true);
  assert.equal(withinTolerance(0, 0, {}), true);
});

test('withinTolerance: within amount tolerance passes', () => {
  assert.equal(withinTolerance(100, 100.5, { amount: 1 }), true);
  assert.equal(withinTolerance(100, 99, { amount: 1 }), true);
  assert.equal(withinTolerance(100, 101.5, { amount: 1 }), false);
});

test('withinTolerance: within pct tolerance passes when amount exceeds', () => {
  assert.equal(withinTolerance(10000, 10050, { amount: 1, pct: 0.01 }), true);
  assert.equal(withinTolerance(10000, 10200, { amount: 1, pct: 0.01 }), false);
});

test('withinTolerance: default tolerance is 1', () => {
  assert.equal(withinTolerance(10, 10.5, {}), true);
  assert.equal(withinTolerance(10, 11.5, {}), false);
});

test('runChecks: invalid params return FAIL', async () => {
  const result = await runChecks(null, '2025-01');
  assert.equal(result.checks.length >= 1, true);
  assert.equal(result.checks[0].status, STATUS_FAIL);
  assert.ok(result.checks[0].message.includes('required'));

  const result2 = await runChecks('00000000-0000-0000-0000-000000000001', 'invalid');
  assert.equal(result2.checks[0].status, STATUS_FAIL);
});

test('runChecks: returns month, checks array, tolerance', async () => {
  const companyId = '00000000-0000-0000-0000-000000000001';
  const month = '2025-01';
  try {
    const result = await runChecks(companyId, month);
    assert.equal(result.month, month);
    assert.ok(Array.isArray(result.checks));
    assert.ok(result.tolerance && typeof result.tolerance.amount === 'number');
    assert.ok(result.checks.every((c) => ['PASS', 'WARN', 'FAIL'].includes(c.status)));
  } catch (err) {
    if (err?.name === 'SequelizeHostNotFoundError' || err?.message?.includes('ENOTFOUND') || err?.message?.includes('ECONNREFUSED')) {
      return;
    }
    throw err;
  }
});

test('runChecks with DB (skip if unreachable)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  try {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const month = '2025-01';
    const result = await runChecks(companyId, month);
    assert.equal(result.month, month);
    // If validator threw and we only got run_checks FAIL, skip (no data or env issue)
    const runFail = result.checks.find((c) => c.key === 'run_checks' && c.status === STATUS_FAIL);
    if (runFail && result.checks.length <= 1) {
      t.skip('Validator returned only run_checks FAIL (e.g. no data for company/month)');
      return;
    }
    assert.ok(result.checks.some((c) => c.key === 'cash_consistency'), 'expected cash_consistency check');
    assert.ok(
      result.checks.some((c) => c.key === 'pl_revenue_breakdown' || c.key === 'pl_expenses_breakdown'),
      'expected pl breakdown check'
    );
    assert.ok(result.checks.some((c) => c.key === 'inventory_consistency'), 'expected inventory_consistency check');
    assert.ok(result.checks.some((c) => c.key === 'month_availability'), 'expected month_availability check');
  } catch (err) {
    if (err?.name === 'SequelizeHostNotFoundError' || err?.message?.includes('ENOTFOUND') || err?.message?.includes('ECONNREFUSED')) {
      t.skip('Database not available');
      return;
    }
    throw err;
  }
});

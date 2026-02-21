const test = require('node:test');
const assert = require('node:assert/strict');
const { createDemoCompany, getLatestClosedMonthKey } = require('../src/services/demoSeedService');

test('getLatestClosedMonthKey returns YYYY-MM format', () => {
  const key = getLatestClosedMonthKey();
  assert.ok(/^\d{4}-\d{2}$/.test(key), 'expected YYYY-MM format');
});

test('createDemoCompany return shape (DB)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  const userId = '00000000-0000-0000-0000-000000000001';
  try {
    const result = await createDemoCompany(userId);
    assert.ok(result && typeof result === 'object');
    assert.ok(result.company);
    assert.ok(result.company.id);
    assert.strictEqual(result.company.name, 'Demo Company');
    assert.strictEqual(result.company.isDemo, true);
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    const code = (err && err.code) || (err && err.parent && err.parent.code);
    const dbUnavailable =
      code === 'ENOTFOUND' ||
      (typeof msg === 'string' && (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || /database|relation.*does not exist|HostNotFound/i.test(msg)));
    if (dbUnavailable) {
      t.skip('Database not available or migrations not run');
      return;
    }
    throw err;
  }
});


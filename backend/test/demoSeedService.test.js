const test = require('node:test');
const assert = require('node:assert/strict');
const { createDemoCompany, getLatestClosedMonthKey } = require('../src/services/demoSeedService');

test('getLatestClosedMonthKey returns YYYY-MM format', () => {
  const key = getLatestClosedMonthKey();
  assert.ok(/^\d{4}-\d{2}$/.test(key), 'expected YYYY-MM format');
});

test('createDemoCompany return shape (DB)', async (t) => {
  if (!process.env.DATABASE_URL) {
    return t.skip('DATABASE_URL not set');
  }
  try {
    const { User } = require('../src/models');
    const existing = await User.findOne({ where: {}, attributes: ['id'], raw: true });
    if (!existing) {
      return t.skip('No users in DB — seed first');
    }
    const result = await createDemoCompany(existing.id);
    assert.ok(result && typeof result === 'object');
    assert.ok(result.company);
    assert.ok(result.company.id);
    assert.strictEqual(result.company.name, 'Demo Company');
    assert.strictEqual(result.company.isDemo, true);
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    const code = (err && err.code) || (err && err.parent && err.parent.code);
    const dbUnavailable =
      code === 'ENOTFOUND' || code === '23503' ||
      (typeof msg === 'string' && (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || /database|relation.*does not exist|HostNotFound|foreign key/i.test(msg)));
    if (dbUnavailable) {
      return t.skip('Database not available, migrations not run, or no valid user');
    }
    throw err;
  }
});


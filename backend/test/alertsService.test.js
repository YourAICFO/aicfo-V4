const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeConditionHash,
  getAlerts,
  getRawAlerts,
  snooze,
  dismiss,
  clear
} = require('../src/services/alertsService');

test('computeConditionHash: stable string for ruleKey, month, bucket', () => {
  assert.equal(computeConditionHash('runway_low', '2025-01', 2), 'runway_low|2025-01|2');
  assert.equal(computeConditionHash('net_profit_drop', '2025-01', 35), 'net_profit_drop|2025-01|35');
  assert.equal(computeConditionHash('revenue_drop', '2024-12', ''), 'revenue_drop|2024-12|');
  assert.notEqual(computeConditionHash('runway_low', '2025-01', 2), computeConditionHash('runway_low', '2025-02', 2));
  assert.notEqual(computeConditionHash('runway_low', '2025-01', 2), computeConditionHash('runway_low', '2025-01', 3));
});

test('getRawAlerts returns array (no DB required for empty company)', async () => {
  const companyId = '00000000-0000-0000-0000-000000000001';
  try {
    const raw = await getRawAlerts(companyId);
    assert.ok(Array.isArray(raw));
    raw.forEach((a) => {
      assert.ok(typeof a.ruleKey === 'string');
      assert.ok(typeof a.conditionHash === 'string');
      assert.ok(['critical', 'high', 'medium'].includes(a.severity));
    });
  } catch (err) {
    if (err?.name === 'SequelizeHostNotFoundError' || err?.message?.includes('ENOTFOUND') || err?.message?.includes('ECONNREFUSED')) {
      return;
    }
    throw err;
  }
});

test('getAlerts returns shape with state fields (DB)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  try {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const list = await getAlerts(companyId);
    assert.ok(Array.isArray(list));
    assert.ok(list.length <= 5);
    list.forEach((a) => {
      assert.ok(typeof a.id === 'string');
      assert.ok(typeof a.ruleKey === 'string');
      assert.ok(typeof a.title === 'string');
      assert.ok(typeof a.message === 'string');
      assert.ok(typeof a.link === 'string');
      assert.ok(a.isSnoozed === false);
      assert.ok(a.snoozedUntil === null);
      assert.ok(a.isDismissed === false);
    });
  } catch (err) {
    if (err?.name === 'SequelizeHostNotFoundError' || err?.message?.includes('ENOTFOUND') || err?.message?.includes('ECONNREFUSED')) {
      t.skip('Database not available');
      return;
    }
    throw err;
  }
});

test('snooze rejects invalid days', async () => {
  await assert.rejects(
    async () => snooze('00000000-0000-0000-0000-000000000001', 'runway_low', 14),
    /days must be one of/
  );
});

test('snooze and clear (DB)', async (t) => {
  if (!process.env.DATABASE_URL) {
    return t.skip('DATABASE_URL not set');
  }
  try {
    const { Company } = require('../src/models');
    const company = await Company.findOne({ where: {}, attributes: ['id'], raw: true });
    if (!company) return t.skip('No companies in DB — seed first');

    await snooze(company.id, 'runway_low', 7);
    const afterSnooze = await getAlerts(company.id);
    assert.ok(Array.isArray(afterSnooze));
    const runwayShown = afterSnooze.find((a) => a.ruleKey === 'runway_low');
    assert.ok(!runwayShown, 'runway_low should be hidden when snoozed (or absent for this company)');
    await clear(company.id, 'runway_low');
  } catch (err) {
    if (err?.name === 'SequelizeHostNotFoundError' || err?.name === 'SequelizeForeignKeyConstraintError' || err?.message?.includes('ENOTFOUND') || err?.message?.includes('ECONNREFUSED')) {
      return t.skip('Database not available or no test data');
    }
    throw err;
  }
});

test('dismiss and clear (DB)', async (t) => {
  if (!process.env.DATABASE_URL) {
    return t.skip('DATABASE_URL not set');
  }
  try {
    const { Company } = require('../src/models');
    const company = await Company.findOne({ where: {}, attributes: ['id'], raw: true });
    if (!company) return t.skip('No companies in DB — seed first');

    await dismiss(company.id, 'revenue_drop');
    const afterDismiss = await getAlerts(company.id);
    assert.ok(Array.isArray(afterDismiss));
    const revDropShown = afterDismiss.find((a) => a.ruleKey === 'revenue_drop');
    assert.ok(!revDropShown, 'revenue_drop should be hidden when dismissed (or absent)');
    await clear(company.id, 'revenue_drop');
  } catch (err) {
    if (err?.name === 'SequelizeHostNotFoundError' || err?.name === 'SequelizeForeignKeyConstraintError' || err?.message?.includes('ENOTFOUND') || err?.message?.includes('ECONNREFUSED')) {
      return t.skip('Database not available or no test data');
    }
    throw err;
  }
});

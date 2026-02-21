const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getImpactMessages,
  getSuggestedNextSteps,
  getDataHealth
} = require('../src/services/dataHealthService');

test('getImpactMessages returns array of objects with key, message, severity, owner', () => {
  const health = {
    cogsMappingStatus: { isAvailable: false },
    inventoryMappingStatus: {},
    debtorsMappingStatus: {},
    creditorsMappingStatus: {},
    lastSync: { last_sync_status: 'success' },
    classifiedPct: 90
  };
  const messages = getImpactMessages(health);
  assert.ok(Array.isArray(messages));
  assert.ok(messages.length > 0);
  for (const m of messages) {
    assert.ok(typeof m === 'object');
    assert.ok('key' in m && typeof m.key === 'string');
    assert.ok('message' in m && typeof m.message === 'string');
    assert.ok('severity' in m && ['critical', 'high', 'medium', 'low'].includes(m.severity));
    assert.ok('owner' in m && ['user', 'system'].includes(m.owner));
  }
});

test('getImpactMessages returns CCC message when COGS not mapped (severity medium)', () => {
  const health = {
    cogsMappingStatus: { isAvailable: false },
    inventoryMappingStatus: {},
    debtorsMappingStatus: {},
    creditorsMappingStatus: {},
    lastSync: { last_sync_status: 'success' },
    classifiedPct: 90
  };
  const messages = getImpactMessages(health);
  assert.ok(Array.isArray(messages));
  const cogsMsg = messages.find((m) => m.key === 'cogs_unavailable' || (m.message && m.message.includes('CCC') && m.message.includes('COGS')));
  assert.ok(cogsMsg, 'expected COGS/CCC impact message');
  assert.strictEqual(cogsMsg.severity, 'medium');
  assert.strictEqual(cogsMsg.owner, 'user');
  assert.ok(cogsMsg.link === '/working-capital');
});

test('getImpactMessages returns no CCC message when COGS mapped', () => {
  const health = {
    cogsMappingStatus: { isAvailable: true },
    inventoryMappingStatus: {},
    debtorsMappingStatus: {},
    creditorsMappingStatus: {},
    lastSync: {},
    classifiedPct: 90
  };
  const messages = getImpactMessages(health);
  assert.ok(!messages.some((m) => m.message && m.message.includes('CCC') && m.message.includes('COGS')));
});

test('getImpactMessages classifiedPct < 80 has severity high', () => {
  const health = {
    cogsMappingStatus: { isAvailable: true },
    inventoryMappingStatus: {},
    debtorsMappingStatus: {},
    creditorsMappingStatus: {},
    lastSync: { last_sync_status: 'success' },
    classifiedPct: 75
  };
  const messages = getImpactMessages(health);
  const coverageMsg = messages.find((m) => m.key === 'low_coverage');
  assert.ok(coverageMsg, 'expected low_coverage message when classifiedPct < 80');
  assert.strictEqual(coverageMsg.severity, 'high');
  assert.strictEqual(coverageMsg.owner, 'user');
  assert.strictEqual(coverageMsg.link, '/data-health');
});

test('getImpactMessages returns inventory warning when present (severity medium)', () => {
  const health = {
    cogsMappingStatus: { isAvailable: true },
    inventoryMappingStatus: { warning: 'Inventory total is zero but P&L has activity.' },
    debtorsMappingStatus: {},
    creditorsMappingStatus: {},
    lastSync: {},
    classifiedPct: 90
  };
  const messages = getImpactMessages(health);
  const invMsg = messages.find((m) => m.key === 'inventory_warning' || (m.message && m.message.includes('Inventory')));
  assert.ok(invMsg);
  assert.strictEqual(invMsg.severity, 'medium');
  assert.strictEqual(invMsg.link, '/working-capital');
});

test('getImpactMessages sync failed has severity critical and link /integrations', () => {
  const health = {
    cogsMappingStatus: { isAvailable: true },
    inventoryMappingStatus: {},
    debtorsMappingStatus: {},
    creditorsMappingStatus: {},
    lastSync: { last_sync_status: 'failed' },
    classifiedPct: 90
  };
  const messages = getImpactMessages(health);
  const syncMsg = messages.find((m) => m.key === 'sync_failed');
  assert.ok(syncMsg);
  assert.strictEqual(syncMsg.severity, 'critical');
  assert.strictEqual(syncMsg.owner, 'system');
  assert.strictEqual(syncMsg.link, '/integrations');
});

test('getImpactMessages returns empty for null health', () => {
  assert.deepEqual(getImpactMessages(null), []);
});

test('getSuggestedNextSteps suggests mapping when unclassified > 0', () => {
  const health = {
    unclassifiedLedgers: 5,
    cogsMappingStatus: { isAvailable: true },
    inventoryMappingStatus: {},
    lastSync: {},
    availableMonthsCount: 12,
    classifiedPct: 80
  };
  const steps = getSuggestedNextSteps(health);
  assert.ok(steps.some((s) => s.includes('unclassified') || s.includes('5')));
});

test('getSuggestedNextSteps suggests COGS when not available', () => {
  const health = {
    unclassifiedLedgers: 0,
    cogsMappingStatus: { isAvailable: false },
    inventoryMappingStatus: {},
    lastSync: {},
    availableMonthsCount: 12,
    classifiedPct: 100
  };
  const steps = getSuggestedNextSteps(health);
  assert.ok(steps.some((s) => s.includes('COGS') || s.includes('Purchases')));
});

test('getSuggestedNextSteps suggests sync when no months', () => {
  const health = {
    unclassifiedLedgers: 0,
    cogsMappingStatus: { isAvailable: false },
    inventoryMappingStatus: {},
    lastSync: {},
    availableMonthsCount: 0,
    classifiedPct: 0
  };
  const steps = getSuggestedNextSteps(health);
  assert.ok(steps.some((s) => s.includes('sync') || s.includes('Connect')));
});

function isDbUnavailable(err) {
  const msg = (err && err.message) ? err.message : String(err);
  return /ECONNREFUSED|ENOTFOUND|connect|database|DATABASE/i.test(msg);
}

test('getDataHealth returns expected shape (DB)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  try {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const health = await getDataHealth(companyId);
    assert.ok(health && typeof health === 'object');
    assert.ok('classifiedPct' in health);
    assert.ok('totalLedgers' in health);
    assert.ok('classifiedLedgers' in health);
    assert.ok('unclassifiedLedgers' in health);
    assert.ok(Array.isArray(health.topUnclassifiedLedgers));
    assert.ok(health.cogsMappingStatus && typeof health.cogsMappingStatus.isAvailable === 'boolean');
    assert.ok(health.inventoryMappingStatus && typeof health.inventoryMappingStatus === 'object');
    assert.ok(health.debtorsMappingStatus && typeof health.debtorsMappingStatus === 'object');
    assert.ok(health.creditorsMappingStatus && typeof health.creditorsMappingStatus === 'object');
    assert.ok(health.lastSync && typeof health.lastSync === 'object');
    assert.ok('availableMonthsCount' in health);
    assert.ok('latestMonth' in health);
    assert.ok(typeof health.dataReadyForInsights === 'boolean');
  } catch (err) {
    if (isDbUnavailable(err)) {
      t.skip('Database not available');
      return;
    }
    throw err;
  }
});

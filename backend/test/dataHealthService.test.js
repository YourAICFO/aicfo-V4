const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getImpactMessages,
  getSuggestedNextSteps,
  getDataHealth
} = require('../src/services/dataHealthService');

test('getImpactMessages returns CCC message when COGS not mapped', () => {
  const health = {
    cogsMappingStatus: { isAvailable: false },
    inventoryMappingStatus: {},
    debtorsMappingStatus: {},
    creditorsMappingStatus: {}
  };
  const messages = getImpactMessages(health);
  assert.ok(Array.isArray(messages));
  assert.ok(messages.some((m) => m.includes('CCC') && m.includes('COGS')));
});

test('getImpactMessages returns no CCC message when COGS mapped', () => {
  const health = {
    cogsMappingStatus: { isAvailable: true },
    inventoryMappingStatus: {},
    debtorsMappingStatus: {},
    creditorsMappingStatus: {}
  };
  const messages = getImpactMessages(health);
  assert.ok(!messages.some((m) => m.includes('CCC') && m.includes('COGS')));
});

test('getImpactMessages returns inventory warning when present', () => {
  const health = {
    cogsMappingStatus: { isAvailable: true },
    inventoryMappingStatus: { warning: 'Inventory total is zero but P&L has activity.' },
    debtorsMappingStatus: {},
    creditorsMappingStatus: {}
  };
  const messages = getImpactMessages(health);
  assert.ok(messages.some((m) => m.includes('Inventory') || m.includes('inventory')));
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
  } catch (err) {
    if (isDbUnavailable(err)) {
      t.skip('Database not available');
      return;
    }
    throw err;
  }
});

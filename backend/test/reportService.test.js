const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMonthlyReport } = require('../src/services/reportService');

const REQUIRED_KEYS = [
  'company',
  'month',
  'generatedAt',
  'executiveSummary',
  'performance',
  'drivers',
  'workingCapital',
  'liquidity',
  'runway',
  'alerts'
];

function isDbUnavailable(err) {
  const msg = (err && err.message) ? err.message : String(err);
  return /ECONNREFUSED|ENOTFOUND|connect|database|DATABASE/i.test(msg);
}

test('buildMonthlyReport returns object with expected top-level keys', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }
  try {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const monthKey = '2099-12';
    const report = await buildMonthlyReport(companyId, monthKey);
    assert.ok(report && typeof report === 'object');
    for (const key of REQUIRED_KEYS) {
      assert.ok(key in report, `missing key: ${key}`);
    }
    assert.ok(Array.isArray(report.executiveSummary));
    assert.ok(Array.isArray(report.alerts));
    assert.ok(typeof report.performance === 'object');
    assert.ok(report.month === monthKey);
    assert.ok(report.company && (report.company.name || report.company.id));
  } catch (err) {
    if (isDbUnavailable(err)) {
      t.skip('Database not available');
      return;
    }
    throw err;
  }
});

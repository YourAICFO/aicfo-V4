require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const DB_AVAILABLE = !!process.env.DATABASE_URL;

test('idempotencyService — acquireLock returns acquired:true on first call', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { sequelize } = require('../src/models');
  const { acquireLock, releaseLock } = require('../src/services/idempotencyService');

  const companyId = '00000000-0000-0000-0000-000000000001';
  const jobKey = 'test_job';
  const scopeKey = `test-${Date.now()}`;

  const r1 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j1' });
  assert.equal(r1.acquired, true);

  await releaseLock({ companyId, jobKey, scopeKey, success: true });
  await sequelize.query(
    `DELETE FROM job_idempotency_locks WHERE company_id = :companyId AND job_key = :jobKey AND scope_key = :scopeKey`,
    { replacements: { companyId, jobKey, scopeKey } }
  );
});

test('idempotencyService — skips when already completed', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { sequelize } = require('../src/models');
  const { acquireLock, releaseLock } = require('../src/services/idempotencyService');

  const companyId = '00000000-0000-0000-0000-000000000002';
  const jobKey = 'test_job';
  const scopeKey = `test-completed-${Date.now()}`;

  const r1 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j1' });
  assert.equal(r1.acquired, true);

  await releaseLock({ companyId, jobKey, scopeKey, success: true });

  const r2 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j2' });
  assert.equal(r2.acquired, false);
  assert.equal(r2.reason, 'already_completed');

  await sequelize.query(
    `DELETE FROM job_idempotency_locks WHERE company_id = :companyId AND job_key = :jobKey AND scope_key = :scopeKey`,
    { replacements: { companyId, jobKey, scopeKey } }
  );
});

test('idempotencyService — blocks concurrent running lock', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { sequelize } = require('../src/models');
  const { acquireLock, releaseLock } = require('../src/services/idempotencyService');

  const companyId = '00000000-0000-0000-0000-000000000003';
  const jobKey = 'test_job';
  const scopeKey = `test-running-${Date.now()}`;

  const r1 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j1' });
  assert.equal(r1.acquired, true);

  const r2 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j2' });
  assert.equal(r2.acquired, false);
  assert.equal(r2.reason, 'already_running');

  await releaseLock({ companyId, jobKey, scopeKey, success: false, error: 'test cleanup' });
  await sequelize.query(
    `DELETE FROM job_idempotency_locks WHERE company_id = :companyId AND job_key = :jobKey AND scope_key = :scopeKey`,
    { replacements: { companyId, jobKey, scopeKey } }
  );
});

test('idempotencyService — allows retry after failure', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { sequelize } = require('../src/models');
  const { acquireLock, releaseLock } = require('../src/services/idempotencyService');

  const companyId = '00000000-0000-0000-0000-000000000004';
  const jobKey = 'test_job';
  const scopeKey = `test-retry-${Date.now()}`;

  const r1 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j1' });
  assert.equal(r1.acquired, true);

  await releaseLock({ companyId, jobKey, scopeKey, success: false, error: 'some error' });

  const r2 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j2' });
  assert.equal(r2.acquired, true);

  await releaseLock({ companyId, jobKey, scopeKey, success: true });
  await sequelize.query(
    `DELETE FROM job_idempotency_locks WHERE company_id = :companyId AND job_key = :jobKey AND scope_key = :scopeKey`,
    { replacements: { companyId, jobKey, scopeKey } }
  );
});

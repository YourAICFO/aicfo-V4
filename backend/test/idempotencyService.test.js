require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const DB_AVAILABLE = !!process.env.DATABASE_URL;

function cleanup(sequelize, companyId, jobKey, scopeKey) {
  return sequelize.query(
    `DELETE FROM job_idempotency_locks WHERE company_id = :companyId AND job_key = :jobKey AND scope_key = :scopeKey`,
    { replacements: { companyId, jobKey, scopeKey } }
  );
}

test('idempotencyService — acquireLock returns acquired:true on first call', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { sequelize } = require('../src/models');
  const { acquireLock, releaseLock } = require('../src/services/idempotencyService');

  const companyId = '00000000-0000-0000-0000-000000000001';
  const jobKey = 'test_job';
  const scopeKey = `test-first-${Date.now()}`;

  const r1 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j1' });
  assert.equal(r1.acquired, true);

  await releaseLock({ companyId, jobKey, scopeKey, success: true });
  await cleanup(sequelize, companyId, jobKey, scopeKey);
});

test('idempotencyService — skips when completed with same payloadHash', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { sequelize } = require('../src/models');
  const { acquireLock, releaseLock } = require('../src/services/idempotencyService');

  const companyId = '00000000-0000-0000-0000-000000000002';
  const jobKey = 'test_job';
  const scopeKey = `test-completed-${Date.now()}`;
  const hash = 'abc123';

  const r1 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j1', payloadHash: hash });
  assert.equal(r1.acquired, true);
  await releaseLock({ companyId, jobKey, scopeKey, success: true });

  const r2 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j2', payloadHash: hash });
  assert.equal(r2.acquired, false);
  assert.equal(r2.reason, 'already_completed');

  await cleanup(sequelize, companyId, jobKey, scopeKey);
});

test('idempotencyService — allows re-run when completed with different payloadHash', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { sequelize } = require('../src/models');
  const { acquireLock, releaseLock } = require('../src/services/idempotencyService');

  const companyId = '00000000-0000-0000-0000-000000000012';
  const jobKey = 'test_job';
  const scopeKey = `test-hash-change-${Date.now()}`;

  const r1 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j1', payloadHash: 'hash_v1' });
  assert.equal(r1.acquired, true);
  await releaseLock({ companyId, jobKey, scopeKey, success: true });

  const r2 = await acquireLock({ companyId, jobKey, scopeKey, jobId: 'j2', payloadHash: 'hash_v2' });
  assert.equal(r2.acquired, true, 'Should re-run because payloadHash changed');

  await releaseLock({ companyId, jobKey, scopeKey, success: true });
  await cleanup(sequelize, companyId, jobKey, scopeKey);
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
  await cleanup(sequelize, companyId, jobKey, scopeKey);
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
  await cleanup(sequelize, companyId, jobKey, scopeKey);
});

test('idempotencyService — withIdempotency wrapper skips on duplicate', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { sequelize } = require('../src/models');
  const { withIdempotency } = require('../src/services/idempotencyService');

  let callCount = 0;
  const handler = async () => { callCount++; return { done: true }; };
  const wrapped = withIdempotency('wrap_test', () => 'scope1', handler);

  const companyId = '00000000-0000-0000-0000-000000000005';
  const data = { companyId };

  const r1 = await wrapped(data, { jobId: 'w1' });
  assert.equal(callCount, 1);
  assert.deepEqual(r1, { done: true });

  const r2 = await wrapped(data, { jobId: 'w2' });
  assert.equal(callCount, 1, 'Handler should not be called again');
  assert.equal(r2.skipped, true);
  assert.equal(r2.reason, 'already_completed');

  await sequelize.query(
    `DELETE FROM job_idempotency_locks WHERE company_id = :companyId AND job_key = 'wrap_test'`,
    { replacements: { companyId } }
  );
});

test('computePayloadHash — deterministic and strips secrets', () => {
  const { computePayloadHash } = require('../src/services/idempotencyService');

  const h1 = computePayloadHash({ companyId: 'abc', month: '2025-01' });
  const h2 = computePayloadHash({ companyId: 'abc', month: '2025-01' });
  assert.equal(h1, h2, 'Same input should produce same hash');

  const h3 = computePayloadHash({ companyId: 'abc', month: '2025-02' });
  assert.notEqual(h1, h3, 'Different input should produce different hash');

  const h4 = computePayloadHash({ companyId: 'abc', month: '2025-01', secretToken: 'xyz' });
  assert.equal(h1, h4, 'Secret fields should be stripped before hashing');
});

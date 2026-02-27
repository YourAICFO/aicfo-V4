require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { redactPayload } = require('../src/services/jobFailureService');

test('redactPayload — redacts sensitive keys', () => {
  const input = {
    companyId: 'abc',
    userId: 'def',
    password: 'secret123',
    token: 'tok_abc',
    apiKey: 'sk-12345',
    Authorization: 'Bearer xyz',
    normalField: 'visible',
  };
  const result = redactPayload(input);
  assert.equal(result.companyId, 'abc');
  assert.equal(result.userId, 'def');
  assert.equal(result.normalField, 'visible');
  assert.equal(result.password, '[REDACTED]');
  assert.equal(result.token, '[REDACTED]');
  assert.equal(result.apiKey, '[REDACTED]');
  assert.equal(result.Authorization, '[REDACTED]');
});

test('redactPayload — handles null/undefined safely', () => {
  assert.equal(redactPayload(null), null);
  assert.equal(redactPayload(undefined), undefined);
  assert.deepEqual(redactPayload({}), {});
});

const DB_AVAILABLE = !!process.env.DATABASE_URL;

test('jobFailureService — recordFailure persists to DB and is queryable', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { recordFailure, listRecentFailures } = require('../src/services/jobFailureService');
  const { sequelize } = require('../src/models');

  const testJobId = `test-record-${Date.now()}`;
  await recordFailure({
    jobId: testJobId,
    jobName: 'test_job',
    queueName: 'test-queue',
    companyId: null,
    payload: { foo: 'bar', password: 'secret' },
    attemptsMade: 3,
    maxAttempts: 5,
    isFinalAttempt: false,
    failedReason: 'Test failure',
    stackTrace: 'Error: Test\n  at test.js:1',
  });

  const { rows } = await listRecentFailures({ limit: 5 });
  const found = rows.find((r) => (r.job_id || r.jobId) === testJobId);
  assert.ok(found, 'Should find the recorded failure');
  assert.equal(found.job_name || found.jobName, 'test_job');
  assert.equal(found.payload?.password, '[REDACTED]');

  await sequelize.query(`DELETE FROM job_failures WHERE job_id = :jobId`, { replacements: { jobId: testJobId } });
});

test('jobFailureService — listRecentFailures returns newest first', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { recordFailure, listRecentFailures } = require('../src/services/jobFailureService');
  const { sequelize } = require('../src/models');

  const id1 = `test-order-a-${Date.now()}`;
  const id2 = `test-order-b-${Date.now()}`;
  await recordFailure({ jobId: id1, jobName: 'sort_test', attemptsMade: 1, maxAttempts: 5, isFinalAttempt: false, failedReason: 'first' });
  await new Promise((r) => setTimeout(r, 50));
  await recordFailure({ jobId: id2, jobName: 'sort_test', attemptsMade: 1, maxAttempts: 5, isFinalAttempt: false, failedReason: 'second' });

  const { rows } = await listRecentFailures({ limit: 10, jobName: 'sort_test' });
  const ids = rows.map((r) => r.job_id || r.jobId);
  const idx1 = ids.indexOf(id1);
  const idx2 = ids.indexOf(id2);
  assert.ok(idx2 < idx1, 'Newer failure (id2) should come before older (id1)');

  await sequelize.query(`DELETE FROM job_failures WHERE job_name = 'sort_test'`);
});

test('jobFailureService — listRecentFailures filters by companyId and jobName', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { recordFailure, listRecentFailures } = require('../src/services/jobFailureService');
  const { sequelize } = require('../src/models');

  const cid = '00000000-0000-0000-0000-ffffffffffff';
  await recordFailure({ jobId: `filt-${Date.now()}`, jobName: 'filter_test', companyId: cid, attemptsMade: 5, maxAttempts: 5, isFinalAttempt: true, failedReason: 'x' });

  const { count } = await listRecentFailures({ companyId: cid, jobName: 'filter_test' });
  assert.ok(count >= 1, 'Filter should match at least 1');

  const { count: noMatch } = await listRecentFailures({ companyId: cid, jobName: 'no_such_job' });
  assert.equal(noMatch, 0);

  await sequelize.query(`DELETE FROM job_failures WHERE job_name = 'filter_test'`);
});

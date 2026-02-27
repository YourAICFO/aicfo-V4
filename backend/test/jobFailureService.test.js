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

test('jobFailureService — recordFailure persists to DB', { skip: !DB_AVAILABLE && 'DATABASE_URL not set' }, async () => {
  const { recordFailure, getRecentFailures } = require('../src/services/jobFailureService');
  const { sequelize } = require('../src/models');

  const testJobId = `test-${Date.now()}`;
  await recordFailure({
    jobId: testJobId,
    jobName: 'test_job',
    queueName: 'test-queue',
    companyId: null,
    payload: { foo: 'bar', password: 'secret' },
    attempts: 5,
    failedReason: 'Test failure',
    stackTrace: 'Error: Test\n  at test.js:1',
  });

  const { rows } = await getRecentFailures({ limit: 5 });
  const found = rows.find((r) => (r.job_id || r.jobId) === testJobId);
  assert.ok(found, 'Should find the recorded failure');
  assert.equal(found.job_name || found.jobName, 'test_job');
  const payload = found.payload;
  assert.equal(payload?.password, '[REDACTED]');

  await sequelize.query(`DELETE FROM job_failures WHERE job_id = :jobId`, { replacements: { jobId: testJobId } });
});

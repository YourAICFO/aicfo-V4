const test = require('node:test');
const assert = require('node:assert/strict');

const { enqueueJob, queue } = require('../src/worker/queue');

test('enqueue job returns id', async (t) => {
  if (!process.env.REDIS_URL) {
    t.skip('REDIS_URL not set');
  }

  const job = await enqueueJob('batchRecalc', {
    companyId: '00000000-0000-0000-0000-000000000000',
    userId: '00000000-0000-0000-0000-000000000000',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31'
  });

  assert.ok(job.id);
  await queue.remove(job.id);
});

require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const { isQueueResilientMode } = require('../src/config/redis');

test('job lifecycle', async (t) => {
  if (!process.env.REDIS_URL || isQueueResilientMode()) {
    return t.skip('REDIS_URL not set or QUEUE_RESILIENT_MODE active — Redis queue not available');
  }

  const { enqueueJob, queue } = require('../src/worker/queue');
  const job = await enqueueJob('batchRecalc', {
    companyId: '00000000-0000-0000-0000-000000000000',
    userId: '00000000-0000-0000-0000-000000000000',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31'
  });

  const fetched = await queue.getJob(job.id);
  assert.ok(fetched);
});

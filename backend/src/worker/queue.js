const { Queue, QueueEvents } = require('bullmq');
const { logger } = require('./logger');
const { logError } = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error('REDIS_URL is required for BullMQ connection');
}
const QUEUE_NAME = process.env.WORKER_QUEUE_NAME || 'ai-cfo-jobs';

const connection = { url: REDIS_URL };

const queue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});

const events = new QueueEvents(QUEUE_NAME, { connection });

events.on('completed', ({ jobId }) => {
  logger.info({ jobId }, 'Job completed');
});

events.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Job failed');
  logError({
    service: 'ai-cfo-worker',
    run_id: `job-${jobId}`,
    event: 'worker_job_failed'
  }, 'Queue event job failed', new Error(String(failedReason || 'unknown failure')));
});

const enqueueJob = async (name, data, options = {}) => {
  const job = await queue.add(name, data, options);
  return job;
};

module.exports = {
  queue,
  events,
  enqueueJob,
  connection,
  QUEUE_NAME
};

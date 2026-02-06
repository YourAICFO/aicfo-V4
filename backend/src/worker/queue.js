const { Queue, QueueScheduler, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const { logger } = require('./logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = process.env.WORKER_QUEUE_NAME || 'ai-cfo-jobs';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null
});

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

const scheduler = new QueueScheduler(QUEUE_NAME, { connection });
const events = new QueueEvents(QUEUE_NAME, { connection });

events.on('completed', ({ jobId }) => {
  logger.info({ jobId }, 'Job completed');
});

events.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Job failed');
});

const enqueueJob = async (name, data, options = {}) => {
  const job = await queue.add(name, data, options);
  return job;
};

module.exports = {
  queue,
  scheduler,
  events,
  enqueueJob,
  connection,
  QUEUE_NAME
};

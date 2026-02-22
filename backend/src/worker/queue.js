const { Queue, QueueEvents } = require('bullmq');
const { logger } = require('./logger');
const { logError } = require('../utils/logger');
const { connection: redisConnection, isQueueResilientMode } = require('../config/redis');

const QUEUE_NAME = process.env.WORKER_QUEUE_NAME || 'ai-cfo-jobs';
const RESILIENT_MODE = isQueueResilientMode();

let queue, events;

if (!RESILIENT_MODE) {
  queue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
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

  events = new QueueEvents(QUEUE_NAME, { connection: redisConnection });

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
} else {
  logger.warn({ event: 'queue_resilient_mode' }, 'Queue operating in resilient mode (QUEUE_RESILIENT_MODE=true) - no Redis connection');
  queue = {
    add: async () => {
      throw new Error('Queue.add should not be called in resilient mode - use enqueueJob instead');
    },
    getJobCounts: async () => ({ waiting: 0, active: 0, delayed: 0, failed: 0 }),
    getWorkers: async () => [],
    getJob: async () => null
  };
  events = {
    on: () => {}
  };
}

const enqueueJob = async (name, data, options = {}) => {
  if (RESILIENT_MODE && global.processJobDirectly) {
    logger.info({ jobName: name, companyId: data?.companyId }, 'Processing job synchronously in resilient mode');
    try {
      const result = await global.processJobDirectly(name, data, options);
      return {
        id: `sync-${Date.now()}`,
        name,
        data,
        opts: options,
        processed: true,
        result,
        finished: () => Promise.resolve(),
        remove: () => Promise.resolve()
      };
    } catch (error) {
      logger.error({ jobName: name, error: error.message }, 'Direct job processing failed in resilient mode');
      throw error;
    }
  }

  const job = await queue.add(name, data, options);
  return job;
};

module.exports = {
  queue,
  events,
  enqueueJob,
  connection: redisConnection,
  QUEUE_NAME,
  getRedisTarget: require('../config/redis').getRedisTarget
};

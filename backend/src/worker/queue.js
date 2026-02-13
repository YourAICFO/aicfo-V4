const { Queue, QueueEvents } = require('bullmq');
const { logger } = require('./logger');
const { logError } = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL;
const QUEUE_NAME = process.env.WORKER_QUEUE_NAME || 'ai-cfo-jobs';

const connection = {
  url: REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 10000,
  retryStrategy: (times) => Math.min(times * 200, 2000)
};

const getRedisTarget = () => {
  if (!REDIS_URL) {
    return { host: null, port: null, tls: false };
  }
  try {
    const parsed = new URL(REDIS_URL);
    return {
      host: parsed.hostname || null,
      port: parsed.port ? Number(parsed.port) : null,
      tls: parsed.protocol === 'rediss:'
    };
  } catch (_) {
    return { host: null, port: null, tls: false };
  }
};

// Check if we're in resilient mode (no Redis)
const RESILIENT_MODE = process.env.RESILIENT_WORKER_MODE === 'true' || !process.env.REDIS_URL;

let queue, events;

if (!RESILIENT_MODE) {
  if (!REDIS_URL) {
    logger.error({ event: 'redis_url_missing' }, 'REDIS_URL is required for BullMQ connection');
    throw new Error('REDIS_URL is required for BullMQ connection');
  }

  queue = new Queue(QUEUE_NAME, {
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

  events = new QueueEvents(QUEUE_NAME, { connection });

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
  // In resilient mode, create mock queue objects
  logger.warn({ event: 'queue_resilient_mode' }, 'Queue operating in resilient mode - no Redis connection');
  queue = {
    add: async () => {
      throw new Error('Queue.add should not be called in resilient mode - use enqueueJob instead');
    }
  };
  events = {
    on: () => {} // No-op for event handlers
  };
}

const enqueueJob = async (name, data, options = {}) => {
  // Check if we're in resilient mode (no Redis)
  const RESILIENT_MODE = process.env.RESILIENT_WORKER_MODE === 'true' || !process.env.REDIS_URL;
  
  if (RESILIENT_MODE && global.processJobDirectly) {
    // Process job synchronously in resilient mode
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
  
  // Normal Redis queue processing
  const job = await queue.add(name, data, options);
  return job;
};

module.exports = {
  queue,
  events,
  enqueueJob,
  connection,
  QUEUE_NAME,
  getRedisTarget
};

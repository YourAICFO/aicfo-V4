require('dotenv').config();
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { logger } = require('./logger');
const { logError } = require('../utils/logger');
const { initSentry, captureException } = require('../utils/sentry');
const { generateAIInsights } = require('./tasks/generateAIInsights');
const { updateReports } = require('./tasks/updateReports');
const { batchRecalc } = require('./tasks/batchRecalc');
const { sendNotifications } = require('./tasks/sendNotifications');
const { generateMonthlySnapshots } = require('./tasks/generateMonthlySnapshots');

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '4', 10);
initSentry({ serviceName: 'ai-cfo-worker' });

const handlers = {
  generateAIInsights,
  updateReports,
  batchRecalc,
  sendNotifications,
  generateMonthlySnapshots
};

const pingRedis = async (redisClient) => {
  const timeoutMs = 10000;
  const pingPromise = redisClient.ping();
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Redis ping timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([pingPromise, timeoutPromise]);
};

const startWorker = async () => {
  if (process.env.DISABLE_WORKER === 'true') {
    logger.warn({ event: 'worker_disabled' }, 'Worker startup skipped because DISABLE_WORKER=true');
    process.exit(0);
  }

  if (!process.env.REDIS_URL) {
    logger.error({ event: 'redis_url_missing' }, 'REDIS_URL is required for worker startup');
    process.exit(1);
  }

  const { connection, QUEUE_NAME, getRedisTarget } = require('./queue');
  const target = getRedisTarget();
  const { url: _redisUrl, ...redisOptions } = connection;
  const redis = new IORedis(process.env.REDIS_URL, redisOptions);

  logger.info(
    { event: 'redis_connect_attempt', host: target.host, port: target.port, tls: target.tls },
    'Attempting Redis connection for worker'
  );

  try {
    const pong = await pingRedis(redis);
    logger.info({ event: 'redis_ping_ok', response: pong, host: target.host, port: target.port, tls: target.tls }, 'Redis ping succeeded');
  } catch (err) {
    logger.error(
      {
        event: 'redis_ping_failed',
        host: target.host,
        port: target.port,
        tls: target.tls,
        code: err?.code || null,
        error: err?.message || 'unknown'
      },
      'Redis ping failed; worker exiting'
    );
    process.exit(1);
  } finally {
    try {
      await redis.quit();
    } catch (_) {
      redis.disconnect();
    }
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const runId = `job-${job.id}`;
      const handler = handlers[job.name];
      if (!handler) {
        throw new Error(`Unknown job type: ${job.name}`);
      }

      logger.info({
        jobId: job.id,
        name: job.name,
        userId: job.data?.userId,
        companyId: job.data?.companyId,
        run_id: runId
      }, 'Job started');

      let result;
      try {
        result = await handler(job.data);
      } catch (err) {
        captureException(err, {
          run_id: runId,
          job_id: job.id,
          job_name: job.name,
          company_id: job.data?.companyId || null,
          user_id: job.data?.userId || null
        });
        await logError({
          service: 'ai-cfo-worker',
          run_id: runId,
          company_id: job.data?.companyId || null,
          event: 'worker_job_failed'
        }, `Job failed: ${job.name}`, err);
        throw err;
      }

      logger.info({
        jobId: job.id,
        name: job.name,
        result,
        run_id: runId
      }, 'Job finished');

      return result;
    },
    {
      connection,
      concurrency: CONCURRENCY
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({
      jobId: job?.id,
      name: job?.name,
      error: err.message,
      stack: err.stack
    }, 'Job failed');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Job completed');
  });

  process.on('SIGINT', async () => {
    await worker.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await worker.close();
    process.exit(0);
  });
};

startWorker().catch((error) => {
  logger.error({ event: 'worker_startup_failed', error: error.message, code: error.code || null }, 'Worker failed during startup');
  process.exit(1);
});

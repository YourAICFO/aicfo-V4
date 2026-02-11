require('dotenv').config();
console.log("WORKER_BOOT_V=2026-02-11-redis-debug-2");
if (process.env.DISABLE_WORKER === "true") {
  console.log("WORKER_DISABLED=true; exiting 0");
  process.exit(0);
}
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

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`PING_TIMEOUT_${ms}ms`)), ms))
  ]);

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
  const redis = new IORedis(process.env.REDIS_URL, { ...redisOptions, lazyConnect: true });
  let lastRedisError = null;
  redis.on('error', (clientErr) => {
    lastRedisError = clientErr;
  });

  logger.info(
    { event: 'redis_connect_attempt', host: target.host, port: target.port, tls: target.tls },
    'Attempting Redis connection for worker'
  );

  try {
    await redis.connect();
    const pong = await withTimeout(redis.ping(), 10000);
    console.log("REDIS_PING_OK", pong);
    logger.info({ event: 'redis_ping_ok', response: pong, host: target.host, port: target.port, tls: target.tls }, 'Redis ping succeeded');
    await redis.quit();
  } catch (err) {
    const effectiveErr = lastRedisError || err;
    console.error("REDIS_PING_FAILED", {
      name: effectiveErr?.name,
      code: effectiveErr?.code,
      errno: effectiveErr?.errno,
      syscall: effectiveErr?.syscall,
      message: effectiveErr?.message,
      stack: effectiveErr?.stack ? effectiveErr.stack.split("\n").slice(0,2).join(" | ") : null,
    });
    const firstStackLine = typeof effectiveErr?.stack === 'string' ? effectiveErr.stack.split('\n')[0] : null;
    logger.error(
      {
        event: 'redis_ping_failed',
        host: target.host,
        port: target.port,
        tls: target.tls,
        code: effectiveErr?.code || null,
        errno: effectiveErr?.errno || null,
        syscall: effectiveErr?.syscall || null,
        message: effectiveErr?.message || 'unknown',
        stack: firstStackLine
      },
      `Redis ping failed; worker exiting (host=${target.host || 'unknown'} port=${target.port || 'unknown'} tls=${target.tls ? 'true' : 'false'} code=${effectiveErr?.code || 'n/a'} errno=${effectiveErr?.errno || 'n/a'} syscall=${effectiveErr?.syscall || 'n/a'} message=${effectiveErr?.message || 'unknown'})`
    );
    try { redis.disconnect(); } catch {}
    process.exit(1);
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

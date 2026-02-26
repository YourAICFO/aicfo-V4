require('dotenv').config();
const { loadEnv } = require('../config/env');
const env = loadEnv();

if (env.DISABLE_WORKER) {
  console.log('WORKER_DISABLED=true; exiting 0');
  process.exit(0);
}

const { Worker } = require('bullmq');
const { logger } = require('./logger');
const { logError } = require('../utils/logger');
const { initSentry, captureException } = require('../utils/sentry');
const { generateAIInsights } = require('./tasks/generateAIInsights');
const { updateReports } = require('./tasks/updateReports');
const { batchRecalc } = require('./tasks/batchRecalc');
const { sendNotifications } = require('./tasks/sendNotifications');
const { generateMonthlySnapshots } = require('./tasks/generateMonthlySnapshots');
const { processScheduledInsightEmails } = require('./tasks/processScheduledInsightEmails');
const { testConnection, isQueueResilientMode } = require('../config/redis');

const RESILIENT_MODE = isQueueResilientMode();
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '4', 10);
initSentry({ serviceName: 'ai-cfo-worker' });

const handlers = {
  healthPing: async (data, context = {}) => {
    logger.info({
      event: 'HEALTH_PING_OK',
      jobId: context.jobId || null,
      run_id: context.runId || null,
      companyId: data?.companyId || null,
      at: data?.at || null
    }, 'HEALTH_PING_OK');
    return { ok: true };
  },
  generateAIInsights,
  updateReports,
  batchRecalc,
  sendNotifications,
  generateMonthlySnapshots
};

const startScheduledEmailTicker = () => {
  const tickMs = Number(process.env.INSIGHT_EMAIL_TICK_MS || 60 * 60 * 1000);
  const runTick = async () => {
    try {
      const result = await processScheduledInsightEmails();
      logger.info({ event: 'scheduled_insight_email_tick', ...result }, 'Scheduled insight email tick completed');
    } catch (error) {
      logger.warn({ event: 'scheduled_insight_email_tick_failed', error: error.message }, 'Scheduled insight email tick failed');
    }
  };

  runTick().catch(() => {});
  setInterval(runTick, tickMs);
};

const startWorker = async () => {
  if (process.env.DISABLE_WORKER === 'true') {
    logger.warn({ event: 'worker_disabled' }, 'Worker startup skipped because DISABLE_WORKER=true');
    process.exit(0);
  }

  if (RESILIENT_MODE) {
    logger.warn({ event: 'worker_resilient_mode' }, 'Starting worker in resilient mode (QUEUE_RESILIENT_MODE=true)');
    console.log('Worker ready in resilient mode - jobs will be processed synchronously');

    const processJobDirectly = async (jobName, jobData, context = {}) => {
      const runId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const handler = handlers[jobName];

      if (!handler) {
        throw new Error(`Unknown job type: ${jobName}`);
      }

      logger.info({
        jobName,
        userId: jobData?.userId,
        companyId: jobData?.companyId,
        run_id: runId
      }, 'Direct job processing started');

      let result;
      try {
        result = await handler(jobData, { ...context, runId });
      } catch (err) {
        captureException(err, {
          run_id: runId,
          job_name: jobName,
          company_id: jobData?.companyId || null,
          user_id: jobData?.userId || null
        });
        await logError({
          service: 'ai-cfo-worker',
          run_id: runId,
          company_id: jobData?.companyId || null,
          event: 'direct_job_failed'
        }, `Direct job failed: ${jobName}`, err);
        throw err;
      }

      logger.info({
        jobName,
        result,
        run_id: runId
      }, 'Direct job processing finished');

      return result;
    };

    global.processJobDirectly = processJobDirectly;
    logger.info({ event: 'worker_resilient_ready' }, 'Worker ready in resilient mode');
    startScheduledEmailTicker();

    process.on('SIGINT', () => {
      logger.info({ event: 'worker_shutdown' }, 'Worker shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info({ event: 'worker_shutdown' }, 'Worker shutting down gracefully');
      process.exit(0);
    });

    return;
  }

  try {
    await testConnection();
  } catch (err) {
    logger.error({ event: 'redis_connect_failed', error: err.message }, 'Redis required for worker; exiting');
    process.exit(1);
  }

  const { connection, QUEUE_NAME } = require('./queue');
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
        result = await handler(job.data, { jobId: job.id, runId });
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

  startScheduledEmailTicker();

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

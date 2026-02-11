require('dotenv').config();
const { Worker } = require('bullmq');
const { connection, QUEUE_NAME } = require('./queue');
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

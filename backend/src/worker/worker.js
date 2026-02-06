require('dotenv').config();
const { Worker } = require('bullmq');
const { connection, QUEUE_NAME } = require('./queue');
const { logger } = require('./logger');
const { generateAIInsights } = require('./tasks/generateAIInsights');
const { updateReports } = require('./tasks/updateReports');
const { batchRecalc } = require('./tasks/batchRecalc');
const { sendNotifications } = require('./tasks/sendNotifications');

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '4', 10);

const handlers = {
  generateAIInsights,
  updateReports,
  batchRecalc,
  sendNotifications
};

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const handler = handlers[job.name];
    if (!handler) {
      throw new Error(`Unknown job type: ${job.name}`);
    }

    logger.info({
      jobId: job.id,
      name: job.name,
      userId: job.data?.userId,
      companyId: job.data?.companyId
    }, 'Job started');

    const result = await handler(job.data);

    logger.info({
      jobId: job.id,
      name: job.name,
      result
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
    error: err.message
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

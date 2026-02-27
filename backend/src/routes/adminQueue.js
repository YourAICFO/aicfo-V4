'use strict';

const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { validateBody } = require('../middleware/validateBody');
const { queue, QUEUE_NAME } = require('../worker/queue');
const { isQueueResilientMode } = require('../config/redis');

const retrySchema = z.object({
  failureId: z.string().uuid('failureId must be a valid UUID'),
});
const {
  listRecentFailures,
  getFailureCountSince,
  getTopFailedJobs,
  markResolved,
  pruneOldFailures,
  DLQ_RETENTION_DAYS,
} = require('../services/jobFailureService');
const { enqueueJob } = require('../worker/queue');
const { logger } = require('../utils/logger');

router.get('/health', authenticate, requireAdmin, async (req, res) => {
  try {
    const resilientMode = isQueueResilientMode();
    let counts = { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 };
    let oldestWaitingAgeSec = null;

    if (!resilientMode) {
      counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');

      try {
        const waiting = await queue.getJobs(['waiting'], 0, 0);
        if (waiting && waiting.length > 0 && waiting[0].timestamp) {
          oldestWaitingAgeSec = Math.round((Date.now() - waiting[0].timestamp) / 1000);
        }
      } catch (_) {}
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failedLastHour = await getFailureCountSince(oneHourAgo);
    const failedLast24h = await getFailureCountSince(oneDayAgo);
    const topFailedJobs = await getTopFailedJobs(24, 10);

    res.json({
      success: true,
      data: {
        queueName: QUEUE_NAME,
        resilientMode,
        counts,
        oldestWaitingAgeSec,
        failedLastHour,
        topFailedJobs,
        dlq: {
          failedLastHour,
          failedLast24h,
          retentionDays: DLQ_RETENTION_DAYS,
        },
      },
    });
  } catch (error) {
    logger.error({ event: 'admin_queue_health_error', error: error.message }, 'Admin queue health failed');
    res.status(500).json({ success: false, error: 'Queue health check failed' });
  }
});

router.get('/failures', authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    const companyId = req.query.companyId || undefined;
    const jobName = req.query.jobName || undefined;
    const { count, rows } = await listRecentFailures({ limit, offset, companyId, jobName });
    res.json({ success: true, data: { total: count, items: rows } });
  } catch (error) {
    logger.error({ event: 'admin_queue_failures_error', error: error.message }, 'Admin queue failures list error');
    res.status(500).json({ success: false, error: 'Failed to fetch DLQ entries' });
  }
});

// Keep /failed as alias for backward compat
router.get('/failed', authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    const { count, rows } = await listRecentFailures({ limit, offset });
    res.json({ success: true, data: { total: count, items: rows } });
  } catch (error) {
    logger.error({ event: 'admin_queue_failed_error', error: error.message }, 'Admin queue failed list error');
    res.status(500).json({ success: false, error: 'Failed to fetch DLQ entries' });
  }
});

router.post('/retry', authenticate, requireAdmin, validateBody(retrySchema), async (req, res) => {
  try {
    const { failureId } = req.validatedBody;

    const { JobFailure } = require('../models');
    const failure = await JobFailure.findByPk(failureId);
    if (!failure) {
      return res.status(404).json({ success: false, error: 'DLQ entry not found' });
    }

    let job;
    try {
      job = await enqueueJob(failure.jobName, failure.payload || {});
    } catch (enqueueErr) {
      if (isQueueResilientMode() && !global.processJobDirectly) {
        return res.status(503).json({
          success: false,
          error: 'Retry unavailable: queue is in resilient mode and the worker process is not running in this instance. Retry from the worker process or disable resilient mode.',
        });
      }
      throw enqueueErr;
    }
    await markResolved(failureId);

    logger.info({
      event: 'admin_queue_retry',
      failureId,
      jobName: failure.jobName,
      newJobId: job.id,
    }, 'Admin retried failed job');

    res.json({
      success: true,
      data: { newJobId: job.id, jobName: failure.jobName },
    });
  } catch (error) {
    logger.error({ event: 'admin_queue_retry_error', error: error.message }, 'Admin queue retry failed');
    res.status(500).json({ success: false, error: 'Retry failed' });
  }
});

router.post('/prune', authenticate, requireAdmin, async (req, res) => {
  try {
    const count = await pruneOldFailures();
    res.json({ success: true, data: { pruned: count, retentionDays: DLQ_RETENTION_DAYS } });
  } catch (error) {
    logger.error({ event: 'admin_queue_prune_error', error: error.message }, 'Admin queue prune failed');
    res.status(500).json({ success: false, error: 'Prune failed' });
  }
});

module.exports = router;

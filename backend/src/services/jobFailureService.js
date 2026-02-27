'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { logger } = require('../utils/logger');

const DLQ_RETENTION_DAYS = parseInt(process.env.JOB_DLQ_RETENTION_DAYS || '14', 10);
const FAILURE_SPIKE_THRESHOLD = parseInt(process.env.JOB_FAILURE_SPIKE_THRESHOLD || '10', 10);

let _JobFailure;
function getModel() {
  if (!_JobFailure) _JobFailure = require('../models').JobFailure;
  return _JobFailure;
}

const SENSITIVE_PATTERNS = ['password', 'token', 'secret', 'key', 'authorization'];

function redactPayload(data) {
  if (!data || typeof data !== 'object') return data;
  const redacted = { ...data };
  for (const k of Object.keys(redacted)) {
    if (SENSITIVE_PATTERNS.some((s) => k.toLowerCase().includes(s))) {
      redacted[k] = '[REDACTED]';
    }
  }
  return redacted;
}

/**
 * Record a job failure (every attempt, not just final).
 * Called from worker 'failed' event.
 */
async function recordFailure({
  jobId, jobName, queueName, companyId,
  payload, attemptsMade, maxAttempts,
  failedReason, stackTrace, isFinalAttempt,
}) {
  try {
    const JobFailure = getModel();
    await JobFailure.create({
      jobId: String(jobId),
      jobName,
      queueName: queueName || 'ai-cfo-jobs',
      companyId: companyId || null,
      payload: redactPayload(payload),
      attempts: attemptsMade || 0,
      maxAttempts: maxAttempts || 5,
      isFinalAttempt: !!isFinalAttempt,
      failedReason: failedReason ? String(failedReason).slice(0, 2000) : null,
      stackTrace: stackTrace ? String(stackTrace).slice(0, 4000) : null,
      firstFailedAt: new Date(),
      lastFailedAt: new Date(),
    });
  } catch (err) {
    logger.error({ event: 'dlq_record_failed', jobId, jobName, error: err.message }, 'Failed to persist job failure to DLQ');
  }
}

/**
 * List recent failures with optional filters.
 */
async function listRecentFailures({ limit = 50, offset = 0, companyId, jobName } = {}) {
  const JobFailure = getModel();
  const where = {};
  if (companyId) where.companyId = companyId;
  if (jobName) where.jobName = jobName;

  return JobFailure.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: Math.min(limit, 200),
    offset,
    raw: true,
  });
}

async function getFailureCountSince(since) {
  const JobFailure = getModel();
  return JobFailure.count({ where: { created_at: { [Op.gte]: since } } });
}

/**
 * Top failed job names in the last 24h.
 */
async function getTopFailedJobs(hours = 24, topN = 10) {
  const JobFailure = getModel();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  try {
    const rows = await JobFailure.findAll({
      where: { created_at: { [Op.gte]: since } },
      attributes: [
        'jobName',
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['jobName'],
      order: [[literal('"count" DESC')]],
      limit: topN,
      raw: true,
    });
    return rows.map((r) => ({ jobName: r.jobName || r.job_name, count: parseInt(r.count, 10) }));
  } catch (err) {
    logger.warn({ event: 'top_failed_jobs_error', error: err.message }, 'getTopFailedJobs query failed');
    return [];
  }
}

async function markResolved(id) {
  const JobFailure = getModel();
  const [updated] = await JobFailure.update(
    { resolvedAt: new Date() },
    { where: { id, resolvedAt: null } }
  );
  return updated > 0;
}

async function pruneOldFailures() {
  const JobFailure = getModel();
  const cutoff = new Date(Date.now() - DLQ_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const count = await JobFailure.destroy({ where: { created_at: { [Op.lt]: cutoff } } });
  if (count > 0) {
    logger.info({ event: 'dlq_pruned', count, retentionDays: DLQ_RETENTION_DAYS }, 'Pruned old DLQ entries');
  }
  return count;
}

async function checkFailureSpike(queueName) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await getFailureCountSince(oneHourAgo);
  if (count >= FAILURE_SPIKE_THRESHOLD) {
    logger.error({
      type: 'QUEUE_FAILURE_SPIKE',
      failedLastHour: count,
      threshold: FAILURE_SPIKE_THRESHOLD,
      queueName: queueName || 'ai-cfo-jobs',
    }, `Queue failure spike: ${count} failures in last hour (threshold ${FAILURE_SPIKE_THRESHOLD})`);
  }
  return count;
}

module.exports = {
  recordFailure,
  listRecentFailures,
  getRecentFailures: listRecentFailures,
  getFailureCountSince,
  getTopFailedJobs,
  markResolved,
  pruneOldFailures,
  checkFailureSpike,
  redactPayload,
  DLQ_RETENTION_DAYS,
  FAILURE_SPIKE_THRESHOLD,
};

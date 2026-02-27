'use strict';

const { Op } = require('sequelize');
const { logger } = require('../utils/logger');

const DLQ_RETENTION_DAYS = parseInt(process.env.JOB_DLQ_RETENTION_DAYS || '30', 10);
const FAILURE_SPIKE_THRESHOLD = parseInt(process.env.JOB_FAILURE_SPIKE_THRESHOLD || '10', 10);

let _JobFailure;
function getModel() {
  if (!_JobFailure) _JobFailure = require('../models').JobFailure;
  return _JobFailure;
}

function redactPayload(data) {
  if (!data || typeof data !== 'object') return data;
  const redacted = { ...data };
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

async function recordFailure({ jobId, jobName, queueName, companyId, payload, attempts, failedReason, stackTrace }) {
  try {
    const JobFailure = getModel();
    await JobFailure.create({
      jobId: String(jobId),
      jobName,
      queueName: queueName || 'ai-cfo-jobs',
      companyId: companyId || null,
      payload: redactPayload(payload),
      attempts: attempts || 0,
      failedReason: failedReason ? String(failedReason).slice(0, 2000) : null,
      stackTrace: stackTrace ? String(stackTrace).slice(0, 4000) : null,
      firstFailedAt: new Date(),
      lastFailedAt: new Date(),
    });
  } catch (err) {
    logger.error({ event: 'dlq_record_failed', jobId, jobName, error: err.message }, 'Failed to persist job failure to DLQ');
  }
}

async function getRecentFailures({ limit = 50, offset = 0 } = {}) {
  const JobFailure = getModel();
  return JobFailure.findAndCountAll({
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
  getRecentFailures,
  getFailureCountSince,
  markResolved,
  pruneOldFailures,
  checkFailureSpike,
  redactPayload,
  DLQ_RETENTION_DAYS,
  FAILURE_SPIKE_THRESHOLD,
};

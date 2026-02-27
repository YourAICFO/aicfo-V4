'use strict';

const { Op } = require('sequelize');
const { logger } = require('../utils/logger');

const LOCK_STALE_MINUTES = parseInt(process.env.JOB_LOCK_STALE_MINUTES || '30', 10);

let _Lock;
function getModel() {
  if (!_Lock) _Lock = require('../models').JobIdempotencyLock;
  return _Lock;
}

/**
 * Attempt to acquire an idempotency lock.
 *
 * Returns { acquired: true } if the caller should proceed, or
 * { acquired: false, reason } if the job should be skipped.
 *
 * Lock semantics:
 * - INSERT ON CONFLICT UPDATE: race-safe via unique (company_id, job_key, scope_key).
 * - If status='running' and locked recently (< LOCK_STALE_MINUTES), skip.
 * - If status='running' and stale, take over (previous run likely crashed).
 * - If status='completed', skip (already done).
 * - If status='failed', allow retry (re-acquire).
 */
async function acquireLock({ companyId, jobKey, scopeKey, jobId }) {
  const Lock = getModel();
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - LOCK_STALE_MINUTES * 60 * 1000);

  try {
    const existing = await Lock.findOne({
      where: { companyId, jobKey, scopeKey },
    });

    if (!existing) {
      await Lock.create({
        companyId,
        jobKey,
        scopeKey,
        status: 'running',
        lockedAt: now,
        lastJobId: jobId || null,
      });
      return { acquired: true };
    }

    if (existing.status === 'completed') {
      logger.info({
        event: 'idempotency_skip_completed',
        companyId, jobKey, scopeKey,
        completedAt: existing.completedAt
      }, 'Skipping — already completed');
      return { acquired: false, reason: 'already_completed' };
    }

    if (existing.status === 'running' && existing.lockedAt > staleCutoff) {
      logger.warn({
        event: 'idempotency_skip_running',
        companyId, jobKey, scopeKey,
        lockedAt: existing.lockedAt
      }, 'Skipping — another run is in progress');
      return { acquired: false, reason: 'already_running' };
    }

    await Lock.update(
      { status: 'running', lockedAt: now, lastJobId: jobId || null, lastError: null, completedAt: null },
      { where: { id: existing.id } }
    );
    if (existing.status === 'running') {
      logger.warn({
        event: 'idempotency_takeover_stale',
        companyId, jobKey, scopeKey,
        previousLockedAt: existing.lockedAt
      }, 'Taking over stale lock');
    }
    return { acquired: true };
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return { acquired: false, reason: 'race_conflict' };
    }
    logger.error({ event: 'idempotency_lock_error', error: err.message }, 'Lock acquisition failed');
    return { acquired: true };
  }
}

async function releaseLock({ companyId, jobKey, scopeKey, success, error }) {
  const Lock = getModel();
  const now = new Date();
  try {
    await Lock.update(
      {
        status: success ? 'completed' : 'failed',
        completedAt: success ? now : null,
        lastError: error ? String(error).slice(0, 2000) : null,
      },
      { where: { companyId, jobKey, scopeKey } }
    );
  } catch (err) {
    logger.error({ event: 'idempotency_release_error', error: err.message }, 'Lock release failed');
  }
}

/**
 * Wraps a job handler with idempotency guard.
 * @param {string} jobKey - e.g. 'monthly_snapshot'
 * @param {Function} scopeKeyFn - (data) => scopeKey string
 * @param {Function} handler - original (data, context) => result
 */
function withIdempotency(jobKey, scopeKeyFn, handler) {
  return async (data, context = {}) => {
    const companyId = data?.companyId;
    if (!companyId) return handler(data, context);

    const scopeKey = scopeKeyFn(data);
    const { acquired, reason } = await acquireLock({
      companyId,
      jobKey,
      scopeKey,
      jobId: context.jobId || context.runId || null,
    });

    if (!acquired) {
      logger.info({ event: 'job_skipped_idempotent', jobKey, scopeKey, companyId, reason }, `Job skipped: ${reason}`);
      return { skipped: true, reason };
    }

    try {
      const result = await handler(data, context);
      await releaseLock({ companyId, jobKey, scopeKey, success: true });
      return result;
    } catch (err) {
      await releaseLock({ companyId, jobKey, scopeKey, success: false, error: err.message });
      throw err;
    }
  };
}

module.exports = { acquireLock, releaseLock, withIdempotency, LOCK_STALE_MINUTES };

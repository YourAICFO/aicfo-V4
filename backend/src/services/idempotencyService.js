'use strict';

const crypto = require('crypto');
const { logger } = require('../utils/logger');

const LOCK_STALE_MINUTES = parseInt(process.env.JOB_LOCK_STALE_MINUTES || '30', 10);

let _Lock;
function getModel() {
  if (!_Lock) _Lock = require('../models').JobIdempotencyLock;
  return _Lock;
}

/**
 * Deterministic hash of payload for content-aware dedup.
 * Strips sensitive keys before hashing.
 */
function computePayloadHash(data) {
  if (!data || typeof data !== 'object') return 'empty';
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    const lower = k.toLowerCase();
    if (['password', 'token', 'secret', 'key', 'authorization'].some((s) => lower.includes(s))) continue;
    clean[k] = v;
  }
  const stable = JSON.stringify(clean, Object.keys(clean).sort());
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

/**
 * Attempt to acquire an idempotency lock.
 *
 * Lock semantics:
 * - INSERT on first encounter, race-safe via unique (company_id, job_key, scope_key).
 * - status=running + recent (< LOCK_STALE_MINUTES) => skip.
 * - status=running + stale => take over (previous run crashed).
 * - status=completed + same payloadHash => skip (content unchanged).
 * - status=completed + different payloadHash => allow (data changed).
 * - status=failed => allow retry.
 */
async function acquireLock({ companyId, jobKey, scopeKey, jobId, payloadHash }) {
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
        payloadHash: payloadHash || null,
        status: 'running',
        lockedAt: now,
        lastJobId: jobId || null,
      });
      return { acquired: true };
    }

    if (existing.status === 'completed') {
      if (payloadHash && existing.payloadHash === payloadHash) {
        logger.info({
          event: 'idempotency_skip_completed',
          companyId, jobKey, scopeKey, payloadHash,
        }, 'Skipping — already completed with same payload');
        return { acquired: false, reason: 'already_completed' };
      }
      // payload changed — allow re-run
      await Lock.update(
        { status: 'running', lockedAt: now, lastJobId: jobId || null, lastError: null, completedAt: null, payloadHash: payloadHash || null },
        { where: { id: existing.id } }
      );
      return { acquired: true };
    }

    if (existing.status === 'running' && existing.lockedAt > staleCutoff) {
      logger.warn({
        event: 'idempotency_skip_running',
        companyId, jobKey, scopeKey,
        lockedAt: existing.lockedAt,
      }, 'Skipping — another run is in progress');
      return { acquired: false, reason: 'already_running' };
    }

    // stale running lock or failed — take over
    await Lock.update(
      { status: 'running', lockedAt: now, lastJobId: jobId || null, lastError: null, completedAt: null, payloadHash: payloadHash || null },
      { where: { id: existing.id } }
    );
    if (existing.status === 'running') {
      logger.warn({
        event: 'idempotency_takeover_stale',
        companyId, jobKey, scopeKey,
        previousLockedAt: existing.lockedAt,
      }, 'Taking over stale lock');
    }
    return { acquired: true };
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return { acquired: false, reason: 'race_conflict' };
    }
    logger.error({ event: 'idempotency_lock_error', error: err.message }, 'Lock acquisition failed — proceeding anyway');
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
 * @param {Function} scopeKeyFn - (data) => scope string (will be prefixed with companyId)
 * @param {Function} handler - original (data, context) => result
 */
function withIdempotency(jobKey, scopeKeyFn, handler) {
  return async (data, context = {}) => {
    const companyId = data?.companyId;
    if (!companyId) return handler(data, context);

    const rawScope = scopeKeyFn(data);
    const scopeKey = `${companyId}:${rawScope}`;
    const payloadHash = computePayloadHash(data);
    const { acquired, reason } = await acquireLock({
      companyId,
      jobKey,
      scopeKey,
      jobId: context.jobId || context.runId || null,
      payloadHash,
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

module.exports = { acquireLock, releaseLock, withIdempotency, computePayloadHash, LOCK_STALE_MINUTES };

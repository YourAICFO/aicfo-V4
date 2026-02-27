'use strict';

/**
 * Rate limiting middleware — Redis-backed when enabled (multi-instance safe), in-memory fallback.
 *
 * When RATE_LIMIT_REDIS_ENABLED=true and REDIS_URL is set: uses rate-limit-redis (shared across instances).
 * Each limiter gets its own RedisStore instance with a unique prefix (required by express-rate-limit).
 * On Redis connection/usage errors: fail-open (allow request), single structured warning (no log spam).
 */
const rateLimit = require('express-rate-limit');
const { loadEnv } = require('../config/env');

const env = loadEnv();

/** Shared Redis client; each limiter gets its own RedisStore with a unique prefix. */
let redisClient = null;
/** 'redis' | 'memory' — for tests and diagnostics. */
let rateLimitBackend = 'memory';

let redisRateLimitWarned = false;
function warnRedisOnce(message, err) {
  if (redisRateLimitWarned) return;
  redisRateLimitWarned = true;
  try {
    const { logger } = require('../utils/logger');
    logger.warn({ err: err?.message ?? err, rateLimit: 'redis_fail_open' }, message);
  } catch {
    console.warn('[rate-limit]', message, err?.message ?? err);
  }
}

/** Wraps a Redis store to fail-open on errors: allows the request and logs once. */
function wrapStoreWithFailOpen(store, windowMs) {
  return {
    async increment(key) {
      try {
        return await store.increment(key);
      } catch (err) {
        warnRedisOnce('Rate limit Redis store error; allowing request (fail-open).', err);
        return { totalHits: 0, resetTime: new Date(Date.now() + windowMs) };
      }
    },
    async decrement(key) {
      try {
        await store.decrement(key);
      } catch {
        // no-op on error
      }
    },
    async resetKey(key) {
      try {
        await store.resetKey(key);
      } catch {
        // no-op
      }
    }
  };
}

if (env.RATE_LIMIT_ENABLED && env.RATE_LIMIT_REDIS_ENABLED && env.REDIS_URL) {
  try {
    const IORedis = require('ioredis');
    const client = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
    });
    client.on('error', () => {});
    client.connect().catch((err) => {
      warnRedisOnce('Rate limit Redis connection failed; using in-memory (fail-open).', err);
      try { client.quit(); } catch { /* ignore */ }
    });
    redisClient = client;
    rateLimitBackend = 'redis';
  } catch (err) {
    warnRedisOnce('Rate limit Redis init failed; using in-memory (fail-open).', err);
  }
}

const defaultHandler = (_req, res) => {
  res.status(429).json({
    success: false,
    error: 'Too many requests. Please try again later.',
  });
};

/**
 * @param {string} prefix - Unique prefix for this limiter's Redis keys (e.g. 'rl:auth').
 * @param {number} windowMs
 * @param {number} max
 * @param {object} opts - Additional rateLimit options.
 */
function createLimiter(prefix, windowMs, max, opts = {}) {
  if (!env.RATE_LIMIT_ENABLED) {
    return (_req, _res, next) => next();
  }
  let store;
  if (redisClient) {
    try {
      const { RedisStore } = require('rate-limit-redis');
      const redisStore = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: `rl:${prefix}:`,
      });
      store = wrapStoreWithFailOpen(redisStore, windowMs);
    } catch (err) {
      warnRedisOnce('Rate limit Redis store init failed; using in-memory (fail-open).', err);
    }
  }
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: defaultHandler,
    ...(store ? { store } : {}),
    ...opts,
  });
}

const authLimiter = createLimiter('auth', 60_000, env.RATE_LIMIT_AUTH_PER_MIN, {
  skip: (req) => req.method === 'GET',
  message: { success: false, error: 'Too many auth attempts. Try again later.' },
});

const aiLimiter = createLimiter('ai', 60_000, env.RATE_LIMIT_AI_PER_MIN, {
  message: { success: false, error: 'Too many AI requests. Try again later.' },
});

const connectorLimiter = createLimiter('connector', 60_000, env.RATE_LIMIT_CONNECTOR_PER_MIN, {
  message: { success: false, error: 'Too many connector requests. Try again later.' },
});

const billingLimiter = createLimiter('billing', 60_000, env.RATE_LIMIT_BILLING_PER_MIN, {
  message: { success: false, error: 'Too many billing requests. Try again later.' },
});

const adminLimiter = createLimiter('admin', 60_000, env.RATE_LIMIT_ADMIN_PER_MIN, {
  message: { success: false, error: 'Too many admin requests. Try again later.' },
});

const jobsLimiter = createLimiter('jobs', 60_000, env.RATE_LIMIT_JOBS_PER_MIN, {
  message: { success: false, error: 'Too many job requests. Try again later.' },
});

const globalLimiter = createLimiter('global', 60_000, env.RATE_LIMIT_GLOBAL_PER_MIN);

/** Returns 'redis' | 'memory' for tests and diagnostics. */
function getRateLimitBackend() {
  return rateLimitBackend;
}

module.exports = {
  authLimiter,
  aiLimiter,
  connectorLimiter,
  billingLimiter,
  adminLimiter,
  jobsLimiter,
  globalLimiter,
  getRateLimitBackend,
};

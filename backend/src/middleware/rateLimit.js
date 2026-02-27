'use strict';

/**
 * Rate limiting middleware — Redis-backed when available, in-memory fallback.
 *
 * Uses express-rate-limit + rate-limit-redis for distributed enforcement.
 * Each limiter gets its own RedisStore instance with a unique prefix (required by express-rate-limit).
 * Falls back to in-memory when REDIS_URL is absent or RATE_LIMIT_REDIS_ENABLED=false.
 */
const rateLimit = require('express-rate-limit');
const { loadEnv } = require('../config/env');

const env = loadEnv();

/** Shared Redis client; each limiter gets its own RedisStore with a unique prefix. */
let redisClient = null;

if (env.RATE_LIMIT_ENABLED && env.RATE_LIMIT_REDIS_ENABLED && process.env.REDIS_URL) {
  try {
    const IORedis = require('ioredis');
    redisClient = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
    });
    redisClient.on('error', () => {});
    redisClient.connect().catch(() => {});
  } catch (_) {
    // Redis unavailable — fall through to in-memory
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
    const { RedisStore } = require('rate-limit-redis');
    store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `rl:${prefix}:`,
    });
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

module.exports = {
  authLimiter,
  aiLimiter,
  connectorLimiter,
  billingLimiter,
  adminLimiter,
  jobsLimiter,
  globalLimiter,
};

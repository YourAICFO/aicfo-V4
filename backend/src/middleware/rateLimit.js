'use strict';

/**
 * Rate limiting middleware — Redis-backed when available, in-memory fallback.
 *
 * Uses express-rate-limit + rate-limit-redis for distributed enforcement.
 * Falls back to in-memory when REDIS_URL is absent or RATE_LIMIT_REDIS_ENABLED=false.
 */
const rateLimit = require('express-rate-limit');
const { loadEnv } = require('../config/env');

const env = loadEnv();

let redisStore = null;

if (env.RATE_LIMIT_ENABLED && env.RATE_LIMIT_REDIS_ENABLED && process.env.REDIS_URL) {
  try {
    const { RedisStore } = require('rate-limit-redis');
    const IORedis = require('ioredis');
    const client = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
    });
    client.on('error', () => {});
    client.connect().catch(() => {});
    redisStore = new RedisStore({ sendCommand: (...args) => client.call(...args) });
  } catch (_) {
    // Redis store unavailable — fall through to in-memory
  }
}

const defaultHandler = (_req, res) => {
  res.status(429).json({
    success: false,
    error: 'Too many requests. Please try again later.',
  });
};

function createLimiter(windowMs, max, opts = {}) {
  if (!env.RATE_LIMIT_ENABLED) {
    return (_req, _res, next) => next();
  }
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: defaultHandler,
    ...(redisStore ? { store: redisStore } : {}),
    ...opts,
  });
}

const authLimiter = createLimiter(60_000, env.RATE_LIMIT_AUTH_PER_MIN, {
  skip: (req) => req.method === 'GET',
  message: { success: false, error: 'Too many auth attempts. Try again later.' },
});

const aiLimiter = createLimiter(60_000, env.RATE_LIMIT_AI_PER_MIN, {
  message: { success: false, error: 'Too many AI requests. Try again later.' },
});

const connectorLimiter = createLimiter(60_000, env.RATE_LIMIT_CONNECTOR_PER_MIN, {
  message: { success: false, error: 'Too many connector requests. Try again later.' },
});

const billingLimiter = createLimiter(60_000, env.RATE_LIMIT_BILLING_PER_MIN, {
  message: { success: false, error: 'Too many billing requests. Try again later.' },
});

const adminLimiter = createLimiter(60_000, env.RATE_LIMIT_ADMIN_PER_MIN, {
  message: { success: false, error: 'Too many admin requests. Try again later.' },
});

const jobsLimiter = createLimiter(60_000, env.RATE_LIMIT_JOBS_PER_MIN, {
  message: { success: false, error: 'Too many job requests. Try again later.' },
});

const globalLimiter = createLimiter(60_000, env.RATE_LIMIT_GLOBAL_PER_MIN);

module.exports = {
  authLimiter,
  aiLimiter,
  connectorLimiter,
  billingLimiter,
  adminLimiter,
  jobsLimiter,
  globalLimiter,
};

require('dotenv').config();

const IORedis = require('ioredis');

// Default 127.0.0.1 to avoid IPv6 (::1) connection refused on Windows when Redis binds to IPv4
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isProduction = process.env.NODE_ENV === 'production';
// When not in production, default to resilient (no Redis required) unless explicitly disabled
const QUEUE_RESILIENT_MODE =
  process.env.QUEUE_RESILIENT_MODE === 'true' ||
  (process.env.NODE_ENV !== 'production' && process.env.QUEUE_RESILIENT_MODE !== 'false');

/** BullMQ connection options (single source of truth) */
const connection = {
  url: REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 10000,
  retryStrategy: (times) => Math.min(times * 200, 2000)
};

/**
 * Parse REDIS_URL for logging (host, port, tls).
 * @returns {{ host: string|null, port: number|null, tls: boolean }}
 */
function getRedisTarget() {
  try {
    const parsed = new URL(REDIS_URL);
    return {
      host: parsed.hostname || null,
      port: parsed.port ? Number(parsed.port) : null,
      tls: parsed.protocol === 'rediss:'
    };
  } catch (_) {
    return { host: null, port: null, tls: false };
  }
}

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`PING_TIMEOUT_${ms}ms`)), ms))
  ]);

/**
 * Test Redis connectivity: ping and log result.
 * - On success: logs "Redis connected successfully".
 * - On failure in development: throws (fail loudly).
 * - On failure in production: logs warning and returns false (caller may degrade).
 * @returns {Promise<boolean>} true if connected, false if failed in production
 */
async function testConnection() {
  const redis = new IORedis(REDIS_URL, { ...connection, lazyConnect: true });
  try {
    await redis.connect();
    const pong = await withTimeout(redis.ping(), 10000);
    await redis.quit();
    console.log('Redis connected successfully');
    return true;
  } catch (err) {
    await redis.quit().catch(() => {});
    if (isProduction) {
      console.warn(
        `Redis connection failed (production): ${err.message}. ` +
          (QUEUE_RESILIENT_MODE ? 'QUEUE_RESILIENT_MODE is enabled.' : 'Set QUEUE_RESILIENT_MODE=true to run without Redis.')
      );
      return false;
    }
    console.error('Redis connection failed:', err.message);
    throw err;
  }
}

module.exports = {
  REDIS_URL,
  connection,
  getRedisTarget,
  testConnection,
  isQueueResilientMode: () => QUEUE_RESILIENT_MODE
};

const test = require('node:test');
const assert = require('node:assert/strict');
const { envSchema } = require('../src/config/env');

test('block3 env — rate limit vars parse with defaults', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://x:x@localhost/db',
    JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.RATE_LIMIT_ENABLED, true);
  assert.equal(result.data.RATE_LIMIT_REDIS_ENABLED, true);
  assert.equal(result.data.RATE_LIMIT_AUTH_PER_MIN, 20);
  assert.equal(result.data.RATE_LIMIT_AI_PER_MIN, 30);
  assert.equal(result.data.RATE_LIMIT_ADMIN_PER_MIN, 60);
  assert.equal(result.data.RATE_LIMIT_CONNECTOR_PER_MIN, 30);
  assert.equal(result.data.RATE_LIMIT_BILLING_PER_MIN, 20);
  assert.equal(result.data.RATE_LIMIT_GLOBAL_PER_MIN, 300);
});

test('block3 env — monitoring vars parse with defaults', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://x:x@localhost/db',
    JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.API_5XX_SPIKE_THRESHOLD, 20);
  assert.equal(result.data.QUEUE_FAIL_SPIKE_THRESHOLD, 10);
  assert.equal(result.data.QUEUE_MONITORING_ENABLED, true);
});

test('block3 env — rate limit vars accept overrides', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://x:x@localhost/db',
    JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
    REDIS_URL: 'redis://localhost:6379',
    ALLOWED_ORIGINS: 'https://app.example.com',
    RATE_LIMIT_AUTH_PER_MIN: '50',
    RATE_LIMIT_GLOBAL_PER_MIN: '1000',
    API_5XX_SPIKE_THRESHOLD: '5',
    RATE_LIMIT_ENABLED: 'false',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.RATE_LIMIT_AUTH_PER_MIN, 50);
  assert.equal(result.data.RATE_LIMIT_GLOBAL_PER_MIN, 1000);
  assert.equal(result.data.API_5XX_SPIKE_THRESHOLD, 5);
  assert.equal(result.data.RATE_LIMIT_ENABLED, false);
});

test('block3 env — production parses without ALLOWED_ORIGINS (loadEnv applies default)', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://x:x@localhost/db',
    JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
    REDIS_URL: 'redis://localhost:6379',
  });
  assert.equal(result.success, true);
});

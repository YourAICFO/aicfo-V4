const test = require('node:test');
const assert = require('node:assert/strict');
const { envSchema } = require('../src/config/env');

test('env validation — rejects missing JWT_SECRET', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://x:x@localhost/db',
  });
  assert.equal(result.success, false);
  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('JWT_SECRET'), `Expected JWT_SECRET in issue paths: ${paths}`);
});

test('env validation — rejects short JWT_SECRET', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://x:x@localhost/db',
    JWT_SECRET: 'too-short',
  });
  assert.equal(result.success, false);
  const msgs = result.error.issues.map((i) => i.message);
  assert.ok(msgs.some((m) => m.includes('32 characters')));
});

test('env validation — accepts valid config', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://x:x@localhost/db',
    JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.PORT, 5000);
  assert.equal(result.data.JWT_EXPIRES_IN, '7d');
  assert.equal(result.data.ALLOW_SEQUELIZE_SYNC, false);
});

test('env validation — requires DATABASE_URL outside of test env', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'production',
    JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
    ALLOWED_ORIGINS: 'https://app.example.com',
    REDIS_URL: 'redis://localhost:6379',
  });
  assert.equal(result.success, false);
  const msgs = result.error.issues.map((i) => i.message);
  assert.ok(msgs.some((m) => m.includes('DATABASE_URL')));
});

test('env validation — DATABASE_URL optional in test env', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'test',
    JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
  });
  assert.equal(result.success, true);
});

test('env validation — requires REDIS_URL in prod without resilient mode', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://x:x@localhost/db',
    JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
    ALLOWED_ORIGINS: 'https://app.example.com',
  });
  assert.equal(result.success, false);
  const msgs = result.error.issues.map((i) => i.message);
  assert.ok(msgs.some((m) => m.includes('REDIS_URL')));
});

test('env validation — requires ALLOWED_ORIGINS in production', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://x:x@localhost/db',
    JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
    REDIS_URL: 'redis://localhost:6379',
  });
  assert.equal(result.success, false);
  const msgs = result.error.issues.map((i) => i.message);
  assert.ok(msgs.some((m) => m.includes('ALLOWED_ORIGINS')));
});

test('env validation — parses boolean env vars correctly', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://x:x@localhost/db',
    JWT_SECRET: 'a-valid-secret-that-is-at-least-32-characters-long',
    ENFORCE_COMPANY_LIMITS: 'true',
    ENFORCE_USAGE_LIMITS: '1',
    ENABLE_CONNECTOR_DEV_ROUTES: 'false',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.ENFORCE_COMPANY_LIMITS, true);
  assert.equal(result.data.ENFORCE_USAGE_LIMITS, true);
  assert.equal(result.data.ENABLE_CONNECTOR_DEV_ROUTES, false);
});

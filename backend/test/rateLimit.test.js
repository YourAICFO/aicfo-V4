'use strict';

require('dotenv').config();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'a-valid-secret-that-is-at-least-32-characters-long';
}

/**
 * Rate limiting middleware tests: in-memory vs Redis path, fail-open behavior.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('path');

test('rate limit — getRateLimitBackend returns redis or memory', () => {
  const { getRateLimitBackend } = require('../src/middleware/rateLimit');
  const backend = getRateLimitBackend();
  assert.equal(typeof backend, 'string');
  assert.ok(backend === 'redis' || backend === 'memory', `Expected 'redis' or 'memory', got ${backend}`);
});

test('rate limit — authLimiter is a function and does not throw when invoked', () => {
  const { authLimiter } = require('../src/middleware/rateLimit');
  assert.equal(typeof authLimiter, 'function');
  const req = { method: 'GET', ip: '127.0.0.1' };
  const res = { status: () => res, json: () => res };
  assert.doesNotThrow(() => {
    authLimiter(req, res, () => {});
  }, 'authLimiter should not throw when invoked');
});

test('rate limit — with RATE_LIMIT_REDIS_ENABLED=false uses memory backend (subprocess)', () => {
  const cwd = path.resolve(__dirname, '..');
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `
        process.env.RATE_LIMIT_REDIS_ENABLED = 'false';
        process.env.REDIS_URL = '';
        process.env.JWT_SECRET = 'a-valid-secret-that-is-at-least-32-characters-long';
        process.env.NODE_ENV = 'test';
        const r = require('./src/middleware/rateLimit');
        const b = r.getRateLimitBackend();
        if (b !== 'memory') throw new Error('Expected memory, got ' + b);
        console.log('ok');
      `
    ],
    { cwd, encoding: 'utf8', timeout: 5000 }
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'subprocess failed');
  assert.ok((result.stdout || '').trim() === 'ok' || result.status === 0);
});

test('rate limit — graceful fallback when Redis init fails (subprocess)', () => {
  const cwd = path.resolve(__dirname, '..');
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `
        process.env.RATE_LIMIT_REDIS_ENABLED = 'true';
        process.env.REDIS_URL = 'redis://localhost:16379';
        process.env.JWT_SECRET = 'a-valid-secret-that-is-at-least-32-characters-long';
        process.env.NODE_ENV = 'test';
        const Module = require('module');
        const orig = Module.prototype.require;
        Module.prototype.require = function (id) {
          if (id === 'ioredis') throw new Error('Mock Redis unavailable');
          return orig.apply(this, arguments);
        };
        const r = require('./src/middleware/rateLimit');
        Module.prototype.require = orig;
        const b = r.getRateLimitBackend();
        if (b !== 'memory') throw new Error('Expected memory after Redis init failure, got ' + b);
        console.log('ok');
      `
    ],
    { cwd, encoding: 'utf8', timeout: 5000 }
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'subprocess failed');
});

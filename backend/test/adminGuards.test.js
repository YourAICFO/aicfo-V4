const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAdmin } = require('../src/middleware/adminAuth');

test('requireAdmin — rejects when no user on req', () => {
  let statusCode, body;
  const req = {};
  const res = {
    status(c) { statusCode = c; return this; },
    json(d) { body = d; },
  };
  const next = () => { statusCode = 200; };
  requireAdmin(req, res, next);
  assert.equal(statusCode, 401);
  assert.equal(body.success, false);
});

test('requireAdmin — rejects non-admin user', () => {
  const origEnv = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'admin@example.com';

  let statusCode, body;
  const req = { user: { email: 'notadmin@example.com' } };
  const res = {
    status(c) { statusCode = c; return this; },
    json(d) { body = d; },
  };
  const next = () => { statusCode = 200; };
  requireAdmin(req, res, next);
  assert.equal(statusCode, 403);
  assert.equal(body.success, false);

  if (origEnv !== undefined) process.env.ADMIN_EMAILS = origEnv;
  else delete process.env.ADMIN_EMAILS;
});

test('requireAdmin — allows admin user', () => {
  const origEnv = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'admin@example.com,other@example.com';

  let statusCode = null;
  const req = { user: { email: 'admin@example.com' } };
  const res = {
    status(c) { statusCode = c; return this; },
    json() {},
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  requireAdmin(req, res, next);
  assert.equal(nextCalled, true);
  assert.equal(statusCode, null);

  if (origEnv !== undefined) process.env.ADMIN_EMAILS = origEnv;
  else delete process.env.ADMIN_EMAILS;
});

test('requireAdmin — returns 503 when ADMIN_EMAILS not configured', () => {
  const origEnv = process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_EMAILS;

  let statusCode, body;
  const req = { user: { email: 'anyone@example.com' } };
  const res = {
    status(c) { statusCode = c; return this; },
    json(d) { body = d; },
  };
  const next = () => {};
  requireAdmin(req, res, next);
  assert.equal(statusCode, 503);

  if (origEnv !== undefined) process.env.ADMIN_EMAILS = origEnv;
});

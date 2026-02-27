const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const { validateBody, validateQuery } = require('../src/middleware/validateBody');

function mockReqResNext(body, query) {
  let statusCode = null;
  let jsonBody = null;
  let nextCalled = false;
  const req = { body: body || {}, query: query || {}, validatedBody: null, validatedQuery: null };
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { jsonBody = data; },
  };
  const next = () => { nextCalled = true; };
  return { req, res, next, get: () => ({ statusCode, jsonBody, nextCalled }) };
}

test('validateBody — valid body calls next and sets req.validatedBody', () => {
  const schema = z.object({ name: z.string().min(1) });
  const mw = validateBody(schema);
  const { req, res, next, get } = mockReqResNext({ name: 'Test' });
  mw(req, res, next);
  const r = get();
  assert.equal(r.nextCalled, true);
  assert.equal(r.statusCode, null);
  assert.deepEqual(req.validatedBody, { name: 'Test' });
});

test('validateBody — invalid body returns 400 with INVALID_INPUT', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int() });
  const mw = validateBody(schema);
  const { req, res, next, get } = mockReqResNext({ name: '', age: 'not-a-number' });
  mw(req, res, next);
  const r = get();
  assert.equal(r.nextCalled, false);
  assert.equal(r.statusCode, 400);
  assert.equal(r.jsonBody.success, false);
  assert.equal(r.jsonBody.error, 'INVALID_INPUT');
  assert.ok(Array.isArray(r.jsonBody.details));
  assert.ok(r.jsonBody.details.length >= 1);
  assert.ok(r.jsonBody.details.some((d) => d.path === 'name'));
});

test('validateBody — missing required field returns 400', () => {
  const schema = z.object({ email: z.string().email() });
  const mw = validateBody(schema);
  const { req, res, next, get } = mockReqResNext({});
  mw(req, res, next);
  const r = get();
  assert.equal(r.statusCode, 400);
  assert.equal(r.jsonBody.error, 'INVALID_INPUT');
});

test('validateQuery — valid query calls next', () => {
  const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });
  const mw = validateQuery(schema);
  const { req, res, next, get } = mockReqResNext(null, { month: '2025-01' });
  mw(req, res, next);
  const r = get();
  assert.equal(r.nextCalled, true);
  assert.deepEqual(req.validatedQuery, { month: '2025-01' });
});

test('validateQuery — invalid query returns 400', () => {
  const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });
  const mw = validateQuery(schema);
  const { req, res, next, get } = mockReqResNext(null, { month: 'bad' });
  mw(req, res, next);
  const r = get();
  assert.equal(r.statusCode, 400);
  assert.equal(r.jsonBody.error, 'INVALID_INPUT');
});

const test = require('node:test');
const assert = require('node:assert/strict');

test('devGate — blocks when NODE_ENV is production', async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origFlag = process.env.ENABLE_CONNECTOR_DEV_ROUTES;
  try {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_CONNECTOR_DEV_ROUTES = 'true';

    delete require.cache[require.resolve('../src/middleware/devGate')];
    const { requireDevRouteEnabled } = require('../src/middleware/devGate');

    let statusCode, body;
    const req = {};
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { body = data; },
    };
    const next = () => { statusCode = 200; };

    requireDevRouteEnabled(req, res, next);
    assert.equal(statusCode, 404);
    assert.deepEqual(body, { success: false, error: 'Not found' });
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.ENABLE_CONNECTOR_DEV_ROUTES = origFlag;
    delete require.cache[require.resolve('../src/middleware/devGate')];
  }
});

test('devGate — blocks when flag is missing/false in development', async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origFlag = process.env.ENABLE_CONNECTOR_DEV_ROUTES;
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_CONNECTOR_DEV_ROUTES;

    delete require.cache[require.resolve('../src/middleware/devGate')];
    const { requireDevRouteEnabled } = require('../src/middleware/devGate');

    let statusCode;
    const req = {};
    const res = {
      status(code) { statusCode = code; return this; },
      json() {},
    };
    const next = () => { statusCode = 200; };

    requireDevRouteEnabled(req, res, next);
    assert.equal(statusCode, 404);
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    if (origFlag !== undefined) process.env.ENABLE_CONNECTOR_DEV_ROUTES = origFlag;
    delete require.cache[require.resolve('../src/middleware/devGate')];
  }
});

test('devGate — allows when development AND flag is true', async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origFlag = process.env.ENABLE_CONNECTOR_DEV_ROUTES;
  try {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_CONNECTOR_DEV_ROUTES = 'true';

    delete require.cache[require.resolve('../src/middleware/devGate')];
    const { requireDevRouteEnabled } = require('../src/middleware/devGate');

    let called = false;
    const req = {};
    const res = {
      status() { return this; },
      json() {},
    };
    const next = () => { called = true; };

    requireDevRouteEnabled(req, res, next);
    assert.equal(called, true);
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    if (origFlag !== undefined) process.env.ENABLE_CONNECTOR_DEV_ROUTES = origFlag;
    else delete process.env.ENABLE_CONNECTOR_DEV_ROUTES;
    delete require.cache[require.resolve('../src/middleware/devGate')];
  }
});

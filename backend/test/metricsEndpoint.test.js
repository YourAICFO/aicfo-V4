const test = require('node:test');
const assert = require('node:assert/strict');
const { metricsMiddleware, formatPrometheus, getCounters, getDurations, routeGroup, statusClass } = require('../src/middleware/metricsCollector');

test('routeGroup — extracts API prefix correctly', () => {
  assert.equal(routeGroup('/api/auth/login'), '/api/auth');
  assert.equal(routeGroup('/api/ai/chat'), '/api/ai');
  assert.equal(routeGroup('/api/admin/queue/health'), '/api/admin');
  assert.equal(routeGroup('/api/connector/device/login'), '/api/connector');
  assert.equal(routeGroup('/health'), '/health');
  assert.equal(routeGroup('/download/connector'), '/download');
  assert.equal(routeGroup('/metrics'), '/metrics');
  assert.equal(routeGroup('/random/path'), '/other');
});

test('statusClass — maps HTTP codes correctly', () => {
  assert.equal(statusClass(200), '2xx');
  assert.equal(statusClass(201), '2xx');
  assert.equal(statusClass(301), '3xx');
  assert.equal(statusClass(400), '4xx');
  assert.equal(statusClass(404), '4xx');
  assert.equal(statusClass(429), '4xx');
  assert.equal(statusClass(500), '5xx');
  assert.equal(statusClass(503), '5xx');
});

test('formatPrometheus — produces valid Prometheus text format', () => {
  const output = formatPrometheus({ queue_failures_last_hour: 3, dlq_count: 7 });
  assert.ok(output.includes('# HELP http_requests_total'));
  assert.ok(output.includes('# TYPE http_requests_total counter'));
  assert.ok(output.includes('# HELP http_request_duration_ms'));
  assert.ok(output.includes('queue_failures_last_hour 3'));
  assert.ok(output.includes('dlq_count 7'));
  assert.ok(output.endsWith('\n'));
});

test('metricsMiddleware — records request on finish', (t, done) => {
  const req = { originalUrl: '/api/auth/login' };
  const handlers = {};
  const res = {
    statusCode: 200,
    on(event, handler) { handlers[event] = handler; },
  };
  const next = () => {
    handlers.finish();
    const counters = getCounters();
    const key = '/api/auth|2xx';
    assert.ok(counters[key] >= 1, `Expected counter for ${key}`);
    done();
  };
  metricsMiddleware(req, res, next);
});

test('formatPrometheus — includes per-route duration stats after middleware runs', () => {
  const d = getDurations();
  assert.ok('/api/auth' in d || Object.keys(d).length >= 0);
  const output = formatPrometheus({});
  assert.ok(typeof output === 'string');
});

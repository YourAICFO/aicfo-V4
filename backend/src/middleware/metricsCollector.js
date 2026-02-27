'use strict';

/**
 * Lightweight in-process HTTP metrics collector.
 * Tracks request counts by route group + status class, and basic duration.
 * Exposed via /metrics in Prometheus text format.
 */

const counters = {};
const durations = {};

function routeGroup(url) {
  if (!url) return 'other';
  const parts = url.split('?')[0].split('/').filter(Boolean);
  if (parts[0] === 'api' && parts.length >= 2) {
    return `/api/${parts[1]}`;
  }
  if (parts[0] === 'health') return '/health';
  if (parts[0] === 'download') return '/download';
  if (parts[0] === 'metrics') return '/metrics';
  return '/other';
}

function statusClass(code) {
  if (code >= 500) return '5xx';
  if (code >= 400) return '4xx';
  if (code >= 300) return '3xx';
  if (code >= 200) return '2xx';
  return 'other';
}

function recordRequest(req, res) {
  const group = routeGroup(req.originalUrl);
  const cls = statusClass(res.statusCode);
  const key = `${group}|${cls}`;
  counters[key] = (counters[key] || 0) + 1;
}

function recordDuration(group, ms) {
  if (!durations[group]) {
    durations[group] = { sum: 0, count: 0, max: 0 };
  }
  durations[group].sum += ms;
  durations[group].count += 1;
  if (ms > durations[group].max) durations[group].max = ms;
}

function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    recordRequest(req, res);
    const group = routeGroup(req.originalUrl);
    recordDuration(group, Date.now() - start);
  });
  next();
}

function formatPrometheus(extraMetrics = {}) {
  const lines = [];

  lines.push('# HELP http_requests_total Total HTTP requests by route group and status class');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, count] of Object.entries(counters)) {
    const [group, cls] = key.split('|');
    lines.push(`http_requests_total{route="${group}",status="${cls}"} ${count}`);
  }

  lines.push('# HELP http_request_duration_ms HTTP request duration statistics');
  lines.push('# TYPE http_request_duration_ms summary');
  for (const [group, d] of Object.entries(durations)) {
    if (d.count === 0) continue;
    const avg = Math.round(d.sum / d.count);
    lines.push(`http_request_duration_ms{route="${group}",stat="avg"} ${avg}`);
    lines.push(`http_request_duration_ms{route="${group}",stat="max"} ${d.max}`);
    lines.push(`http_request_duration_ms{route="${group}",stat="count"} ${d.count}`);
  }

  for (const [name, value] of Object.entries(extraMetrics)) {
    lines.push(`# HELP ${name} Auto-collected metric`);
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name} ${value}`);
  }

  return lines.join('\n') + '\n';
}

function getCounters() { return { ...counters }; }
function getDurations() { return JSON.parse(JSON.stringify(durations)); }

module.exports = { metricsMiddleware, formatPrometheus, getCounters, getDurations, routeGroup, statusClass };

'use strict';

/**
 * Rolling-window 5xx spike detector for the Express error handler.
 * Logs a structured ALERT event when errors exceed threshold within the window.
 */
const { logger } = require('../utils/logger');

const WINDOW_MS = 60_000;
const threshold = parseInt(process.env.API_5XX_SPIKE_THRESHOLD || '20', 10);

let timestamps = [];
let lastAlertAt = 0;

function record5xx(route) {
  const now = Date.now();
  timestamps.push({ t: now, route });
  timestamps = timestamps.filter((e) => now - e.t < WINDOW_MS);

  if (timestamps.length >= threshold && now - lastAlertAt > WINDOW_MS) {
    lastAlertAt = now;
    const routeBreakdown = {};
    for (const { route: r } of timestamps) {
      const key = r || 'unknown';
      routeBreakdown[key] = (routeBreakdown[key] || 0) + 1;
    }

    logger.error({
      type: 'API_5XX_SPIKE',
      count: timestamps.length,
      threshold,
      windowMs: WINDOW_MS,
      topRoutes: Object.entries(routeBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([route, count]) => ({ route, count })),
    }, `API 5xx spike: ${timestamps.length} errors in last 60s (threshold ${threshold})`);

    try {
      const Sentry = require('@sentry/node');
      if (Sentry.isInitialized && Sentry.isInitialized()) {
        Sentry.captureMessage(`API 5xx spike: ${timestamps.length} errors in 60s`, 'warning');
      }
    } catch (_) {}
  }
}

function getErrorSpikeStats() {
  const now = Date.now();
  timestamps = timestamps.filter((e) => now - e.t < WINDOW_MS);
  return { count: timestamps.length, threshold, windowMs: WINDOW_MS };
}

module.exports = { record5xx, getErrorSpikeStats };

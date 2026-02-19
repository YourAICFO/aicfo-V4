/**
 * Central rate limiting for sensitive endpoints (auth, connector, AI).
 * Uses in-memory store by default; for multi-instance deployments use a shared store (e.g. rate-limit-redis).
 */
const rateLimit = require('express-rate-limit');

const defaultHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Too many requests. Please try again later.'
  });
};

/** Auth: login/signup/me – prevent brute force. Per IP. Default 80/15min allows retries and multiple tabs. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '80', 10),
  message: { success: false, error: 'Too many auth attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler
});

/** Connector API (devices, sync, link) – prevent abuse. Per IP. */
const connectorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_CONNECTOR_MAX || '120', 10),
  message: { success: false, error: 'Too many connector requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler
});

/** AI chat and insights – limit cost and abuse. Per IP. */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AI_MAX || '60', 10),
  message: { success: false, error: 'Too many AI requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler
});

module.exports = {
  authLimiter,
  connectorLimiter,
  aiLimiter
};

require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.JWT_SECRET;

if (isProduction && (!rawSecret || rawSecret.trim().length < 32)) {
  // In production, a strong JWT_SECRET is mandatory. Fail fast on misconfiguration.
  // This deliberately does not fall back to any default value.
  // eslint-disable-next-line no-console
  require('../utils/logger').logger.error('CRITICAL: JWT_SECRET must be set to a strong value in production');
  process.exit(1);
}

const jwtSecret = rawSecret && rawSecret.trim().length > 0
  ? rawSecret
  : 'fallback-secret-key-change-in-production';

module.exports = {
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptSaltRounds: 12
};

'use strict';

/**
 * Gate middleware for development-only routes.
 *
 * Requirements (both must be true):
 *   1. NODE_ENV === 'development'
 *   2. ENABLE_CONNECTOR_DEV_ROUTES === 'true'
 *
 * Returns 404 on failure so production never reveals route existence.
 */
const requireDevRouteEnabled = (req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  const flagOn = process.env.ENABLE_CONNECTOR_DEV_ROUTES === 'true';

  if (isDev && flagOn) return next();

  return res.status(404).json({ success: false, error: 'Not found' });
};

module.exports = { requireDevRouteEnabled };

const Sentry = require('@sentry/node');

let enabled = false;

const initSentry = ({ serviceName }) => {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || undefined
  });
  Sentry.setTag('service', serviceName || 'ai-cfo-api');
  Sentry.setTag('env', process.env.NODE_ENV || 'development');
  if (process.env.GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA) {
    Sentry.setTag('git_sha', process.env.GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA);
  }
  enabled = true;
};

const sentryRequestHandler = (req, _res, next) => {
  if (!enabled) return next();
  Sentry.setContext('request_context', {
    run_id: req.run_id,
    user_id: req.user?.id || null,
    company_id: req.company?.id || req.companyId || null
  });
  return next();
};

const sentryErrorHandler = (err, req, _res, next) => {
  if (enabled) {
    captureException(err, {
      run_id: req.run_id,
      user_id: req.user?.id || null,
      company_id: req.company?.id || req.companyId || null
    });
  }
  next(err);
};

const captureException = (err, context = {}) => {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (context.run_id) scope.setTag('run_id', context.run_id);
    if (context.company_id) scope.setTag('company_id', context.company_id);
    if (context.job_name) scope.setTag('job_name', context.job_name);
    scope.setContext('extra_context', context);
    Sentry.captureException(err);
  });
};

module.exports = {
  initSentry,
  sentryRequestHandler,
  sentryErrorHandler,
  captureException
};

const pino = require('pino');
const { persistAppLog } = require('./logSink');

const gitSha = process.env.GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || null;

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'ai-cfo-api',
    env: process.env.NODE_ENV || 'development',
    git_sha: gitSha
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

const childLogger = (ctx = {}) => logger.child(ctx);

const logWarn = async (ctx = {}, msg = 'warn', data = {}) => {
  logger.warn({ ...ctx, ...data }, msg);
  await persistAppLog({
    level: 'warn',
    service: ctx.service || 'ai-cfo-api',
    run_id: ctx.run_id,
    company_id: ctx.company_id,
    event: ctx.event || data.event || 'warn_event',
    message: msg,
    data
  });
};

const logError = async (ctx = {}, msg = 'error', err = null) => {
  const errObj = err ? { err } : {};
  logger.error({ ...ctx, ...errObj }, msg);
  await persistAppLog({
    level: 'error',
    service: ctx.service || 'ai-cfo-api',
    run_id: ctx.run_id,
    company_id: ctx.company_id,
    event: ctx.event || 'error_event',
    message: msg,
    data: err ? { name: err.name, message: err.message } : {},
    error_stack: err?.stack || null
  });
};

module.exports = {
  logger,
  childLogger,
  logWarn,
  logError
};

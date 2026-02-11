const { AppLog } = require('../models');

const persistAppLog = async ({
  level,
  service,
  run_id,
  company_id,
  event,
  message,
  data,
  error_stack
}) => {
  try {
    await AppLog.create({
      level: level || 'info',
      service: service || 'ai-cfo-api',
      runId: run_id || null,
      companyId: company_id || null,
      event: event || 'unknown_event',
      message: message || '',
      data: data || {},
      errorStack: error_stack || null
    });
  } catch (_) {
    // best effort sink
  }
};

module.exports = { persistAppLog };

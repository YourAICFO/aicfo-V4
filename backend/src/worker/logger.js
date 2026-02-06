const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'ai-cfo-worker'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = { logger };

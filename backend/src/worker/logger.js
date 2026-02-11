const { childLogger } = require('../utils/logger');

const logger = childLogger({ service: 'ai-cfo-worker' });

module.exports = { logger };

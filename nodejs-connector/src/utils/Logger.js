const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
  constructor() {
    this.logger = this.createLogger();
  }

  createLogger() {
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          return `${timestamp} [${level.toUpperCase()}] ${stack || message}`;
        })
      ),
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, stack }) => {
              return `${timestamp} [${level}] ${stack || message}`;
            })
          )
        }),
        // File transport - main log file
        new winston.transports.File({
          filename: path.join(logsDir, 'connector.log'),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        }),
        // Error log file
        new winston.transports.File({
          filename: path.join(logsDir, 'connector-error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 3,
          tailable: true
        })
      ],
      exitOnError: false
    });

    return logger;
  }

  // Logging methods
  info(message, meta) {
    this.logger.info(message, meta);
  }

  error(message, error, meta) {
    if (error instanceof Error) {
      this.logger.error(message, { error: error.message, stack: error.stack, ...meta });
    } else {
      this.logger.error(message, { error, ...meta });
    }
  }

  warn(message, meta) {
    this.logger.warn(message, meta);
  }

  debug(message, meta) {
    this.logger.debug(message, meta);
  }

  log(level, message, meta) {
    this.logger.log(level, message, meta);
  }
}

module.exports = Logger;
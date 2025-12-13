import winston from 'winston';

/**
 * Configure Winston logger with consistent formatting
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'stremio-nas-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          // Always include error details, even if service is present
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      )
    })
  ]
});

/**
 * Update log level dynamically
 * @param level - New log level (error, warn, info, verbose, debug, silly)
 */
export function setLogLevel(level: string): void {
  const validLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
  if (validLevels.includes(level.toLowerCase())) {
    logger.level = level.toLowerCase();
    logger.info('Log level updated', { newLevel: level });
  } else {
    logger.warn('Invalid log level', { level, validLevels });
  }
}

/**
 * Get current log level
 */
export function getLogLevel(): string {
  return logger.level;
}

export default logger;

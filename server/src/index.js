const createApp = require('./app');
const config = require('./config');
const logger = require('./config/logger');
const scheduler = require('./services/scheduler.service');
const fileScannerService = require('./services/fileScanner.service');
const db = require('./services/database.service');

/**
 * Server entry point
 */
async function startServer() {
  const app = createApp();

  // Initial scan on startup (optional)
  if (config.scanner.onStartup) {
    logger.info('Running initial file scan...');
    try {
      await fileScannerService.scan();
    } catch (error) {
      logger.error('Initial file scan failed', { error: error.message });
    }
  }

  // Start periodic scanning
  scheduler.start();

  // Start listening
  const server = app.listen(config.port, config.host, () => {
    logger.info('Media API server started', {
      port: config.port,
      host: config.host,
      mediaDir: config.mediaDir,
      allowedExtensions: config.allowedExtensions.join(', '),
      logLevel: config.logLevel,
      database: {
        path: config.database.path
      },
      scanner: {
        interval: config.scanner.interval,
        onStartup: config.scanner.onStartup
      },
      cache: {
        imdbTTL: `${config.cache.imdbTTL}ms`
      }
    });
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutdown signal received, shutting down gracefully');
    scheduler.stop();
    server.close(() => {
      db.close();
      logger.info('Server closed');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = startServer;


import createApp from './app';
import config from './config';
import logger from './config/logger';
import scheduler from './services/scheduler.service';
import fileScannerService from './services/file-scanner.service';
import db from './services/database.service';
import { Server } from 'http';

/**
 * Server entry point
 */
async function startServer(): Promise<Server> {
  const app = createApp();

  // Initial scan on startup (optional)
  if (config.scanner.onStartup) {
    logger.info('Running initial file scan...');
    try {
      await fileScannerService.scan();
    } catch (error: any) {
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

  // Optimize HTTP server for video streaming
  server.setTimeout(0); // Disable timeout for long-running streams
  server.keepAliveTimeout = 65000; // Keep connections alive (65s)
  server.headersTimeout = 66000; // Slightly higher than keepAlive (66s)

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

export default startServer;

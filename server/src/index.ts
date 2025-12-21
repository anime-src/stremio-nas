import 'reflect-metadata';
import createApp from './app';
import config from './config';
import logger from './config/logger';
import { setLogLevel } from './config/logger';
import scheduler from './services/scheduler.service';
import fileScannerService from './services/file-scanner.service';
import db from './services/database.service';
import configService from './services/config.service';
import { Server } from 'http';

/**
 * Server entry point
 */
async function startServer(): Promise<Server> {
  const app = createApp();

  // Initialize configuration service (loads watch folders and settings from database)
  await configService.initialize();

  // Apply log level from database settings
  const logLevel = configService.getLogLevel();
  setLogLevel(logLevel);
  logger.info('Log level set from database', { level: logLevel });

  // Get enabled watch folders
  const watchFolders = configService.getEnabledWatchFolders();
  logger.info('Loaded watch folders', { count: watchFolders.length });

  // Start scheduler with watch folders
  scheduler.start(watchFolders);

  // Initial scan on startup (optional)
  if (configService.isScanOnStartup()) {
    logger.info('Running initial file scans for enabled watch folders...');
    for (const folder of watchFolders) {
      if (folder.id) {
        try {
          await fileScannerService.scan(folder.id);
        } catch (error: any) {
          logger.error('Initial file scan failed', { 
            watchFolderId: folder.id,
            path: folder.path,
            error: error.message 
          });
        }
      }
    }
  }

  // Start listening
  const server = app.listen(config.port, config.host, () => {
    logger.info('Media API server started', {
      port: config.port,
      host: config.host,
      logLevel: configService.getLogLevel(),
      watchFolders: watchFolders.length,
      database: {
        path: config.database.path
      },
      scheduler: {
        activeJobs: scheduler.getStatus().jobs.length
      }
    });
  });

  // Optimize HTTP server for video streaming
  server.setTimeout(0); // Disable timeout for long-running streams
  server.keepAliveTimeout = 65000; // Keep connections alive (65s)
  server.headersTimeout = 66000; // Slightly higher than keepAlive (66s)

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutdown signal received, shutting down gracefully');
    scheduler.stop();
    server.close(async () => {
      await db.close();
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

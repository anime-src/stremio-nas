const path = require('path');
const db = require('../services/database.service');
const scheduler = require('../services/scheduler.service');
const logger = require('../config/logger');
const { ApiError } = require('../middleware/errorHandler');
const config = require('../config');

/**
 * Controller for file listing operations
 */
class FilesController {
  /**
   * List all video files
   * @route GET /files
   */
  async listFiles(req, res, next) {
    const startTime = Date.now();
    
    try {
      logger.info('Listing files', { extFilter: req.query.ext });
      
      // Get files directly from database
      let files;
      if (req.validatedExt) {
        // Filter by extension in database query
        files = db.filterByExtension(req.validatedExt);
        logger.debug('Files filtered by extension', { 
          extension: req.validatedExt, 
          count: files.length 
        });
      } else {
        // Get all files
        files = db.getAllFiles();
      }
      
      const duration = Date.now() - startTime;
      logger.info('Files listed successfully', { 
        count: files.length, 
        duration: `${duration}ms` 
      });
      
      res.json(files);
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error('Error listing files', { 
        error: err.message, 
        stack: err.stack, 
        duration: `${duration}ms` 
      });
      next(err);
    }
  }

  /**
   * Trigger manual file scan
   * @route POST /files/refresh
   */
  async refreshCache(req, res, next) {
    try {
      // Trigger scan through scheduler (includes isScanning check and proper error handling)
      const result = await scheduler.triggerScan();
      
      // Get updated count from database
      const stats = db.getStats();
      
      res.json({ 
        message: 'File scan completed successfully',
        fileCount: stats.totalFiles,
        filesFound: result.filesFound,
        removedCount: result.removedCount,
        duration: result.duration,
        scanCompleted: new Date().toISOString()
      });
    } catch (err) {
      if (err.message === 'Scan already in progress') {
        return res.status(409).json({ 
          error: 'Scan already in progress',
          message: 'A file scan is currently running. Please wait for it to complete.'
        });
      }
      logger.error('Error during manual scan', { error: err.message });
      next(err);
    }
  }

  /**
   * Get database statistics
   * @route GET /files/stats
   */
  getStats(req, res) {
    try {
      const stats = db.getStats();
      const schedulerStatus = scheduler.getStatus();
      
      res.json({
        database: stats,
        scheduler: schedulerStatus,
        config: {
          scanInterval: config.scanner.interval,
          scanOnStartup: config.scanner.onStartup
        }
      });
    } catch (err) {
      logger.error('Error getting stats', { error: err.message });
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  }

  /**
   * Get scan history
   * @route GET /files/scan-history
   */
  getScanHistory(req, res) {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const history = db.getScanHistory(limit);
      
      res.json({ history });
    } catch (err) {
      logger.error('Error getting scan history', { error: err.message });
      res.status(500).json({ error: 'Failed to get scan history' });
    }
  }
}

module.exports = new FilesController();


import { Request, Response, NextFunction } from 'express';
import db from '../services/database.service';
import scheduler from '../services/scheduler.service';
import logger from '../config/logger';
import config from '../config';

/**
 * Controller for file listing operations
 */
class FilesController {
  /**
   * List all video files
   * @route GET /files
   */
  async listFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Listing files', { 
        extFilter: req.query.ext, 
        imdbFilter: req.query.imdb_id,
        nameFilter: req.query.name
      });
      
      // Get files directly from database
      // Priority: imdb_id > name > ext > all
      let files;
      if (req.validatedImdbId) {
        // Filter by IMDB ID in database query (most efficient, exact match)
        files = db.getFilesByImdbId(req.validatedImdbId);
        logger.debug('Files filtered by IMDB ID', { 
          imdb_id: req.validatedImdbId, 
          count: files.length 
        });
      } else if (req.validatedName) {
        // Filter by name in database query (partial match)
        files = db.searchFilesByName(req.validatedName);
        logger.debug('Files filtered by name', { 
          name: req.validatedName, 
          count: files.length 
        });
      } else if (req.validatedExt) {
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
    } catch (err: any) {
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
  async refreshCache(_req: Request, res: Response, next: NextFunction): Promise<void> {
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
    } catch (err: any) {
      if (err.message === 'Scan already in progress') {
        res.status(409).json({ 
          error: 'Scan already in progress',
          message: 'A file scan is currently running. Please wait for it to complete.'
        });
        return;
      }
      logger.error('Error during manual scan', { error: err.message });
      next(err);
    }
  }

  /**
   * Get database statistics
   * @route GET /files/stats
   */
  getStats(_req: Request, res: Response): void {
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
    } catch (err: any) {
      logger.error('Error getting stats', { error: err.message });
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  }

  /**
   * Get scan history
   * @route GET /files/scan-history
   */
  getScanHistory(req: Request, res: Response): void {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const history = db.getScanHistory(limit);
      
      res.json({ history });
    } catch (err: any) {
      logger.error('Error getting scan history', { error: err.message });
      res.status(500).json({ error: 'Failed to get scan history' });
    }
  }
}

export default new FilesController();

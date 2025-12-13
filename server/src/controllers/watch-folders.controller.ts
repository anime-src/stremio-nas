import { Request, Response, NextFunction } from 'express';
import db from '../services/database.service';
import scheduler from '../services/scheduler.service';
import logger from '../config/logger';
import { WatchFolderDTO } from '../types/watch-folder';
import cron from 'node-cron';
import { existsSync } from 'fs';

/**
 * Controller for watch folders management
 */
class WatchFoldersController {
  /**
   * List all watch folders
   * @route GET /api/watch-folders
   */
  async listWatchFolders(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folders = db.getAllWatchFolders();
      const status = scheduler.getStatus();
      
      // Add scanning status to each folder
      const foldersWithStatus = folders.map(folder => ({
        ...folder,
        isScanning: folder.id ? scheduler.isScanning(folder.id) : false,
        hasScheduledJob: folder.id ? status.jobs.some(j => j.watchFolderId === folder.id) : false
      }));

      res.json(foldersWithStatus);
    } catch (err: any) {
      logger.error('Error listing watch folders', { error: err.message });
      next(err);
    }
  }

  /**
   * Get watch folder by ID
   * @route GET /api/watch-folders/:id
   */
  async getWatchFolderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid watch folder ID' });
        return;
      }

      const folder = db.getWatchFolderById(id);
      if (!folder) {
        res.status(404).json({ error: 'Watch folder not found' });
        return;
      }

      const status = scheduler.getStatus();
      const folderWithStatus = {
        ...folder,
        isScanning: scheduler.isScanning(id),
        hasScheduledJob: status.jobs.some(j => j.watchFolderId === id)
      };

      res.json(folderWithStatus);
    } catch (err: any) {
      logger.error('Error getting watch folder', { error: err.message });
      next(err);
    }
  }

  /**
   * Create a new watch folder
   * @route POST /api/watch-folders
   */
  async createWatchFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: WatchFolderDTO = req.body;

      // Validation
      if (!data.path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      // Validate path exists
      if (!existsSync(data.path)) {
        res.status(400).json({ error: 'Path does not exist' });
        return;
      }

      // Validate cron expression
      if (data.scan_interval && !cron.validate(data.scan_interval)) {
        res.status(400).json({ error: 'Invalid cron expression' });
        return;
      }

      // Check if path already exists
      const existing = db.getWatchFolderByPath(data.path);
      if (existing) {
        res.status(409).json({ error: 'Watch folder with this path already exists' });
        return;
      }

      // Create watch folder
      const folder = db.createWatchFolder(data);

      // Add to scheduler if enabled
      if (folder.enabled) {
        scheduler.addWatchFolder(folder);
      }

      logger.info('Created watch folder', { id: folder.id, path: folder.path });
      res.status(201).json(folder);
    } catch (err: any) {
      logger.error('Error creating watch folder', { error: err.message });
      next(err);
    }
  }

  /**
   * Update a watch folder
   * @route PUT /api/watch-folders/:id
   */
  async updateWatchFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid watch folder ID' });
        return;
      }

      const data: Partial<WatchFolderDTO> = req.body;

      // Validate cron expression if provided
      if (data.scan_interval && !cron.validate(data.scan_interval)) {
        res.status(400).json({ error: 'Invalid cron expression' });
        return;
      }

      // Validate path exists if provided
      if (data.path && !existsSync(data.path)) {
        res.status(400).json({ error: 'Path does not exist' });
        return;
      }

      // Check if path already exists (if changing path)
      if (data.path) {
        const existing = db.getWatchFolderByPath(data.path);
        if (existing && existing.id !== id) {
          res.status(409).json({ error: 'Watch folder with this path already exists' });
          return;
        }
      }

      // Update watch folder
      const folder = db.updateWatchFolder(id, data);
      if (!folder) {
        res.status(404).json({ error: 'Watch folder not found' });
        return;
      }

      // Update scheduler
      scheduler.removeWatchFolder(id);
      if (folder.enabled) {
        scheduler.addWatchFolder(folder);
      }

      logger.info('Updated watch folder', { id: folder.id, path: folder.path });
      res.json(folder);
    } catch (err: any) {
      logger.error('Error updating watch folder', { error: err.message });
      next(err);
    }
  }

  /**
   * Delete a watch folder
   * @route DELETE /api/watch-folders/:id
   */
  async deleteWatchFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid watch folder ID' });
        return;
      }

      const folder = db.getWatchFolderById(id);
      if (!folder) {
        res.status(404).json({ error: 'Watch folder not found' });
        return;
      }

      // Remove from scheduler
      scheduler.removeWatchFolder(id);

      // Delete from database
      const deleted = db.deleteWatchFolder(id);
      if (!deleted) {
        res.status(500).json({ error: 'Failed to delete watch folder' });
        return;
      }

      logger.info('Deleted watch folder', { id, path: folder.path });
      res.status(204).send();
    } catch (err: any) {
      logger.error('Error deleting watch folder', { error: err.message });
      next(err);
    }
  }

  /**
   * Trigger manual scan for a watch folder
   * @route POST /api/watch-folders/:id/scan
   */
  async triggerScan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid watch folder ID' });
        return;
      }

      const folder = db.getWatchFolderById(id);
      if (!folder) {
        res.status(404).json({ error: 'Watch folder not found' });
        return;
      }

      // Check if already scanning
      if (scheduler.isScanning(id)) {
        res.status(409).json({ 
          error: 'Scan already in progress',
          message: 'A scan is currently running for this watch folder. Please wait for it to complete.'
        });
        return;
      }

      // Trigger scan
      const result = await scheduler.triggerScan(id);

      // Get updated stats
      const stats = db.getStats();

      res.json({ 
        message: 'File scan completed successfully',
        watchFolderId: id,
        fileCount: stats.totalFiles,
        filesFound: result.filesFound,
        processedCount: result.processedCount,
        skippedCount: result.skippedCount,
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
   * Get scan statistics for a watch folder
   * @route GET /api/watch-folders/:id/stats
   */
  async getWatchFolderStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid watch folder ID' });
        return;
      }

      const folder = db.getWatchFolderById(id);
      if (!folder) {
        res.status(404).json({ error: 'Watch folder not found' });
        return;
      }

      // Get scan history for this watch folder
      const allScans = db.getScanHistory(100);
      const folderScans = allScans.filter(scan => scan.watch_folder_id === id);

      res.json({
        watchFolder: folder,
        scanHistory: folderScans,
        lastScan: folderScans[0] || null,
        totalScans: folderScans.length,
        isScanning: scheduler.isScanning(id)
      });
    } catch (err: any) {
      logger.error('Error getting watch folder stats', { error: err.message });
      next(err);
    }
  }
}

export default new WatchFoldersController();

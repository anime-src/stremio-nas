import { Request, Response, NextFunction } from 'express';
import db from '../services/database.service';
import scheduler from '../services/scheduler.service';
import fileScanner from '../services/file-scanner.service';
import logger from '../config/logger';
import { WatchFolderDTO } from '../types/watch-folder';
import cron from 'node-cron';
import { existsSync } from 'fs';

/**
 * Controller for watch folders management
 */
class WatchFoldersController {
  /**
   * Sanitize watch folder response - never return password_encrypted
   * @private
   */
  private sanitizeWatchFolder(folder: any): any {
    const { password_encrypted, ...sanitized } = folder;
    return sanitized;
  }

  /**
   * Validate UNC path format
   * @private
   */
  private isValidUNCPath(path: string): boolean {
    // Windows UNC: \\server\share
    // SMB: //server/share
    return /^\\\\[^\\]+\\[^\\]+/.test(path) || /^\/\/[^\/]+\/[^\/]+/.test(path);
  }

  /**
   * Validate network watch folder data
   * @private
   */
  private validateNetworkFolder(data: WatchFolderDTO): string | null {
    if (data.type !== 'network') {
      return null; // Not a network folder, skip validation
    }

    if (!data.username || !data.password) {
      return 'Username and password are required for network paths';
    }

    if (!this.isValidUNCPath(data.path)) {
      return 'Invalid UNC path format. Expected: \\\\server\\share or //server/share';
    }

    return null;
  }
  /**
   * List all watch folders
   * @route GET /api/watch-folders
   */
  async listWatchFolders(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folders = await db.getAllWatchFolders();
      const status = scheduler.getStatus();
      
      // Add scanning status to each folder and sanitize
      const foldersWithStatus = folders.map(folder => {
        const sanitized = this.sanitizeWatchFolder(folder);
        return {
          ...sanitized,
          isScanning: folder.id ? scheduler.isScanning(folder.id) : false,
          hasScheduledJob: folder.id ? status.jobs.some(j => j.watchFolderId === folder.id) : false
        };
      });

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

      const folder = await db.getWatchFolderById(id);
      if (!folder) {
        res.status(404).json({ error: 'Watch folder not found' });
        return;
      }

      const status = scheduler.getStatus();
      const sanitized = this.sanitizeWatchFolder(folder);
      const folderWithStatus = {
        ...sanitized,
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

      // Set default type if not provided
      if (!data.type) {
        data.type = 'local';
      }

      // Validate network folder requirements
      const networkError = this.validateNetworkFolder(data);
      if (networkError) {
        res.status(400).json({ error: networkError });
        return;
      }

      // Validate path exists (only for local paths)
      if (data.type === 'local' && !existsSync(data.path)) {
        res.status(400).json({ error: 'Path does not exist' });
        return;
      }

      // Validate cron expression
      if (data.scan_interval && !cron.validate(data.scan_interval)) {
        res.status(400).json({ error: 'Invalid cron expression' });
        return;
      }

      // Check if path already exists
      const existing = await db.getWatchFolderByPath(data.path);
      if (existing) {
        res.status(409).json({ error: 'Watch folder with this path already exists' });
        return;
      }

      // Create watch folder
      const folder = await db.createWatchFolder(data);

      // Add to scheduler if enabled
      if (folder.enabled) {
        scheduler.addWatchFolder(folder);
      }

      logger.info('Created watch folder', { id: folder.id, path: folder.path, type: folder.type });
      const sanitized = this.sanitizeWatchFolder(folder);
      res.status(201).json(sanitized);
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

      // Get existing folder to check current type
      const existing = await db.getWatchFolderById(id);
      if (!existing) {
        res.status(404).json({ error: 'Watch folder not found' });
        return;
      }

      // Determine type (use existing if not changing)
      const type = data.type !== undefined ? data.type : existing.type;

      // Validate network folder requirements if type is network
      if (type === 'network') {
        const networkData: WatchFolderDTO = {
          path: data.path || existing.path, // Ensure path is always defined
          ...data,
          type: 'network',
          username: data.username !== undefined ? data.username : existing.username || undefined,
          password: data.password !== undefined ? data.password : undefined, // Password might not be in update
          domain: data.domain !== undefined ? data.domain : existing.domain || undefined
        };
        const networkError = this.validateNetworkFolder(networkData);
        if (networkError) {
          res.status(400).json({ error: networkError });
          return;
        }
      }

      // Validate cron expression if provided
      if (data.scan_interval && !cron.validate(data.scan_interval)) {
        res.status(400).json({ error: 'Invalid cron expression' });
        return;
      }

      // Validate path exists if provided (only for local paths)
      if (data.path && type === 'local' && !existsSync(data.path)) {
        res.status(400).json({ error: 'Path does not exist' });
        return;
      }

      // Validate UNC path format if changing to network type
      if (data.path && type === 'network' && !this.isValidUNCPath(data.path)) {
        res.status(400).json({ error: 'Invalid UNC path format. Expected: \\\\server\\share or //server/share' });
        return;
      }

      // Check if path already exists (if changing path)
      if (data.path) {
        const pathExisting = await db.getWatchFolderByPath(data.path);
        if (pathExisting && pathExisting.id !== id) {
          res.status(409).json({ error: 'Watch folder with this path already exists' });
          return;
        }
      }

      // Update watch folder
      const folder = await db.updateWatchFolder(id, data);
      if (!folder) {
        res.status(404).json({ error: 'Watch folder not found' });
        return;
      }

      // Update scheduler
      scheduler.removeWatchFolder(id);
      if (folder.enabled) {
        scheduler.addWatchFolder(folder);
      }

      logger.info('Updated watch folder', { id: folder.id, path: folder.path, type: folder.type });
      const sanitized = this.sanitizeWatchFolder(folder);
      res.json(sanitized);
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

      const folder = await db.getWatchFolderById(id);
      if (!folder) {
        res.status(404).json({ error: 'Watch folder not found' });
        return;
      }

      // Disconnect from storage if provider supports it (e.g., network mounts, S3 connections)
      try {
        await fileScanner.disconnectStorage(id);
      } catch (error: any) {
        logger.warn('Failed to disconnect storage during deletion', { 
          id,
          type: folder.type,
          error: error.message 
        });
        // Continue with deletion even if disconnect fails
      }

      // Remove from scheduler
      scheduler.removeWatchFolder(id);

      // Delete from database
      const deleted = await db.deleteWatchFolder(id);
      if (!deleted) {
        res.status(500).json({ error: 'Failed to delete watch folder' });
        return;
      }

      logger.info('Deleted watch folder', { id, path: folder.path, type: folder.type });
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

      const folder = await db.getWatchFolderById(id);
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
      const stats = await db.getStats();

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

      const folder = await db.getWatchFolderById(id);
      if (!folder) {
        res.status(404).json({ error: 'Watch folder not found' });
        return;
      }

      // Get scan history for this watch folder
      const allScans = await db.getScanHistory(100);
      const folderScans = allScans.filter(scan => scan.watch_folder_id === id);

      const sanitized = this.sanitizeWatchFolder(folder);
      res.json({
        watchFolder: sanitized,
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

import cron from 'node-cron';
import logger from '../config/logger';
import fileScannerService from './file-scanner.service';
import { WatchFolder } from '../types/database';

interface ScanResult {
  success: boolean;
  filesFound: number;
  processedCount: number;
  skippedCount: number;
  removedCount: number;
  duration: number;
}

interface WatchFolderJob {
  watchFolderId: number;
  watchFolder: WatchFolder;
  job: import('node-cron').ScheduledTask;
}

/**
 * Scheduler service for periodic tasks like file scanning
 * Supports multiple watch folders with individual cron schedules
 */
class SchedulerService {
  private jobs: Map<number, WatchFolderJob>;
  private scanningFolders: Set<number>; // Track which folders are currently scanning

  constructor() {
    this.jobs = new Map();
    this.scanningFolders = new Set();
  }

  /**
   * Execute scan for a specific watch folder
   * @private
   * @param watchFolderId - Watch folder ID to scan
   * @param isManual - Whether this is a manual trigger
   * @returns Scan result
   */
  private async _executeScan(watchFolderId: number, isManual: boolean = false): Promise<ScanResult | null> {
    if (this.scanningFolders.has(watchFolderId)) {
      if (isManual) {
        throw new Error(`Scan already in progress for watch folder ${watchFolderId}`);
      }
      logger.warn('Skipping scheduled scan - previous scan still running', { watchFolderId });
      return null;
    }

    this.scanningFolders.add(watchFolderId);
    const logPrefix = isManual ? 'Manual' : 'Scheduled';
    logger.info(`Starting ${logPrefix.toLowerCase()} file scan`, { watchFolderId });
    
    try {
      const result = await fileScannerService.scan(watchFolderId);
      logger.info(`${logPrefix} file scan completed`, { 
        watchFolderId,
        filesFound: result.filesFound,
        duration: `${result.duration}ms`
      });
      return result;
    } catch (error: any) {
      logger.error(`${logPrefix} file scan failed`, { 
        watchFolderId,
        error: error.message,
        stack: error.stack 
      });
      if (isManual) {
        throw error;
      }
      return null;
    } finally {
      this.scanningFolders.delete(watchFolderId);
    }
  }

  /**
   * Start scheduler for all enabled watch folders
   * @param watchFolders - Array of watch folders to schedule
   */
  start(watchFolders: WatchFolder[]): void {
    // Stop existing jobs first
    this.stop();

    // Schedule jobs for enabled watch folders
    for (const watchFolder of watchFolders) {
      if (!watchFolder.enabled) {
        continue;
      }

      // Validate cron expression
      if (!cron.validate(watchFolder.scan_interval)) {
        logger.error('Invalid scan interval cron expression', { 
          watchFolderId: watchFolder.id,
          interval: watchFolder.scan_interval 
        });
        continue;
      }

      // Create scan callback function for this watch folder
      const scanCallback = async () => {
        if (watchFolder.id) {
          return await this._executeScan(watchFolder.id, false);
        }
        return null;
      };

      // Schedule periodic file scan
      const scanJob = cron.schedule(watchFolder.scan_interval, scanCallback);

      if (watchFolder.id) {
        this.jobs.set(watchFolder.id, {
          watchFolderId: watchFolder.id,
          watchFolder,
          job: scanJob
        });
        
        // Start the job (it's scheduled but not started by default)
        scanJob.start();
        
        logger.info('Scheduled watch folder scan', { 
          watchFolderId: watchFolder.id,
          path: watchFolder.path,
          interval: watchFolder.scan_interval
        });
      }
    }
    
    logger.info('Scheduler started', { 
      totalJobs: this.jobs.size,
      watchFolders: Array.from(this.jobs.values()).map(j => ({
        id: j.watchFolderId,
        path: j.watchFolder.path,
        interval: j.watchFolder.scan_interval
      }))
    });
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    this.jobs.forEach((job, watchFolderId) => {
      job.job.stop();
      logger.info('Stopped scheduled job', { watchFolderId });
    });
    this.jobs.clear();
  }

  /**
   * Add or update a watch folder job
   */
  addWatchFolder(watchFolder: WatchFolder): void {
    if (!watchFolder.enabled || !watchFolder.id) {
      return;
    }

    // Remove existing job if present
    this.removeWatchFolder(watchFolder.id);

    // Validate cron expression
    if (!cron.validate(watchFolder.scan_interval)) {
      logger.error('Invalid scan interval cron expression', { 
        watchFolderId: watchFolder.id,
        interval: watchFolder.scan_interval 
      });
      return;
    }

    // Create scan callback function
    const scanCallback = async () => {
      return await this._executeScan(watchFolder.id!, false);
    };

    // Schedule periodic file scan
    const scanJob = cron.schedule(watchFolder.scan_interval, scanCallback);
    scanJob.start();

    this.jobs.set(watchFolder.id, {
      watchFolderId: watchFolder.id,
      watchFolder,
      job: scanJob
    });

    logger.info('Added watch folder to scheduler', { 
      watchFolderId: watchFolder.id,
      path: watchFolder.path,
      interval: watchFolder.scan_interval
    });
  }

  /**
   * Remove a watch folder job
   */
  removeWatchFolder(watchFolderId: number): void {
    const job = this.jobs.get(watchFolderId);
    if (job) {
      job.job.stop();
      this.jobs.delete(watchFolderId);
      logger.info('Removed watch folder from scheduler', { watchFolderId });
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      active: this.jobs.size > 0,
      scanningFolders: Array.from(this.scanningFolders),
      jobs: Array.from(this.jobs.values()).map(j => ({
        watchFolderId: j.watchFolderId,
        path: j.watchFolder.path,
        interval: j.watchFolder.scan_interval,
        name: j.watchFolder.name || j.watchFolder.path
      }))
    };
  }

  /**
   * Manually trigger a scan for a specific watch folder
   * @param watchFolderId - Watch folder ID to scan
   * @returns Scan result
   */
  async triggerScan(watchFolderId: number): Promise<ScanResult> {
    const result = await this._executeScan(watchFolderId, true);
    if (!result) {
      throw new Error('Scan failed');
    }
    return result;
  }

  /**
   * Check if a watch folder is currently scanning
   */
  isScanning(watchFolderId: number): boolean {
    return this.scanningFolders.has(watchFolderId);
  }
}

export default new SchedulerService();

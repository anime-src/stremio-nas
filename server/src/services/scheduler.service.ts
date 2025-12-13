import cron from 'node-cron';
import logger from '../config/logger';
import fileScannerService from './file-scanner.service';
import config from '../config';

interface ScanResult {
  success: boolean;
  filesFound: number;
  processedCount: number;
  skippedCount: number;
  removedCount: number;
  duration: number;
}

interface Job {
  name: string;
  job: import('node-cron').ScheduledTask;
}

/**
 * Scheduler service for periodic tasks like file scanning
 */
class SchedulerService {
  private jobs: Job[];
  private isScanning: boolean;
  private scanCallback: (() => Promise<ScanResult | null>) | null;

  constructor() {
    this.jobs = [];
    this.isScanning = false;
    this.scanCallback = null;
  }

  /**
   * Execute scan with proper state management and error handling
   * @private
   * @param isManual - Whether this is a manual trigger
   * @returns Scan result
   */
  private async _executeScan(isManual: boolean = false): Promise<ScanResult | null> {
    if (this.isScanning) {
      if (isManual) {
        throw new Error('Scan already in progress');
      }
      logger.warn('Skipping scheduled scan - previous scan still running');
      return null;
    }

    this.isScanning = true;
    const logPrefix = isManual ? 'Manual' : 'Scheduled';
    logger.info(`Starting ${logPrefix.toLowerCase()} file scan`);
    
    try {
      const result = await fileScannerService.scan();
      logger.info(`${logPrefix} file scan completed`, { 
        filesFound: result.filesFound,
        duration: `${result.duration}ms`
      });
      return result;
    } catch (error: any) {
      logger.error(`${logPrefix} file scan failed`, { 
        error: error.message,
        stack: error.stack 
      });
      if (isManual) {
        throw error;
      }
      return null;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    // Validate cron expression
    if (!cron.validate(config.scanner.interval)) {
      logger.error('Invalid scan interval cron expression', { 
        interval: config.scanner.interval 
      });
      return;
    }

    // Create scan callback function
    this.scanCallback = async () => {
      return await this._executeScan(false);
    };

    // Schedule periodic file scan
    const scanJob = cron.schedule(config.scanner.interval, this.scanCallback!);

    this.jobs.push({ name: 'file-scan', job: scanJob });
    
    // Start the job (it's scheduled but not started by default)
    scanJob.start();
    
    logger.info('Scheduler started', { 
      scanInterval: config.scanner.interval,
      nextScan: this.getNextScanTime(),
      jobs: this.jobs.length 
    });
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info('Stopped scheduled job', { name });
    });
    this.jobs = [];
  }

  /**
   * Get next scheduled scan time
   */
  getNextScanTime(): string {
    if (this.jobs.length > 0) {
      // node-cron doesn't provide next run time, so we return the interval
      return `Next scan in: ${config.scanner.interval}`;
    }
    return 'No scheduled scans';
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      active: this.jobs.length > 0,
      isScanning: this.isScanning,
      interval: config.scanner.interval,
      jobs: this.jobs.map(j => j.name)
    };
  }

  /**
   * Manually trigger a scan (uses the same callback as scheduled scans)
   * @returns Scan result
   */
  async triggerScan(): Promise<ScanResult> {
    // Use the same execution logic as scheduled scans
    const result = await this._executeScan(true);
    if (!result) {
      throw new Error('Scan failed');
    }
    return result;
  }
}

export default new SchedulerService();

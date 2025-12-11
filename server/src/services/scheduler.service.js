const cron = require('node-cron');
const logger = require('../config/logger');
const fileScannerService = require('./fileScanner.service');
const config = require('../config');

/**
 * Scheduler service for periodic tasks like file scanning
 */
class SchedulerService {
  constructor() {
    this.jobs = [];
    this.isScanning = false;
    this.scanCallback = null; // Store the scan callback function
  }

  /**
   * Execute scan with proper state management and error handling
   * @private
   * @param {boolean} isManual - Whether this is a manual trigger
   * @returns {Promise<Object>} Scan result
   */
  async _executeScan(isManual = false) {
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
    } catch (error) {
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
  start() {
    // Validate cron expression
    if (!cron.validate(config.scanner.interval)) {
      logger.error('Invalid scan interval cron expression', { 
        interval: config.scanner.interval 
      });
      return;
    }

    // Create scan callback function
    this.scanCallback = async () => {
      await this._executeScan(false);
    };

    // Schedule periodic file scan
    const scanJob = cron.schedule(config.scanner.interval, this.scanCallback, {
      scheduled: false // Don't start immediately
    });

    this.jobs.push({ name: 'file-scan', job: scanJob });
    
    // Start the job
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
  stop() {
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info('Stopped scheduled job', { name });
    });
    this.jobs = [];
  }

  /**
   * Get next scheduled scan time
   */
  getNextScanTime() {
    if (this.jobs.length > 0) {
      const job = this.jobs[0].job;
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
   * @returns {Promise<Object>} Scan result
   */
  async triggerScan() {
    // Use the same execution logic as scheduled scans
    return await this._executeScan(true);
  }
}

module.exports = new SchedulerService();


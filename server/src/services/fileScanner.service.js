const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../config/logger');
const imdbService = require('./imdb.service');
const db = require('./database.service');

/**
 * File scanner service with database persistence
 */
class FileScannerService {
  /**
   * Scan filesystem and sync with database
   * This is the main method that should be called for scanning
   * @returns {Promise<Object>} Scan results
   */
  async scan() {
    logger.info('Starting filesystem scan', { mediaDir: config.mediaDir });
    const startTime = Date.now();
    
    try {
      // Step 1: Scan filesystem (only file discovery)
      const rawFiles = await this._scanDirectory(config.mediaDir);
      
      // Extract all paths from raw files (for cleanup)
      const allPaths = rawFiles.map(f => f.path);
      
      // Step 2: Process files (DB checks, IMDB lookups, filtering)
      const processResult = await this._processFiles(rawFiles);
      
      // Step 3: Update database with files that need changes
      if (processResult.filesToUpdate.length > 0) {
        db.upsertFilesBatch(processResult.filesToUpdate);
      }
      
      // Step 4: Cleanup - remove files that no longer exist on filesystem
      const removedCount = db.removeFilesNotInList(allPaths);
      
      if (removedCount > 0) {
        logger.info('Removed deleted files from database', { count: removedCount });
      }
      
      const duration = Date.now() - startTime;
      
      // Record scan to history
      db.recordScan({
        filesFound: allPaths.length,
        duration,
        errors: 0,
        processedCount: processResult.processedCount || 0,
        skippedCount: processResult.skippedCount || 0
      });
      
      logger.info('Filesystem scan completed and synced to database', { 
        fileCount: allPaths.length,
        processedCount: processResult.processedCount || 0,
        skippedCount: processResult.skippedCount || 0,
        removedCount,
        duration: `${duration}ms` 
      });
      
      return {
        success: true,
        filesFound: allPaths.length,
        processedCount: processResult.processedCount || 0,
        skippedCount: processResult.skippedCount || 0,
        removedCount,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Filesystem scan failed', {
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`
      });
      
      // Record failed scan
      db.recordScan({
        filesFound: 0,
        duration,
        errors: 1
      });
      
      throw error;
    }
  }

  /**
   * Recursively scan directory - ONLY filesystem discovery
   * Returns raw file stats without any processing
   * @private
   */
  async _scanDirectory(dirPath, basePath = '') {
    const rawFiles = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.join(basePath, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const result = await this._scanDirectory(fullPath, relativePath);
          rawFiles.push(...result);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          // Only check extension - no other processing
          if (config.allowedExtensions.includes(ext)) {
            try {
              const stats = await fs.stat(fullPath);
              
              // Skip incomplete/downloading files
              if (this._shouldSkipFile(entry.name, stats)) {
                continue;
              }
              
              // Return raw file data only
              rawFiles.push({
                name: entry.name,
                path: relativePath,
                fullPath: fullPath,
                size: stats.size,
                mtime: stats.mtime.getTime(),
                ext: ext
              });
            } catch (err) {
              logger.warn('Error reading file', { path: fullPath, error: err.message });
            }
          }
        }
      }
    } catch (err) {
      logger.error('Error scanning directory', { directory: dirPath, error: err.message });
    }
    
    return rawFiles;
  }

  /**
   * Process raw file data: check DB, IMDB lookups, build file info
   * Returns only files that need database updates
   * @private
   */
  async _processFiles(rawFiles) {
    const filesToUpdate = []; // Only files that need DB updates
    let processedCount = 0;
    let skippedCount = 0;
    
    for (const rawFile of rawFiles) {
      // Check if file exists in database
      const existingFile = db.getFileByPath(rawFile.path);
      
      // Check if file is unchanged
      if (existingFile && 
          existingFile.size === rawFile.size && 
          existingFile.mtime && 
          existingFile.mtime > 0 && 
          existingFile.mtime === rawFile.mtime) {
        // File unchanged - skip DB update
        skippedCount++;
        logger.debug('File unchanged, skipping DB update', { 
          name: rawFile.name, 
          path: rawFile.path 
        });
        continue; // Don't add to filesToUpdate
      }
      
      // File is new or changed - process it
      processedCount++;
      const imdbInfo = await imdbService.processFile(
        rawFile.fullPath, 
        rawFile.name, 
        rawFile.size
      );
      
      if (imdbInfo.imdb_id) {
        // Build file info object (id will be set by database auto-increment)
        const fileInfo = {
          name: rawFile.name,
          path: rawFile.path,
          size: rawFile.size,
          mtime: rawFile.mtime,
          parsedName: imdbInfo.parsedName,
          type: imdbInfo.type, // movie or series
          imdb_id: imdbInfo.imdb_id,
          season: imdbInfo.season,
          episode: imdbInfo.episode,
          resolution: imdbInfo.resolution || null,
          source: imdbInfo.source || null,
          videoCodec: imdbInfo.videoCodec || null,
          audioCodec: imdbInfo.audioCodec || null,
          audioChannels: imdbInfo.audioChannels || null,
          languages: imdbInfo.languages || null,
          releaseGroup: imdbInfo.releaseGroup || null,
          flags: imdbInfo.flags || null,
          edition: imdbInfo.edition || null,
          imdbName: imdbInfo.imdbName || null,
          imdbYear: imdbInfo.imdbYear || null,
          imdbType: imdbInfo.imdbType || null,
          yearRange: imdbInfo.yearRange || null,
          image: imdbInfo.image || null,
          starring: imdbInfo.starring || null,
          similarity: imdbInfo.similarity || null
        };
        
        filesToUpdate.push(fileInfo);
        logger.debug('File processed', { 
          name: rawFile.name, 
          path: rawFile.path,
          imdb_id: imdbInfo.imdb_id
        });
      } else {
        logger.debug('Skipping video file without IMDB ID', { name: rawFile.name });
      }
    }
    
    return {
      filesToUpdate,
      processedCount,
      skippedCount
    };
  }
  
  /**
   * Check if file should be skipped (incomplete/downloading)
   * @private
   */
  _shouldSkipFile(fileName, stats) {
    const tempExtensions = config.scanner.temporaryExtensions;
    if (tempExtensions.some(ext => fileName.toLowerCase().endsWith(ext))) {
      logger.debug('Skipping temporary file', { fileName });
      return true;
    }

    const minSizeMB = config.scanner.minVideoSizeMB;
    const sizeMB = stats.size / 1024 / 1024;
    
    if (sizeMB < minSizeMB) {
      logger.debug('Skipping small file', { 
        fileName, 
        sizeMB: sizeMB.toFixed(2),
        minRequired: minSizeMB 
      });
      return true;
    }

    return false;
  }

}

module.exports = new FileScannerService();


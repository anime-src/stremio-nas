import { promises as fs } from 'fs';
import path from 'path';
import config from '../config';
import logger from '../config/logger';
import imdbService from './imdb.service';
import db from './database.service';
import { FileRecord } from '../types/database';
import { WatchFolder } from '../types/watch-folder';

interface RawFile {
  name: string;
  path: string;
  fullPath: string;
  size: number;
  mtime: number;
  ext: string;
}

interface ProcessResult {
  filesToUpdate: FileRecord[];
  processedCount: number;
  skippedCount: number;
}

interface ScanResult {
  success: boolean;
  filesFound: number;
  processedCount: number;
  skippedCount: number;
  removedCount: number;
  duration: number;
}

/**
 * File scanner service with database persistence
 */
class FileScannerService {
  /**
   * Scan filesystem and sync with database
   * @param watchFolderId - Optional watch folder ID to scan. If not provided, uses default config.
   * @returns Scan results
   */
  async scan(watchFolderId?: number): Promise<ScanResult> {
    // Get watch folder configuration
    let watchFolder: WatchFolder | null = null;
    let folderPath: string;
    let allowedExtensions: string[];
    let minVideoSizeMB: number;
    let temporaryExtensions: string[];

    if (watchFolderId) {
      watchFolder = db.getWatchFolderById(watchFolderId);
      if (!watchFolder) {
        throw new Error(`Watch folder with ID ${watchFolderId} not found`);
      }
      folderPath = watchFolder.path;
      allowedExtensions = watchFolder.allowed_extensions;
      minVideoSizeMB = watchFolder.min_video_size_mb;
      temporaryExtensions = watchFolder.temporary_extensions;
    } else {
      // Fallback to config for backward compatibility
      folderPath = config.mediaDir;
      allowedExtensions = config.allowedExtensions;
      minVideoSizeMB = config.scanner.minVideoSizeMB;
      temporaryExtensions = config.scanner.temporaryExtensions;
    }

    logger.info('Starting filesystem scan', { 
      watchFolderId: watchFolder?.id,
      path: folderPath 
    });
    const startTime = Date.now();
    
    try {
      // Step 1: Scan filesystem (only file discovery)
      const rawFiles = await this._scanDirectory(folderPath, '', allowedExtensions, minVideoSizeMB, temporaryExtensions);
      
      // Extract all paths from raw files (for cleanup)
      const allPaths = rawFiles.map(f => f.path);
      
      // Step 2: Process files (DB checks, IMDB lookups, filtering)
      const processResult = await this._processFiles(rawFiles, watchFolder?.id);
      
      // Step 3: Update database with files that need changes
      if (processResult.filesToUpdate.length > 0) {
        db.upsertFilesBatch(processResult.filesToUpdate);
      }
      
      // Step 4: Cleanup - remove files that no longer exist on filesystem for this watch folder
      const removedCount = db.removeFilesNotInList(allPaths, watchFolder?.id);
      
      if (removedCount > 0) {
        logger.info('Removed deleted files from database', { count: removedCount });
      }
      
      const duration = Date.now() - startTime;
      
      // Record scan to history with watch folder ID
      db.recordScan({
        filesFound: allPaths.length,
        duration,
        errors: 0,
        processedCount: processResult.processedCount || 0,
        skippedCount: processResult.skippedCount || 0,
        watchFolderId: watchFolder?.id
      });
      
      logger.info('Filesystem scan completed and synced to database', { 
        watchFolderId: watchFolder?.id,
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
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logger.error('Filesystem scan failed', {
        watchFolderId: watchFolder?.id,
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`
      });
      
      // Record failed scan
      db.recordScan({
        filesFound: 0,
        duration,
        errors: 1,
        watchFolderId: watchFolder?.id
      });
      
      throw error;
    }
  }

  /**
   * Recursively scan directory - ONLY filesystem discovery
   * Returns raw file stats without any processing
   * @private
   */
  private async _scanDirectory(
    dirPath: string, 
    basePath: string = '', 
    allowedExtensions: string[],
    minVideoSizeMB: number,
    temporaryExtensions: string[]
  ): Promise<RawFile[]> {
    const rawFiles: RawFile[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.join(basePath, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const result = await this._scanDirectory(fullPath, relativePath, allowedExtensions, minVideoSizeMB, temporaryExtensions);
          rawFiles.push(...result);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          // Only check extension - no other processing
          if (allowedExtensions.includes(ext)) {
            try {
              const stats = await fs.stat(fullPath);
              
              // Skip incomplete/downloading files
              if (this._shouldSkipFile(entry.name, stats, minVideoSizeMB, temporaryExtensions)) {
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
            } catch (err: any) {
              logger.warn('Error reading file', { path: fullPath, error: err.message });
            }
          }
        }
      }
    } catch (err: any) {
      logger.error('Error scanning directory', { directory: dirPath, error: err.message });
    }
    
    return rawFiles;
  }

  /**
   * Process raw file data: check DB, IMDB lookups, build file info
   * Returns only files that need database updates
   * @private
   */
  private async _processFiles(rawFiles: RawFile[], watchFolderId?: number): Promise<ProcessResult> {
    const filesToUpdate: FileRecord[] = []; // Only files that need DB updates
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
        const fileInfo: FileRecord = {
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
          similarity: imdbInfo.similarity || null,
          watch_folder_id: watchFolderId || null
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
  private _shouldSkipFile(
    fileName: string, 
    stats: import('fs').Stats,
    minVideoSizeMB: number,
    temporaryExtensions: string[]
  ): boolean {
    if (temporaryExtensions.some(ext => fileName.toLowerCase().endsWith(ext))) {
      logger.debug('Skipping temporary file', { fileName });
      return true;
    }

    const sizeMB = stats.size / 1024 / 1024;
    
    if (sizeMB < minVideoSizeMB) {
      logger.debug('Skipping small file', { 
        fileName, 
        sizeMB: sizeMB.toFixed(2),
        minRequired: minVideoSizeMB 
      });
      return true;
    }

    return false;
  }
}

export default new FileScannerService();

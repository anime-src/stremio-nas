import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../config/logger';
import imdbService from './imdb.service';
import db from './database.service';
import { FileRecord } from '../types/database';
import { WatchFolder } from '../types/watch-folder';

const execAsync = promisify(exec);

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
  // Track mounted network paths: watchFolderId -> mountPoint
  private mountedPaths: Map<number, string> = new Map();
  /**
   * Scan filesystem and sync with database
   * @param watchFolderId - Watch folder ID to scan (required)
   * @returns Scan results
   */
  async scan(watchFolderId: number): Promise<ScanResult> {
    // Get watch folder configuration
    const watchFolder = db.getWatchFolderById(watchFolderId);
    if (!watchFolder) {
      throw new Error(`Watch folder with ID ${watchFolderId} not found`);
    }

    let folderPath = watchFolder.path;
    const allowedExtensions = watchFolder.allowed_extensions;
    const minVideoSizeMB = watchFolder.min_video_size_mb;
    const temporaryExtensions = watchFolder.temporary_extensions;

    logger.info('Starting filesystem scan', { 
      watchFolderId: watchFolder.id,
      path: folderPath,
      type: watchFolder.type || 'local'
    });
    const startTime = Date.now();
    
    let mountPoint: string | null = null;
    let shouldUnmount = false;
    
    try {
      // For network paths, mount before scanning
      if (watchFolder.type === 'network') {
        mountPoint = await this._mountNetworkPath(watchFolder);
        if (mountPoint) {
          folderPath = mountPoint; // Use mounted path for scanning
          shouldUnmount = true;
        } else {
          throw new Error('Failed to mount network path');
        }
      }

      // Step 1: Scan filesystem (only file discovery)
      const rawFiles = await this._scanDirectory(folderPath, '', allowedExtensions, minVideoSizeMB, temporaryExtensions);
      
      // Extract all paths from raw files (for cleanup)
      const allPaths = rawFiles.map(f => f.path);
      
      // Step 2: Process files (DB checks, IMDB lookups, filtering)
      const processResult = await this._processFiles(rawFiles, watchFolderId);
      
      // Step 3: Update database with files that need changes
      if (processResult.filesToUpdate.length > 0) {
        db.upsertFilesBatch(processResult.filesToUpdate);
      }
      
      // Step 4: Cleanup - remove files that no longer exist on filesystem for this watch folder
      const removedCount = db.removeFilesNotInList(allPaths, watchFolderId);
      
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
        watchFolderId: watchFolderId
      });
      
      logger.info('Filesystem scan completed and synced to database', { 
        watchFolderId: watchFolderId,
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
        watchFolderId: watchFolderId,
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`
      });
      
      // Record failed scan
      db.recordScan({
        filesFound: 0,
        duration,
        errors: 1,
        watchFolderId: watchFolderId
      });
      
      throw error;
    } finally {
      // Unmount network path if we mounted it for this scan
      // Note: We keep mounts active for scheduled scans, only unmount on manual scans or errors
      // For now, we'll keep mounts active to avoid remounting on every scheduled scan
      // Unmount will happen when watch folder is deleted or disabled
      if (shouldUnmount && mountPoint) {
        // Only unmount if this was a one-time scan (not scheduled)
        // For scheduled scans, keep the mount active
        logger.debug('Keeping network mount active for scheduled scans', { 
          watchFolderId: watchFolderId,
          mountPoint 
        });
      }
    }
  }

  /**
   * Mount network path using CIFS
   * @private
   */
  private async _mountNetworkPath(watchFolder: WatchFolder): Promise<string | null> {
    if (!watchFolder.id) {
      throw new Error('Watch folder ID is required for network mounting');
    }

    // Check if already mounted
    if (this.mountedPaths.has(watchFolder.id)) {
      const existingMount = this.mountedPaths.get(watchFolder.id)!;
      logger.debug('Network path already mounted', { 
        watchFolderId: watchFolder.id,
        mountPoint: existingMount 
      });
      return existingMount;
    }

    // Get decrypted password
    const password = db.getDecryptedPassword(watchFolder.id);
    if (!password) {
      throw new Error('Password not available for network path');
    }

    // Convert Windows UNC path to SMB path format
    // \\server\share -> //server/share
    let smbPath = watchFolder.path.replace(/\\/g, '/');
    if (!smbPath.startsWith('//')) {
      smbPath = '//' + smbPath.replace(/^\/+/, '');
    }

    // Mount point: /mnt/network/{watchFolderId}
    const mountPoint = `/mnt/network/${watchFolder.id}`;

    try {
      // Create mount point directory
      await fs.mkdir(mountPoint, { recursive: true });

      // Build mount options
      const mountOptions: string[] = [];
      mountOptions.push(`username=${watchFolder.username || ''}`);
      mountOptions.push(`password=${password}`);
      if (watchFolder.domain) {
        mountOptions.push(`domain=${watchFolder.domain}`);
      }
      // Note: Mounting requires root privileges
      // If running as non-root, container needs CAP_SYS_ADMIN or run as root
      // For node user (uid=1000), we still set ownership
      mountOptions.push('uid=1000'); // node user
      mountOptions.push('gid=1000'); // node group
      mountOptions.push('file_mode=0644');
      mountOptions.push('dir_mode=0755');
      mountOptions.push('iocharset=utf8');
      mountOptions.push('noperm'); // Don't check permissions on mount

      const mountCmd = `mount -t cifs "${smbPath}" "${mountPoint}" -o ${mountOptions.join(',')}`;
      
      logger.info('Mounting network path', { 
        watchFolderId: watchFolder.id,
        smbPath,
        mountPoint 
      });

      try {
        await execAsync(mountCmd);
        this.mountedPaths.set(watchFolder.id, mountPoint);
        logger.info('Network path mounted successfully', { 
          watchFolderId: watchFolder.id,
          mountPoint 
        });
        return mountPoint;
      } catch (mountError: any) {
        logger.error('Failed to mount network path', { 
          watchFolderId: watchFolder.id,
          error: mountError.message,
          stderr: mountError.stderr 
        });
        // Clean up mount point directory if mount failed
        try {
          await fs.rmdir(mountPoint);
        } catch (rmError) {
          // Ignore cleanup errors
        }
        return null;
      }
    } catch (error: any) {
      logger.error('Error preparing network mount', { 
        watchFolderId: watchFolder.id,
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Unmount network path
   * @param watchFolderId - Watch folder ID
   */
  async unmountNetworkPath(watchFolderId: number): Promise<void> {
    const mountPoint = this.mountedPaths.get(watchFolderId);
    if (!mountPoint) {
      logger.debug('Network path not mounted', { watchFolderId });
      return;
    }

    try {
      logger.info('Unmounting network path', { watchFolderId, mountPoint });
      await execAsync(`umount "${mountPoint}"`);
      this.mountedPaths.delete(watchFolderId);
      
      // Remove mount point directory
      try {
        await fs.rmdir(mountPoint);
      } catch (rmError) {
        // Ignore cleanup errors
      }
      
      logger.info('Network path unmounted successfully', { watchFolderId });
    } catch (error: any) {
      logger.error('Failed to unmount network path', { 
        watchFolderId,
        mountPoint,
        error: error.message,
        stderr: error.stderr 
      });
      // Still remove from map even if unmount failed
      this.mountedPaths.delete(watchFolderId);
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
  private async _processFiles(rawFiles: RawFile[], watchFolderId: number): Promise<ProcessResult> {
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
          watch_folder_id: watchFolderId
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

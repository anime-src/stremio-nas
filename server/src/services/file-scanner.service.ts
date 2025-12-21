import logger from '../config/logger';
import imdbService from './imdb.service';
import db from './database.service';
import { FileRecord } from '../types/database';
import { createStorageProvider } from './file-scanner/factory';
import { RawFile } from './file-scanner/interface';

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
 * Orchestrates storage providers and processes files
 */
class FileScannerService {
  /**
   * Scan filesystem and sync with database
   * @param watchFolderId - Watch folder ID to scan (required)
   * @returns Scan results
   */
  async scan(watchFolderId: number): Promise<ScanResult> {
    // Get watch folder configuration
    const watchFolder = await db.getWatchFolderById(watchFolderId);
    if (!watchFolder) {
      throw new Error(`Watch folder with ID ${watchFolderId} not found`);
    }

    const allowedExtensions = watchFolder.allowed_extensions;
    const minVideoSizeMB = watchFolder.min_video_size_mb;
    const temporaryExtensions = watchFolder.temporary_extensions;

    logger.info('Starting filesystem scan', {
      watchFolderId: watchFolder.id,
      path: watchFolder.path,
      type: watchFolder.type || 'local'
    });
    const startTime = Date.now();

    // Get storage provider for this watch folder type
    const provider = createStorageProvider(watchFolder);

    try {
      // Connect to storage if provider supports it (e.g., network mounts)
      if (provider.connect) {
        await provider.connect(watchFolder);
      }

      // Step 1: Scan storage (only file discovery)
      const rawFiles = await provider.scan(watchFolder, {
        allowedExtensions,
        minVideoSizeMB,
        temporaryExtensions,
        basePath: '' // Start with empty base path for relative paths
      });

      // Extract all paths from raw files (for cleanup)
      const allPaths = rawFiles.map(f => f.path);

      // Step 2: Process files (DB checks, IMDB lookups, filtering)
      const processResult = await this._processFiles(rawFiles, watchFolderId);

      // Step 3: Update database with files that need changes
      if (processResult.filesToUpdate.length > 0) {
        await db.upsertFilesBatch(processResult.filesToUpdate);
      }

      // Step 4: Cleanup - remove files that no longer exist on storage for this watch folder
      const removedCount = await db.removeFilesNotInList(allPaths, watchFolderId);

      if (removedCount > 0) {
        logger.info('Removed deleted files from database', { count: removedCount });
      }

      const duration = Date.now() - startTime;

      // Record scan to history with watch folder ID
      await db.recordScan({
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
      await db.recordScan({
        filesFound: 0,
        duration,
        errors: 1,
        watchFolderId: watchFolderId
      });

      throw error;
    } finally {
      // Disconnect from storage if provider supports it
      // Note: For network providers, we typically keep mounts active for scheduled scans
      // This cleanup is mainly for error cases or manual scans
      if (provider.disconnect && watchFolder.id) {
        // Only disconnect on error or manual scans, not scheduled scans
        // For now, we'll keep connections active (provider handles this internally)
        logger.debug('Keeping storage connection active for scheduled scans', {
          watchFolderId: watchFolder.id,
          type: provider.getSupportedType()
        });
      }
    }
  }

  /**
   * Disconnect from storage (for providers that support it)
   * Generic method that works for any storage type (network, S3, etc.)
   * @param watchFolderId - Watch folder ID
   */
  async disconnectStorage(watchFolderId: number): Promise<void> {
    const watchFolder = await db.getWatchFolderById(watchFolderId);
    if (!watchFolder) {
      throw new Error(`Watch folder with ID ${watchFolderId} not found`);
    }

    // Get storage provider for this watch folder type
    const provider = createStorageProvider(watchFolder);

    // Call disconnect if provider supports it
    if (provider.disconnect) {
      await provider.disconnect(watchFolderId);
      logger.info('Storage disconnected', {
        watchFolderId,
        type: provider.getSupportedType()
      });
    } else {
      logger.debug('Disconnect not supported for this storage type', {
        watchFolderId,
        type: provider.getSupportedType()
      });
    }
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
      const existingFile = await db.getFileByPath(rawFile.path);

      // Check if file is unchanged
      if (
        existingFile &&
        existingFile.size === rawFile.size &&
        existingFile.mtime &&
        existingFile.mtime > 0 &&
        existingFile.mtime === rawFile.mtime
      ) {
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
      const imdbInfo = await imdbService.processFile(rawFile.fullPath, rawFile.name, rawFile.size);

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
}

export default new FileScannerService();

import { promises as fs } from 'fs';
import path from 'path';
import logger from '../../../config/logger';
import { IStorageProvider, RawFile, ScanOptions } from '../interface';
import { WatchFolder } from '../../../types/database';

/**
 * Local filesystem storage provider
 * Scans local directories using Node.js fs module
 */
export class LocalStorageProvider implements IStorageProvider {
  getSupportedType(): string {
    return 'local';
  }

  /**
   * Connect is not needed for local filesystem (always available)
   */
  async connect(_watchFolder: WatchFolder): Promise<void> {
    // No-op for local filesystem
  }

  /**
   * Disconnect is not needed for local filesystem
   */
  async disconnect(_watchFolderId: number): Promise<void> {
    // No-op for local filesystem
  }

  /**
   * Scan local filesystem directory recursively
   */
  async scan(watchFolder: WatchFolder, options: ScanOptions): Promise<RawFile[]> {
    const dirPath = watchFolder.path;
    const basePath = options.basePath || '';
    
    return this._scanDirectory(
      dirPath,
      basePath,
      options.allowedExtensions,
      options.minVideoSizeMB,
      options.temporaryExtensions
    );
  }

  /**
   * Recursively scan directory - ONLY filesystem discovery
   * Returns raw file stats without any processing
   * @private
   */
  private async _scanDirectory(
    dirPath: string,
    basePath: string,
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
          const result = await this._scanDirectory(
            fullPath,
            relativePath,
            allowedExtensions,
            minVideoSizeMB,
            temporaryExtensions
          );
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

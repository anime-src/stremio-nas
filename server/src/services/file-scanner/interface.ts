import { WatchFolder } from '../../types/database';

/**
 * Raw file data structure returned by storage providers
 */
export interface RawFile {
  name: string;
  path: string;
  fullPath: string;
  size: number;
  mtime: number;
  ext: string;
}

/**
 * Options for scanning storage
 */
export interface ScanOptions {
  allowedExtensions: string[];
  minVideoSizeMB: number;
  temporaryExtensions: string[];
  basePath?: string; // For relative path calculation
}

/**
 * Storage provider interface
 * Defines the contract for all storage providers (local, network, S3, etc.)
 */
export interface IStorageProvider {
  /**
   * Scan storage and return raw file data
   * @param watchFolder - Watch folder configuration
   * @param options - Scanning options (extensions, size limits, etc.)
   * @returns Array of raw file data
   */
  scan(watchFolder: WatchFolder, options: ScanOptions): Promise<RawFile[]>;

  /**
   * Connect to storage (optional, for network/S3 providers)
   * Called before scanning to establish connection
   * @param watchFolder - Watch folder configuration
   */
  connect?(watchFolder: WatchFolder): Promise<void>;

  /**
   * Disconnect from storage (optional, for network/S3 providers)
   * Called after scanning to cleanup connections
   * @param watchFolderId - Watch folder ID
   */
  disconnect?(watchFolderId: number): Promise<void>;

  /**
   * Get the storage type this provider supports
   * @returns Storage type string ('local', 'network', 's3', etc.)
   */
  getSupportedType(): string;
}

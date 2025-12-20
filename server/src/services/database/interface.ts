import { FileRecord, DatabaseStats, ScanRecord } from '../../types/database';
import { WatchFolder, WatchFolderDTO } from '../../types/watch-folder';

/**
 * Database service interface
 * Defines the contract for all database implementations
 */
export interface IDatabaseService {
  // File operations
  upsertFile(fileData: FileRecord): any;
  upsertFilesBatch(files: FileRecord[]): void;
  getAllFiles(): FileRecord[];
  getFileById(fileId: number): FileRecord | null;
  getFileByPath(filePath: string): FileRecord | null;
  getFilesByImdb(imdbId: string): FileRecord[];
  getFilesByImdbId(imdbId: string): FileRecord[];
  searchFiles(query: string): FileRecord[];
  searchFilesByName(namePattern: string): FileRecord[];
  filterByExtension(ext: string): FileRecord[];
  removeFile(filePath: string): boolean;
  removeFilesNotInList(paths: string[], watchFolderId?: number): number;
  clearFiles(): any;

  // Scan operations
  recordScan(stats: {
    filesFound: number;
    duration: number;
    errors?: number;
    processedCount?: number;
    skippedCount?: number;
    watchFolderId?: number;
  }): any;
  getScanHistory(limit?: number): ScanRecord[];

  // Statistics
  getStats(): DatabaseStats;

  // Watch folder operations
  getAllWatchFolders(): WatchFolder[];
  getEnabledWatchFolders(): WatchFolder[];
  getWatchFolderById(id: number): WatchFolder | null;
  getWatchFolderByPath(folderPath: string): WatchFolder | null;
  createWatchFolder(data: WatchFolderDTO): WatchFolder;
  updateWatchFolder(id: number, data: Partial<WatchFolderDTO>): WatchFolder | null;
  deleteWatchFolder(id: number): boolean;
  getDecryptedPassword(watchFolderId: number): string | null;

  // Server settings operations
  getAllSettings(): Record<string, string>;
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
  setSettings(settings: Record<string, string>): void;
  deleteSetting(key: string): boolean;

  // Connection management
  close(): void;
}

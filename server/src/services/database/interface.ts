import { FileRecord, DatabaseStats, ScanRecord } from '../../types/database';
import { WatchFolder, WatchFolderDTO } from '../../types/watch-folder';

/**
 * Database service interface
 * Defines the contract for all database providers
 * All methods are async to work properly with TypeORM
 */
export interface IDatabaseService {
  // File operations
  upsertFile(fileData: FileRecord): Promise<any>;
  upsertFilesBatch(files: FileRecord[]): Promise<void>;
  getAllFiles(): Promise<FileRecord[]>;
  getFileById(fileId: number): Promise<FileRecord | null>;
  getFileByPath(filePath: string): Promise<FileRecord | null>;
  getFilesByImdb(imdbId: string): Promise<FileRecord[]>;
  getFilesByImdbId(imdbId: string): Promise<FileRecord[]>;
  searchFiles(query: string): Promise<FileRecord[]>;
  searchFilesByName(namePattern: string): Promise<FileRecord[]>;
  filterByExtension(ext: string): Promise<FileRecord[]>;
  removeFile(filePath: string): Promise<boolean>;
  removeFilesNotInList(paths: string[], watchFolderId?: number): Promise<number>;
  clearFiles(): Promise<any>;

  // Scan operations
  recordScan(stats: {
    filesFound: number;
    duration: number;
    errors?: number;
    processedCount?: number;
    skippedCount?: number;
    watchFolderId?: number;
  }): Promise<any>;
  getScanHistory(limit?: number): Promise<ScanRecord[]>;

  // Statistics
  getStats(): Promise<DatabaseStats>;

  // Watch folder operations
  getAllWatchFolders(): Promise<WatchFolder[]>;
  getEnabledWatchFolders(): Promise<WatchFolder[]>;
  getWatchFolderById(id: number): Promise<WatchFolder | null>;
  getWatchFolderByPath(folderPath: string): Promise<WatchFolder | null>;
  createWatchFolder(data: WatchFolderDTO): Promise<WatchFolder>;
  updateWatchFolder(id: number, data: Partial<WatchFolderDTO>): Promise<WatchFolder | null>;
  deleteWatchFolder(id: number): Promise<boolean>;
  getDecryptedPassword(watchFolderId: number): Promise<string | null>;

  // Server settings operations
  getAllSettings(): Promise<Record<string, string>>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  setSettings(settings: Record<string, string>): Promise<void>;
  deleteSetting(key: string): Promise<boolean>;

  // Connection management
  close(): Promise<void>;
}

import Database from 'better-sqlite3';

/**
 * Database file record interface
 */
export interface FileRecord {
  id?: number;
  name: string;
  path: string;
  size: number;
  mtime: number;
  parsedName?: string | null;
  type?: string | null;
  imdb_id?: string | null;
  season?: number | null;
  episode?: number | null;
  resolution?: string | null;
  source?: string | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  audioChannels?: string | null;
  languages?: string | string[] | null;
  releaseGroup?: string | null;
  flags?: string | string[] | null;
  edition?: string | null;
  imdbName?: string | null;
  imdbYear?: number | null;
  imdbType?: string | null;
  yearRange?: string | null;
  image?: string | object | null;
  starring?: string | null;
  similarity?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Database statistics interface
 */
export interface DatabaseStats {
  totalFiles: number;
  uniqueImdb: number;
  totalSize: number;
  byType: Record<string, number>;
  lastScan: ScanRecord | null;
}

/**
 * Scan record interface
 */
export interface ScanRecord {
  id: number;
  timestamp: string;
  filesFound: number;
  duration: number;
  errors: number;
  processedCount: number;
  skippedCount: number;
}

/**
 * Prepared statements interface
 */
export interface PreparedStatements {
  insertFile: Database.Statement<FileRecord>;
  getAllFiles: Database.Statement<[]>;
  getFileById: Database.Statement<[number]>;
  getFileByPath: Database.Statement<[string]>;
  getFilesByImdb: Database.Statement<[string]>;
  deleteFile: Database.Statement<[string]>;
  clearFiles: Database.Statement<[]>;
  searchFiles: Database.Statement<[string, string]>;
  filterByExtension: Database.Statement<[string]>;
  insertScan: Database.Statement<[number, number, number, number, number]>;
  getScanHistory: Database.Statement<[number]>;
  getStats: Database.Statement<[]>;
  getTypeStats: Database.Statement<[]>;
}

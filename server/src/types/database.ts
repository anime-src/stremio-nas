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
  watch_folder_id?: number | null;
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
  watch_folder_id?: number | null;
}

/**
 * Watch folder configuration interface
 */
export interface WatchFolder {
  id?: number;
  path: string;
  name?: string | null;
  enabled: boolean;
  scan_interval: string; // cron expression
  allowed_extensions: string[]; // e.g., [".mp4", ".mkv"]
  min_video_size_mb: number;
  temporary_extensions: string[]; // e.g., [".part", ".tmp"]
  type: 'local' | 'network' | 's3';
  username?: string | null;
  password_encrypted?: string | null; // Never returned in API responses
  domain?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Server setting interface
 */
export interface ServerSetting {
  key: string;
  value: string;
  updated_at?: string;
}

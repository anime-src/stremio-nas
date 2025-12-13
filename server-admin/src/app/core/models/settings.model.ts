export interface ServerSettings {
  [key: string]: string;
}

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

export interface DatabaseStats {
  totalFiles: number;
  uniqueImdb: number;
  totalSize: number;
  byType: Record<string, number>;
  lastScan: ScanRecord | null;
}

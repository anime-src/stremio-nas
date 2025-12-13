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
  created_at?: string;
  updated_at?: string;
}

/**
 * Watch folder creation/update DTO
 */
export interface WatchFolderDTO {
  path: string;
  name?: string;
  enabled?: boolean;
  scan_interval?: string;
  allowed_extensions?: string[];
  min_video_size_mb?: number;
  temporary_extensions?: string[];
}

/**
 * Server setting interface
 */
export interface ServerSetting {
  key: string;
  value: string;
  updated_at?: string;
}

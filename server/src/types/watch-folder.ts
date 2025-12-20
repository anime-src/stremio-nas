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
 * Watch folder creation/update DTO
 * Password is sent as plain text and encrypted before storage
 */
export interface WatchFolderDTO {
  path: string;
  name?: string;
  enabled?: boolean;
  scan_interval?: string;
  allowed_extensions?: string[];
  min_video_size_mb?: number;
  temporary_extensions?: string[];
  type?: 'local' | 'network' | 's3';
  username?: string;
  password?: string; // Plain text - will be encrypted before storage
  domain?: string;
}

/**
 * Server setting interface
 */
export interface ServerSetting {
  key: string;
  value: string;
  updated_at?: string;
}

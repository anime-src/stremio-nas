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


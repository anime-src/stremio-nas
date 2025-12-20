export interface WatchFolder {
  id?: number;
  path: string;
  name?: string | null;
  enabled: boolean;
  scan_interval: string;
  allowed_extensions: string[];
  min_video_size_mb: number;
  temporary_extensions: string[];
  type: 'local' | 'network';
  username?: string | null;
  domain?: string | null;
  // Note: password_encrypted is never returned from API for security
  created_at?: string;
  updated_at?: string;
  isScanning?: boolean;
  hasScheduledJob?: boolean;
}

export interface WatchFolderDTO {
  path: string;
  name?: string;
  enabled?: boolean;
  scan_interval?: string;
  allowed_extensions?: string[];
  min_video_size_mb?: number;
  temporary_extensions?: string[];
  type?: 'local' | 'network';
  username?: string;
  password?: string; // Plain text - sent to API, encrypted on server
  domain?: string;
}

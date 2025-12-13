export interface WatchFolder {
  id?: number;
  path: string;
  name?: string | null;
  enabled: boolean;
  scan_interval: string;
  allowed_extensions: string[];
  min_video_size_mb: number;
  temporary_extensions: string[];
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
}

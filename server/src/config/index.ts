/**
 * Central configuration for the media API server
 */
export interface Config {
  port: number;
  host: string;
  mediaDir: string;
  allowedExtensions: string[];
  apiHost: string;
  cache: {
    imdbTTL: number;
    maxSize: number;
  };
  scanner: {
    interval: string;
    onStartup: boolean;
    minVideoSizeMB: number;
    temporaryExtensions: string[];
  };
  database: {
    path: string;
  };
  logLevel: string;
  imdb: {
    enabled: boolean;
    interestingTypes: string[];
  };
}

const config: Config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  host: '0.0.0.0',
  
  // Media directory configuration
  mediaDir: process.env.MEDIA_DIR || '/data/videos',
  allowedExtensions: (process.env.ALLOWED_EXTENSIONS || '.mp4,.mkv,.avi')
    .split(',')
    .map(ext => ext.trim().toLowerCase()),
  
  // API configuration
  apiHost: process.env.API_HOST || `http://localhost:${process.env.PORT || 3000}`,
  
  // Cache configuration (for IMDB lookups)
  cache: {
    imdbTTL: parseInt(process.env.CACHE_IMDB_TTL || '86400000', 10), // 24 hours in ms
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10) // Maximum cache entries
  },
  
  // Scanner configuration
  scanner: {
    interval: process.env.SCAN_INTERVAL || '*/5 * * * *', // Every 5 minutes (cron format)
    onStartup: process.env.SCAN_ON_STARTUP !== 'false', // Scan when server starts
    minVideoSizeMB: parseInt(process.env.MIN_VIDEO_SIZE_MB || '50', 10), // Minimum video size in MB
    temporaryExtensions: (process.env.TEMPORARY_EXTENSIONS || '.part,.tmp,.download,.crdownload,.!qB,.filepart')
      .split(',')
      .map(ext => ext.trim().toLowerCase())
  },
  
  // Database configuration
  database: {
    path: process.env.DB_PATH || './storage/media.db'
  },
  
  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // IMDB lookup configuration
  imdb: {
    enabled: process.env.IMDB_LOOKUP_ENABLED !== 'false', // Enabled by default
    interestingTypes: ['movie', 'series']
  }
};

export default config;

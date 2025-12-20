/**
 * Central configuration for the media API server
 */
export interface Config {
  port: number;
  host: string;
  mediaDir: string;
  allowedExtensions: string[];
  cache: {
    type: 'memory' | 'redis' | 'memcached';
    imdbTTL: number;
    maxSize: number;
    // Redis/Memcached connection options (for future use)
    host?: string;
    port?: number;
    password?: string;
  };
  scanner: {
    interval: string;
    onStartup: boolean;
    minVideoSizeMB: number;
    temporaryExtensions: string[];
  };
  database: {
    type: 'sqlite' | 'postgresql' | 'mysql' | 'mariadb';
    path: string;
    // PostgreSQL/MySQL connection options (for future use)
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
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
  
  // Cache configuration (for IMDB lookups)
  cache: {
    type: (process.env.CACHE_TYPE || 'memory') as 'memory' | 'redis' | 'memcached',
    imdbTTL: parseInt(process.env.CACHE_IMDB_TTL || '86400000', 10), // 24 hours in ms
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10), // Maximum cache entries
    // Redis/Memcached connection options (optional, only used for non-memory caches)
    host: process.env.CACHE_HOST,
    port: process.env.CACHE_PORT ? parseInt(process.env.CACHE_PORT, 10) : undefined,
    password: process.env.CACHE_PASSWORD
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
    type: (process.env.DB_TYPE || 'sqlite') as 'sqlite' | 'postgresql' | 'mysql' | 'mariadb',
    path: process.env.DB_PATH || './storage/media.db',
    // PostgreSQL/MySQL connection options (optional, only used for non-SQLite databases)
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  },
  
  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // IMDB lookup configuration (always enabled)
  imdb: {
    enabled: true,
    interestingTypes: ['movie', 'series']
  }
};

export default config;

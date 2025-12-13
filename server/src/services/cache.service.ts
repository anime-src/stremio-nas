import config from '../config';
import logger from '../config/logger';

/**
 * Simple in-memory cache service with TTL support
 */
class CacheService {
  private cache: Map<string, any>;
  private timestamps: Map<string, number>;

  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  /**
   * Get a value from cache
   * @param key - Cache key
   * @param ttl - Time to live in milliseconds
   * @returns Cached value or null if not found/expired
   */
  get(key: string, ttl: number): any {
    if (!this.cache.has(key)) {
      return null;
    }

    const timestamp = this.timestamps.get(key);
    if (timestamp === undefined) {
      return null;
    }

    const now = Date.now();

    if (now - timestamp > ttl) {
      // Expired, remove from cache
      this.cache.delete(key);
      this.timestamps.delete(key);
      logger.debug('Cache expired', { key });
      return null;
    }

    logger.debug('Cache hit', { key });
    return this.cache.get(key);
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: any): void {
    // Implement simple LRU: if cache is full, remove oldest entry
    if (this.cache.size >= config.cache.maxSize && !this.cache.has(key)) {
      const oldestKey = this.timestamps.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.timestamps.delete(oldestKey);
        logger.debug('Cache eviction', { key: oldestKey });
      }
    }

    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
    logger.debug('Cache set', { key, size: this.cache.size });
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.timestamps.clear();
    logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: config.cache.maxSize
    };
  }
}

// Export singleton instance
export default new CacheService();

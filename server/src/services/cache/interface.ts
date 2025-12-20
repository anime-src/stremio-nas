/**
 * Cache service interface
 * Defines the contract for all cache implementations
 */
export interface ICacheService {
  /**
   * Get a value from cache
   * @param key - Cache key
   * @param ttl - Time to live in milliseconds
   * @returns Cached value or null if not found/expired
   */
  get(key: string, ttl: number): any;

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: any): void;

  /**
   * Delete a specific key from cache
   * @param key - Cache key to delete
   */
  delete(key: string): void;

  /**
   * Clear entire cache
   */
  clear(): void;

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
  };
}

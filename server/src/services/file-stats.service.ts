import { getFileStats } from '../utils/file-utils';

/**
 * File statistics service with caching
 * Caches file stats to avoid repeated filesystem calls
 */
class FileStatsService {
  // Simple in-memory cache for file stats (avoids repeated fs.stat calls)
  // Uses Map for O(1) lookups, with TTL-based expiration
  private statsCache: Map<string, { stats: import('fs').Stats; timestamp: number }>;
  private readonly STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  constructor() {
    this.statsCache = new Map();
  }

  /**
   * Get file statistics with caching
   * Caches file stats for 5 minutes to avoid repeated filesystem calls
   * @param filePath - Path to file
   * @returns File stats (cached if available)
   */
  async getCachedFileStats(filePath: string): Promise<import('fs').Stats> {
    const now = Date.now();
    const cached = this.statsCache.get(filePath);
    
    if (cached && (now - cached.timestamp) < this.STATS_CACHE_TTL) {
      return cached.stats;
    }
    
    const stats = await getFileStats(filePath);
    this.statsCache.set(filePath, { stats, timestamp: now });
    
    // Cleanup old entries (lazy cleanup on access)
    if (this.statsCache.size > this.MAX_CACHE_SIZE) {
      this._cleanupExpiredEntries(now);
    }
    
    return stats;
  }

  /**
   * Clear expired entries from cache
   * @private
   */
  private _cleanupExpiredEntries(now: number): void {
    const entries = Array.from(this.statsCache.entries());
    entries.forEach(([key, value]) => {
      if ((now - value.timestamp) >= this.STATS_CACHE_TTL) {
        this.statsCache.delete(key);
      }
    });
  }

  /**
   * Clear entire cache
   * @returns Number of entries cleared
   */
  clearCache(): number {
    const size = this.statsCache.size;
    this.statsCache.clear();
    return size;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.statsCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttl: this.STATS_CACHE_TTL
    };
  }
}

// Export singleton instance
export default new FileStatsService();

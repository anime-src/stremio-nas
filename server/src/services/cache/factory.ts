import logger from '../../config/logger';
import config from '../../config';
import { ICacheService } from './interface';
import { MemoryCacheService } from './providers/memory.cache.service';

export type CacheType = 'memory' | 'redis' | 'memcached';

/**
 * Cache factory that creates the appropriate cache service instance
 * based on configuration
 */
export function createCacheService(): ICacheService {
  const cacheType = (config.cache.type || 'memory').toLowerCase() as CacheType;

  logger.info('Initializing cache service', { type: cacheType });

  switch (cacheType) {
    case 'memory':
      return new MemoryCacheService();

    case 'redis':
      // TODO: Implement Redis support
      throw new Error('Redis cache support is not yet implemented. Please use memory cache for now.');

    case 'memcached':
      // TODO: Implement Memcached support
      throw new Error('Memcached cache support is not yet implemented. Please use memory cache for now.');

    default:
      logger.warn('Unknown cache type, defaulting to memory', { type: cacheType });
      return new MemoryCacheService();
  }
}

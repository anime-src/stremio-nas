/**
 * Cache service - factory-based implementation
 * 
 * This module exports a singleton cache service instance created by the factory.
 * The default implementation is in-memory cache, but other cache types can be configured
 * via the CACHE_TYPE environment variable.
 * 
 * Usage:
 *   import cache from './services/cache.service';
 *   const value = cache.get('key', 60000);
 *   cache.set('key', value);
 * 
 * To use a different cache:
 *   Set CACHE_TYPE=redis (or memcached) in your environment
 *   Note: Redis/Memcached providers need to be added first
 */
import { createCacheService } from './cache/factory';

  /**
 * Singleton cache service instance
 * Created using the factory based on configuration
 * Defaults to memory cache if CACHE_TYPE is not specified
 */
const cacheService = createCacheService();

export default cacheService;

import { logger } from '../utils/logger';

/**
 * Category Cache Service
 * Provides intelligent caching for category data with TTL and invalidation
 */
class CategoryCache {
  constructor() {
    this.cache = {
      data: null,
      timestamp: null,
      ttl: 30000, // 30 seconds TTL
    };
    this.listeners = new Set();
  }

  /**
   * Check if cache is valid
   */
  isValid() {
    if (!this.cache.data || !this.cache.timestamp) {
      return false;
    }
    return Date.now() - this.cache.timestamp < this.cache.ttl;
  }

  /**
   * Get cached data or fetch fresh data
   */
  async get(fetchFunction) {
    if (this.isValid()) {
      logger.debug('Category cache hit');
      return this.cache.data;
    }

    logger.debug('Category cache miss, fetching fresh data');
    try {
      const freshData = await fetchFunction();
      this.set(freshData);
      return freshData;
    } catch (error) {
      logger.error('Failed to fetch fresh category data:', error);

      // Return stale data if available, otherwise throw
      if (this.cache.data) {
        logger.warn('Returning stale category data due to fetch error');
        return this.cache.data;
      }
      throw error;
    }
  }

  /**
   * Set cache data
   */
  set(data) {
    this.cache.data = data;
    this.cache.timestamp = Date.now();
    this.notifyListeners();
  }

  /**
   * Invalidate cache
   */
  invalidate() {
    this.cache.data = null;
    this.cache.timestamp = null;
    this.notifyListeners();
  }

  /**
   * Add cache listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of cache changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.cache.data);
      } catch (error) {
        logger.error('Error in cache listener:', error);
      }
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      hasData: !!this.cache.data,
      isStale: !this.isValid(),
      age: this.cache.timestamp ? Date.now() - this.cache.timestamp : null,
      ttl: this.cache.ttl,
      listenerCount: this.listeners.size,
    };
  }
}

// Singleton instance
export const categoryCache = new CategoryCache();

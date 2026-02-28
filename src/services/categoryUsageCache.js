import { logger } from '../utils/logger';

/**
 * Category Usage Cache Service
 * Provides intelligent caching for category usage statistics with TTL and invalidation
 */
class CategoryUsageCache {
  constructor() {
    this.cache = new Map(); // Map<categoryName, usageStats>
    this.timestamp = null;
    this.ttl = 60000; // 60s TTL (usage changes less frequently than category cache)
  }

  /**
   * Check if cache is valid
   */
  isValid() {
    if (!this.timestamp || this.cache.size === 0) {
      return false;
    }
    return Date.now() - this.timestamp < this.ttl;
  }

  /**
   * Get usage stats for a single category
   */
  getUsageStats(categoryName) {
    if (!this.isValid()) {
      return null;
    }
    return this.cache.get(categoryName) || null;
  }

  /**
   * Get usage stats for multiple categories
   * Returns a Map of categoryName -> usageStats
   */
  getAllUsageStats(categoryNames) {
    if (!this.isValid()) {
      return new Map();
    }
    const result = new Map();
    categoryNames.forEach(name => {
      const stats = this.cache.get(name);
      if (stats) {
        result.set(name, stats);
      }
    });
    return result;
  }

  /**
   * Set usage stats for a single category
   * Always updates timestamp to prevent premature expiration when called in parallel
   */
  setUsageStats(categoryName, stats) {
    this.cache.set(categoryName, stats);

    // Always update timestamp to ensure cache validity reflects the most recent update
    // This is critical when multiple parallel promises call setUsageStats
    this.timestamp = Date.now();
  }

  /**
   * Set usage stats for multiple categories
   * Accepts a Map of categoryName -> usageStats
   */
  setAllUsageStats(statsMap) {
    if (statsMap instanceof Map) {
      statsMap.forEach((stats, categoryName) => {
        this.cache.set(categoryName, stats);
      });
    } else if (typeof statsMap === 'object') {
      Object.entries(statsMap).forEach(([categoryName, stats]) => {
        this.cache.set(categoryName, stats);
      });
    }
    this.timestamp = Date.now();
  }

  /**
   * Invalidate cache
   */
  invalidate() {
    this.cache.clear();
    this.timestamp = null;
    logger.debug('Category usage cache invalidated');
  }

  /**
   * Invalidate stats for a specific category
   */
  invalidateCategory(categoryName) {
    this.cache.delete(categoryName);
    logger.debug(`Category usage stats invalidated for: ${categoryName}`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      isValid: this.isValid(),
      age: this.timestamp ? Date.now() - this.timestamp : null,
      ttl: this.ttl,
    };
  }
}

// Singleton instance
export const categoryUsageCache = new CategoryUsageCache();

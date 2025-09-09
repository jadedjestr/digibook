import { logger } from './logger';

/**
 * Utility functions for database pagination and data chunking
 * Helps manage large datasets efficiently by loading data in chunks
 */

/**
 * Pagination configuration
 */
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,
  MIN_PAGE_SIZE: 10,
};

/**
 * Create a paginated query result
 */
export const createPaginatedResult = (data, page, pageSize, total) => {
  const totalPages = Math.ceil(total / pageSize);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    },
  };
};

/**
 * Calculate pagination parameters
 */
export const calculatePagination = (page, pageSize, total) => {
  const normalizedPageSize = Math.min(
    Math.max(pageSize, PAGINATION_CONFIG.MIN_PAGE_SIZE),
    PAGINATION_CONFIG.MAX_PAGE_SIZE
  );

  const normalizedPage = Math.max(1, page);
  const offset = (normalizedPage - 1) * normalizedPageSize;
  const limit = normalizedPageSize;

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    offset,
    limit,
    total,
  };
};

/**
 * Paginated database query helper
 */
export const createPaginatedQuery = async (
  queryFunction,
  page = 1,
  pageSize = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
  ...args
) => {
  try {
    start();

    // Get total count first
    const total = await queryFunction('count', ...args);

    // Calculate pagination parameters
    const { offset, limit } = calculatePagination(page, pageSize, total);

    // Get paginated data
    const data = await queryFunction('data', { offset, limit }, ...args);

    const result = createPaginatedResult(data, page, pageSize, total);
    end('createPaginatedQuery');

    return result;
  } catch (error) {
    logger.error('Error in paginated query:', error);
    throw error;
  }
};

/**
 * Infinite scroll pagination helper
 */
export const createInfiniteScrollQuery = async (
  queryFunction,
  lastId = null,
  pageSize = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
  ...args
) => {
  try {
    start();

    const data = await queryFunction(
      'infinite',
      { lastId, limit: pageSize },
      ...args
    );

    const result = {
      data,
      hasMore: data.length === pageSize,
      lastId: data.length > 0 ? data[data.length - 1].id : null,
    };

    end('createInfiniteScrollQuery');
    return result;
  } catch (error) {
    logger.error('Error in infinite scroll query:', error);
    throw error;
  }
};

/**
 * Search with pagination
 */
export const createSearchQuery = async (
  searchFunction,
  query,
  page = 1,
  pageSize = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
  ...args
) => {
  try {
    start();

    if (!query || query.trim().length === 0) {
      return createPaginatedResult([], page, pageSize, 0);
    }

    // Get total count for search results
    const total = await searchFunction('count', query, ...args);

    // Calculate pagination parameters
    const { offset, limit } = calculatePagination(page, pageSize, total);

    // Get paginated search results
    const data = await searchFunction(
      'data',
      query,
      { offset, limit },
      ...args
    );

    const result = createPaginatedResult(data, page, pageSize, total);
    end('createSearchQuery');

    return result;
  } catch (error) {
    logger.error('Error in search query:', error);
    throw error;
  }
};

/**
 * Batch processing utility for large datasets
 */
export const processBatch = async (items, batchSize = 100, processFunction) => {
  const results = [];
  const totalBatches = Math.ceil(items.length / batchSize);

  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, items.length);
    const batch = items.slice(start, end);

    try {
      const batchResult = await processFunction(batch, i, totalBatches);
      results.push(...batchResult);

      // Log progress
      logger.debug(
        `Processed batch ${i + 1}/${totalBatches} (${batch.length} items)`
      );
    } catch (error) {
      logger.error(`Error processing batch ${i + 1}:`, error);
      throw error;
    }
  }

  return results;
};

/**
 * Memory-efficient data streaming
 */
export const streamData = async function* (
  queryFunction,
  pageSize = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
  ...args
) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const result = await createPaginatedQuery(
        queryFunction,
        page,
        pageSize,
        ...args
      );

      yield result.data;

      hasMore = result.pagination.hasNextPage;
      page++;
    } catch (error) {
      logger.error(`Error streaming data for page ${page}:`, error);
      throw error;
    }
  }
};

/**
 * Performance monitoring for pagination
 */
let startTime = 0;

const start = () => {
  startTime = performance.now();
};

const end = operation => {
  const duration = performance.now() - startTime;
  if (duration > 100) {
    // Log if operation takes more than 100ms
    logger.warn(
      `Slow pagination operation: ${operation} took ${duration.toFixed(2)}ms`
    );
  }
};

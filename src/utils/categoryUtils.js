/**
 * Category utility functions
 * Provides helper functions for category operations
 */

/**
 * Creates a Map from categories array for O(1) lookups by category name
 * @param {Array} categories - Array of category objects with name property
 * @returns {Map<string, Object>} Map of category name to category object
 */
export function createCategoryMap(categories) {
  if (!Array.isArray(categories)) {
    return new Map();
  }

  const categoryMap = new Map();
  categories.forEach(category => {
    if (category && category.name) {
      categoryMap.set(category.name, category);
    }
  });

  return categoryMap;
}

/**
 * Gets a category from a Map by name with fallback
 * @param {Map<string, Object>} categoryMap - Map of categories
 * @param {string} categoryName - Name of the category to find
 * @param {Object} fallback - Fallback category object if not found
 * @returns {Object} Category object or fallback
 */
export function getCategoryFromMap(categoryMap, categoryName, fallback = null) {
  if (!categoryMap || !categoryName) {
    return fallback;
  }

  return categoryMap.get(categoryName) || fallback;
}

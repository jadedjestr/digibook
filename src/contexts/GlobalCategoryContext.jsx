import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { categoryCache } from '../services/categoryCache';
import { dbHelpers } from '../db/database';
import { notify } from '../utils/notifications';

const GlobalCategoryContext = createContext(null);

export const useGlobalCategories = () => {
  const context = useContext(GlobalCategoryContext);
  if (!context) {
    throw new Error('useGlobalCategories must be used within a GlobalCategoryProvider');
  }
  return context;
};

export const GlobalCategoryProvider = ({ children }) => {
  // Fetch function for the cache
  const fetchCategories = useCallback(async () => {
    return await dbHelpers.getCategories();
  }, []);

  // Get categories with caching
  const getCategories = useCallback(async () => {
    return await categoryCache.get(fetchCategories);
  }, [fetchCategories]);

  // Add category with cache invalidation
  const addCategory = useCallback(async (categoryData) => {
    try {
      const id = await dbHelpers.addCategory(categoryData);
      categoryCache.invalidate(); // Invalidate cache after mutation
      notify.success('Category added successfully');
      return id;
    } catch (error) {
      notify.error('Failed to add category. Please try again.', error);
      throw error;
    }
  }, []);

  // Update category with cache invalidation
  const updateCategory = useCallback(async (id, updates) => {
    try {
      await dbHelpers.updateCategory(id, updates);
      categoryCache.invalidate(); // Invalidate cache after mutation
      notify.success('Category updated successfully');
    } catch (error) {
      notify.error('Failed to update category. Please try again.', error);
      throw error;
    }
  }, []);

  // Delete category with cache invalidation
  const deleteCategory = useCallback(async (id) => {
    try {
      await dbHelpers.deleteCategory(id);
      categoryCache.invalidate(); // Invalidate cache after mutation
      notify.success('Category deleted successfully');
    } catch (error) {
      notify.error('Failed to delete category. Please try again.', error);
      throw error;
    }
  }, []);

  // Reassign category items with cache invalidation
  const reassignCategoryItems = useCallback(async (oldCategoryName, newCategoryName, affectedItems) => {
    try {
      await dbHelpers.reassignCategoryItems(oldCategoryName, newCategoryName, affectedItems);
      categoryCache.invalidate(); // Invalidate cache after mutation
      notify.success(`Reassigned items from "${oldCategoryName}" to "${newCategoryName}"`);
    } catch (error) {
      notify.error('Failed to reassign category items. Please try again.', error);
      throw error;
    }
  }, []);

  // Get category usage stats (cached)
  const getCategoryUsageStats = useCallback(async (categoryName) => {
    return await dbHelpers.getCategoryUsageStats(categoryName);
  }, []);

  // Force refresh categories
  const refreshCategories = useCallback(async () => {
    categoryCache.invalidate();
    return await getCategories();
  }, [getCategories]);

  // Invalidate cache (for import/export operations)
  const invalidateCache = useCallback(() => {
    categoryCache.invalidate();
  }, []);

  // Memoized context value
  const value = useMemo(() => ({
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    reassignCategoryItems,
    getCategoryUsageStats,
    refreshCategories,
    invalidateCache,
    cache: categoryCache,
  }), [
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    reassignCategoryItems,
    getCategoryUsageStats,
    refreshCategories,
    invalidateCache,
  ]);

  return (
    <GlobalCategoryContext.Provider value={value}>
      {children}
    </GlobalCategoryContext.Provider>
  );
};

export default GlobalCategoryContext;

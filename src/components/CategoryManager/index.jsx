import { Plus, Search, Trash2, AlertTriangle } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useState, useMemo, useCallback } from 'react';

import { useGlobalCategories } from '../../contexts/GlobalCategoryContext';
import { dbHelpers } from '../../db/database-clean';
import { categoryUsageCache } from '../../services/categoryUsageCache';
import { logger } from '../../utils/logger';
import { showConfirmation, notify } from '../../utils/notifications';
import CategoryDeletionModal from '../CategoryDeletionModal';

import { CategoryProvider, useCategoryContext } from './CategoryContext';
import CategoryForm from './CategoryForm';
import CategoryGrid from './CategoryGrid';
import CategoryManagerErrorBoundary from './CategoryManagerErrorBoundary';
import { colorOptions, iconCategories } from './constants';

const CategoryManagerContent = () => {
  const {
    categories,
    isLoading,
    operationLoading,
    formMode,
    editingCategory,
    deletionModal,
    loadCategories,
    setFormMode,
    setEditingCategory,
    handleDeleteCategory,
    handleSaveCategory,
    handleBulkDeleteCategories,
    setDeletionModal,
    refreshAfterMutation,
  } = useCategoryContext();

  // Global categories service
  const globalCategories = useGlobalCategories();

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, default, custom
  const [sortBy, setSortBy] = useState('name'); // name, createdAt, usage

  // Bulk operations state
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [pendingBulkDeletions, setPendingBulkDeletions] = useState([]);

  // Usage stats state
  const [categoryUsageStats, setCategoryUsageStats] = useState(new Map());
  const [loadingUsageStats, setLoadingUsageStats] = useState(false);

  // Orphaned expenses state
  const [orphanedExpenses, setOrphanedExpenses] = useState([]);
  const [checkingOrphans, setCheckingOrphans] = useState(false);
  const [fixingOrphans, setFixingOrphans] = useState({});
  const [showOrphanSection, setShowOrphanSection] = useState(false);

  // Filtered and sorted categories
  const filteredCategories = useMemo(() => {
    let filtered = categories;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        category =>
          category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          category.icon.includes(searchTerm) ||
          category.color.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(category => {
        if (filterType === 'default') return category.isDefault;
        if (filterType === 'custom') return !category.isDefault;
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'createdAt':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'usage': {
          const getUsageCount = category => {
            const stats = categoryUsageStats.get(category.name);
            if (!stats) return 0;
            return stats.expenseCount + stats.transactionCount;
          };
          return getUsageCount(b) - getUsageCount(a); // Descending (most used first)
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [categories, searchTerm, filterType, sortBy, categoryUsageStats]);

  // Bulk operation functions
  const handleSelectCategory = useCallback(categoryId => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedCategories(prev => {
      if (prev.size === filteredCategories.length) {
        return new Set();
      }
      return new Set(filteredCategories.map(cat => cat.id));
    });
  }, [filteredCategories]);

  // Load category usage stats
  const loadCategoryUsageStats = useCallback(async () => {
    if (categories.length === 0) return;

    // Check cache first
    if (categoryUsageCache.isValid()) {
      const cachedStats = categoryUsageCache.getAllUsageStats(
        categories.map(cat => cat.name),
      );
      if (cachedStats.size === categories.length) {
        // All stats are cached
        setCategoryUsageStats(cachedStats);
        return;
      }
    }

    setLoadingUsageStats(true);
    try {
      // Load stats for all categories in parallel
      const statsPromises = categories.map(async category => {
        try {
          // Check cache first
          const cached = categoryUsageCache.getUsageStats(category.name);
          if (cached) {
            return { categoryName: category.name, stats: cached };
          }

          // Fetch from database
          const stats = await globalCategories.getCategoryUsageStats(
            category.name,
          );

          // Store in cache
          categoryUsageCache.setUsageStats(category.name, stats);
          return { categoryName: category.name, stats };
        } catch (error) {
          // Return default stats on error
          const defaultStats = {
            expenseCount: 0,
            transactionCount: 0,
            totalExpenseAmount: 0,
            totalTransactionAmount: 0,
          };
          categoryUsageCache.setUsageStats(category.name, defaultStats);
          return { categoryName: category.name, stats: defaultStats };
        }
      });

      const results = await Promise.all(statsPromises);
      const statsMap = new Map();
      results.forEach(({ categoryName, stats }) => {
        statsMap.set(categoryName, stats);
      });

      setCategoryUsageStats(statsMap);
    } catch (error) {
      logger.error('Error loading category usage stats:', error);
      notify.error('Failed to load usage statistics');
    } finally {
      setLoadingUsageStats(false);
    }
  }, [categories, globalCategories]);

  // Process next pending category deletion
  const processNextPendingDeletion = useCallback(() => {
    setPendingBulkDeletions(prev => {
      if (prev.length > 0) {
        const next = prev[0];
        setDeletionModal({
          isOpen: true,
          category: next.category,
          affectedItems: next.affectedItems,
        });
        return prev.slice(1);
      }

      // All done, clear selection
      setSelectedCategories(new Set());
      return [];
    });
  }, [setDeletionModal]);

  // Enhanced callback for category deletion that handles pending bulk deletions
  const handleCategoryDeletedWithBulk = useCallback(async () => {
    await refreshAfterMutation();

    // Small delay to allow modal to close, then process next
    setTimeout(() => {
      processNextPendingDeletion();
    }, 100);
  }, [processNextPendingDeletion, refreshAfterMutation]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedCategories.size === 0) return;

    setBulkOperationLoading(true);
    try {
      // Check affected items for all selected categories
      const categoryIds = Array.from(selectedCategories);
      const deletionAnalysis = await handleBulkDeleteCategories(categoryIds);

      const { safeToDelete, needsReassignment } = deletionAnalysis;

      // Handle safe-to-delete categories
      if (safeToDelete.length > 0) {
        const confirmed = await showConfirmation(
          `Are you sure you want to delete ${safeToDelete.length} ${
            safeToDelete.length > 1 ? 'categories' : 'category'
          }? This action cannot be undone.`,
        );

        if (confirmed) {
          const deletePromises = safeToDelete.map(category =>
            globalCategories.deleteCategory(category.id),
          );
          await Promise.all(deletePromises);

          // Invalidate usage cache for deleted categories
          safeToDelete.forEach(category => {
            categoryUsageCache.invalidateCategory(category.name);
          });
          await refreshAfterMutation();
        }
      }

      // Handle categories that need reassignment
      if (needsReassignment.length > 0) {
        // Store remaining categories for sequential processing
        setPendingBulkDeletions(needsReassignment.slice(1));

        // Show modal for first category
        setDeletionModal({
          isOpen: true,
          category: needsReassignment[0].category,
          affectedItems: needsReassignment[0].affectedItems,
        });
      } else {
        // All were safe to delete, clear selection
        setSelectedCategories(new Set());
      }
    } catch (error) {
      notify.error(
        'Failed to delete some categories. Please try again.',
        error,
      );
    } finally {
      setBulkOperationLoading(false);
    }
  }, [
    selectedCategories,
    handleBulkDeleteCategories,
    globalCategories,
    setDeletionModal,
    refreshAfterMutation,
  ]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedCategories(new Set());
  }, [searchTerm, filterType, sortBy]);

  // Check for orphaned expenses
  const handleCheckOrphanedExpenses = useCallback(async () => {
    setCheckingOrphans(true);
    try {
      const orphans = await dbHelpers.detectOrphanedExpenses();
      setOrphanedExpenses(orphans);
      setShowOrphanSection(true);
      if (orphans.length > 0) {
        notify.warning(
          `Found ${orphans.length} orphaned categor${orphans.length > 1 ? 'ies' : 'y'}`,
        );
      } else {
        notify.success('No orphaned expenses found. All categories are valid.');
      }
    } catch (error) {
      logger.error('Error checking orphaned expenses:', error);
      notify.error(
        'Failed to check for orphaned expenses. Please try again.',
        error,
      );
    } finally {
      setCheckingOrphans(false);
    }
  }, []);

  // Fix orphaned expenses
  const handleFixOrphanedExpenses = useCallback(
    async (orphanedCategoryName, targetCategoryName) => {
      setFixingOrphans(prev => ({ ...prev, [orphanedCategoryName]: true }));
      try {
        await dbHelpers.fixOrphanedExpenses(
          orphanedCategoryName,
          targetCategoryName,
        );

        // Remove from list
        setOrphanedExpenses(prev =>
          prev.filter(orphan => orphan.categoryName !== orphanedCategoryName),
        );
        notify.success(
          `Fixed orphaned category "${orphanedCategoryName}" by reassigning to "${targetCategoryName}"`,
        );
        await refreshAfterMutation();
      } catch (error) {
        logger.error('Error fixing orphaned expenses:', error);
        notify.error(
          'Failed to fix orphaned expenses. Please try again.',
          error,
        );
      } finally {
        setFixingOrphans(prev => ({ ...prev, [orphanedCategoryName]: false }));
      }
    },
    [refreshAfterMutation],
  );

  // Load usage stats when sort by usage is selected
  useEffect(() => {
    if (sortBy === 'usage' && categories.length > 0 && !isLoading) {
      // Check cache validity first
      if (!categoryUsageCache.isValid()) {
        // Cache is invalid, clear local state and reload
        setCategoryUsageStats(new Map());
        loadCategoryUsageStats();
        return;
      }

      // Check if we have all stats in state
      const allStatsLoaded =
        categoryUsageStats.size > 0 &&
        categories.every(cat => categoryUsageStats.has(cat.name));

      if (!allStatsLoaded) {
        // Try to get missing stats from cache
        const cachedStats = categoryUsageCache.getAllUsageStats(
          categories.map(cat => cat.name),
        );
        if (cachedStats.size === categories.length) {
          // All stats are in cache, update state
          setCategoryUsageStats(cachedStats);
        } else {
          // Need to load missing stats
          loadCategoryUsageStats();
        }
      }
    }
  }, [
    sortBy,
    categories.length,
    isLoading,
    categoryUsageStats.size,
    loadCategoryUsageStats,
  ]);

  if (isLoading) {
    return (
      <div className='text-center py-8'>
        <div className='glass-loading' />
        <p className='text-white/70 mt-4'>Loading categories...</p>
      </div>
    );
  }

  return (
    <CategoryManagerErrorBoundary>
      <div className='space-y-4 overflow-visible'>
        {/* Search and Filter Controls */}
        {!formMode && (
          <div className='glass-panel border border-white/20 p-4'>
            <div className='flex flex-col lg:flex-row gap-4'>
              {/* Search Input */}
              <div className='flex-1'>
                <div className='relative'>
                  <Search
                    size={16}
                    className='absolute left-3 top-1/2 -translate-y-1/2 text-white/40'
                  />
                  <input
                    type='text'
                    placeholder='Search categories...'
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className='glass-input w-full pl-9'
                  />
                </div>
              </div>

              {/* Filter and Sort Controls */}
              <div className='flex gap-2'>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className='glass-input min-w-[120px]'
                >
                  <option value='all'>All Types</option>
                  <option value='default'>Default</option>
                  <option value='custom'>Custom</option>
                </select>

                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className='glass-input min-w-[120px]'
                >
                  <option value='name'>Sort by Name</option>
                  <option value='createdAt'>Sort by Date</option>
                  <option value='usage'>Sort by Usage</option>
                </select>
              </div>
            </div>

            {/* Results Summary */}
            <div className='mt-3 text-sm text-white/60'>
              {loadingUsageStats && sortBy === 'usage' ? (
                <div className='flex items-center gap-2'>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                  <span>Loading usage data...</span>
                </div>
              ) : (
                <>
                  Showing {filteredCategories.length} of {categories.length}{' '}
                  categories
                  {searchTerm && ` matching "${searchTerm}"`}
                </>
              )}
            </div>

            {/* Bulk Operations */}
            {filteredCategories.length > 0 && (
              <div className='mt-4 flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <label className='flex items-center gap-2 text-sm text-white/80'>
                    <input
                      type='checkbox'
                      checked={
                        selectedCategories.size === filteredCategories.length &&
                        filteredCategories.length > 0
                      }
                      onChange={handleSelectAll}
                      className='rounded border-white/20 bg-transparent'
                    />
                    Select All
                  </label>
                  {selectedCategories.size > 0 && (
                    <span className='text-sm text-blue-300'>
                      {selectedCategories.size} selected
                    </span>
                  )}
                </div>

                {selectedCategories.size > 0 && (
                  <div className='flex gap-2'>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkOperationLoading}
                      className='glass-button glass-button--danger flex items-center space-x-2 disabled:opacity-50'
                    >
                      <Trash2 size={16} />
                      <span>
                        {bulkOperationLoading
                          ? 'Deleting...'
                          : `Delete ${selectedCategories.size}`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Category Form */}
        {formMode && (
          <CategoryForm
            mode={formMode}
            initialData={
              editingCategory || { name: '', color: '#3B82F6', icon: '📦' }
            }
            onSave={handleSaveCategory}
            onCancel={() => {
              setFormMode(null);
              setEditingCategory(null);
            }}
            existingCategories={categories}
            colorOptions={colorOptions}
            iconCategories={iconCategories}
            isDefault={editingCategory?.isDefault || false}
          />
        )}

        {/* Data Validation Section */}
        <div className='glass-panel border border-yellow-500/20'>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center gap-2'>
              <AlertTriangle className='text-yellow-400' size={20} />
              <h3 className='text-lg font-semibold text-primary'>
                Data Validation
              </h3>
            </div>
            <button
              onClick={() => setShowOrphanSection(!showOrphanSection)}
              className='text-sm text-white/70 hover:text-white'
            >
              {showOrphanSection ? 'Hide' : 'Show'}
            </button>
          </div>

          {showOrphanSection && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <p className='text-sm text-white/70'>
                  Check for expenses with invalid category names
                </p>
                <button
                  onClick={handleCheckOrphanedExpenses}
                  disabled={checkingOrphans}
                  className='glass-button px-4 py-2 text-sm disabled:opacity-50'
                >
                  {checkingOrphans
                    ? 'Checking...'
                    : 'Check for Orphaned Expenses'}
                </button>
              </div>

              {orphanedExpenses.length > 0 && (
                <div className='space-y-3'>
                  <p className='text-sm font-medium text-yellow-300'>
                    Found {orphanedExpenses.length} orphaned categor
                    {orphanedExpenses.length > 1 ? 'ies' : 'y'}:
                  </p>
                  {orphanedExpenses.map(orphan => (
                    <div
                      key={orphan.categoryName}
                      className='glass-card p-4 space-y-3'
                    >
                      <div className='flex items-center justify-between'>
                        <div>
                          <p className='font-medium text-primary'>
                            {orphan.categoryName}
                          </p>
                          <p className='text-sm text-white/60'>
                            {orphan.expenseCount} expenses,{' '}
                            {orphan.transactionCount} transactions
                          </p>
                        </div>
                        <div className='flex items-center gap-2'>
                          <select
                            onChange={e => {
                              if (e.target.value) {
                                handleFixOrphanedExpenses(
                                  orphan.categoryName,
                                  e.target.value,
                                );
                                e.target.value = '';
                              }
                            }}
                            disabled={fixingOrphans[orphan.categoryName]}
                            className='glass-input text-sm'
                          >
                            <option value=''>Select target category...</option>
                            {categories
                              .filter(cat => cat.name !== orphan.categoryName)
                              .map(category => (
                                <option key={category.id} value={category.name}>
                                  {category.icon} {category.name}
                                </option>
                              ))}
                          </select>
                          {fixingOrphans[orphan.categoryName] && (
                            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {orphanedExpenses.length === 0 && !checkingOrphans && (
                <div className='text-center py-4 text-white/60 text-sm'>
                  No orphaned expenses detected. Click &quot;Check for Orphaned
                  Expenses&quot; to scan your data.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Grid */}
        <CategoryGrid
          categories={filteredCategories}
          onEdit={category => {
            setEditingCategory(category);
            setFormMode('edit');
          }}
          onDelete={handleDeleteCategory}
          operationLoading={operationLoading}
          selectedCategories={selectedCategories}
          onSelectCategory={handleSelectCategory}
        />

        {/* Add Category Button */}
        {!formMode && (
          <button
            onClick={() => setFormMode('add')}
            disabled={operationLoading.saving}
            className='glass-button flex items-center justify-center space-x-2 w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <Plus size={16} />
            <span>
              {operationLoading.saving ? 'Saving...' : 'Add New Category'}
            </span>
          </button>
        )}

        {/* Category Deletion Modal */}
        <CategoryDeletionModal
          isOpen={deletionModal.isOpen}
          onClose={() => {
            setDeletionModal({
              isOpen: false,
              category: null,
              affectedItems: { fixedExpenses: [], pendingTransactions: [] },
            });

            // Only clear selection if no pending deletions (user cancelled)
            // Don't process next here - onCategoryDeleted handles that
            if (pendingBulkDeletions.length === 0) {
              setSelectedCategories(new Set());
            }
          }}
          categoryToDelete={deletionModal.category}
          affectedItems={deletionModal.affectedItems}
          onCategoryDeleted={
            pendingBulkDeletions.length > 0
              ? handleCategoryDeletedWithBulk
              : refreshAfterMutation
          }
        />
      </div>
    </CategoryManagerErrorBoundary>
  );
};

// Wrapper component that provides the context
const CategoryManager = ({ onDataChange }) => (
  <CategoryProvider onDataChange={onDataChange}>
    <CategoryManagerContent />
  </CategoryProvider>
);

CategoryManager.propTypes = {
  onDataChange: PropTypes.func.isRequired,
};

export default CategoryManager;

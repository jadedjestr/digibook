import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, Search, Filter, Trash2 } from 'lucide-react';
import { CategoryProvider, useCategoryContext } from './CategoryContext';
import CategoryForm from './CategoryForm';
import CategoryGrid from './CategoryGrid';
import CategoryDeletionModal from '../CategoryDeletionModal';
import CategoryManagerErrorBoundary from './CategoryManagerErrorBoundary';
import { colorOptions, iconCategories } from './constants';
import { useGlobalCategories } from '../../contexts/GlobalCategoryContext';
import { showConfirmation, notify } from '../../utils/notifications';

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

  // Filtered and sorted categories
  const filteredCategories = useMemo(() => {
    let filtered = categories;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.icon.includes(searchTerm) ||
        category.color.toLowerCase().includes(searchTerm.toLowerCase())
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
        case 'usage':
          // This would need usage data from the global context
          return 0;
        default:
          return 0;
      }
    });

    return filtered;
  }, [categories, searchTerm, filterType, sortBy]);

  // Bulk operation functions
  const handleSelectCategory = useCallback((categoryId) => {
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
    if (selectedCategories.size === filteredCategories.length) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(filteredCategories.map(cat => cat.id)));
    }
  }, [selectedCategories.size, filteredCategories]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedCategories.size === 0) return;
    
    const confirmed = await showConfirmation(
      `Are you sure you want to delete ${selectedCategories.size} categories? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    setBulkOperationLoading(true);
    try {
      const deletePromises = Array.from(selectedCategories).map(categoryId => 
        globalCategories.deleteCategory(categoryId)
      );
      await Promise.all(deletePromises);
      setSelectedCategories(new Set());
      await refreshAfterMutation();
    } catch (error) {
      notify.error('Failed to delete some categories. Please try again.', error);
    } finally {
      setBulkOperationLoading(false);
    }
  }, [selectedCategories, globalCategories, refreshAfterMutation]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="glass-loading" />
        <p className="text-white/70 mt-4">Loading categories...</p>
      </div>
    );
  }

  return (
    <CategoryManagerErrorBoundary>
      <div className="space-y-4 overflow-visible">
        {/* Search and Filter Controls */}
        {!formMode && (
          <div className="glass-panel border border-white/20 p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="glass-input w-full pl-9"
                  />
                </div>
              </div>

              {/* Filter and Sort Controls */}
              <div className="flex gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="glass-input min-w-[120px]"
                >
                  <option value="all">All Types</option>
                  <option value="default">Default</option>
                  <option value="custom">Custom</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="glass-input min-w-[120px]"
                >
                  <option value="name">Sort by Name</option>
                  <option value="createdAt">Sort by Date</option>
                  <option value="usage">Sort by Usage</option>
                </select>
              </div>
            </div>

            {/* Results Summary */}
            <div className="mt-3 text-sm text-white/60">
              Showing {filteredCategories.length} of {categories.length} categories
              {searchTerm && ` matching "${searchTerm}"`}
            </div>

            {/* Bulk Operations */}
            {filteredCategories.length > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={selectedCategories.size === filteredCategories.length && filteredCategories.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-white/20 bg-transparent"
                    />
                    Select All
                  </label>
                  {selectedCategories.size > 0 && (
                    <span className="text-sm text-blue-300">
                      {selectedCategories.size} selected
                    </span>
                  )}
                </div>

                {selectedCategories.size > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkOperationLoading}
                      className="glass-button bg-red-500/20 hover:bg-red-500/30 text-red-300 flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      <span>
                        {bulkOperationLoading ? 'Deleting...' : `Delete ${selectedCategories.size}`}
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
            initialData={editingCategory || { name: '', color: '#3B82F6', icon: '📦' }}
            onSave={handleSaveCategory}
            onCancel={() => {
              setFormMode(null);
              setEditingCategory(null);
            }}
            existingCategories={categories}
            colorOptions={colorOptions}
            iconCategories={iconCategories}
          />
        )}

        {/* Category Grid */}
        <CategoryGrid
          categories={filteredCategories}
          onEdit={(category) => {
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
            className="glass-button flex items-center justify-center space-x-2 w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
          onClose={() => setDeletionModal({
            isOpen: false,
            category: null,
            affectedItems: { fixedExpenses: [], pendingTransactions: [] },
          })}
          categoryToDelete={deletionModal.category}
          affectedItems={deletionModal.affectedItems}
          onCategoryDeleted={refreshAfterMutation}
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

export default CategoryManager;

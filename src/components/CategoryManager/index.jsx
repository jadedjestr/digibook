import React, { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { CategoryProvider, useCategoryContext } from './CategoryContext';
import CategoryForm from './CategoryForm';
import CategoryGrid from './CategoryGrid';
import CategoryDeletionModal from '../CategoryDeletionModal';
import { colorOptions, iconCategories } from './constants';

const CategoryManagerContent = () => {
  const {
    categories,
    isLoading,
    formMode,
    editingCategory,
    deletionModal,
    loadCategories,
    setFormMode,
    setEditingCategory,
    handleDeleteCategory,
    handleSaveCategory,
    setDeletionModal,
    refreshAfterMutation
  } = useCategoryContext();

  useEffect(() => {
    loadCategories();
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="glass-loading"></div>
        <p className="text-white/70 mt-4">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-visible">
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
        categories={categories}
        onEdit={(category) => {
          setEditingCategory(category);
          setFormMode('edit');
        }}
        onDelete={handleDeleteCategory}
      />

      {/* Add Category Button */}
      {!formMode && (
        <button
          onClick={() => setFormMode('add')}
          className="glass-button flex items-center justify-center space-x-2 w-full py-3"
        >
          <Plus size={16} />
          <span>Add New Category</span>
        </button>
      )}

      {/* Category Deletion Modal */}
      <CategoryDeletionModal
        isOpen={deletionModal.isOpen}
        onClose={() => setDeletionModal({ 
          isOpen: false, 
          category: null, 
          affectedItems: { fixedExpenses: [], pendingTransactions: [] } 
        })}
        categoryToDelete={deletionModal.category}
        affectedItems={deletionModal.affectedItems}
        onCategoryDeleted={refreshAfterMutation}
      />
    </div>
  );
};

// Wrapper component that provides the context
const CategoryManager = ({ onDataChange }) => (
  <CategoryProvider onDataChange={onDataChange}>
    <CategoryManagerContent />
  </CategoryProvider>
);

export default CategoryManager;
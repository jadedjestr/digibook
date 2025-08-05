import React, { useState, useEffect } from 'react';
import { logger } from "../utils/logger";
import { Plus, Edit3, Trash2, Save, X } from 'lucide-react';
import { dbHelpers } from '../db/database';

const CategoryManager = ({ onDataChange }) => {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    color: '#3B82F6',
    icon: '📦'
  });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const categoriesData = await dbHelpers.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      logger.error('Error loading categories:', error);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return;

    try {
      // Ensure user-created categories are not marked as default
      const categoryData = {
        ...newCategory,
        isDefault: false
      };
      
      await dbHelpers.addCategory(categoryData);
      setNewCategory({ name: '', color: '#3B82F6', icon: '📦' });
      setIsAdding(false);
      await loadCategories();
      onDataChange();
      logger.success('Category added successfully');
    } catch (error) {
      logger.error('Error adding category:', error);
      alert('Failed to add category. Please try again.');
    }
  };

  const handleUpdateCategory = async (id, updates) => {
    try {
      await dbHelpers.updateCategory(id, updates);
      setEditingId(null);
      await loadCategories();
      onDataChange();
      logger.success('Category updated successfully');
    } catch (error) {
      logger.error('Error updating category:', error);
      alert('Failed to update category. Please try again.');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category? This will affect all expenses using this category.')) {
      return;
    }

    try {
      await dbHelpers.deleteCategory(id);
      await loadCategories();
      onDataChange();
      logger.success('Category deleted successfully');
    } catch (error) {
      logger.error('Error deleting category:', error);
      alert('Failed to delete category. Please try again.');
    }
  };

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', 
    '#EF4444', '#06B6D4', '#84CC16', '#6B7280', '#F97316'
  ];

  const iconOptions = [
    '🏠', '⚡', '🛡️', '🚗', '📱', '💳', '🏥', '🎓', '📦', '🍔',
    '🎬', '🏋️', '✈️', '🎨', '📚', '🎵', '🎮', '💄', '🛍️', '🏠'
  ];

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="glass-loading"></div>
        <p className="text-white/70 mt-4">Loading categories...</p>
      </div>
    );
  }

  if (categories === null) {
    return (
      <div className="text-center py-8">
        <p className="text-white/70">Unable to load categories. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Category Form */}
      {isAdding && (
        <div className="glass-panel border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-primary font-medium">Add New Category</h4>
            <button
              onClick={() => setIsAdding(false)}
              className="p-1 hover:bg-white/10 rounded"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Name</label>
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="glass-input w-full"
                placeholder="Category name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Icon</label>
              <select
                value={newCategory.icon}
                onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                className="glass-input w-full"
              >
                {iconOptions.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Color</label>
              <select
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                className="glass-input w-full"
              >
                {colorOptions.map(color => (
                  <option key={color} value={color} style={{ backgroundColor: color }}>
                    {color}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddCategory}
                className="glass-button flex items-center space-x-2 w-full"
              >
                <Save size={16} />
                <span>Add Category</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact Visual Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {categories.map((category) => (
          <div 
            key={category.id} 
            className="glass-card relative cursor-pointer transition-all duration-200 hover:scale-105"
            style={{ 
              borderLeft: `4px solid ${category.color}`,
              minHeight: '80px'
            }}
          >
            {/* Category Content */}
            <div className="flex flex-col items-center justify-center text-center p-2">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg mb-2"
                style={{ 
                  backgroundColor: category.color + '20', 
                  color: category.color 
                }}
              >
                {category.icon}
              </div>
              <h4 className="text-primary font-medium text-sm truncate w-full">
                {category.name}
              </h4>
              {category.isDefault && (
                <span className="text-xs text-secondary mt-1">Default</span>
              )}
            </div>

            {/* Hover Actions */}
            {!category.isDefault && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(category.id);
                  }}
                  className="p-2 hover:bg-white/20 rounded-full text-blue-400 hover:text-blue-300 transition-colors"
                  title="Edit category"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(category.id);
                  }}
                  className="p-2 hover:bg-white/20 rounded-full text-red-400 hover:text-red-300 transition-colors"
                  title="Delete category"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Category Button */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="glass-button flex items-center justify-center space-x-2 w-full py-3"
        >
          <Plus size={16} />
          <span>Add New Category</span>
        </button>
      )}

      {categories.length === 0 && (
        <div className="text-center py-8 text-secondary">
          <p>No categories found. Add your first category to get started.</p>
        </div>
      )}
    </div>
  );
};

export default CategoryManager; 
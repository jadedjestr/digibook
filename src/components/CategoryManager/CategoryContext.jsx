import React, { createContext, useContext, useReducer } from 'react';
import { categoryReducer, initialState, ACTIONS } from './categoryReducer';
import { dbHelpers } from '../../db/database';
import { notify, showConfirmation } from '../../utils/notifications.jsx';

const CategoryContext = createContext(null);

export const useCategoryContext = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategoryContext must be used within a CategoryProvider');
  }
  return context;
};

export const CategoryProvider = ({ children, onDataChange }) => {
  const [state, dispatch] = useReducer(categoryReducer, initialState);

  // Actions
  const loadCategories = async () => {
    try {
      const categoriesData = await dbHelpers.getCategories();
      dispatch({ type: ACTIONS.SET_CATEGORIES, payload: categoriesData });
    } catch (error) {
      notify.error('Failed to load categories. Please try again.', error);
      dispatch({ type: ACTIONS.SET_CATEGORIES, payload: [] });
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Helper to refresh UI and notify parent after mutations
  const refreshAfterMutation = async () => {
    await loadCategories();
    onDataChange();
  };

  const handleSaveCategory = async (categoryData) => {
    try {
      if (state.formMode === 'add') {
        await dbHelpers.addCategory({ ...categoryData, isDefault: false });
        notify.success('Category added successfully');
      } else {
        await dbHelpers.updateCategory(state.editingCategory.id, categoryData);
        notify.success('Category updated successfully');
      }
      
      dispatch({ type: ACTIONS.RESET_FORM });
      await refreshAfterMutation();
    } catch (error) {
      notify.error(
        state.formMode === 'add' 
          ? 'Failed to add category. Please try again.'
          : 'Failed to update category. Please try again.',
        error
      );
    }
  };

  const handleDeleteCategory = async (category) => {
    try {
      const affectedFixedExpenses = await dbHelpers.getFixedExpenses();
      const affectedPendingTransactions = await dbHelpers.getPendingTransactions();
      
      const filteredFixedExpenses = affectedFixedExpenses.filter(expense => expense.category === category.name);
      const filteredPendingTransactions = affectedPendingTransactions.filter(transaction => transaction.category === category.name);
      
      const totalAffected = filteredFixedExpenses.length + filteredPendingTransactions.length;
      
      if (totalAffected === 0) {
        const confirmed = await showConfirmation(`Are you sure you want to delete "${category.name}"?`);
        if (confirmed) {
          await dbHelpers.deleteCategory(category.id);
          await refreshAfterMutation();
          notify.success('Category deleted successfully');
        }
      } else {
        dispatch({
          type: ACTIONS.SET_DELETION_MODAL,
          payload: {
            isOpen: true,
            category: category,
            affectedItems: {
              fixedExpenses: filteredFixedExpenses,
              pendingTransactions: filteredPendingTransactions
            }
          }
        });
      }
    } catch (error) {
      notify.error('Failed to prepare category deletion. Please try again.', error);
    }
  };

  const value = {
    // State
    categories: state.categories,
    isLoading: state.isLoading,
    formMode: state.formMode,
    editingCategory: state.editingCategory,
    deletionModal: state.deletionModal,

    // Actions
    loadCategories,
    handleSaveCategory,
    handleDeleteCategory,
    refreshAfterMutation,
    
    // Dispatch helpers
    setFormMode: (mode) => dispatch({ type: ACTIONS.SET_FORM_MODE, payload: mode }),
    setEditingCategory: (category) => dispatch({ type: ACTIONS.SET_EDITING_CATEGORY, payload: category }),
    setDeletionModal: (modalState) => dispatch({ type: ACTIONS.SET_DELETION_MODAL, payload: modalState }),
    resetForm: () => dispatch({ type: ACTIONS.RESET_FORM })
  };

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};

export default CategoryContext;

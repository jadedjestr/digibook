import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useState,
  useEffect,
} from 'react';

import { useGlobalCategories } from '../../contexts/GlobalCategoryContext';
import { dbHelpers } from '../../db/database-clean';
import { notify, showConfirmation } from '../../utils/notifications.jsx';

import { categoryReducer, initialState, ACTIONS } from './categoryReducer';

const CategoryContext = createContext(null);

export const useCategoryContext = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error(
      'useCategoryContext must be used within a CategoryProvider'
    );
  }
  return context;
};

export const CategoryProvider = ({ children, onDataChange }) => {
  const [state, dispatch] = useReducer(categoryReducer, initialState);
  const [operationLoading, setOperationLoading] = useState({
    saving: false,
    deleting: false,
    loading: false,
  });

  // Use global category service
  const globalCategories = useGlobalCategories();

  // Actions - memoized with useCallback
  const loadCategories = useCallback(async () => {
    try {
      setOperationLoading(prev => ({ ...prev, loading: true }));
      const categoriesData = await globalCategories.getCategories();
      dispatch({ type: ACTIONS.SET_CATEGORIES, payload: categoriesData });
    } catch (error) {
      notify.error('Failed to load categories. Please try again.', error);
      dispatch({ type: ACTIONS.SET_CATEGORIES, payload: [] });
    } finally {
      setOperationLoading(prev => ({ ...prev, loading: false }));
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  }, [globalCategories]);

  // Helper to refresh UI and notify parent after mutations
  const refreshAfterMutation = useCallback(async () => {
    await loadCategories();
    onDataChange();
  }, [loadCategories, onDataChange]);

  const handleSaveCategory = useCallback(
    async categoryData => {
      try {
        setOperationLoading(prev => ({ ...prev, saving: true }));

        // Optimistic update - add to local state immediately
        const optimisticCategory = {
          ...categoryData,
          id:
            state.formMode === 'add'
              ? `temp-${Date.now()}`
              : state.editingCategory.id,
          isDefault: false,
          createdAt: new Date().toISOString(),
        };

        if (state.formMode === 'add') {
          // Optimistically add to categories
          dispatch({
            type: ACTIONS.ADD_CATEGORY_OPTIMISTIC,
            payload: optimisticCategory,
          });

          try {
            const id = await globalCategories.addCategory({
              ...categoryData,
              isDefault: false,
            });

            // Replace optimistic category with real one
            dispatch({
              type: ACTIONS.CONFIRM_CATEGORY_ADD,
              payload: { ...optimisticCategory, id },
            });
          } catch (error) {
            // Revert optimistic update on error
            dispatch({
              type: ACTIONS.REVERT_CATEGORY_ADD,
              payload: optimisticCategory.id,
            });
            throw error;
          }
        } else {
          // Optimistically update category
          dispatch({
            type: ACTIONS.UPDATE_CATEGORY_OPTIMISTIC,
            payload: { id: state.editingCategory.id, updates: categoryData },
          });

          try {
            await globalCategories.updateCategory(
              state.editingCategory.id,
              categoryData
            );

            // Confirm optimistic update
            dispatch({
              type: ACTIONS.CONFIRM_CATEGORY_UPDATE,
              payload: { id: state.editingCategory.id, updates: categoryData },
            });
          } catch (error) {
            // Revert optimistic update on error
            dispatch({
              type: ACTIONS.REVERT_CATEGORY_UPDATE,
              payload: {
                id: state.editingCategory.id,
                originalData: state.editingCategory,
              },
            });
            throw error;
          }
        }

        dispatch({ type: ACTIONS.RESET_FORM });
        onDataChange(); // Notify parent of change
      } catch (error) {
        notify.error(
          state.formMode === 'add'
            ? 'Failed to add category. Please try again.'
            : 'Failed to update category. Please try again.',
          error
        );
      } finally {
        setOperationLoading(prev => ({ ...prev, saving: false }));
      }
    },
    [state.formMode, state.editingCategory, globalCategories, onDataChange]
  );

  const handleDeleteCategory = useCallback(
    async category => {
      try {
        setOperationLoading(prev => ({ ...prev, deleting: true }));

        // Use optimized queries instead of loading all data
        const [filteredFixedExpenses, filteredPendingTransactions] =
          await Promise.all([
            dbHelpers.getExpensesByCategory(category.name),
            dbHelpers.getTransactionsByCategory(category.name),
          ]);

        const totalAffected =
          filteredFixedExpenses.length + filteredPendingTransactions.length;

        if (totalAffected === 0) {
          const confirmed = await showConfirmation(
            `Are you sure you want to delete "${category.name}"?`
          );
          if (confirmed) {
            await globalCategories.deleteCategory(category.id);
            await refreshAfterMutation();
          }
        } else {
          dispatch({
            type: ACTIONS.SET_DELETION_MODAL,
            payload: {
              isOpen: true,
              category,
              affectedItems: {
                fixedExpenses: filteredFixedExpenses,
                pendingTransactions: filteredPendingTransactions,
              },
            },
          });
        }
      } catch (error) {
        notify.error(
          'Failed to prepare category deletion. Please try again.',
          error
        );
      } finally {
        setOperationLoading(prev => ({ ...prev, deleting: false }));
      }
    },
    [globalCategories, refreshAfterMutation]
  );

  // Memoized dispatch helpers
  const setFormMode = useCallback(
    mode => dispatch({ type: ACTIONS.SET_FORM_MODE, payload: mode }),
    []
  );
  const setEditingCategory = useCallback(
    category =>
      dispatch({ type: ACTIONS.SET_EDITING_CATEGORY, payload: category }),
    []
  );
  const setDeletionModal = useCallback(
    modalState =>
      dispatch({ type: ACTIONS.SET_DELETION_MODAL, payload: modalState }),
    []
  );
  const resetForm = useCallback(
    () => dispatch({ type: ACTIONS.RESET_FORM }),
    []
  );

  // Memoized context value
  const value = useMemo(
    () => ({
      // State
      categories: state.categories,
      isLoading: state.isLoading,
      operationLoading,
      formMode: state.formMode,
      editingCategory: state.editingCategory,
      deletionModal: state.deletionModal,

      // Actions
      loadCategories,
      handleSaveCategory,
      handleDeleteCategory,
      refreshAfterMutation,

      // Dispatch helpers
      setFormMode,
      setEditingCategory,
      setDeletionModal,
      resetForm,
    }),
    [
      state.categories,
      state.isLoading,
      operationLoading,
      state.formMode,
      state.editingCategory,
      state.deletionModal,
      loadCategories,
      handleSaveCategory,
      handleDeleteCategory,
      refreshAfterMutation,
      setFormMode,
      setEditingCategory,
      setDeletionModal,
      resetForm,
    ]
  );

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};

export default CategoryContext;

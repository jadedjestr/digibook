import PropTypes from 'prop-types';
import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useState,
} from 'react';

import { useGlobalCategories } from '../../contexts/GlobalCategoryContext';
import { dbHelpers } from '../../db/database-clean';
import { categoryUsageCache } from '../../services/categoryUsageCache';
import { notify, showConfirmation } from '../../utils/notifications.jsx';

import { categoryReducer, initialState, ACTIONS } from './categoryReducer';
import CategoryRenameModal from './CategoryRenameModal';

const CategoryContext = createContext(null);

export const useCategoryContext = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error(
      'useCategoryContext must be used within a CategoryProvider',
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
    // Invalidate usage cache since categories or their usage may have changed
    categoryUsageCache.invalidate();
    await loadCategories();
    await onDataChange();
  }, [loadCategories, onDataChange]);

  const handleSaveCategory = useCallback(
    async categoryData => {
      try {
        setOperationLoading(prev => ({ ...prev, saving: true }));

        // Check if this is a default category and name is being changed
        if (
          state.formMode === 'edit' &&
          state.editingCategory?.isDefault &&
          categoryData.name !== state.editingCategory.name
        ) {
          notify.error(
            'Default category names cannot be changed. Create a custom category instead.',
          );
          setOperationLoading(prev => ({ ...prev, saving: false }));
          return;
        }

        // Check if name is being changed (rename scenario)
        if (
          state.formMode === 'edit' &&
          categoryData.name !== state.editingCategory.name
        ) {
          // Check affected items
          const [filteredFixedExpenses, filteredPendingTransactions] =
            await Promise.all([
              dbHelpers.getExpensesByCategory(state.editingCategory.name),
              dbHelpers.getTransactionsByCategory(state.editingCategory.name),
            ]);

          // Show rename modal
          dispatch({
            type: ACTIONS.SET_RENAME_MODAL,
            payload: {
              isOpen: true,
              category: state.editingCategory,
              oldName: state.editingCategory.name,
              newName: categoryData.name,
              affectedItems: {
                fixedExpenses: filteredFixedExpenses,
                pendingTransactions: filteredPendingTransactions,
              },
            },
          });

          setOperationLoading(prev => ({ ...prev, saving: false }));
          return;
        }

        // Optimistic update - add to local state immediately
        const optimisticCategory = {
          ...categoryData,
          id:
            state.formMode === 'add'
              ? `temp-${Date.now()}`
              : state.editingCategory.id,
          isDefault:
            state.formMode === 'edit' ? state.editingCategory.isDefault : false,
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
              categoryData,
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

        // Invalidate usage cache when category is added or updated
        categoryUsageCache.invalidate();
        dispatch({ type: ACTIONS.RESET_FORM });
        await onDataChange(); // Notify parent of change
      } catch (error) {
        notify.error(
          state.formMode === 'add'
            ? 'Failed to add category. Please try again.'
            : 'Failed to update category. Please try again.',
          error,
        );
      } finally {
        setOperationLoading(prev => ({ ...prev, saving: false }));
      }
    },
    [state.formMode, state.editingCategory, globalCategories, onDataChange],
  );

  // Handle category rename
  const handleRenameCategory = useCallback(async () => {
    const { category, oldName, newName } = state.renameModal;
    try {
      setOperationLoading(prev => ({ ...prev, saving: true }));
      await dbHelpers.renameCategory(category.id, oldName, newName);

      // Invalidate usage cache
      categoryUsageCache.invalidate();
      await refreshAfterMutation();
      dispatch({ type: ACTIONS.RESET_FORM });
      dispatch({
        type: ACTIONS.SET_RENAME_MODAL,
        payload: {
          isOpen: false,
          category: null,
          oldName: '',
          newName: '',
          affectedItems: { fixedExpenses: [], pendingTransactions: [] },
        },
      });
    } finally {
      // Always reset operation loading state, even on error
      setOperationLoading(prev => ({ ...prev, saving: false }));
    }
  }, [state.renameModal, refreshAfterMutation]);

  const handleDeleteCategory = useCallback(
    async category => {
      try {
        setOperationLoading(prev => ({ ...prev, deleting: true }));

        // Prevent deletion of default categories
        if (category.isDefault) {
          notify.error(
            'Default categories cannot be deleted. You can hide them by creating custom categories.',
          );
          setOperationLoading(prev => ({ ...prev, deleting: false }));
          return;
        }

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
            `Are you sure you want to delete "${category.name}"?`,
          );
          if (confirmed) {
            await globalCategories.deleteCategory(category.id);

            // Invalidate usage cache for deleted category
            categoryUsageCache.invalidateCategory(category.name);
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
          error,
        );
      } finally {
        setOperationLoading(prev => ({ ...prev, deleting: false }));
      }
    },
    [globalCategories, refreshAfterMutation],
  );

  // Bulk deletion handler that checks affected items
  const handleBulkDeleteCategories = useCallback(
    async categoryIds => {
      try {
        setOperationLoading(prev => ({ ...prev, deleting: true }));

        // Get all categories to check
        const categoriesToCheck = state.categories.filter(cat =>
          categoryIds.includes(cat.id),
        );

        // Filter out default categories
        const defaultCategories = categoriesToCheck.filter(
          cat => cat.isDefault,
        );
        const customCategories = categoriesToCheck.filter(
          cat => !cat.isDefault,
        );

        if (defaultCategories.length > 0) {
          notify.warning(
            `${defaultCategories.length} default categor${defaultCategories.length > 1 ? 'ies were' : 'y was'} skipped (cannot be deleted)`,
          );
        }

        // Check affected items for custom categories only
        const categoryChecks = await Promise.all(
          customCategories.map(async category => {
            const [filteredFixedExpenses, filteredPendingTransactions] =
              await Promise.all([
                dbHelpers.getExpensesByCategory(category.name),
                dbHelpers.getTransactionsByCategory(category.name),
              ]);

            const totalAffected =
              filteredFixedExpenses.length + filteredPendingTransactions.length;

            return {
              category,
              affectedItems: {
                fixedExpenses: filteredFixedExpenses,
                pendingTransactions: filteredPendingTransactions,
              },
              totalAffected,
            };
          }),
        );

        // Group categories by deletion type
        const safeToDelete = categoryChecks
          .filter(check => check.totalAffected === 0)
          .map(check => check.category);

        const needsReassignment = categoryChecks.filter(
          check => check.totalAffected > 0,
        );

        return {
          safeToDelete,
          needsReassignment: needsReassignment.map(check => ({
            category: check.category,
            affectedItems: check.affectedItems,
          })),
        };
      } catch (error) {
        notify.error(
          'Failed to check affected items. Please try again.',
          error,
        );
        throw error;
      } finally {
        setOperationLoading(prev => ({ ...prev, deleting: false }));
      }
    },
    [state.categories],
  );

  // Memoized dispatch helpers
  const setFormMode = useCallback(
    mode => dispatch({ type: ACTIONS.SET_FORM_MODE, payload: mode }),
    [],
  );
  const setEditingCategory = useCallback(
    category =>
      dispatch({ type: ACTIONS.SET_EDITING_CATEGORY, payload: category }),
    [],
  );
  const setDeletionModal = useCallback(
    modalState =>
      dispatch({ type: ACTIONS.SET_DELETION_MODAL, payload: modalState }),
    [],
  );
  const setRenameModal = useCallback(
    modalState =>
      dispatch({ type: ACTIONS.SET_RENAME_MODAL, payload: modalState }),
    [],
  );
  const resetForm = useCallback(
    () => dispatch({ type: ACTIONS.RESET_FORM }),
    [],
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
      renameModal: state.renameModal,

      // Actions
      loadCategories,
      handleSaveCategory,
      handleDeleteCategory,
      handleBulkDeleteCategories,
      handleRenameCategory,
      refreshAfterMutation,

      // Dispatch helpers
      setFormMode,
      setEditingCategory,
      setDeletionModal,
      setRenameModal,
      resetForm,
    }),
    [
      state.categories,
      state.isLoading,
      operationLoading,
      state.formMode,
      state.editingCategory,
      state.deletionModal,
      state.renameModal,
      loadCategories,
      handleSaveCategory,
      handleDeleteCategory,
      handleBulkDeleteCategories,
      handleRenameCategory,
      refreshAfterMutation,
      setFormMode,
      setEditingCategory,
      setDeletionModal,
      setRenameModal,
      resetForm,
    ],
  );

  return (
    <CategoryContext.Provider value={value}>
      {children}
      <CategoryRenameModal
        isOpen={state.renameModal.isOpen}
        onClose={() => {
          dispatch({
            type: ACTIONS.SET_RENAME_MODAL,
            payload: {
              isOpen: false,
              category: null,
              oldName: '',
              newName: '',
              affectedItems: { fixedExpenses: [], pendingTransactions: [] },
            },
          });
        }}
        category={state.renameModal.category}
        oldName={state.renameModal.oldName}
        newName={state.renameModal.newName}
        affectedItems={state.renameModal.affectedItems}
        onRename={handleRenameCategory}
      />
    </CategoryContext.Provider>
  );
};

CategoryProvider.propTypes = {
  children: PropTypes.node.isRequired,
  onDataChange: PropTypes.func.isRequired,
};

export default CategoryContext;

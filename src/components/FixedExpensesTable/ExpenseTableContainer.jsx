import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

import { useExpenseOperations } from '../../hooks/useExpenseOperations';
import { useMemoizedCalculations } from '../../hooks/useMemoizedCalculations';
import { usePaycheckCalculations } from '../../hooks/usePaycheckCalculations';
import {
  useCollapsedCategories,
  useSortPreference,
  useAutoCollapsePreference,
  useShowOnlyUnpaidPreference,
  useExpenseTypeFilter,
} from '../../hooks/usePersistedState';
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  regenerateUnpaidOccurrences,
} from '../../services/recurringExpenseService';
import {
  useAccounts,
  useCategories,
  useCreditCards,
  useFixedExpenses,
  useIsLoading,
  useIsPanelOpen,
  usePaycheckSettings,
  useReloadExpenses,
  useSetPanelOpen,
} from '../../stores/useAppStore';
import { createCategoryMap } from '../../utils/categoryUtils';
import {
  groupExpensesByCategory,
  computeFixedExpenseTotals,
  computeCategoryTotals,
} from '../../utils/expenseUtils';
import { logger } from '../../utils/logger';
import AccountValidationAlert from '../AccountValidationAlert';
import AddExpensePanel from '../AddExpensePanel';
import DuplicateExpenseModal from '../DuplicateExpenseModal';
import EmptyState from '../EmptyState';
import FixedExpensesEmptyIllustration from '../illustrations/FixedExpensesEmptyIllustration';
import RecurringExpenseModal from '../RecurringExpenseModal';

import ExpenseCategoryGroup from './ExpenseCategoryGroup';
import ExpenseTableHeader from './ExpenseTableHeader';

// Initialization State Machine
const INIT_STATES = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

/**
 * Main container component for the Fixed Expenses Table
 * Now uses Zustand store for state management instead of props
 */
const ExpenseTableContainer = ({
  expensesOverride,
  onCategoryClick,
  headerVariant = 'full',
}) => {
  // 🔧 ROBUST INITIALIZATION STATE MACHINE
  const [initState, setInitState] = useState(INIT_STATES.LOADING);
  const [initError, setInitError] = useState(null);

  // Core state - initialized with safe defaults
  const [newExpenseId, setNewExpenseId] = useState(null);
  const [duplicatingExpense, setDuplicatingExpense] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [updatingExpenseId, setUpdatingExpenseId] = useState(null);
  const updateInProgressRef = useRef(new Set());
  const [invalidExpenses, setInvalidExpenses] = useState([]);
  const [editingRecurringTemplate, setEditingRecurringTemplate] =
    useState(null);
  const [showEditRecurringModal, setShowEditRecurringModal] = useState(false);

  // 🔧 SIMPLIFIED PERSISTED STATE - No complex manual overrides
  const {
    value: collapsedCategories,
    setValue: setCollapsedCategories,
    isLoaded: collapsedLoaded,
  } = useCollapsedCategories();
  const {
    value: sortBy,
    setValue: setSortBy,
    isLoaded: sortLoaded,
  } = useSortPreference();
  const { isLoaded: autoCollapseLoaded } = useAutoCollapsePreference();
  const {
    value: showOnlyUnpaid,
    setValue: setShowOnlyUnpaid,
    isLoaded: showOnlyUnpaidLoaded,
  } = useShowOnlyUnpaidPreference();
  const {
    value: expenseTypeFilter,
    setValue: setExpenseTypeFilter,
    isLoaded: expenseTypeFilterLoaded,
  } = useExpenseTypeFilter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
  );

  // Use Zustand store for data
  const accounts = useAccounts();
  const creditCards = useCreditCards();
  const storeFixedExpenses = useFixedExpenses();
  const categories = useCategories();
  const paycheckSettings = usePaycheckSettings();
  const isPanelOpen = useIsPanelOpen();
  const isLoading = useIsLoading();
  const setPanelOpen = useSetPanelOpen();
  const reloadExpenses = useReloadExpenses();

  const fixedExpenses = expensesOverride ?? storeFixedExpenses;

  // Use custom hooks for operations
  const { updateExpense, deleteExpense, duplicateExpense, markAsPaid } =
    useExpenseOperations();

  const { paycheckService, paycheckDates } =
    usePaycheckCalculations(paycheckSettings);

  // 🔧 ROBUST INITIALIZATION PROCESS
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        setInitState(INIT_STATES.LOADING);
        setInitError(null);

        // Wait for persisted preferences to load
        const checkPreferencesLoaded = () => {
          return (
            collapsedLoaded &&
            sortLoaded &&
            autoCollapseLoaded &&
            showOnlyUnpaidLoaded &&
            expenseTypeFilterLoaded
          );
        };

        // Wait for preferences with timeout
        let attempts = 0;
        while (!checkPreferencesLoaded() && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (checkPreferencesLoaded()) {
          // Preferences loaded successfully
        } else {
          // Preferences loading timed out, continuing with current values
        }

        // Step 3: Mark as ready
        setInitState(INIT_STATES.READY);
      } catch (error) {
        setInitError(error.message);
        setInitState(INIT_STATES.ERROR);
      }
    };

    initializeComponent();
  }, [
    collapsedLoaded,
    sortLoaded,
    autoCollapseLoaded,
    showOnlyUnpaidLoaded,
    expenseTypeFilterLoaded,
  ]);

  // Apply expense type filter
  const filteredExpenses = useMemo(() => {
    if (!fixedExpenses) return [];
    if (expenseTypeFilter === 'all') return fixedExpenses;

    return fixedExpenses.filter(expense => {
      const isRecurring =
        expense.recurringTemplateId !== null &&
        expense.recurringTemplateId !== undefined;

      if (expenseTypeFilter === 'recurring') return isRecurring;
      if (expenseTypeFilter === 'oneoff') return !isRecurring;
      return true;
    });
  }, [fixedExpenses, expenseTypeFilter]);

  // Recalculate expensesByCategory with filtered expenses (shared helper)
  const filteredExpensesByCategory = useMemo(
    () => groupExpensesByCategory(filteredExpenses),
    [filteredExpenses],
  );

  // Totals and category totals from filtered expenses (shared helpers)
  const _totals = useMemo(
    () => computeFixedExpenseTotals(filteredExpenses),
    [filteredExpenses],
  );
  const _categoryTotals = useMemo(
    () => computeCategoryTotals(filteredExpensesByCategory),
    [filteredExpensesByCategory],
  );

  // Use memoized calculations for sorting
  const { getSortedExpenses } = useMemoizedCalculations(
    filteredExpenses || [],
    accounts,
    creditCards,
    paycheckSettings,
  );

  // 🔧 SAFE DATA PROCESSING - Use memoized calculations with filtered expenses
  const groupedExpenses = useMemo(() => {
    if (!filteredExpensesByCategory) {
      return {};
    }

    try {
      // Sort each category's expenses using memoized function
      const sortedGroups = {};
      Object.entries(filteredExpensesByCategory).forEach(
        ([category, expenses]) => {
          sortedGroups[category] = getSortedExpenses(expenses, sortBy);
        },
      );

      return sortedGroups;
    } catch (error) {
      return {};
    }
  }, [filteredExpensesByCategory, sortBy, getSortedExpenses]);

  // Validate account references when data changes
  useEffect(() => {
    if (fixedExpenses && accounts && creditCards) {
      const allValidAccountIds = new Set([
        ...accounts.map(acc => acc.id),
        ...creditCards.map(card => card.id),
      ]);

      const invalid = fixedExpenses.filter(
        expense =>
          expense.accountId && !allValidAccountIds.has(expense.accountId),
      );

      setInvalidExpenses(invalid);
    }
  }, [fixedExpenses, accounts, creditCards]);

  // Create categoryMap for O(1) lookups
  const categoryMap = useMemo(
    () => createCategoryMap(categories),
    [categories],
  );

  // Calculate total for a category
  const getCategoryTotal = useCallback(categoryExpenses => {
    return categoryExpenses.reduce((total, expense) => {
      const remaining = expense.amount - (expense.paidAmount || 0);
      return total + (remaining > 0 ? remaining : 0);
    }, 0);
  }, []);

  // Handle expense updates using the custom hook
  const handleUpdateExpense = useCallback(
    async (id, updates) => {
      if (updateInProgressRef.current.has(id)) {
        logger.debug(
          `FixedExpensesTable: Update already in progress for expense ${id}, skipping`,
        );
        return;
      }

      try {
        updateInProgressRef.current.add(id);
        setUpdatingExpenseId(id);

        await updateExpense(id, updates);
      } catch (error) {
        logger.error('Error updating expense:', error);
      } finally {
        updateInProgressRef.current.delete(id);
        setUpdatingExpenseId(null);
      }
    },
    [updateExpense],
  );

  // Handle marking expense as paid
  const handleMarkAsPaid = useCallback(
    async expenseId => {
      await markAsPaid(expenseId);
    },
    [markAsPaid],
  );

  // Handle expense deletion
  const handleDeleteExpense = useCallback(
    async expenseId => {
      await deleteExpense(expenseId);
    },
    [deleteExpense],
  );

  // Handle expense duplication
  const handleDuplicate = useCallback(
    async (originalExpense, duplicateData) => {
      const newId = await duplicateExpense(originalExpense, duplicateData);
      setNewExpenseId(newId);
    },
    [duplicateExpense],
  );

  // Handle editing recurring expense template
  const handleEditRecurring = useCallback(async expense => {
    if (!expense.recurringTemplateId) {
      logger.error('Expense does not have a recurring template ID');
      return;
    }

    try {
      const template = await getTemplate(expense.recurringTemplateId);
      if (!template) {
        logger.error('Template not found');
        return;
      }

      setEditingRecurringTemplate(template);
      setShowEditRecurringModal(true);
    } catch (error) {
      logger.error('Error loading template for editing:', error);
    }
  }, []);

  // Handle saving edited recurring template
  const handleSaveEditRecurring = useCallback(
    async recurringData => {
      if (!editingRecurringTemplate) return;

      try {
        // Map modal form data to template update format
        // Use explicit null/undefined checks instead of falsy checks to handle 0 values correctly
        const parsedAmount = recurringData.amount
          ? parseFloat(recurringData.amount)
          : null;
        const updateData = {
          name: recurringData.name,
          baseAmount:
            parsedAmount !== null && !isNaN(parsedAmount)
              ? parsedAmount
              : editingRecurringTemplate.baseAmount,
          category: recurringData.category || editingRecurringTemplate.category,
          accountId: recurringData.paymentSource?.accountId || null,
          creditCardId: recurringData.paymentSource?.creditCardId || null,
          targetCreditCardId: recurringData.targetCreditCardId || null, // For credit card payments
          frequency: recurringData.frequency,
          intervalValue: recurringData.intervalValue || 1,
          intervalUnit: recurringData.intervalUnit || 'months',
          startDate: recurringData.startDate,
          endDate: recurringData.endDate || null,
          isVariableAmount: recurringData.isVariableAmount || false,
          notes: recurringData.notes || '',
        };

        await updateTemplate(editingRecurringTemplate.id, updateData);

        // Regenerate unpaid future occurrences with updated template data
        try {
          await regenerateUnpaidOccurrences(editingRecurringTemplate.id);
          logger.success(
            'Regenerated unpaid future occurrences with updated template data',
          );
        } catch (error) {
          logger.warn(
            'Could not regenerate unpaid occurrences after template update:',
            error,
          );

          // Don't fail the entire operation if regeneration fails
        }

        setShowEditRecurringModal(false);
        setEditingRecurringTemplate(null);
        await reloadExpenses();
      } catch (error) {
        logger.error('Error updating recurring template:', error);
        throw error;
      }
    },
    [editingRecurringTemplate, reloadExpenses],
  );

  // Handle pausing/resuming recurring template
  const handleTogglePauseRecurring = useCallback(async () => {
    if (!editingRecurringTemplate) return;

    try {
      await updateTemplate(editingRecurringTemplate.id, {
        isActive: !editingRecurringTemplate.isActive,
      });
      setShowEditRecurringModal(false);
      setEditingRecurringTemplate(null);
      await reloadExpenses();
    } catch (error) {
      logger.error('Error toggling template pause state:', error);
    }
  }, [editingRecurringTemplate, reloadExpenses]);

  // Handle deleting recurring template
  const handleDeleteRecurringTemplate = useCallback(async () => {
    if (!editingRecurringTemplate) return;

    if (
      !window.confirm(
        'Are you sure you want to delete this recurring template? This will stop generating future expenses, but existing expenses will remain.',
      )
    ) {
      return;
    }

    try {
      await deleteTemplate(editingRecurringTemplate.id);
      setShowEditRecurringModal(false);
      setEditingRecurringTemplate(null);
      await reloadExpenses();
    } catch (error) {
      logger.error('Error deleting recurring template:', error);
    }
  }, [editingRecurringTemplate, reloadExpenses]);

  // Handle drag and drop
  const handleDragStart = useCallback(event => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    async event => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const expenseId = active.id;
      const newCategory = over.id;

      if (newCategory && newCategory !== 'expense-table') {
        const expense = fixedExpenses.find(e => e.id === expenseId);
        if (expense && expense.category !== newCategory) {
          await handleUpdateExpense(expenseId, { category: newCategory });
        }
      }
    },
    [fixedExpenses, handleUpdateExpense],
  );

  // Extracted JSX handlers — stable refs for child components
  const handleExpenseAdded = useCallback(
    async newExpenseId => {
      if (newExpenseId) {
        setNewExpenseId(newExpenseId);
        await reloadExpenses();
      }
    },
    [reloadExpenses],
  );

  const handleAddPanelDataChange = useCallback(
    async newExpenseId => {
      if (
        newExpenseId &&
        typeof newExpenseId === 'string' &&
        newExpenseId.trim().length > 0
      ) {
        setNewExpenseId(newExpenseId);
      }
      await reloadExpenses();
    },
    [reloadExpenses],
  );

  const handleCloseRecurringModal = useCallback(() => {
    setShowEditRecurringModal(false);
    setEditingRecurringTemplate(null);
  }, []);

  // Loading state
  if (initState === INIT_STATES.LOADING || isLoading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='text-white/70'>Loading expenses...</div>
      </div>
    );
  }

  // Error state
  if (initState === INIT_STATES.ERROR) {
    return (
      <div className='text-center p-8'>
        <div className='text-red-400 mb-4'>Error loading expenses</div>
        <div className='text-white/70 text-sm'>{initError}</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Account Validation Alert */}
      {invalidExpenses.length > 0 && (
        <AccountValidationAlert
          invalidExpenses={invalidExpenses}
          onFix={() => window.location.reload()} // Simple fix for now
        />
      )}

      {/* Table Header */}
      <ExpenseTableHeader
        expenses={filteredExpenses}
        groupedExpenses={groupedExpenses}
        totals={_totals}
        categoryTotals={_categoryTotals}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showOnlyUnpaid={showOnlyUnpaid}
        setShowOnlyUnpaid={setShowOnlyUnpaid}
        expenseTypeFilter={expenseTypeFilter}
        setExpenseTypeFilter={setExpenseTypeFilter}
        setIsPanelOpen={setPanelOpen}
        onCategoryClick={onCategoryClick}
        variant={headerVariant}
      />

      {/* Main Table Content */}
      {fixedExpenses && fixedExpenses.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className='space-y-6'>
            {Object.entries(groupedExpenses).map(
              ([categoryName, categoryExpenses]) => (
                <ExpenseCategoryGroup
                  key={categoryName}
                  categoryName={categoryName}
                  categoryExpenses={categoryExpenses}
                  categoryMap={categoryMap}
                  collapsedCategories={collapsedCategories}
                  setCollapsedCategories={setCollapsedCategories}
                  getCategoryTotal={getCategoryTotal}
                  paycheckService={paycheckService}
                  paycheckDates={paycheckDates}
                  accounts={accounts}
                  creditCards={creditCards}
                  newExpenseId={newExpenseId}
                  updatingExpenseId={updatingExpenseId}
                  onMarkAsPaid={handleMarkAsPaid}
                  onDuplicate={setDuplicatingExpense}
                  onDelete={handleDeleteExpense}
                  onUpdateExpense={handleUpdateExpense}
                  onEditRecurring={handleEditRecurring}
                  onExpenseAdded={handleExpenseAdded}
                  activeId={activeId}
                />
              ),
            )}
          </div>
        </DndContext>
      ) : (
        <EmptyState
          illustration={<FixedExpensesEmptyIllustration />}
          title='No expenses yet'
          subtitle='Add recurring expenses to plan your monthly budget'
          action={{
            label: 'Add Your First Expense',
            onClick: () => setPanelOpen(true),
          }}
        />
      )}

      {/* Duplicate Modal */}
      {duplicatingExpense && (
        <DuplicateExpenseModal
          expense={duplicatingExpense}
          onClose={() => setDuplicatingExpense(null)}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* Add Expense Panel */}
      <AddExpensePanel
        isOpen={isPanelOpen}
        onClose={() => setPanelOpen(false)}
        accounts={accounts}
        creditCards={creditCards}
        onDataChange={handleAddPanelDataChange}
      />

      {/* Edit Recurring Template Modal */}
      {editingRecurringTemplate && (
        <RecurringExpenseModal
          isOpen={showEditRecurringModal}
          onClose={handleCloseRecurringModal}
          mode='edit'
          templateId={editingRecurringTemplate.id}
          initialData={editingRecurringTemplate}
          onSave={handleSaveEditRecurring}
          onPause={handleTogglePauseRecurring}
          onDelete={handleDeleteRecurringTemplate}
          accounts={accounts}
          creditCards={creditCards}
        />
      )}
    </div>
  );
};

ExpenseTableContainer.propTypes = {
  expensesOverride: PropTypes.arrayOf(PropTypes.object),
  onCategoryClick: PropTypes.func,
  headerVariant: PropTypes.oneOf(['full', 'minimal']),
};

ExpenseTableContainer.defaultProps = {
  expensesOverride: undefined,
  headerVariant: 'full',
};

export default ExpenseTableContainer;

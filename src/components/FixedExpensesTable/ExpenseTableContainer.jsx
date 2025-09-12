import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';

import { useExpenseOperations } from '../../hooks/useExpenseOperations';
import { useMemoizedCalculations } from '../../hooks/useMemoizedCalculations';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import {
  useCollapsedCategories,
  useSortPreference,
  useAutoCollapsePreference,
  useShowOnlyUnpaidPreference,
} from '../../hooks/usePersistedState';
import { PaycheckService } from '../../services/paycheckService';
import { useAppStore } from '../../stores/useAppStore';
import { logger } from '../../utils/logger';
import AddExpensePanel from '../AddExpensePanel';
import DuplicateExpenseModal from '../DuplicateExpenseModal';

import ExpenseCategoryGroup from './ExpenseCategoryGroup';
import ExpenseTableHeader from './ExpenseTableHeader';
import VirtualizedExpenseTable from './VirtualizedExpenseTable';
import VirtualizedMobileView from './VirtualizedMobileView';

import AccountValidationAlert from '../AccountValidationAlert';

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
const ExpenseTableContainer = () => {
  // 🔧 ROBUST INITIALIZATION STATE MACHINE
  const [initState, setInitState] = useState(INIT_STATES.LOADING);
  const [initError, setInitError] = useState(null);

  // Core state - initialized with safe defaults
  const [editingId, setEditingId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [newExpenseId, setNewExpenseId] = useState(null);
  const [duplicatingExpense, setDuplicatingExpense] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [updatingExpenseId, setUpdatingExpenseId] = useState(null);
  const [updateInProgress, setUpdateInProgress] = useState(new Set());
  const [invalidExpenses, setInvalidExpenses] = useState([]);

  // Performance monitoring
  const { startRender, endRender, getPerformanceData } = usePerformanceMonitor(
    'ExpenseTableContainer',
    {
      trackRenders: true,
      trackMemory: true,
      logThreshold: 16,
    }
  );

  // Virtual scrolling refs
  const scrollRefs = useRef({});

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
  const {
    value: autoCollapseEnabled,
    setValue: setAutoCollapseEnabled,
    isLoaded: autoCollapseLoaded,
  } = useAutoCollapsePreference();
  const {
    value: showOnlyUnpaid,
    setValue: setShowOnlyUnpaid,
    isLoaded: showOnlyUnpaidLoaded,
  } = useShowOnlyUnpaidPreference();

  const [dropAnimation, setDropAnimation] = useState({
    duration: 250,
    easing: 'ease-in-out',
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  // Use Zustand store for data
  const {
    accounts,
    creditCards,
    fixedExpenses,
    categories,
    paycheckSettings,
    isPanelOpen,
    isLoading,
    setPanelOpen,
    reloadExpenses,
  } = useAppStore();

  // Use custom hooks for operations
  const { updateExpense, deleteExpense, duplicateExpense, markAsPaid } =
    useExpenseOperations();

  // Use memoized calculations for performance
  const {
    expensesByCategory,
    totals,
    categoryTotals,
    getFilteredExpenses,
    getSortedExpenses,
  } = useMemoizedCalculations(
    fixedExpenses,
    accounts,
    creditCards,
    paycheckSettings
  );

  const paycheckService = new PaycheckService(paycheckSettings);
  const paycheckDates = paycheckService.calculatePaycheckDates();

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
            showOnlyUnpaidLoaded
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
  }, [collapsedLoaded, sortLoaded, autoCollapseLoaded, showOnlyUnpaidLoaded]);

  // Sorting helpers - MUST be defined BEFORE useMemo that uses them
  const sortByDueDate = (a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;

    // Parse as local dates to avoid timezone shifts
    const dateA = new Date(`${a.dueDate}T00:00:00`);
    const dateB = new Date(`${b.dueDate}T00:00:00`);
    return dateA - dateB;
  };

  const sortByName = (a, b) => {
    return a.name.localeCompare(b.name);
  };

  // 🔧 SAFE DATA PROCESSING - Use memoized calculations
  const groupedExpenses = useMemo(() => {
    if (!expensesByCategory) {
      return {};
    }

    try {
      // Sort each category's expenses using memoized function
      const sortedGroups = {};
      Object.entries(expensesByCategory).forEach(([category, expenses]) => {
        sortedGroups[category] = getSortedExpenses(expenses, sortBy);
      });

      return sortedGroups;
    } catch (error) {
      return {};
    }
  }, [expensesByCategory, sortBy, getSortedExpenses]);

  // Validate account references when data changes
  useEffect(() => {
    if (fixedExpenses && accounts && creditCards) {
      const allValidAccountIds = new Set([
        ...accounts.map(acc => acc.id),
        ...creditCards.map(card => card.id),
      ]);

      const invalid = fixedExpenses.filter(
        expense =>
          expense.accountId && !allValidAccountIds.has(expense.accountId)
      );

      setInvalidExpenses(invalid);
    }
  }, [fixedExpenses, accounts, creditCards]);

  // Calculate total for a category
  const getCategoryTotal = categoryExpenses => {
    return categoryExpenses.reduce((total, expense) => {
      const remaining = expense.amount - (expense.paidAmount || 0);
      return total + (remaining > 0 ? remaining : 0);
    }, 0);
  };

  // Handle expense updates using the custom hook
  const handleUpdateExpense = useCallback(
    async (id, updates) => {
      if (updateInProgress.has(id)) {
        console.log(
          `FixedExpensesTable: Update already in progress for expense ${id}, skipping`
        );
        return;
      }

      try {
        setUpdateInProgress(prev => new Set(prev).add(id));
        setUpdatingExpenseId(id);

        await updateExpense(id, updates);
      } catch (error) {
        logger.error('Error updating expense:', error);
      } finally {
        setUpdateInProgress(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        setUpdatingExpenseId(null);
      }
    },
    [updateExpense, updateInProgress]
  );

  // Handle marking expense as paid
  const handleMarkAsPaid = useCallback(
    async expenseId => {
      await markAsPaid(expenseId);
    },
    [markAsPaid]
  );

  // Handle expense deletion
  const handleDeleteExpense = useCallback(
    async expenseId => {
      await deleteExpense(expenseId);
    },
    [deleteExpense]
  );

  // Handle expense duplication
  const handleDuplicate = useCallback(
    async (originalExpense, duplicateData) => {
      const newId = await duplicateExpense(originalExpense, duplicateData);
      setNewExpenseId(newId);
    },
    [duplicateExpense]
  );

  // Handle drag and drop
  const handleDragStart = event => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async event => {
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
  };

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
        expenses={fixedExpenses}
        groupedExpenses={groupedExpenses}
        totals={totals}
        categoryTotals={categoryTotals}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showOnlyUnpaid={showOnlyUnpaid}
        setShowOnlyUnpaid={setShowOnlyUnpaid}
        setIsPanelOpen={setPanelOpen}
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
                  categories={categories}
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
                  onExpenseAdded={async newExpenseId => {
                    if (newExpenseId) {
                      setNewExpenseId(newExpenseId);
                      await reloadExpenses();
                    }
                  }}
                  activeId={activeId}
                />
              )
            )}
          </div>
        </DndContext>
      ) : (
        <div className='text-center p-8'>
          <div className='text-white/70 mb-4'>No expenses found</div>
          <button onClick={() => setPanelOpen(true)} className='glass-button'>
            Add Your First Expense
          </button>
        </div>
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
        onDataChange={async newExpenseId => {
          if (newExpenseId) {
            setNewExpenseId(newExpenseId);

            // Reload expenses from database to show the new expense
            await reloadExpenses();
          }
        }}
      />
    </div>
  );
};

export default ExpenseTableContainer;

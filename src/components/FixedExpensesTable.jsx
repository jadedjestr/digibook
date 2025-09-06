import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';
import { DateUtils } from '../utils/dateUtils';
import { Plus, Home, Zap, Shield, Car, Smartphone, CreditCard, Stethoscope, GraduationCap, Package, Check, X } from 'lucide-react';
import { useCollapsedCategories, useSortPreference, useAutoCollapsePreference, useShowOnlyUnpaidPreference, usePersistedState } from '../hooks/usePersistedState';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import DuplicateExpenseModal from './DuplicateExpenseModal';
import StatusBadge from './StatusBadge';
import AccountSelector from './AccountSelector';
import AddExpensePanel from './AddExpensePanel';
import AccountValidationAlert from './AccountValidationAlert';
import { dbHelpers } from '../db/database';
import { PaycheckService } from '../services/paycheckService';
import PrivacyWrapper from './PrivacyWrapper';

import DraggableExpenseRow from './DraggableExpenseRow';
import CategoryDropZone from './CategoryDropZone';
import MobileExpenseCard from './MobileExpenseCard';

// Initialization State Machine
const INIT_STATES = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

const FixedExpensesTable = ({
  expenses,
  accounts,
  creditCards = [],
  paycheckSettings,
  onDataChange,
  onAccountChange,
  isPanelOpen,
  setIsPanelOpen,
}) => {
  // 🔧 ROBUST INITIALIZATION STATE MACHINE
  const [initState, setInitState] = useState(INIT_STATES.LOADING);
  const [initError, setInitError] = useState(null);

  // Core state - initialized with safe defaults
  const [editingId, setEditingId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [categories, setCategories] = useState([]);
  const [newExpenseId, setNewExpenseId] = useState(null);
  const [duplicatingExpense, setDuplicatingExpense] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [updatingExpenseId, setUpdatingExpenseId] = useState(null);
  const [updateInProgress, setUpdateInProgress] = useState(new Set());
  const [invalidExpenses, setInvalidExpenses] = useState([]);

  // 🔧 SIMPLIFIED PERSISTED STATE - No complex manual overrides
  const { value: collapsedCategories, setValue: setCollapsedCategories, isLoaded: collapsedLoaded } = useCollapsedCategories();
  const { value: sortBy, setValue: setSortBy, isLoaded: sortLoaded } = useSortPreference();
  const { value: autoCollapseEnabled, setValue: setAutoCollapseEnabled, isLoaded: autoCollapseLoaded } = useAutoCollapsePreference();
  const { value: showOnlyUnpaid, setValue: setShowOnlyUnpaid, isLoaded: showOnlyUnpaidLoaded } = useShowOnlyUnpaidPreference();

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
    }),
  );

  const paycheckService = new PaycheckService(paycheckSettings);
  const paycheckDates = paycheckService.calculatePaycheckDates();

  // 🔧 ROBUST INITIALIZATION PROCESS
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        setInitState(INIT_STATES.LOADING);
        setInitError(null);

        // Step 1: Load categories (required for grouping)
        const categoriesData = await dbHelpers.getCategories();
        setCategories(categoriesData);

        // Step 2: Wait for persisted preferences to load
        const checkPreferencesLoaded = () => {
          return collapsedLoaded && sortLoaded && autoCollapseLoaded && showOnlyUnpaidLoaded;
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
  }, [collapsedLoaded, sortLoaded, autoCollapseLoaded, showOnlyUnpaidLoaded]); // Wait for preferences

  // Sorting helpers - MUST be defined BEFORE useMemo that uses them
  const sortByDueDate = (a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    // Parse as local dates to avoid timezone shifts
    const dateA = new Date(a.dueDate + 'T00:00:00');
    const dateB = new Date(b.dueDate + 'T00:00:00');
    return dateA - dateB;
  };

  const sortByName = (a, b) => {
    return a.name.localeCompare(b.name);
  };

  // 🔧 SAFE DATA PROCESSING - Only run when ready
  const groupedExpenses = useMemo(() => {
    // TEMPORARY: Allow processing even if not fully initialized
    if (!expenses) {
      return {};
    }

    // Don't process data until initialization is complete
    if (initState !== INIT_STATES.READY) {
      // Continue processing for debugging
    }

    try {
      const groups = {};

      expenses.forEach(expense => {
        const category = expense.category || 'Uncategorized';
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(expense);
      });

      // Sort each category's expenses
      Object.keys(groups).forEach(category => {
        groups[category].sort(sortBy === 'dueDate' ? sortByDueDate : sortByName);
      });

      return groups;
    } catch (error) {
      return {};
    }
  }, [expenses, sortBy, initState]); // Include initState in dependencies

  // Get category icon
  const getCategoryIcon = (categoryName) => {
    switch (categoryName) {
    case 'Housing':
      return <Home size={20} className="text-blue-300" />;
    case 'Utilities':
      return <Zap size={20} className="text-green-300" />;
    case 'Insurance':
      return <Shield size={20} className="text-yellow-300" />;
    case 'Transportation':
      return <Car size={20} className="text-purple-300" />;
    case 'Subscriptions':
      return <Smartphone size={20} className="text-pink-300" />;
    case 'Debt':
      return <CreditCard size={20} className="text-red-300" />;
    case 'Healthcare':
      return <Stethoscope size={20} className="text-cyan-300" />;
    case 'Education':
      return <GraduationCap size={20} className="text-lime-300" />;
    default:
      return <Package size={20} className="text-gray-300" />;
    }
  };

  // Get category display name
  const getCategoryDisplayName = (categoryName) => {
    return categoryName === 'Uncategorized' ? 'Uncategorized Expenses' : `${categoryName} Expenses`;
  };

  // Validate account references when data changes
  useEffect(() => {
    if (expenses && accounts && creditCards) {
      const allValidAccountIds = new Set([
        ...accounts.map(acc => acc.id),
        ...creditCards.map(card => card.id),
      ]);

      const invalid = expenses.filter(expense => 
        expense.accountId && !allValidAccountIds.has(expense.accountId)
      );

      setInvalidExpenses(invalid);
    }
  }, [expenses, accounts, creditCards]);

  // Calculate total for a category
  const getCategoryTotal = (categoryExpenses) => {
    return categoryExpenses.reduce((total, expense) => {
      const remaining = expense.amount - (expense.paidAmount || 0);
      return total + (remaining > 0 ? remaining : 0); // Don't count negative remainders
    }, 0);
  };

  const handleUpdateExpense = async (id, updates) => {
    // Prevent multiple simultaneous updates for the same expense
    if (updateInProgress.has(id)) {
      console.log(`FixedExpensesTable: Update already in progress for expense ${id}, skipping`);
      return;
    }

    try {
      console.log(`FixedExpensesTable: handleUpdateExpense called with ID: ${id}, updates:`, updates);
      logger.debug(`Updating expense with ID: ${id}`, updates);

      // Mark this expense as being updated
      setUpdateInProgress(prev => new Set(prev).add(id));

      // Set loading state for this specific expense
      setUpdatingExpenseId(id);
      logger.debug(`Set updatingExpenseId to: ${id}`);

      // Preserve scroll position
      const scrollPosition = window.scrollY;

      // Get the current expense to check for account changes
      const currentExpense = expenses.find(e => e.id === id);
      if (!currentExpense) {
        logger.error('Could not find expense to update');
        setUpdatingExpenseId(null);
        return;
      }

      // Optimistic update for immediate UI feedback
      const updatedExpense = { ...currentExpense, ...updates };
      // Note: We can't update local state here because expenses is passed as a prop
      // The parent component will handle the data reload

      // Handle account switching between credit cards and regular accounts
      if (updates.accountId && updates.accountId !== currentExpense.accountId) {
        const oldAccountId = currentExpense.accountId;
        const newAccountId = updates.accountId;

        // Check if moving from credit card to regular account
        const oldCreditCard = creditCards.find(card => card.id === oldAccountId);
        const newCreditCard = creditCards.find(card => card.id === newAccountId);

        if (oldCreditCard && !newCreditCard) {
          // Moving from credit card to regular account
          // Decrease credit card balance (remove debt)
          const newBalance = Math.max(0, oldCreditCard.balance - currentExpense.amount);
          await dbHelpers.updateCreditCard(oldAccountId, { balance: newBalance });
          logger.info(`Credit card balance decreased: ${oldCreditCard.balance} -> ${newBalance}`);
        } else if (!oldCreditCard && newCreditCard) {
          // Moving from regular account to credit card
          // Increase credit card balance (add debt)
          const newBalance = newCreditCard.balance + currentExpense.amount;
          await dbHelpers.updateCreditCard(newAccountId, { balance: newBalance });
          logger.info(`Credit card balance increased: ${newCreditCard.balance} -> ${newBalance}`);
        }
      }


      // Update the expense in the database
      await dbHelpers.updateFixedExpense(id, updates);
      
      // Handle account balance deduction when paidAmount is updated
      if (updates.paidAmount !== undefined) {
        const oldPaidAmount = currentExpense.paidAmount || 0;
        const newPaidAmount = updates.paidAmount;
        const paymentDifference = newPaidAmount - oldPaidAmount;
        
        if (paymentDifference !== 0) {
          // Check if this is a credit card payment expense
          const isCreditCardPayment = currentExpense.category === 'Credit Card Payment' || 
                                     currentExpense.name.toLowerCase().includes('payment');
          
          if (isCreditCardPayment) {
            // For credit card payments, we need to handle both accounts:
            // 1. Withdraw from the funding account (where money comes from)
            // 2. Reduce the credit card balance (where debt is)
            
            // Step 1: Withdraw from funding account (the account this expense is linked to)
            const fundingAccount = accounts.find(acc => acc.id === currentExpense.accountId);
            if (fundingAccount) {
              const newFundingBalance = fundingAccount.currentBalance - paymentDifference;
              await dbHelpers.updateAccount(currentExpense.accountId, { currentBalance: newFundingBalance });
              logger.info(`Funding account balance updated: ${fundingAccount.currentBalance} -> ${newFundingBalance} (payment difference: ${paymentDifference})`);
            } else {
              logger.warn(`Funding account not found for ID: ${currentExpense.accountId}`);
            }
            
            // Step 2: Find and reduce the corresponding credit card balance
            // Look for a credit card with a name that matches this payment expense
            const creditCardName = currentExpense.name.replace(' Payment', '').replace(' payment', '');
            const correspondingCreditCard = creditCards.find(card => 
              card.name.toLowerCase() === creditCardName.toLowerCase()
            );
            
            if (correspondingCreditCard) {
              const newCreditCardBalance = Math.max(0, correspondingCreditCard.balance - paymentDifference);
              await dbHelpers.updateCreditCard(correspondingCreditCard.id, { balance: newCreditCardBalance });
              logger.info(`Credit card balance updated: ${correspondingCreditCard.balance} -> ${newCreditCardBalance} (payment difference: ${paymentDifference})`);
            } else {
              logger.warn(`Could not find corresponding credit card for payment: ${currentExpense.name}`);
              notify.warning(`Payment processed but could not find corresponding credit card for ${currentExpense.name}`);
            }
          } else {
            // For regular expenses, handle single account (could be checking, savings, or credit card)
            const account = accounts.find(acc => acc.id === currentExpense.accountId);
            const creditCard = creditCards.find(card => card.id === currentExpense.accountId);
            
            if (creditCard) {
              // For credit card expenses, increase the balance when paid (increase debt)
              const newBalance = creditCard.balance + paymentDifference;
              await dbHelpers.updateCreditCard(currentExpense.accountId, { balance: newBalance });
              logger.info(`Credit card balance updated: ${creditCard.name} ${creditCard.balance} -> ${newBalance} (payment difference: ${paymentDifference})`);
            } else if (account) {
              // For regular accounts, deduct the payment difference from balance
              const newBalance = account.currentBalance - paymentDifference;
              await dbHelpers.updateAccount(currentExpense.accountId, { currentBalance: newBalance });
              logger.info(`Account balance updated: ${account.currentBalance} -> ${newBalance} (payment difference: ${paymentDifference})`);
            } else if (currentExpense.accountId === null) {
              // Unlinked account - payment processed but no balance update
              logger.info(`Payment processed for unlinked expense ${currentExpense.id} - no account balance update`);
              notify.info(`Payment processed but expense is not linked to any account.`);
            } else {
              // Invalid account reference - log error and show notification
              logger.error(`Invalid account reference: Account ID ${currentExpense.accountId} not found in accounts or credit cards`);
              notify.error(`Warning: Payment processed but account ${currentExpense.accountId} not found. Please update the account mapping.`);
            }
          }
        }
      }
      
      setEditingId(null);
      setEditingField(null);

      // Verify the update was saved before reloading data
      const verificationExpense = await dbHelpers.getFixedExpense(id);
      const updateVerified = verificationExpense &&
        Object.keys(updates).every(key => verificationExpense[key] === updates[key]);

      if (updateVerified) {
        logger.debug(`Database update verified for expense ${id}:`, updates);

        // Show success notification
        const fieldNames = Object.keys(updates);
        if (fieldNames.includes('accountId')) {
          const newAccount = [...accounts, ...creditCards].find(acc => acc.id === updates.accountId);
          const accountName = newAccount ? newAccount.name : `Account ${updates.accountId}`;
          notify.success(`Account updated to ${accountName}`);
        } else if (fieldNames.includes('dueDate')) {
          notify.success(`Due date updated to ${DateUtils.formatShortDate(updates.dueDate)}`);
        } else if (fieldNames.includes('amount')) {
          notify.success(`Amount updated to $${updates.amount.toFixed(2)}`);
        } else if (fieldNames.includes('name')) {
          notify.success(`Name updated to "${updates.name}"`);
        } else if (fieldNames.includes('paidAmount')) {
          const overpaymentAmount = Math.max(0, updates.paidAmount - currentExpense.amount);
          if (overpaymentAmount > 0) {
            notify.success(`Payment updated to $${updates.paidAmount.toFixed(2)} (Overpaid: $${overpaymentAmount.toFixed(2)})`);
          } else {
            notify.success(`Payment updated to $${updates.paidAmount.toFixed(2)}`);
          }
        } else {
          notify.success('Expense updated successfully');
        }

        // Add a small delay to ensure the database transaction is fully committed
        await new Promise(resolve => setTimeout(resolve, 100));

        // Always reload data to ensure UI reflects the changes
        onDataChange();
      } else {
        logger.error(`Database update verification failed for expense ${id}. Expected:`, updates, 'Got:', verificationExpense);
        // Retry the update if verification failed
        console.log('Retrying database update...');
        await dbHelpers.updateFixedExpense(id, updates);

        // Verify again after retry
        const retryVerification = await dbHelpers.getFixedExpense(id);
        const retryVerified = retryVerification &&
          Object.keys(updates).every(key => retryVerification[key] === updates[key]);

        if (retryVerified) {
          logger.debug(`Database update verified after retry for expense ${id}`);
          onDataChange();
        } else {
          logger.error(`Database update failed even after retry for expense ${id}`);
          notify.error('Failed to update expense. Please refresh the page and try again.');
        }
      }

      // Restore scroll position after update
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 0);

    } catch (error) {
      logger.error('Error updating expense:', error);
      notify.error('Failed to update expense. Please try again.');
    } finally {
      // Clear loading state after a delay to show visual feedback
      setTimeout(() => {
        logger.debug(`Clearing updatingExpenseId (was: ${updatingExpenseId})`);
        setUpdatingExpenseId(null);
      }, 1000); // Show loading state for 1 second

      // Remove from update in progress set
      setUpdateInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!active || !over) return;

    try {
      const draggedExpense = expenses.find(e => e.id === active.id);
      if (!draggedExpense) {
        logger.error('Could not find dragged expense');
        return;
      }

      // Extract category from the dropzone ID (format: dropzone-categoryName)
      const targetCategory = over.data?.current?.category;
      if (!targetCategory) {
        logger.error('Invalid drop target');
        return;
      }

      if (draggedExpense.category !== targetCategory) {
        logger.debug(`Moving expense from ${draggedExpense.category} to ${targetCategory}`);
        await handleUpdateExpense(draggedExpense.id, { category: targetCategory });
        logger.success(`Moved expense to ${targetCategory} category`);
      }
    } catch (error) {
      logger.error('Error moving expense:', error);
      alert('Failed to move expense. Please try again.');
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      await dbHelpers.deleteFixedExpense(id);
      onDataChange();
    } catch (error) {
      logger.error('Error deleting expense:', error);
      alert('Failed to delete expense. Please try again.');
    }
  };

  const handleDuplicate = async (duplicates) => {
    try {
      // Add each duplicate expense
      for (const duplicate of duplicates) {
        await dbHelpers.addFixedExpense(duplicate);
      }
      onDataChange();
    } catch (error) {
      logger.error('Error duplicating expenses:', error);
      throw new Error('Failed to duplicate expenses. Please try again.');
    }
  };

  // Calculate payment status for a category
  const getCategoryPaymentStatus = (categoryExpenses) => {
    if (!categoryExpenses || categoryExpenses.length === 0) return { allPaid: true, paidCount: 0, totalCount: 0 };

    const paidCount = categoryExpenses.filter(expense =>
      expense.paidAmount >= expense.amount,
    ).length;

    const totalCount = categoryExpenses.length;
    const allPaid = paidCount === totalCount && totalCount > 0;

    return { allPaid, paidCount, totalCount };
  };

  // 🔧 SIMPLIFIED AUTO-COLLAPSE LOGIC - Only runs on data changes
  const applyAutoCollapseLogic = useCallback(() => {
    if (!autoCollapseEnabled || !expenses || expenses.length === 0) {
      return; // No auto-collapse if disabled or no expenses
    }

    // Group expenses by category
    const expensesByCategory = {};
    expenses.forEach(expense => {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = [];
      }
      expensesByCategory[expense.category].push(expense);
    });

    // Check each category for auto-collapse
    // Use a functional update to avoid dependency on collapsedCategories
    setCollapsedCategories(currentCollapsed => {
      const newCollapsedCategories = new Set(currentCollapsed);
      let autoCollapsedCount = 0;

      Object.entries(expensesByCategory).forEach(([categoryName, categoryExpenses]) => {
        const { allPaid } = getCategoryPaymentStatus(categoryExpenses);

        if (allPaid) {
          // Category is fully paid - auto-collapse it
          if (!newCollapsedCategories.has(categoryName)) {
            newCollapsedCategories.add(categoryName);
            autoCollapsedCount++;
          }
        }
      });

      // Only return new state if we actually auto-collapsed something
      return autoCollapsedCount > 0 ? newCollapsedCategories : currentCollapsed;
    });
  }, [autoCollapseEnabled, expenses, setCollapsedCategories]); // Removed collapsedCategories dependency

  // 🔧 AUTO-COLLAPSE TRIGGER - Only when data actually changes
  useEffect(() => {
    if (initState === INIT_STATES.READY && autoCollapseEnabled && expenses && expenses.length > 0) {
      applyAutoCollapseLogic();
    }
  }, [expenses, autoCollapseEnabled, initState, applyAutoCollapseLogic]); // Only trigger on actual data changes

  // 🔧 SIMPLIFIED TOGGLE - Direct and immediate
  const toggleCategoryCollapse = (categoryName) => {
    const newSet = new Set(collapsedCategories);

    if (newSet.has(categoryName)) {
      // Expanding the category
      newSet.delete(categoryName);
    } else {
      // Collapsing the category
      newSet.add(categoryName);
    }

    // Update state immediately
    setCollapsedCategories(newSet);
  };

  const handleMarkAsPaid = async (expense) => {
    try {
      await dbHelpers.updateFixedExpense(expense.id, {
        paidAmount: expense.amount,
      });

      // Check if this is a credit card payment expense
      const isCreditCardPayment = expense.category === 'Credit Card Payment' || 
                                 expense.name.toLowerCase().includes('payment');
      
      if (isCreditCardPayment) {
        // For credit card payments, we need to handle both accounts:
        // 1. Withdraw from the funding account (where money comes from)
        // 2. Reduce the credit card balance (where debt is)
        
        // Step 1: Withdraw from funding account (the account this expense is linked to)
        const fundingAccount = accounts.find(acc => acc.id === expense.accountId);
        if (fundingAccount) {
          const newFundingBalance = fundingAccount.currentBalance - expense.amount;
          await dbHelpers.updateAccount(expense.accountId, { currentBalance: newFundingBalance });
          logger.info(`Funding account balance updated: ${fundingAccount.currentBalance} -> ${newFundingBalance}`);
        } else {
          logger.warn(`Funding account not found for ID: ${expense.accountId}`);
        }
        
        // Step 2: Find and reduce the corresponding credit card balance
        // Look for a credit card with a name that matches this payment expense
        const creditCardName = expense.name.replace(' Payment', '').replace(' payment', '');
        const correspondingCreditCard = creditCards.find(card => 
          card.name.toLowerCase() === creditCardName.toLowerCase()
        );
        
        if (correspondingCreditCard) {
          const newCreditCardBalance = Math.max(0, correspondingCreditCard.balance - expense.amount);
          await dbHelpers.updateCreditCard(correspondingCreditCard.id, { balance: newCreditCardBalance });
          logger.info(`Credit card balance updated: ${correspondingCreditCard.balance} -> ${newCreditCardBalance}`);
        } else {
          logger.warn(`Could not find corresponding credit card for payment: ${expense.name}`);
          notify.warning(`Payment processed but could not find corresponding credit card for ${expense.name}`);
        }
      } else {
        // For regular expenses, handle single account (could be checking, savings, or credit card)
        const account = accounts.find(acc => acc.id === expense.accountId);
        const creditCard = creditCards.find(card => card.id === expense.accountId);
        
        if (creditCard) {
          // For credit card expenses, increase the balance when paid (increase debt)
          const newBalance = creditCard.balance + expense.amount;
          await dbHelpers.updateCreditCard(expense.accountId, { balance: newBalance });
          logger.info(`Credit card balance updated: ${creditCard.name} ${creditCard.balance} -> ${newBalance}`);
        } else if (account) {
          // For regular accounts, deduct the payment from balance
          const newBalance = account.currentBalance - expense.amount;
          await dbHelpers.updateAccount(expense.accountId, { currentBalance: newBalance });
          logger.info(`Account balance updated: ${account.currentBalance} -> ${newBalance}`);
        } else if (expense.accountId === null) {
          // Unlinked account - payment processed but no balance update
          logger.info(`Payment processed for unlinked expense ${expense.id} - no account balance update`);
          notify.info(`Payment processed but expense is not linked to any account.`);
        } else {
          // Invalid account reference
          logger.error(`Invalid account reference: Account ID ${expense.accountId} not found`);
          notify.error(`Warning: Payment processed but account ${expense.accountId} not found.`);
        }
      }

      onDataChange();
    } catch (error) {
      logger.error('Error marking as paid:', error);
      alert('Failed to mark as paid. Please try again.');
    }
  };

  // Animation for new expenses
  useEffect(() => {
    if (newExpenseId) {
      const timer = setTimeout(() => {
        setNewExpenseId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [newExpenseId]);

  const InlineEdit = ({ value, onSave, type = 'text', expense = null, fieldName = null }) => {
    const [editValue, setEditValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    // Update editValue when value prop changes
    useEffect(() => {
      setEditValue(value);
    }, [value]);

    const handleSave = () => {
      logger.debug(`Saving value: ${editValue} for field: ${fieldName}`);
      if (expense && fieldName) {
        // Parse number values properly for decimal amounts
        const valueToSave = type === 'number' ? parseFloat(editValue) || 0 : editValue;
        handleUpdateExpense(expense.id, { [fieldName]: valueToSave });
      } else {
        onSave(editValue);
      }
      setIsEditing(false);
    };

    const handleCancel = () => {
      setEditValue(value);
      setIsEditing(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    // Focus input when editing starts
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        if (type === 'text') {
          inputRef.current.select();
        }
      }
    }, [isEditing, type]);

    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          {type === 'number' ? (
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={(e) => {
                const value = e.target.value;
                // Allow empty string and valid numbers, including incomplete decimals
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setEditValue(value);
                }
              }}
              onKeyDown={handleKeyDown}
              className="glass-input text-sm w-20"
              step="0.01"
              min="0"
            />
          ) : type === 'date' ? (
            <input
              ref={inputRef}
              type="date"
              value={editValue}
              onChange={(e) => {
                logger.debug('Date input changed:', e.target.value);
                setEditValue(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              className="glass-input text-sm w-32"
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="glass-input text-sm w-full"
            />
          )}
          <button
            onClick={handleSave}
            className="p-1 text-green-300 hover:text-green-200"
            title="Save (Enter)"
          >
            <Check size={14} />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 text-red-300 hover:text-red-200"
            title="Cancel (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      );
    }

    const formatDisplayValue = (val, type) => {
      if (type === 'number') {
        return (
          <PrivacyWrapper>
            ${parseFloat(val).toFixed(2)}
          </PrivacyWrapper>
        );
      } else if (type === 'date') {
        if (!val) return '';
        return DateUtils.formatDisplayDate(val);
      }
      return val;
    };

    return (
      <div
        className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors"
        onClick={() => setIsEditing(true)}
      >
        {formatDisplayValue(value, type)}
      </div>
    );
  };

  // 🔧 LOADING AND ERROR STATES
  if (initState === INIT_STATES.LOADING) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Fixed Expenses</h2>
        </div>
        <div className="glass-panel">
          <div className="text-center py-8">
            <div className="glass-loading" />
            <p className="text-white/70 mt-4">Loading expenses...</p>
          </div>
        </div>
      </div>
    );
  }

  if (initState === INIT_STATES.ERROR) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Fixed Expenses</h2>
        </div>
        <div className="glass-panel bg-red-500/10 border-red-500/30">
          <div className="text-center py-8">
            <h3 className="text-lg font-semibold text-red-300 mb-2">Loading Error</h3>
            <p className="text-white/70 mb-4">{initError || 'Failed to load expenses'}</p>
            <button
              onClick={() => window.location.reload()}
              className="glass-button bg-red-500/20 text-red-300 hover:bg-red-500/30"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log('🎯 Rendering main FixedExpensesTable component...', {
    initState,
    expensesCount: expenses?.length || 0,
    groupedExpensesKeys: Object.keys(groupedExpenses),
  });

  // Handle navigation to manage accounts
  const handleNavigateToSettings = () => {
    // This would typically navigate to accounts/credit cards management
    window.location.hash = '#accounts';
  };

  // Handle fixing invalid account for specific expense
  const handleFixAccount = (expense) => {
    // Set this expense to editing state to allow user to select new account
    setEditingId(expense.id);
    setEditingField('accountId');
  };

  return (
    <div className="space-y-4">
      {/* Account Validation Alert */}
      <AccountValidationAlert 
        invalidExpenses={invalidExpenses}
        onNavigateToSettings={handleNavigateToSettings}
        onFixAccount={handleFixAccount}
      />
      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h2 className="text-xl font-semibold text-white">Fixed Expenses</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSortBy('dueDate')}
              className={`text-sm px-3 py-2 rounded transition-colors ${
                sortBy === 'dueDate'
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'hover:bg-white/10'
              }`}
            >
              Sort by Due Date
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`text-sm px-3 py-2 rounded transition-colors ${
                sortBy === 'name'
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'hover:bg-white/10'
              }`}
            >
              Sort by Name
            </button>
            <div className="h-4 w-px bg-white/20 hidden sm:block" />
            <button
              onClick={() => setAutoCollapseEnabled(!autoCollapseEnabled)}
              className={`text-sm px-3 py-2 rounded flex items-center space-x-1 transition-colors ${
                autoCollapseEnabled
                  ? 'bg-green-500/20 text-green-300'
                  : 'hover:bg-white/10'
              }`}
              title={autoCollapseEnabled ? 'Auto-collapse enabled' : 'Auto-collapse disabled'}
            >
              <span>Auto-collapse</span>
              {autoCollapseEnabled && <Check size={12} />}
            </button>
            <button
              onClick={() => {
                // Collapse all fully paid categories
                const newCollapsedCategories = new Set(collapsedCategories);
                let collapsedCount = 0;

                Object.entries(groupedExpenses).forEach(([categoryName, categoryExpenses]) => {
                  const { allPaid } = getCategoryPaymentStatus(categoryExpenses);
                  if (allPaid && !newCollapsedCategories.has(categoryName)) {
                    newCollapsedCategories.add(categoryName);
                    collapsedCount++;
                  }
                });

                if (collapsedCount > 0) {
                  setCollapsedCategories(newCollapsedCategories);
                  console.log(`📦 Manually collapsed ${collapsedCount} paid categories`);
                }
              }}
              className="text-sm px-3 py-2 rounded hover:bg-white/10 transition-colors"
              title="Collapse all fully paid categories"
            >
              Collapse All Paid
            </button>
            <button
              onClick={() => {
                // Expand all categories
                setCollapsedCategories(new Set());
                console.log('📂 Expanded all categories');
              }}
              className="text-sm px-3 py-2 rounded hover:bg-white/10 transition-colors"
              title="Expand all categories"
            >
              Expand All
            </button>
          </div>
        </div>
        <button
          onClick={() => setIsPanelOpen(true)}
          className="glass-button flex items-center justify-center space-x-2 w-full lg:w-auto min-h-[44px]"
        >
          <Plus size={16} />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Grouped Expenses Display */}
      {expenses.length === 0 ? (
        <div className="glass-panel">
          <div className="text-center py-8 text-secondary">
            No fixed expenses yet. Add your first expense to get started.
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="space-y-6">
            {Object.entries(groupedExpenses).map(([categoryName, categoryExpenses]) => {
              // Guard against empty or undefined categoryExpenses
              if (!categoryExpenses || categoryExpenses.length === 0) {
                return null;
              }

              const categoryTotal = getCategoryTotal(categoryExpenses);
              const { allPaid, paidCount, totalCount } = getCategoryPaymentStatus(categoryExpenses);

              return (
                <div key={categoryName} className="glass-panel">
                  {/* Category Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleCategoryCollapse(categoryName)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title={collapsedCategories.has(categoryName) ? 'Expand category' : 'Collapse category'}
                      >
                        {collapsedCategories.has(categoryName) ? '→' : '↓'}
                      </button>
                      {getCategoryIcon(categoryName)}
                      <h3 className="text-lg font-semibold text-primary">
                        {getCategoryDisplayName(categoryName)}
                      </h3>
                      <span className="text-sm text-secondary">
                        {categoryExpenses.length} expense{categoryExpenses.length !== 1 ? 's' : ''}
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                          allPaid
                            ? 'bg-green-500/20 text-green-300'
                            : paidCount > 0
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'bg-red-500/20 text-red-300'
                        }`}>
                          {allPaid ? 'All paid' : `${paidCount}/${totalCount} paid`}
                        </span>
                        {/* Auto-collapse indicator */}
                        {collapsedCategories.has(categoryName) && allPaid && autoCollapseEnabled && (
                          <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                            Auto-collapsed
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-secondary">Total Remaining</div>
                      <div className="text-lg font-bold text-primary">
                        <PrivacyWrapper>
                          ${categoryTotal.toFixed(2)}
                        </PrivacyWrapper>
                      </div>
                    </div>
                  </div>

                  {/* Expenses Display for this category */}
                  {!collapsedCategories.has(categoryName) && (
                    <>
                      {/* Desktop Table View */}
                      <div className="hidden lg:block">
                        <table className="glass-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Due Date</th>
                              <th>Amount</th>
                              <th>Account</th>
                              <th>Paid Amount</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            <SortableContext
                              items={categoryExpenses.map(e => e.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {categoryExpenses.map((expense) => {
                                const status = paycheckService.calculateExpenseStatus(expense, paycheckDates);
                                const account = accounts.find(acc => acc.id === expense.accountId);
                                const isNewExpense = newExpenseId === expense.id;

                                return (
                                  <DraggableExpenseRow
                                    key={expense.id}
                                    expense={expense}
                                    status={status}
                                    account={account}
                                    isNewExpense={isNewExpense}
                                    isUpdating={updatingExpenseId === expense.id}
                                    onMarkAsPaid={handleMarkAsPaid}
                                    onDuplicate={setDuplicatingExpense}
                                    onDelete={handleDeleteExpense}
                                    onUpdateExpense={handleUpdateExpense}
                                    accounts={accounts}
                                    creditCards={creditCards}
                                  />
                                );
                              })}
                            </SortableContext>
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card View */}
                      <div className="lg:hidden space-y-4">
                        {categoryExpenses.map((expense) => {
                          const status = paycheckService.calculateExpenseStatus(expense, paycheckDates);
                          const account = accounts.find(acc => acc.id === expense.accountId);
                          const isNewExpense = newExpenseId === expense.id;

                          return (
                            <MobileExpenseCard
                              key={expense.id}
                              expense={expense}
                              status={status}
                              account={account}
                              isNewExpense={isNewExpense}
                              isUpdating={updatingExpenseId === expense.id}
                              onMarkAsPaid={handleMarkAsPaid}
                              onDuplicate={setDuplicatingExpense}
                              onDelete={handleDeleteExpense}
                              onUpdateExpense={handleUpdateExpense}
                              accounts={accounts}
                              creditCards={creditCards}
                            />
                          );
                        })}
                      </div>

                      <CategoryDropZone
                        categoryName={categoryName}
                        getCategoryDisplayName={getCategoryDisplayName}
                        activeId={activeId}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </DndContext>
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
        onClose={() => setIsPanelOpen(false)}
        accounts={accounts}
        creditCards={creditCards}
        onDataChange={(newExpenseId) => {
          onDataChange();
          if (newExpenseId) {
            setNewExpenseId(newExpenseId);
          }
        }}
      />
    </div>
  );
};

export default FixedExpensesTable;

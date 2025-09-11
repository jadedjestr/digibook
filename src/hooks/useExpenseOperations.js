import { useCallback } from 'react';

import { dbHelpers } from '../db/database-clean';
import { useAppStore } from '../stores/useAppStore';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';
import { createPaymentService } from '../services/paymentService';
import {
  validatePaymentSource,
  validateCreditCardPayment,
} from '../utils/expenseValidation';

/**
 * Custom hook for managing expense operations with optimistic updates
 *
 * Provides a clean interface for expense CRUD operations including:
 * - Creating new expenses
 * - Updating existing expenses
 * - Deleting expenses
 * - Optimistic updates for better UX
 * - Error handling and recovery
 *
 * @returns {Object} Expense operations object
 * @returns {Function} returns.createExpense - Create a new expense
 * @returns {Function} returns.updateExpense - Update an existing expense
 * @returns {Function} returns.deleteExpense - Delete an expense
 * @returns {Function} returns.duplicateExpense - Duplicate an expense
 * @returns {Function} returns.moveExpense - Move expense between accounts
 * @returns {Function} returns.bulkUpdateExpenses - Update multiple expenses
 */
export const useExpenseOperations = () => {
  const {
    fixedExpenses,
    accounts,
    creditCards,
    updateExpense: updateExpenseInStore,
    addExpense: addExpenseToStore,
    removeExpense: removeExpenseFromStore,
    reloadAccounts,
    reloadExpenses,
  } = useAppStore();

  /**
   * Update an expense with optimistic updates and proper error handling
   */
  const updateExpense = useCallback(
    async (expenseId, updates, showNotification = true) => {
      try {
        // Get the current expense
        const currentExpense = fixedExpenses.find(e => e.id === expenseId);
        if (!currentExpense) {
          throw new Error('Expense not found');
        }

        // Optimistic update
        updateExpenseInStore(expenseId, updates);

        // Update in database
        await dbHelpers.updateFixedExpense(expenseId, updates);

        // Handle account balance changes if paidAmount was updated
        if (updates.paidAmount !== undefined) {
          const paymentService = createPaymentService(accounts, creditCards);
          await paymentService.processExpensePayment(
            currentExpense,
            updates.paidAmount
          );
          await reloadAccounts(); // Refresh account/credit card balances
        }

        logger.success(`Expense updated successfully: ${expenseId}`);
        if (showNotification) {
          notify.success('Expense updated successfully');
        }
      } catch (error) {
        // Revert optimistic update on error
        await reloadExpenses();
        logger.error('Error updating expense:', error);
        notify.error('Failed to update expense');
        throw error;
      }
    },
    [
      fixedExpenses,
      accounts,
      creditCards,
      updateExpenseInStore,
      reloadAccounts,
      reloadExpenses,
    ]
  );

  /**
   * Add a new expense
   */
  const addExpense = useCallback(
    async expenseData => {
      try {
        const newExpenseId = await dbHelpers.addFixedExpense(expenseData);
        const newExpense = { ...expenseData, id: newExpenseId };

        addExpenseToStore(newExpense);

        logger.success(`Expense added successfully: ${newExpenseId}`);
        notify.success('Expense added successfully');

        return newExpenseId;
      } catch (error) {
        logger.error('Error adding expense:', error);
        notify.error('Failed to add expense');
        throw error;
      }
    },
    [addExpenseToStore]
  );

  /**
   * Delete an expense
   */
  const deleteExpense = useCallback(
    async expenseId => {
      try {
        await dbHelpers.deleteFixedExpense(expenseId);
        removeExpenseFromStore(expenseId);

        logger.success(`Expense deleted successfully: ${expenseId}`);
        notify.success('Expense deleted successfully');
      } catch (error) {
        logger.error('Error deleting expense:', error);
        notify.error('Failed to delete expense');
        throw error;
      }
    },
    [removeExpenseFromStore]
  );

  /**
   * Duplicate an expense
   */
  const duplicateExpense = useCallback(
    async (originalExpense, duplicateData) => {
      try {
        const newExpense = {
          ...originalExpense,
          ...duplicateData,
          id: undefined, // Let database generate new ID
          paidAmount: 0,
          status: 'pending',
        };

        const newExpenseId = await dbHelpers.addFixedExpense(newExpense);
        const duplicatedExpense = { ...newExpense, id: newExpenseId };

        addExpenseToStore(duplicatedExpense);

        logger.success(`Expense duplicated successfully: ${newExpenseId}`);
        notify.success('Expense duplicated successfully');

        return newExpenseId;
      } catch (error) {
        logger.error('Error duplicating expense:', error);
        notify.error('Failed to duplicate expense');
        throw error;
      }
    },
    [addExpenseToStore]
  );

  /**
   * Mark an expense as paid
   */
  const markAsPaid = useCallback(
    async expenseId => {
      const expense = fixedExpenses.find(e => e.id === expenseId);
      if (!expense) {
        logger.error(`Expense not found: ${expenseId}`);
        return;
      }

      const updates = {
        paidAmount: expense.amount,
        status: 'paid',
      };

      try {
        await updateExpense(expenseId, updates, false); // Don't show generic notification
        // Reload expenses to ensure UI is updated
        await reloadExpenses();
        logger.success(`Expense marked as paid: ${expenseId}`);
        notify.success('Expense marked as paid');
      } catch (error) {
        logger.error('Error marking expense as paid:', error);
        notify.error('Failed to mark expense as paid');
      }
    },
    [fixedExpenses, updateExpense, reloadExpenses]
  );

  /**
   * Get expense by ID
   */
  const getExpenseById = useCallback(
    expenseId => {
      return fixedExpenses.find(expense => expense.id === expenseId);
    },
    [fixedExpenses]
  );

  /**
   * Get expenses by category
   */
  const getExpensesByCategory = useCallback(
    categoryName => {
      return fixedExpenses.filter(
        expense => (expense.category || 'Uncategorized') === categoryName
      );
    },
    [fixedExpenses]
  );

  /**
   * Add expense with V4 validation (dual foreign key architecture)
   */
  const addExpenseV4 = useCallback(
    async (expenseData, showNotification = true) => {
      try {
        // Validate payment source constraints
        validatePaymentSource(expenseData);

        if (expenseData.category === 'Credit Card Payment') {
          validateCreditCardPayment(expenseData);
        }

        const expenseId = await dbHelpers.addFixedExpenseV4(expenseData);
        await reloadExpenses();

        logger.success(`Added expense: ${expenseData.name}`);
        if (showNotification) {
          notify.success(`Added expense: ${expenseData.name}`);
        }

        return expenseId;
      } catch (error) {
        logger.error('Failed to add expense:', error);
        if (showNotification) {
          notify.error(`Failed to add expense: ${error.message}`);
        }
        throw error;
      }
    },
    [reloadExpenses]
  );

  /**
   * Update expense with V4 validation (dual foreign key architecture)
   */
  const updateExpenseV4 = useCallback(
    async (expenseId, updates, showNotification = true) => {
      try {
        const currentExpense = await dbHelpers.getFixedExpense(expenseId);
        if (!currentExpense) {
          throw new Error(`Expense not found: ${expenseId}`);
        }

        // Create merged expense data for validation
        const mergedExpense = { ...currentExpense, ...updates };
        validatePaymentSource(mergedExpense);

        if (mergedExpense.category === 'Credit Card Payment') {
          validateCreditCardPayment(mergedExpense);
        }

        // Optimistic update
        updateExpenseInStore(expenseId, updates);

        // Handle payment amount changes with new PaymentService
        if (updates.paidAmount !== undefined) {
          const paymentService = createPaymentService(accounts, creditCards);
          await paymentService.processExpensePayment(
            currentExpense,
            updates.paidAmount
          );
          await reloadAccounts(); // Refresh account/credit card balances
        }

        // Update in database with V4 validation
        await dbHelpers.updateFixedExpenseV4(expenseId, updates);

        logger.success(`Expense updated successfully: ${expenseId}`);
        if (showNotification) {
          notify.success('Expense updated successfully');
        }
      } catch (error) {
        logger.error('Error updating expense:', error);
        // Revert optimistic update
        await reloadExpenses();
        if (showNotification) {
          notify.error(`Failed to update expense: ${error.message}`);
        }
        throw error;
      }
    },
    [
      accounts,
      creditCards,
      updateExpenseInStore,
      reloadExpenses,
      reloadAccounts,
    ]
  );

  /**
   * Get payment source information for display
   */
  const getPaymentSourceInfo = useCallback(
    expense => {
      const paymentService = createPaymentService(accounts, creditCards);
      return paymentService.getPaymentSourceDetails(expense);
    },
    [accounts, creditCards]
  );

  /**
   * Get credit card payment details for two-field system display
   */
  const getCreditCardPaymentInfo = useCallback(
    expense => {
      const paymentService = createPaymentService(accounts, creditCards);
      return paymentService.getCreditCardPaymentDetails(expense);
    },
    [accounts, creditCards]
  );

  /**
   * Validate payment sources for an expense
   */
  const validateExpensePaymentSources = useCallback(
    expense => {
      const paymentService = createPaymentService(accounts, creditCards);
      return paymentService.validatePaymentSources(expense);
    },
    [accounts, creditCards]
  );

  /**
   * Enhanced validation for credit card payment amounts
   */
  const validateCreditCardPaymentAmount = useCallback(
    (expense, paymentAmount) => {
      const paymentService = createPaymentService(accounts, creditCards);
      return paymentService.validateCreditCardPaymentAmount(
        expense,
        paymentAmount
      );
    },
    [accounts, creditCards]
  );

  /**
   * Generate payment suggestions for credit card payments
   */
  const generatePaymentSuggestions = useCallback(
    expense => {
      const paymentService = createPaymentService(accounts, creditCards);
      if (expense.category !== 'Credit Card Payment') return [];

      const targetCard = creditCards.find(
        card => card.id === expense.targetCreditCardId
      );
      const fundingAccount = accounts.find(acc => acc.id === expense.accountId);

      if (!targetCard || !fundingAccount) return [];

      return paymentService.generatePaymentSuggestions(
        targetCard,
        fundingAccount
      );
    },
    [accounts, creditCards]
  );

  return {
    // Data
    expenses: fixedExpenses,

    // Legacy Actions (maintain backwards compatibility)
    updateExpense,
    addExpense,
    deleteExpense,
    duplicateExpense,
    markAsPaid,

    // V4 Actions (new dual foreign key architecture)
    addExpenseV4,
    updateExpenseV4,
    getPaymentSourceInfo,
    getCreditCardPaymentInfo,
    validateExpensePaymentSources,
    validateCreditCardPaymentAmount,
    generatePaymentSuggestions,

    // Getters
    getExpenseById,
    getExpensesByCategory,
  };
};

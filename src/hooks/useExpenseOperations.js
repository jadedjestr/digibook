import { useCallback, useMemo } from 'react';

import { dbHelpers } from '../db/database-clean';
import { createPaymentService } from '../services/paymentService';
import {
  useAccounts,
  useAddExpense,
  useCreditCards,
  useFixedExpenses,
  useReloadAccounts,
  useReloadExpenses,
  useRemoveExpense,
  useUpdateExpense,
} from '../stores/useAppStore';
import {
  validatePaymentSource,
  validateCreditCardPayment,
} from '../utils/expenseValidation';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

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
  const fixedExpenses = useFixedExpenses();
  const accounts = useAccounts();
  const creditCards = useCreditCards();
  const updateExpenseInStore = useUpdateExpense();
  const _addExpenseToStore = useAddExpense();
  const removeExpenseFromStore = useRemoveExpense();
  const reloadAccounts = useReloadAccounts();
  const reloadExpenses = useReloadExpenses();

  const paymentService = useMemo(
    () => createPaymentService(accounts, creditCards),
    [accounts, creditCards],
  );

  /**
   * Update expense with V4 validation (dual foreign key architecture)
   * This is the main update function - updateExpense delegates to this
   */
  const updateExpenseV4 = useCallback(
    async (expenseId, updates, showNotification = true) => {
      try {
        const currentExpense = await dbHelpers.getFixedExpenseV4(expenseId);
        if (!currentExpense) {
          throw new Error(`Expense not found: ${expenseId}`);
        }

        // Create copies for self-healing and updates
        const updatesToApply = { ...updates };
        const correctedCurrentExpense = { ...currentExpense };

        // Self-healing for legacy Credit Card Payments
        if (correctedCurrentExpense.category === 'Credit Card Payment') {
          // Fix missing targetCreditCardId
          if (!correctedCurrentExpense.targetCreditCardId) {
            const targetCard = creditCards.find(
              card =>
                correctedCurrentExpense.name
                  .toLowerCase()
                  .includes(card.name.toLowerCase()) ||
                card.name
                  .toLowerCase()
                  .includes(correctedCurrentExpense.name.toLowerCase()),
            );

            if (targetCard) {
              logger.info(
                `Automatically inferred target card for expense "${correctedCurrentExpense.name}": ${targetCard.name}`,
              );
              updatesToApply.targetCreditCardId = targetCard.id;
              correctedCurrentExpense.targetCreditCardId = targetCard.id;
            }
          }

          // Fix missing accountId
          if (!correctedCurrentExpense.accountId) {
            const defaultAccount =
              accounts.find(acc => acc.isDefault) || accounts[0];
            if (defaultAccount) {
              updatesToApply.accountId = defaultAccount.id;
              correctedCurrentExpense.accountId = defaultAccount.id;
            }
          }
        }

        // Create merged expense data for validation
        const mergedExpense = { ...correctedCurrentExpense, ...updatesToApply };
        validatePaymentSource(mergedExpense);

        if (mergedExpense.category === 'Credit Card Payment') {
          validateCreditCardPayment(mergedExpense);
        }

        // Optimistic update
        updateExpenseInStore(expenseId, updatesToApply);

        // Handle paidAmount changes atomically (expense + balances).
        if (updatesToApply.paidAmount !== undefined) {
          const paidAmountNumber = Number(updatesToApply.paidAmount);
          if (Number.isNaN(paidAmountNumber)) {
            throw new Error('paidAmount must be a valid number');
          }
          updatesToApply.paidAmount = paidAmountNumber;

          await dbHelpers.applyExpensePaymentChangeAtomic(
            expenseId,
            updatesToApply,
          );
          await Promise.all([reloadAccounts(), reloadExpenses()]);
        } else {
          // Update in database with V4 validation
          await dbHelpers.updateFixedExpenseV4(expenseId, updatesToApply);
        }

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
    ],
  );

  /**
   * Add expense with V4 validation (dual foreign key architecture)
   * This is the main add function - addExpense delegates to this
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
    [reloadExpenses],
  );

  /**
   * Update an expense with optimistic updates and proper error handling
   * Now uses V4 format with validation (delegates to updateExpenseV4)
   */
  const updateExpense = useCallback(
    async (expenseId, updates, showNotification = true) => {
      try {
        // updateExpenseV4 performs its own authoritative DB check and throws if not found
        await updateExpenseV4(expenseId, updates, showNotification);
      } catch (error) {
        logger.error('Error updating expense:', error);
        if (showNotification) {
          notify.error('Failed to update expense');
        }
        throw error;
      }
    },
    [updateExpenseV4],
  );

  /**
   * Add a new expense
   * Now uses V4 format with validation (delegates to addExpenseV4)
   */
  const addExpense = useCallback(
    async expenseData => {
      try {
        // Use V4 add function which includes validation
        const newExpenseId = await addExpenseV4(expenseData, true);
        return newExpenseId;
      } catch (error) {
        logger.error('Error adding expense:', error);
        notify.error('Failed to add expense');
        throw error;
      }
    },
    [addExpenseV4],
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
    [removeExpenseFromStore],
  );

  /**
   * Duplicate an expense
   * Now uses V4 format with validation and preserves creditCardId
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

          // Preserve payment source fields
          accountId: originalExpense.accountId || null,
          creditCardId: originalExpense.creditCardId || null,
          targetCreditCardId: originalExpense.targetCreditCardId || null,
        };

        // Use V4 add function which includes validation
        const newExpenseId = await addExpenseV4(newExpense, true);

        logger.success(`Expense duplicated successfully: ${newExpenseId}`);
        notify.success('Expense duplicated successfully');

        return newExpenseId;
      } catch (error) {
        logger.error('Error duplicating expense:', error);
        notify.error('Failed to duplicate expense');
        throw error;
      }
    },
    [addExpenseV4],
  );

  /**
   * Mark an expense as paid
   * Uses updateExpenseV4 for proper validation and payment processing
   */
  const markAsPaid = useCallback(
    async expenseId => {
      const expense = await dbHelpers.getFixedExpenseV4(expenseId);
      if (!expense) {
        logger.error(`Expense not found: ${expenseId}`);
        return;
      }

      const updates = {
        paidAmount: expense.amount,
        status: 'paid',
      };

      try {
        await updateExpenseV4(expenseId, updates, false); // Don't show generic notification
        // reloadExpenses is called internally by updateExpenseV4 when paidAmount changes
        logger.success(`Expense marked as paid: ${expenseId}`);
        notify.success('Expense marked as paid');
      } catch (error) {
        logger.error('Error marking expense as paid:', error);
        notify.error('Failed to mark expense as paid');
      }
    },
    [updateExpenseV4],
  );

  /**
   * Get expense by ID
   */
  const getExpenseById = useCallback(
    expenseId => {
      return fixedExpenses.find(expense => expense.id === expenseId);
    },
    [fixedExpenses],
  );

  /**
   * Get expenses by category
   */
  const getExpensesByCategory = useCallback(
    categoryName => {
      return fixedExpenses.filter(
        expense => (expense.category || 'Uncategorized') === categoryName,
      );
    },
    [fixedExpenses],
  );

  /**
   * Get payment source information for display
   */
  const getPaymentSourceInfo = useCallback(
    expense => {
      return paymentService.getPaymentSourceDetails(expense);
    },
    [paymentService],
  );

  /**
   * Get credit card payment details for two-field system display
   */
  const getCreditCardPaymentInfo = useCallback(
    expense => {
      return paymentService.getCreditCardPaymentDetails(expense);
    },
    [paymentService],
  );

  /**
   * Validate payment sources for an expense
   */
  const validateExpensePaymentSources = useCallback(
    expense => {
      return paymentService.validatePaymentSources(expense);
    },
    [paymentService],
  );

  /**
   * Enhanced validation for credit card payment amounts
   */
  const validateCreditCardPaymentAmount = useCallback(
    (expense, paymentAmount) => {
      return paymentService.validateCreditCardPaymentAmount(
        expense,
        paymentAmount,
      );
    },
    [paymentService],
  );

  /**
   * Generate payment suggestions for credit card payments
   */
  const generatePaymentSuggestions = useCallback(
    expense => {
      if (expense.category !== 'Credit Card Payment') return [];

      const targetCard = creditCards.find(
        card => card.id === expense.targetCreditCardId,
      );
      const fundingAccount = accounts.find(acc => acc.id === expense.accountId);

      if (!targetCard || !fundingAccount) return [];

      return paymentService.generatePaymentSuggestions(
        targetCard,
        fundingAccount,
      );
    },
    [accounts, creditCards, paymentService],
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

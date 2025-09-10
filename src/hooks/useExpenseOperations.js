import { useCallback } from 'react';

import { dbHelpers } from '../db/database-clean';
import { useAppStore } from '../stores/useAppStore';
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
          const oldPaidAmount = currentExpense.paidAmount || 0;
          const newPaidAmount = updates.paidAmount;
          const paymentDifference = newPaidAmount - oldPaidAmount;

          if (paymentDifference !== 0) {
            const accountId = updates.accountId || currentExpense.accountId;
            const account = accounts.find(acc => acc.id === accountId);
            const creditCard = creditCards.find(card => card.id === accountId);

            // Handle payment based on expense category and account type
            if (currentExpense.category === 'Credit Card Payment') {
              // A. Credit Card Payment: Transfer money from checking/savings to credit card
              // accountId = funding source (checking/savings)
              // targetCreditCardId = target credit card to pay down

              if (account && currentExpense.targetCreditCardId) {
                // 1. Decrease the funding account balance (money goes out)
                const newAccountBalance =
                  account.currentBalance - paymentDifference;
                await dbHelpers.updateAccount(accountId, {
                  currentBalance: newAccountBalance,
                });

                // Log the funding account balance change
                await dbHelpers.addAuditLog('PAYMENT', 'account', accountId, {
                  action: 'credit_card_payment_funding',
                  expenseId: expenseId,
                  expenseName: currentExpense.name,
                  amount: paymentDifference,
                  oldBalance: account.currentBalance,
                  newBalance: newAccountBalance,
                  description: `Paid credit card from ${account.name}`,
                });

                // 2. Find target credit card and decrease its balance
                const targetCreditCard = creditCards.find(
                  card => card.id === currentExpense.targetCreditCardId
                );

                if (targetCreditCard) {
                  const newCreditCardBalance =
                    targetCreditCard.balance - paymentDifference;
                  await dbHelpers.updateCreditCard(targetCreditCard.id, {
                    balance: newCreditCardBalance,
                  });

                  // Log the credit card balance change
                  await dbHelpers.addAuditLog(
                    'PAYMENT',
                    'creditCard',
                    targetCreditCard.id,
                    {
                      action: 'credit_card_payment_received',
                      expenseId: expenseId,
                      expenseName: currentExpense.name,
                      amount: paymentDifference,
                      oldBalance: targetCreditCard.balance,
                      newBalance: newCreditCardBalance,
                      fundingAccount: account.name,
                      description: `Received payment for ${currentExpense.name}`,
                    }
                  );

                  logger.success(
                    `Paid ${paymentDifference} to ${targetCreditCard.name} from ${account.name}`
                  );
                } else {
                  logger.error(
                    `Could not find target credit card with ID: ${currentExpense.targetCreditCardId}`
                  );
                }

                await reloadAccounts();
              } else {
                logger.error(
                  'Credit card payment requires both funding account and target credit card'
                );
              }
            } else if (account) {
              // B. Regular expense paid from checking/savings account
              const newBalance = account.currentBalance - paymentDifference;
              await dbHelpers.updateAccount(accountId, {
                currentBalance: newBalance,
              });

              // Log the regular expense payment
              await dbHelpers.addAuditLog('PAYMENT', 'account', accountId, {
                action: 'expense_payment',
                expenseId: expenseId,
                expenseName: currentExpense.name,
                amount: paymentDifference,
                oldBalance: account.currentBalance,
                newBalance: newBalance,
                description: `Paid expense ${currentExpense.name} from ${account.name}`,
              });

              await reloadAccounts();
            } else if (creditCard) {
              // C. Regular expense paid with credit card (increases debt)
              const newBalance = creditCard.balance + paymentDifference; // ← INCREASE debt
              await dbHelpers.updateCreditCard(accountId, {
                balance: newBalance,
              });

              // Log the credit card expense charge
              await dbHelpers.addAuditLog('PAYMENT', 'creditCard', accountId, {
                action: 'credit_card_expense_charge',
                expenseId: expenseId,
                expenseName: currentExpense.name,
                amount: paymentDifference,
                oldBalance: creditCard.balance,
                newBalance: newBalance,
                description: `Charged expense ${currentExpense.name} to ${creditCard.name}`,
              });

              await reloadAccounts();
            }
          }
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

  return {
    // Data
    expenses: fixedExpenses,

    // Actions
    updateExpense,
    addExpense,
    deleteExpense,
    duplicateExpense,
    markAsPaid,

    // Getters
    getExpenseById,
    getExpensesByCategory,
  };
};

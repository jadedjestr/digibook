import { useCallback } from 'react';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';
import { dbHelpers } from '../db/database-clean';
import { useAppStore } from '../stores/useAppStore';

/**
 * Custom hook for managing expense operations
 * Provides a clean interface for expense CRUD operations with optimistic updates
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
  const updateExpense = useCallback(async (expenseId, updates) => {
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

          if (account) {
            const newBalance = account.currentBalance - paymentDifference;
            await dbHelpers.updateAccount(accountId, { currentBalance: newBalance });
            await reloadAccounts();
          } else if (creditCard) {
            const newBalance = creditCard.balance + paymentDifference;
            await dbHelpers.updateCreditCard(accountId, { balance: newBalance });
            await reloadAccounts();
          }
        }
      }

      logger.success(`Expense updated successfully: ${expenseId}`);
      notify.success('Expense updated successfully');

    } catch (error) {
      // Revert optimistic update on error
      await reloadExpenses();
      logger.error('Error updating expense:', error);
      notify.error('Failed to update expense');
      throw error;
    }
  }, [fixedExpenses, accounts, creditCards, updateExpenseInStore, reloadAccounts, reloadExpenses]);

  /**
   * Add a new expense
   */
  const addExpense = useCallback(async (expenseData) => {
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
  }, [addExpenseToStore]);

  /**
   * Delete an expense
   */
  const deleteExpense = useCallback(async (expenseId) => {
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
  }, [removeExpenseFromStore]);

  /**
   * Duplicate an expense
   */
  const duplicateExpense = useCallback(async (originalExpense, duplicateData) => {
    try {
      const newExpense = {
        ...originalExpense,
        ...duplicateData,
        id: undefined, // Let database generate new ID
        paidAmount: 0,
        status: 'pending'
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
  }, [addExpenseToStore]);

  /**
   * Mark an expense as paid
   */
  const markAsPaid = useCallback(async (expenseId) => {
    const expense = fixedExpenses.find(e => e.id === expenseId);
    if (!expense) return;

    const updates = {
      paidAmount: expense.amount,
      status: 'paid'
    };

    await updateExpense(expenseId, updates);
  }, [fixedExpenses, updateExpense]);

  /**
   * Get expense by ID
   */
  const getExpenseById = useCallback((expenseId) => {
    return fixedExpenses.find(expense => expense.id === expenseId);
  }, [fixedExpenses]);

  /**
   * Get expenses by category
   */
  const getExpensesByCategory = useCallback((categoryName) => {
    return fixedExpenses.filter(expense => 
      (expense.category || 'Uncategorized') === categoryName
    );
  }, [fixedExpenses]);

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

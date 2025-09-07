import { useCallback } from 'react';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';
import { dbHelpers } from '../db/database-clean';
import { useAppStore } from '../stores/useAppStore';

/**
 * Custom hook for managing account operations
 * Provides a clean interface for account CRUD operations
 */
export const useAccountOperations = () => {
  const {
    accounts,
    creditCards,
    updateAccount: updateAccountInStore,
    updateCreditCard: updateCreditCardInStore,
    reloadAccounts,
  } = useAppStore();

  /**
   * Update a regular account
   */
  const updateAccount = useCallback(async (accountId, updates) => {
    try {
      // Optimistic update
      updateAccountInStore(accountId, updates);

      // Update in database
      await dbHelpers.updateAccount(accountId, updates);

      logger.success(`Account updated successfully: ${accountId}`);
      notify.success('Account updated successfully');

    } catch (error) {
      // Revert optimistic update on error
      await reloadAccounts();
      logger.error('Error updating account:', error);
      notify.error('Failed to update account');
      throw error;
    }
  }, [updateAccountInStore, reloadAccounts]);

  /**
   * Update a credit card
   */
  const updateCreditCard = useCallback(async (cardId, updates) => {
    try {
      // Optimistic update
      updateCreditCardInStore(cardId, updates);

      // Update in database
      await dbHelpers.updateCreditCard(cardId, updates);

      logger.success(`Credit card updated successfully: ${cardId}`);
      notify.success('Credit card updated successfully');

    } catch (error) {
      // Revert optimistic update on error
      await reloadAccounts();
      logger.error('Error updating credit card:', error);
      notify.error('Failed to update credit card');
      throw error;
    }
  }, [updateCreditCardInStore, reloadAccounts]);

  /**
   * Find an account by ID (searches both accounts and credit cards)
   */
  const findAccountById = useCallback((accountId) => {
    return creditCards.find(card => card.id === accountId) ||
           accounts.find(acc => acc.id === accountId) ||
           null;
  }, [accounts, creditCards]);

  /**
   * Get all valid account IDs
   */
  const getAllAccountIds = useCallback(() => {
    return new Set([
      ...accounts.map(acc => acc.id),
      ...creditCards.map(card => card.id),
    ]);
  }, [accounts, creditCards]);

  /**
   * Check if an account ID is valid
   */
  const isValidAccountId = useCallback((accountId) => {
    return getAllAccountIds().has(accountId);
  }, [getAllAccountIds]);

  /**
   * Get accounts by type
   */
  const getAccountsByType = useCallback((type) => {
    return accounts.filter(account => account.type === type);
  }, [accounts]);

  /**
   * Get default account
   */
  const getDefaultAccount = useCallback(() => {
    return accounts.find(account => account.isDefault) || accounts[0] || null;
  }, [accounts]);

  /**
   * Get total balance across all accounts
   */
  const getTotalBalance = useCallback(() => {
    const accountTotal = accounts.reduce((sum, account) => sum + (account.currentBalance || 0), 0);
    const creditCardTotal = creditCards.reduce((sum, card) => sum + (card.balance || 0), 0);
    return accountTotal - creditCardTotal; // Credit card balances are debt
  }, [accounts, creditCards]);

  /**
   * Get total credit card debt
   */
  const getTotalCreditCardDebt = useCallback(() => {
    return creditCards.reduce((sum, card) => sum + (card.balance || 0), 0);
  }, [creditCards]);

  /**
   * Get total available credit
   */
  const getTotalAvailableCredit = useCallback(() => {
    return creditCards.reduce((sum, card) => {
      const available = (card.creditLimit || 0) - (card.balance || 0);
      return sum + Math.max(0, available);
    }, 0);
  }, [creditCards]);

  return {
    // Data
    accounts,
    creditCards,
    
    // Actions
    updateAccount,
    updateCreditCard,
    
    // Getters
    findAccountById,
    getAllAccountIds,
    isValidAccountId,
    getAccountsByType,
    getDefaultAccount,
    getTotalBalance,
    getTotalCreditCardDebt,
    getTotalAvailableCredit,
  };
};

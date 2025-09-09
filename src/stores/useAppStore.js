import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { dbHelpers, initializeDatabase } from '../db/database-clean';
import { logger } from '../utils/logger';

/**
 * Global application state store using Zustand
 * Manages all application data and UI state in a centralized location
 */
export const useAppStore = create(
  persist(
    (set, get) => ({
      // === DATA STATE ===
      accounts: [],
      creditCards: [],
      pendingTransactions: [],
      fixedExpenses: [],
      categories: [],
      paycheckSettings: null,
      defaultAccount: null,

      // === UI STATE ===
      currentPage: 'accounts',
      isPanelOpen: false,
      isLoading: false,
      error: null,

      // === ACTIONS ===

      /**
       * Load all application data from the database
       */
      loadData: async () => {
        try {
          set({ isLoading: true, error: null });

          // Initialize database first
          await initializeDatabase();

          // Initialize default data
          await dbHelpers.initializeDefaultData();

          // Ensure there's a default account BEFORE loading data
          await dbHelpers.ensureDefaultAccount();

          const [
            accountsData,
            creditCardsData,
            transactionsData,
            expensesData,
            categoriesData,
            paycheckSettingsData,
            defaultAccountData,
          ] = await Promise.all([
            dbHelpers.getAccounts(),
            dbHelpers.getCreditCards(),
            dbHelpers.getPendingTransactions(),
            dbHelpers.getFixedExpenses(),
            dbHelpers.getCategories(),
            dbHelpers.getPaycheckSettings(),
            dbHelpers.getDefaultAccount(),
          ]);

          set({
            accounts: accountsData,
            creditCards: creditCardsData,
            pendingTransactions: transactionsData,
            fixedExpenses: expensesData,
            categories: categoriesData,
            paycheckSettings: paycheckSettingsData,
            defaultAccount: defaultAccountData,
            isLoading: false,
          });

          logger.success('Application data loaded successfully');
        } catch (error) {
          logger.error('Error loading application data:', error);
          set({
            error: error.message,
            isLoading: false,

            // Set empty arrays on error
            accounts: [],
            creditCards: [],
            pendingTransactions: [],
            fixedExpenses: [],
            categories: [],
            paycheckSettings: null,
            defaultAccount: null,
          });
        }
      },

      /**
       * Reload specific data types
       */
      reloadAccounts: async () => {
        try {
          const [accountsData, creditCardsData, defaultAccountData] =
            await Promise.all([
              dbHelpers.getAccounts(),
              dbHelpers.getCreditCards(),
              dbHelpers.getDefaultAccount(),
            ]);

          set({
            accounts: accountsData,
            creditCards: creditCardsData,
            defaultAccount: defaultAccountData,
          });

          logger.debug('Accounts data reloaded');
        } catch (error) {
          logger.error('Error reloading accounts:', error);
        }
      },

      reloadExpenses: async () => {
        try {
          const [expensesData, categoriesData] = await Promise.all([
            dbHelpers.getFixedExpenses(),
            dbHelpers.getCategories(),
          ]);

          set({
            fixedExpenses: expensesData,
            categories: categoriesData,
          });

          logger.debug('Expenses data reloaded');
        } catch (error) {
          logger.error('Error reloading expenses:', error);
        }
      },

      reloadTransactions: async () => {
        try {
          const transactionsData = await dbHelpers.getPendingTransactions();
          set({ pendingTransactions: transactionsData });
          logger.debug('Transactions data reloaded');
        } catch (error) {
          logger.error('Error reloading transactions:', error);
        }
      },

      reloadPaycheckSettings: async () => {
        try {
          const paycheckSettingsData = await dbHelpers.getPaycheckSettings();
          set({ paycheckSettings: paycheckSettingsData });
          logger.debug('Paycheck settings data reloaded');
        } catch (error) {
          logger.error('Error reloading paycheck settings:', error);
        }
      },

      /**
       * Update a specific expense in the store
       */
      updateExpense: (expenseId, updates) => {
        set(state => ({
          fixedExpenses: state.fixedExpenses.map(expense =>
            expense.id === expenseId ? { ...expense, ...updates } : expense
          ),
        }));
      },

      /**
       * Add a new expense to the store
       */
      addExpense: newExpense => {
        set(state => ({
          fixedExpenses: [...state.fixedExpenses, newExpense],
        }));
      },

      /**
       * Remove an expense from the store
       */
      removeExpense: expenseId => {
        set(state => ({
          fixedExpenses: state.fixedExpenses.filter(
            expense => expense.id !== expenseId
          ),
        }));
      },

      /**
       * Update account data
       */
      updateAccount: (accountId, updates) => {
        set(state => ({
          accounts: state.accounts.map(account =>
            account.id === accountId ? { ...account, ...updates } : account
          ),
        }));
      },

      /**
       * Update credit card data
       */
      updateCreditCard: (cardId, updates) => {
        set(state => ({
          creditCards: state.creditCards.map(card =>
            card.id === cardId ? { ...card, ...updates } : card
          ),
        }));
      },

      /**
       * Add a new transaction
       */
      addTransaction: newTransaction => {
        set(state => ({
          pendingTransactions: [...state.pendingTransactions, newTransaction],
        }));
      },

      /**
       * Remove a transaction
       */
      removeTransaction: transactionId => {
        set(state => ({
          pendingTransactions: state.pendingTransactions.filter(
            transaction => transaction.id !== transactionId
          ),
        }));
      },

      // === UI ACTIONS ===

      /**
       * Set the current page
       */
      setCurrentPage: page => {
        set({ currentPage: page });
      },

      /**
       * Toggle the add expense panel
       */
      togglePanel: () => {
        set(state => ({ isPanelOpen: !state.isPanelOpen }));
      },

      /**
       * Set panel open state
       */
      setPanelOpen: isOpen => {
        set({ isPanelOpen: isOpen });
      },

      /**
       * Clear any error state
       */
      clearError: () => {
        set({ error: null });
      },

      // === COMPUTED VALUES ===

      /**
       * Get all valid account IDs (accounts + credit cards)
       */
      getAllAccountIds: () => {
        const state = get();
        return new Set([
          ...state.accounts.map(acc => acc.id),
          ...state.creditCards.map(card => card.id),
        ]);
      },

      /**
       * Find an account by ID (searches both accounts and credit cards)
       */
      findAccountById: accountId => {
        const state = get();
        return (
          state.creditCards.find(card => card.id === accountId) ||
          state.accounts.find(acc => acc.id === accountId) ||
          null
        );
      },

      /**
       * Get expenses grouped by category
       */
      getExpensesByCategory: () => {
        const state = get();
        const groups = {};

        state.fixedExpenses.forEach(expense => {
          const category = expense.category || 'Uncategorized';
          if (!groups[category]) {
            groups[category] = [];
          }
          groups[category].push(expense);
        });

        return groups;
      },

      /**
       * Get total remaining amount for expenses
       */
      getTotalRemaining: () => {
        const state = get();
        return state.fixedExpenses.reduce((total, expense) => {
          const remaining = expense.amount - (expense.paidAmount || 0);
          return total + (remaining > 0 ? remaining : 0);
        }, 0);
      },
    }),
    {
      name: 'digibook-app-store',

      // Only persist UI state, not data (data comes from database)
      partialize: state => ({
        currentPage: state.currentPage,
        isPanelOpen: state.isPanelOpen,
      }),
    }
  )
);

// Export individual selectors for better performance
export const useAccounts = () => useAppStore(state => state.accounts);
export const useCreditCards = () => useAppStore(state => state.creditCards);
export const usePendingTransactions = () =>
  useAppStore(state => state.pendingTransactions);
export const useFixedExpenses = () => useAppStore(state => state.fixedExpenses);
export const useCategories = () => useAppStore(state => state.categories);
export const usePaycheckSettings = () =>
  useAppStore(state => state.paycheckSettings);
export const useCurrentPage = () => useAppStore(state => state.currentPage);
export const useIsPanelOpen = () => useAppStore(state => state.isPanelOpen);
export const useIsLoading = () => useAppStore(state => state.isLoading);
export const useError = () => useAppStore(state => state.error);

// Export action selectors
export const useAppActions = () =>
  useAppStore(state => ({
    loadData: state.loadData,
    reloadAccounts: state.reloadAccounts,
    reloadExpenses: state.reloadExpenses,
    reloadTransactions: state.reloadTransactions,
    updateExpense: state.updateExpense,
    addExpense: state.addExpense,
    removeExpense: state.removeExpense,
    updateAccount: state.updateAccount,
    updateCreditCard: state.updateCreditCard,
    addTransaction: state.addTransaction,
    removeTransaction: state.removeTransaction,
    setCurrentPage: state.setCurrentPage,
    togglePanel: state.togglePanel,
    setPanelOpen: state.setPanelOpen,
    clearError: state.clearError,
  }));

// Export computed selectors
export const useAppComputed = () =>
  useAppStore(state => ({
    getAllAccountIds: state.getAllAccountIds,
    findAccountById: state.findAccountById,
    getExpensesByCategory: state.getExpensesByCategory,
    getTotalRemaining: state.getTotalRemaining,
  }));

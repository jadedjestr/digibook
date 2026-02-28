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
      templatesLastUpdated: null,

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

          // Run V4 format migration if needed (one-time migration)
          try {
            const auditReport = await dbHelpers.auditExpenseFormat();
            if (auditReport.summary.accountIdMatchesCreditCard > 0) {
              logger.info(
                `Found ${auditReport.summary.accountIdMatchesCreditCard} expenses needing V4 migration`,
              );
              logger.info('Running automatic V4 format migration...');
              const migrationReport =
                await dbHelpers.migrateExpensesToV4Format();
              if (migrationReport.summary.migrated > 0) {
                logger.success(
                  `Successfully migrated ${migrationReport.summary.migrated} expenses to V4 format`,
                );
              }
            }
          } catch (migrationError) {
            // Don't fail app load if migration fails - log and continue
            logger.error(
              'Migration check failed (non-critical):',
              migrationError,
            );
          }

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

          // Pre-generate occurrences for existing templates (background task)
          // This doesn't block app load - runs asynchronously
          (async () => {
            try {
              const { preGenerateOccurrences, getActiveTemplates } =
                await import('../services/recurringExpenseService');
              const activeTemplates = await getActiveTemplates();

              for (const template of activeTemplates) {
                try {
                  await preGenerateOccurrences(template.id, 6);
                } catch (error) {
                  logger.warn(
                    `Failed to pre-generate for template ${template.id}:`,
                    error,
                  );
                }
              }

              // Reload expenses after pre-generation to show new occurrences
              const [updatedExpensesData] = await Promise.all([
                dbHelpers.getFixedExpenses(),
              ]);
              set({ fixedExpenses: updatedExpensesData });
            } catch (error) {
              logger.warn(
                'Could not pre-generate recurring expenses on load:',
                error,
              );

              // Don't fail app load if this fails
            }
          })();
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
          await dbHelpers.ensureDefaultAccount();

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

      reloadCategories: async () => {
        try {
          const categoriesData = await dbHelpers.getCategories();
          set({ categories: categoriesData });
          logger.debug('Categories data reloaded');
        } catch (error) {
          logger.error('Error reloading categories:', error);
        }
      },

      /**
       * Refresh templates trigger - updates timestamp to signal widget refresh
       */
      refreshTemplates: () => {
        set({ templatesLastUpdated: Date.now() });
        logger.debug('Templates refresh triggered');
      },

      /**
       * Update a specific expense in the store
       */
      updateExpense: (expenseId, updates) => {
        set(state => ({
          fixedExpenses: state.fixedExpenses.map(expense =>
            expense.id === expenseId ? { ...expense, ...updates } : expense,
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
            expense => expense.id !== expenseId,
          ),
        }));
      },

      /**
       * Update account data
       */
      updateAccount: (accountId, updates) => {
        set(state => ({
          accounts: state.accounts.map(account =>
            account.id === accountId ? { ...account, ...updates } : account,
          ),
        }));
      },

      /**
       * Update credit card data
       */
      updateCreditCard: (cardId, updates) => {
        set(state => ({
          creditCards: state.creditCards.map(card =>
            card.id === cardId ? { ...card, ...updates } : card,
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
            transaction => transaction.id !== transactionId,
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
    },
  ),
);

// Data selector hooks — each subscribes only to its specific slice
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

// Action selector hooks — actions are stable references, so these never trigger re-renders
export const useLoadData = () => useAppStore(state => state.loadData);
export const useReloadAccounts = () =>
  useAppStore(state => state.reloadAccounts);
export const useReloadExpenses = () =>
  useAppStore(state => state.reloadExpenses);
export const useReloadTransactions = () =>
  useAppStore(state => state.reloadTransactions);
export const useReloadPaycheckSettings = () =>
  useAppStore(state => state.reloadPaycheckSettings);
export const useReloadCategories = () =>
  useAppStore(state => state.reloadCategories);
export const useRefreshTemplates = () =>
  useAppStore(state => state.refreshTemplates);
export const useSetCurrentPage = () =>
  useAppStore(state => state.setCurrentPage);
export const useTogglePanel = () => useAppStore(state => state.togglePanel);
export const useSetPanelOpen = () => useAppStore(state => state.setPanelOpen);
export const useUpdateExpense = () => useAppStore(state => state.updateExpense);
export const useAddExpense = () => useAppStore(state => state.addExpense);
export const useRemoveExpense = () => useAppStore(state => state.removeExpense);
export const useUpdateAccount = () => useAppStore(state => state.updateAccount);
export const useUpdateCreditCard = () =>
  useAppStore(state => state.updateCreditCard);
export const useAddTransaction = () =>
  useAppStore(state => state.addTransaction);
export const useRemoveTransaction = () =>
  useAppStore(state => state.removeTransaction);
export const useClearError = () => useAppStore(state => state.clearError);

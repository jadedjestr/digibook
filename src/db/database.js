import { logger } from '../utils/logger';
import Dexie from 'dexie';

export class DigibookDB extends Dexie {
  constructor () {
    super('DigibookDB');

    // Define all table schemas without indexes first
    const stores = {
      accounts: '++id',
      pendingTransactions: '++id',
      fixedExpenses: '++id',
      categories: '++id',
      creditCards: '++id',
      paycheckSettings: '++id',
      userPreferences: '++id',
      auditLogs: '++id',
    };

    // Initial setup
    this.version(1).stores(stores);

    // Add basic indexes
    this.version(2).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance',
      pendingTransactions: '++id, accountId, amount, description',
      fixedExpenses: '++id, name, dueDate, amount',
    });

    // Add category support
    this.version(3).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance',
      pendingTransactions: '++id, accountId, amount, category, description',
      fixedExpenses: '++id, name, dueDate, amount, category',
      categories: '++id, name, color, icon',
      auditLogs: '++id, timestamp, actionType, entityType, entityId',
    });

    // Add extended fields
    this.version(4).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category',
      categories: '++id, name, color, icon, isDefault',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    });

    // Add unique constraint to categories
    this.version(5).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category',
      categories: '++id, *name, color, icon, isDefault', // legacy: attempted uniqueness with * (multiEntry)
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    }).upgrade(async tx => {
      // Get all categories
      const categories = await tx.categories.toArray();

      // Create a map to track unique names
      const uniqueCategories = new Map();

      // Keep only the first occurrence of each category name
      categories.forEach(category => {
        const nameLower = category.name.toLowerCase();
        if (!uniqueCategories.has(nameLower)) {
          uniqueCategories.set(nameLower, category);
        }
      });

      // Clear the table
      await tx.categories.clear();

      // Add back unique categories
      await tx.categories.bulkAdd([...uniqueCategories.values()]);
    });

    // Add isAutoCreated field to fixedExpenses for auto-created credit card expenses
    this.version(10).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, createdAt',
      categories: '++id, &nameLower, name, color, icon, isDefault',
      creditCards: '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      userPreferences: '++id, component, preferences',
      monthlyExpenseHistory: '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    }).upgrade(async tx => {
      // Add isAutoCreated and createdAt fields to existing fixed expenses
      const existingExpenses = await tx.fixedExpenses.toArray();
      for (const expense of existingExpenses) {
        await tx.fixedExpenses.update(expense.id, {
          isAutoCreated: false,
          createdAt: new Date().toISOString()
        });
      }
    });

    // Add smart mapping fields for credit card expense detection
    this.version(11).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, createdAt',
      categories: '++id, &nameLower, name, color, icon, isDefault',
      creditCards: '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      userPreferences: '++id, component, preferences',
      monthlyExpenseHistory: '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    }).upgrade(async tx => {
      // Add smart mapping fields to existing fixed expenses
      const existingExpenses = await tx.fixedExpenses.toArray();
      for (const expense of existingExpenses) {
        const updates = {
          isManuallyMapped: false,
          mappingConfidence: 0,
          mappedAt: null
        };
        await tx.fixedExpenses.update(expense.id, updates);
      }
    });

    // Add missing index for monthlyExpenseHistory
    this.version(12).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, createdAt',
      categories: '++id, &nameLower, name, color, icon, isDefault',
      creditCards: '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      userPreferences: '++id, component, preferences',
      monthlyExpenseHistory: '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt, [expenseId+month+year]',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    });

    // Enforce case-insensitive unique category names using nameLower field
    this.version(6).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category',
      // Unique on nameLower to guarantee case-insensitive uniqueness
      categories: '++id, &nameLower, name, color, icon, isDefault',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    }).upgrade(async tx => {
      // Read existing categories
      const existing = await tx.categories.toArray();
      const keptByLower = new Map();
      for (const cat of existing) {
        const nameLower = (cat.name || '').toLowerCase();
        if (!keptByLower.has(nameLower)) {
          keptByLower.set(nameLower, { ...cat, nameLower });
        }
      }
      // Clear and re-add with nameLower populated
      await tx.categories.clear();
      const toAdd = [...keptByLower.values()];
      if (toAdd.length > 0) {
        await tx.categories.bulkAdd(toAdd);
      }
    });

    // Add credit cards table
    this.version(7).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category',
      categories: '++id, &nameLower, name, color, icon, isDefault',
      creditCards: '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    });

    // Add user preferences table
    this.version(8).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category',
      categories: '++id, &nameLower, name, color, icon, isDefault',
      creditCards: '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      userPreferences: '++id, component, preferences',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    });

    // Enhanced analytics and overpayment tracking
    this.version(9).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment',
      categories: '++id, &nameLower, name, color, icon, isDefault',
      creditCards: '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      userPreferences: '++id, component, preferences',
      monthlyExpenseHistory: '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt', // New table for monthly tracking
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    }).upgrade(async tx => {
      // Upgrade existing fixed expenses with new overpayment fields
      const expenses = await tx.fixedExpenses.toArray();
      
      for (const expense of expenses) {
        const overpaymentAmount = Math.max(0, (expense.paidAmount || 0) - expense.amount);
        const overpaymentPercentage = expense.amount > 0 ? (overpaymentAmount / expense.amount) * 100 : 0;
        const budgetSatisfied = (expense.paidAmount || 0) >= expense.amount;
        const significantOverpayment = overpaymentPercentage >= 20;

        await tx.fixedExpenses.update(expense.id, {
          overpaymentAmount,
          overpaymentPercentage,
          budgetSatisfied,
          significantOverpayment,
        });

        // Create initial monthly history entry if expense is paid
        if (expense.paidAmount && expense.paidAmount > 0) {
          const now = new Date();
          await tx.monthlyExpenseHistory.add({
            expenseId: expense.id,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            budgetAmount: expense.amount,
            actualAmount: expense.paidAmount,
            overpaymentAmount,
            createdAt: now.toISOString(),
          });
        }
      }
    });

    // Add optimized indexes for category filtering (Version 10)
    this.version(10).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt, *category',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, *category',
      categories: '++id, &nameLower, name, color, icon, isDefault',
      creditCards: '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      userPreferences: '++id, component, preferences',
      monthlyExpenseHistory: '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    });

    // Add dedicated credit card field for fixed expenses (Version 11)
    this.version(11).stores({
      ...stores,
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt, *category',
      fixedExpenses: '++id, name, dueDate, amount, accountId, creditCardId, paidAmount, status, category, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, *category',
      categories: '++id, &nameLower, name, color, icon, isDefault',
      creditCards: '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      userPreferences: '++id, component, preferences',
      monthlyExpenseHistory: '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    });
  }
}

export const db = new DigibookDB();

// Database helper functions
export const dbHelpers = {
  async deleteDatabase () {
    try {
      // Delete the database completely
      await db.delete();

      // Create a new instance with fresh schema
      const newDb = new DigibookDB();

      // Replace the old instance
      Object.assign(db, newDb);

      logger.success('Database deleted and recreated successfully');
    } catch (error) {
      logger.error('Error deleting database:', error);
      throw new Error('Failed to delete database');
    }
  },
  // Clear database (for development/testing)
  async clearDatabase () {
    try {
      await db.accounts.clear();
      await db.pendingTransactions.clear();
      await db.fixedExpenses.clear();
      await db.categories.clear();
      await db.creditCards.clear();
      await db.paycheckSettings.clear();
      await db.userPreferences.clear();
      await db.auditLogs.clear();
      logger.success('Database cleared successfully');
    } catch (error) {
      logger.error('Error clearing database:', error);
    }
  },

  // Delete and recreate database in case of schema issues
  async resetDatabase () {
    try {
      // Import the dataManager here to avoid circular dependencies
      const { dataManager } = await import('../services/dataManager');

      try {
        // Create backup using BackupManager
        await dataManager.backupManager.createBackup('schema_reset');
      } catch (error) {
        logger.warn('Could not create backup before reset:', error);
      }

      // Delete the database
      await db.delete();

      // Create a new instance
      const newDb = new DigibookDB();
      Object.assign(db, newDb);

      // Try to restore from latest backup
      try {
        const backup = await dataManager.backupManager.getLatestBackup();
        if (backup) {
          await dataManager.backupManager.restoreBackup(backup.key);
          logger.success('Data restored after schema reset');
        } else {
          // Initialize with defaults since no backup exists
          await this.initializeDefaultCategories();
        }
      } catch (error) {
        logger.error('Could not restore data after reset:', error);
        // Initialize with defaults since restore failed
        await this.initializeDefaultCategories();
      }

      logger.success('Database reset and reinitialized successfully');
    } catch (error) {
      logger.error('Error resetting database:', error);
      throw new Error('Failed to reset database');
    }
  },

  // Fix database schema (add missing fields)
  async fixDatabaseSchema () {
    try {
      const accounts = await db.accounts.toArray();
      for (const account of accounts) {
        // Ensure isDefault field exists
        if (account.isDefault === undefined) {
          await db.accounts.update(account.id, { isDefault: false });
        }
      }

      // Ensure paycheckSettings table exists and has at least one record
      const paycheckSettingsCount = await db.paycheckSettings.count();
      if (paycheckSettingsCount === 0) {
        // Create a default paycheck settings record if none exists
        await db.paycheckSettings.add({
          lastPaycheckDate: '',
          frequency: 'biweekly',
        });
      }

      // Clean up any duplicate categories first
      const duplicatesRemoved = await this.cleanupDuplicateCategories();
      if (duplicatesRemoved > 0) {
        logger.info(`Removed ${duplicatesRemoved} duplicate categories during schema fix`);
      }

      // Only initialize default categories if the database is completely empty
      // This prevents deleted default categories from being recreated on app startup
      const categoryCount = await db.categories.count();
      if (categoryCount === 0) {
        logger.info('No categories found, initializing default categories');
        await this.initializeDefaultCategories();
      } else {
        logger.debug(`Found ${categoryCount} existing categories, skipping default initialization`);
      }

      logger.success('Database schema fixed');
    } catch (error) {
      logger.error('Error fixing database schema:', error);
    }
  },

  // Account helpers
  async getAccounts () {
    const accounts = await db.accounts.toArray();

    // Ensure there's always a default account if accounts exist
    if (accounts.length > 0) {
      const hasDefault = accounts.some(account => account.isDefault);
      if (!hasDefault) {
        // Set the first account as default
        await this.setDefaultAccount(accounts[0].id);
        // Return updated accounts
        return await db.accounts.toArray();
      }
    }

    return accounts;
  },

  async ensureDefaultAccount () {
    try {
      const accounts = await db.accounts.toArray();

      // If no accounts exist, nothing to do
      if (accounts.length === 0) {
        return;
      }

      // Check if any account is marked as default
      const hasDefault = accounts.some(account => account.isDefault === true);

      // If no default is set, set the first account as default
      if (!hasDefault) {
        const firstAccount = accounts[0];
        await db.accounts.update(firstAccount.id, { isDefault: true });
        logger.success(`Set first account as default: ${firstAccount.name}`);
      }
    } catch (error) {
      logger.error('Error ensuring default account:', error);
    }
  },

  async getDefaultAccount () {
    try {
      // First check if any accounts exist
      const accountCount = await db.accounts.count();
      if (accountCount === 0) {
        return null;
      }

      // Get all accounts and find the default one
      const allAccounts = await db.accounts.toArray();
      const defaultAccount = allAccounts.find(account => account.isDefault === true);

      if (defaultAccount) {
        return defaultAccount;
      }

      // If no default is set, set the first account as default
      if (allAccounts.length > 0) {
        const firstAccount = allAccounts[0];
        await db.accounts.update(firstAccount.id, { isDefault: true });
        return { ...firstAccount, isDefault: true };
      }

      return null;
    } catch (error) {
      // If any error occurs, return null
      logger.warn('Error getting default account:', error);
      return null;
    }
  },

  async setDefaultAccount (accountId) {
    try {
      // Get all accounts
      const allAccounts = await db.accounts.toArray();

      // Clear all default flags by updating each account individually
      for (const account of allAccounts) {
        if (account.isDefault === true) {
          await db.accounts.update(account.id, { isDefault: false });
        }
      }

      // Set new default
      await db.accounts.update(accountId, { isDefault: true });

      logger.success(`Default account set successfully: ${accountId}`);
    } catch (error) {
      logger.error('Error setting default account:', error);
      throw new Error('Failed to set default account');
    }
  },

  async addAccount (account) {
    try {
      // Check if this is the first account
      const accountCount = await db.accounts.count();
      const isFirstAccount = accountCount === 0;

      const id = await db.accounts.add({
        ...account,
        isDefault: isFirstAccount, // Set first account as default
        createdAt: new Date().toISOString(),
      });

      // Log the action
      await this.addAuditLog('CREATE', 'account', id, {
        name: account.name,
        type: account.type,
        balance: account.currentBalance,
        isDefault: isFirstAccount,
      });

      logger.success('Account added successfully: ' + id);
      return id;
    } catch (error) {
      logger.error('Error adding account:', error);
      throw new Error('Failed to add account');
    }
  },

  async updateAccount (id, updates) {
    try {
      await db.accounts.update(id, updates);
      await this.addAuditLog('UPDATE', 'account', id, updates);
      logger.success('Account updated successfully: ' + id);
    } catch (error) {
      logger.error('Error updating account:', error);
      throw new Error('Failed to update account');
    }
  },

  async deleteAccount (id) {
    try {
      // Check if account has pending transactions
      const pendingCount = await db.pendingTransactions.where('accountId').equals(id).count();
      if (pendingCount > 0) {
        throw new Error('Cannot delete account with pending transactions');
      }

      await db.accounts.delete(id);
      await this.addAuditLog('DELETE', 'account', id, {});
      logger.success('Account deleted successfully: ' + id);
    } catch (error) {
      logger.error('Error deleting account:', error);
      throw error; // Re-throw to let caller handle
    }
  },

  // Pending transaction helpers
  async getPendingTransactions () {
    try {
      const transactions = await db.pendingTransactions.toArray();
      return transactions;
    } catch (error) {
      logger.error('Error getting pending transactions:', error);
      return [];
    }
  },

  async addPendingTransaction (transaction) {
    try {
      const id = await db.pendingTransactions.add({
        ...transaction,
        createdAt: new Date().toISOString(),
      });

      await this.addAuditLog('CREATE', 'pendingTransaction', id, {
        accountId: transaction.accountId,
        amount: transaction.amount,
        category: transaction.category,
        description: transaction.description,
      });

      logger.success('Pending transaction added successfully: ' + id);
      return id;
    } catch (error) {
      logger.error('Error adding pending transaction:', error);
      throw new Error('Failed to add pending transaction');
    }
  },

  async updatePendingTransaction (id, updates) {
    try {
      await db.pendingTransactions.update(id, updates);
      await this.addAuditLog('UPDATE', 'pendingTransaction', id, updates);
      logger.success('Pending transaction updated successfully: ' + id);
    } catch (error) {
      logger.error('Error updating pending transaction:', error);
      throw new Error('Failed to update pending transaction');
    }
  },

  async deletePendingTransaction (id) {
    try {
      await db.pendingTransactions.delete(id);
      await this.addAuditLog('DELETE', 'pendingTransaction', id, {});
      logger.success('Pending transaction deleted successfully: ' + id);
    } catch (error) {
      logger.error('Error deleting pending transaction:', error);
      throw new Error('Failed to delete pending transaction');
    }
  },

  async completePendingTransaction (id) {
    try {
      const transaction = await db.pendingTransactions.get(id);
      if (!transaction) throw new Error('Transaction not found');

      // Update account balance
      const account = await db.accounts.get(transaction.accountId);
      if (!account) throw new Error('Account not found');

      // For expenses (negative amounts), we subtract the absolute value
      // For income (positive amounts), we add the amount
      const balanceChange = transaction.amount;

      await db.transaction('rw', db.accounts, db.pendingTransactions, async () => {
        await db.accounts.update(transaction.accountId, {
          currentBalance: account.currentBalance + balanceChange,
        });
        await db.pendingTransactions.delete(id);
      });

      await this.addAuditLog('COMPLETE', 'pendingTransaction', id, {
        accountId: transaction.accountId,
        amount: transaction.amount,
        newBalance: account.currentBalance + balanceChange,
      });

      logger.success('Pending transaction completed successfully: ' + id);
    } catch (error) {
      logger.error('Error completing pending transaction:', error);
      throw new Error('Failed to complete pending transaction');
    }
  },

  // Fixed expenses helpers
  async getFixedExpenses () {
    try {
      const expenses = await db.fixedExpenses.toArray();
      return expenses;
    } catch (error) {
      logger.error('Error getting fixed expenses:', error);
      return [];
    }
  },

  async getFixedExpense (id) {
    try {
      const expense = await db.fixedExpenses.get(id);
      return expense;
    } catch (error) {
      logger.error('Error getting fixed expense:', error);
      return null;
    }
  },

  async addFixedExpense (expense) {
    try {
      const expenseData = {
        ...expense,
        createdAt: expense.createdAt || new Date().toISOString(),
        isAutoCreated: expense.isAutoCreated || false,
        isManuallyMapped: expense.isManuallyMapped || false,
        mappingConfidence: expense.mappingConfidence || 0,
        mappedAt: expense.mappedAt || null,
        overpaymentAmount: expense.overpaymentAmount || 0,
        overpaymentPercentage: expense.overpaymentPercentage || 0,
        budgetSatisfied: expense.budgetSatisfied || false,
        significantOverpayment: expense.significantOverpayment || false,
      };

      const id = await db.fixedExpenses.add(expenseData);

      await this.addAuditLog('CREATE', 'fixedExpense', id, expense);

      logger.success('Fixed expense added successfully: ' + id);
      return id;
    } catch (error) {
      logger.error('Error adding fixed expense:', error);
      throw new Error('Failed to add fixed expense');
    }
  },

  async updateFixedExpense (id, updates) {
    try {
      logger.debug(`Database: Updating fixed expense ${id} with:`, updates);
      
      // Get the current expense to calculate overpayment fields
      const currentExpense = await db.fixedExpenses.get(id);
      if (!currentExpense) {
        throw new Error('Expense not found');
      }

      // Calculate new values after updates
      const newAmount = updates.amount !== undefined ? updates.amount : currentExpense.amount;
      const newPaidAmount = updates.paidAmount !== undefined ? updates.paidAmount : (currentExpense.paidAmount || 0);
      
      // Calculate overpayment fields
      const overpaymentAmount = Math.max(0, newPaidAmount - newAmount);
      const overpaymentPercentage = newAmount > 0 ? (overpaymentAmount / newAmount) * 100 : 0;
      const budgetSatisfied = newPaidAmount >= newAmount;
      const significantOverpayment = overpaymentPercentage >= 20;

      // Add calculated fields to updates
      const enhancedUpdates = {
        ...updates,
        overpaymentAmount,
        overpaymentPercentage,
        budgetSatisfied,
        significantOverpayment,
      };

      await db.fixedExpenses.update(id, enhancedUpdates);

      // Update monthly history if paidAmount changed
      if (updates.paidAmount !== undefined && updates.paidAmount > 0) {
        await this.updateMonthlyExpenseHistory(id, newAmount, newPaidAmount, overpaymentAmount);
      }

      await this.addAuditLog('UPDATE', 'fixedExpense', id, enhancedUpdates);
      logger.success('Fixed expense updated successfully: ' + id);

      // Verify the update was saved
      const updatedExpense = await db.fixedExpenses.get(id);
      logger.debug(`Database: Verification - expense ${id} after update:`, updatedExpense);
    } catch (error) {
      logger.error('Error updating fixed expense:', error);
      throw new Error('Failed to update fixed expense');
    }
  },

  async deleteFixedExpense (id) {
    try {
      await db.fixedExpenses.delete(id);
      await this.addAuditLog('DELETE', 'fixedExpense', id, {});
      logger.success('Fixed expense deleted successfully: ' + id);
    } catch (error) {
      logger.error('Error deleting fixed expense:', error);
      throw new Error('Failed to delete fixed expense');
    }
  },

  // Paycheck settings helpers
  async getPaycheckSettings () {
    try {
      logger.debug('Getting paycheck settings...');
      const settings = await db.paycheckSettings.toArray();
      logger.debug('Found settings:', settings);
      return settings.length > 0 ? settings[0] : null;
    } catch (error) {
      logger.error('Error getting paycheck settings:', error);
      return null;
    }
  },

  async updatePaycheckSettings (settings) {
    try {
      logger.debug('updatePaycheckSettings called with:', settings);
      const existing = await this.getPaycheckSettings();
      logger.debug('Existing settings:', existing);

      if (existing) {
        logger.debug(`Updating existing settings with ID: ${existing.id}`);
        await db.paycheckSettings.update(existing.id, settings);
      } else {
        logger.debug('Adding new settings');
        await db.paycheckSettings.add(settings);
      }

      await this.addAuditLog('UPDATE', 'paycheckSettings', existing?.id || 'new', settings);
      logger.success('Paycheck settings updated successfully');
    } catch (error) {
      logger.error('Error in updatePaycheckSettings:', error);
      throw error;
    }
  },

  // Audit log helpers
  async addAuditLog (actionType, entityType, entityId, details) {
    try {
      await db.auditLogs.add({
        timestamp: new Date().toISOString(),
        actionType,
        entityType,
        entityId,
        details: JSON.stringify(details),
      });
    } catch (error) {
      logger.error('Error adding audit log:', error);
      // Don't throw here - audit logs shouldn't break the main functionality
    }
  },

  async getAuditLogs () {
    try {
      const logs = await db.auditLogs.orderBy('timestamp').reverse().toArray();
      return logs;
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      return [];
    }
  },

  async clearAuditLogs () {
    try {
      await db.auditLogs.clear();
      logger.success('Audit logs cleared successfully');
    } catch (error) {
      logger.error('Error clearing audit logs:', error);
      throw new Error('Failed to clear audit logs');
    }
  },

  // Category helpers
  async getCategories () {
    try {
      const categories = await db.categories.toArray();
      return categories;
    } catch (error) {
      logger.error('Error getting categories:', error);
      return [];
    }
  },

  async addCategory (category) {
    try {
      const trimmedName = (category.name || '').trim();
      const id = await db.categories.add({
        ...category,
        name: trimmedName,
        nameLower: trimmedName.toLowerCase(),
        isDefault: category.isDefault || false, // Ensure isDefault is explicitly set
        createdAt: new Date().toISOString(),
      });

      await this.addAuditLog('CREATE', 'category', id, category);

      logger.success('Category added successfully: ' + id);
      return id;
    } catch (error) {
      logger.error('Error adding category:', error);
      throw new Error('Failed to add category');
    }
  },

  async updateCategory (id, updates) {
    try {
      let payload = { ...updates };
      if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
        const trimmedName = (updates.name || '').trim();
        payload.name = trimmedName;
        payload.nameLower = trimmedName.toLowerCase();
      }
      await db.categories.update(id, payload);
      await this.addAuditLog('UPDATE', 'category', id, payload);
      logger.success('Category updated successfully: ' + id);
    } catch (error) {
      logger.error('Error updating category:', error);
      throw new Error('Failed to update category');
    }
  },

  async deleteCategory (id) {
    try {
      // Get the category being deleted for audit logging
      const category = await db.categories.get(id);

      // Find all affected items
      const affectedFixedExpenses = await db.fixedExpenses.where('category').equals(category.name).toArray();
      const affectedPendingTransactions = await db.pendingTransactions.where('category').equals(category.name).toArray();

      // Delete the category
      await db.categories.delete(id);
      await this.addAuditLog('DELETE', 'category', id, {
        categoryName: category.name,
        affectedFixedExpenses: affectedFixedExpenses.length,
        affectedPendingTransactions: affectedPendingTransactions.length,
      });

      logger.success('Category deleted successfully: ' + id);
      return {
        affectedFixedExpenses,
        affectedPendingTransactions,
      };
    } catch (error) {
      logger.error('Error deleting category:', error);
      throw new Error('Failed to delete category');
    }
  },

  async reassignCategoryItems (oldCategoryName, newCategoryName, affectedItems) {
    try {
      const updates = [];

      // Update fixed expenses
      for (const expense of affectedItems.fixedExpenses) {
        await db.fixedExpenses.update(expense.id, { category: newCategoryName });
        updates.push({ type: 'fixedExpense', id: expense.id, oldCategory: oldCategoryName, newCategory: newCategoryName });
      }

      // Update pending transactions
      for (const transaction of affectedItems.pendingTransactions) {
        await db.pendingTransactions.update(transaction.id, { category: newCategoryName });
        updates.push({ type: 'pendingTransaction', id: transaction.id, oldCategory: oldCategoryName, newCategory: newCategoryName });
      }

      // Log the reassignment
      await this.addAuditLog('REASSIGN', 'category', null, {
        oldCategory: oldCategoryName,
        newCategory: newCategoryName,
        updates: updates,
      });

      logger.success(`Reassigned ${updates.length} items from "${oldCategoryName}" to "${newCategoryName}"`);
    } catch (error) {
      logger.error('Error reassigning category items:', error);
      throw new Error('Failed to reassign category items');
    }
  },

  // Optimized category query methods
  async getExpensesByCategory (categoryName) {
    try {
      return await db.fixedExpenses.where('category').equals(categoryName).toArray();
    } catch (error) {
      logger.error('Error getting expenses by category:', error);
      return [];
    }
  },

  async getTransactionsByCategory (categoryName) {
    try {
      return await db.pendingTransactions.where('category').equals(categoryName).toArray();
    } catch (error) {
      logger.error('Error getting transactions by category:', error);
      return [];
    }
  },

  async getCategoryUsageStats (categoryName) {
    try {
      const [expenses, transactions] = await Promise.all([
        this.getExpensesByCategory(categoryName),
        this.getTransactionsByCategory(categoryName)
      ]);
      
      return {
        expenseCount: expenses.length,
        transactionCount: transactions.length,
        totalExpenseAmount: expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
        totalTransactionAmount: transactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0)
      };
    } catch (error) {
      logger.error('Error getting category usage stats:', error);
      return { expenseCount: 0, transactionCount: 0, totalExpenseAmount: 0, totalTransactionAmount: 0 };
    }
  },

  async initializeDefaultCategories () {
    try {
      // Get existing categories to check for duplicates
      const existingCategories = await db.categories.toArray();
      const existingCategoryNames = existingCategories.map(cat => cat.name.toLowerCase());

      const defaultCategories = [
        { name: 'Housing', color: '#3B82F6', icon: '🏠', isDefault: true },
        { name: 'Utilities', color: '#10B981', icon: '⚡', isDefault: true },
        { name: 'Insurance', color: '#F59E0B', icon: '🛡️', isDefault: true },
        { name: 'Transportation', color: '#8B5CF6', icon: '🚗', isDefault: true },
        { name: 'Subscriptions', color: '#EC4899', icon: '📱', isDefault: true },
        { name: 'Debt', color: '#EF4444', icon: '💳', isDefault: true },
        { name: 'Healthcare', color: '#06B6D4', icon: '🏥', isDefault: true },
        { name: 'Education', color: '#84CC16', icon: '🎓', isDefault: true },
        { name: 'Other', color: '#6B7280', icon: '📦', isDefault: true },
      ];

      // Only add categories that don't already exist
      const categoriesToAdd = defaultCategories.filter(category =>
        !existingCategoryNames.includes(category.name.toLowerCase()),
      );

      if (categoriesToAdd.length > 0) {
        const withLower = categoriesToAdd.map(c => ({
          ...c,
          nameLower: c.name.toLowerCase(),
        }));
        await db.categories.bulkAdd(withLower);
        logger.success(`Added ${categoriesToAdd.length} default categories`);
      } else {
        logger.info('All default categories already exist');
      }
    } catch (error) {
      logger.error('Error initializing default categories:', error);
    }
  },

  async cleanupDuplicateCategories () {
    try {
      const categories = await db.categories.toArray();
      const seenNames = new Set();
      const duplicates = [];

      // Find duplicates (keep the first occurrence, mark others for deletion)
      for (const category of categories) {
        const nameLower = category.name.toLowerCase();
        if (seenNames.has(nameLower)) {
          duplicates.push(category.id);
        } else {
          seenNames.add(nameLower);
        }
      }

      if (duplicates.length > 0) {
        // Delete duplicate categories
        for (const duplicateId of duplicates) {
          await db.categories.delete(duplicateId);
        }

        logger.success(`Cleaned up ${duplicates.length} duplicate categories`);
        await this.addAuditLog('CLEANUP', 'category', null, {
          duplicatesRemoved: duplicates.length,
        });
      }

      return duplicates.length;
    } catch (error) {
      logger.error('Error cleaning up duplicate categories:', error);
      throw new Error('Failed to cleanup duplicate categories');
    }
  },

  // Monthly Expense History Management
  async getMonthlyExpenseHistory () {
    try {
      const history = await db.monthlyExpenseHistory.toArray();
      return history.sort((a, b) => {
        // Sort by year, then month, then expense ID
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return a.expenseId - b.expenseId;
      });
    } catch (error) {
      logger.error('Error getting monthly expense history:', error);
      throw new Error('Failed to get monthly expense history');
    }
  },

  // Export/Import helpers
  async exportData () {
    try {
      const accounts = await this.getAccounts();
      const pendingTransactions = await this.getPendingTransactions();
      const fixedExpenses = await this.getFixedExpenses();
      const categories = await this.getCategories();
      const creditCards = await this.getCreditCards();
      const paycheckSettings = await this.getPaycheckSettings();
      const auditLogs = await this.getAuditLogs();
      const monthlyExpenseHistory = await this.getMonthlyExpenseHistory();

      const exportData = {
        accounts,
        pendingTransactions,
        fixedExpenses,
        categories,
        creditCards,
        paycheckSettings,
        auditLogs,
        monthlyExpenseHistory,
        exportedAt: new Date().toISOString(),
      };

      logger.success('Data exported successfully');
      return exportData;
    } catch (error) {
      logger.error('Error exporting data:', error);
      throw new Error('Failed to export data');
    }
  },

  async importData (data) {
    try {
      // Validate import data structure
      const validationResult = this.validateImportData(data);
      if (!validationResult.isValid) {
        throw new Error(`Import validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Clear existing data
      await this.clearDatabase();

      // Import new data
      if (data.accounts && Array.isArray(data.accounts)) {
        await db.accounts.bulkAdd(data.accounts);
      }
      if (data.pendingTransactions && Array.isArray(data.pendingTransactions)) {
        await db.pendingTransactions.bulkAdd(data.pendingTransactions);
      }
      if (data.fixedExpenses && Array.isArray(data.fixedExpenses)) {
        await db.fixedExpenses.bulkAdd(data.fixedExpenses);
      }
      if (data.categories && Array.isArray(data.categories)) {
        const categories = data.categories.map(c => ({
          ...c,
          name: (c.name || '').trim(),
          nameLower: (c.name || '').trim().toLowerCase(),
        }));
        await db.categories.bulkAdd(categories);
      }
      if (data.paycheckSettings) {
        // Handle both array and single object cases
        const settings = Array.isArray(data.paycheckSettings) ? data.paycheckSettings[0] : data.paycheckSettings;
        if (settings) {
          await db.paycheckSettings.add(settings);
        }
      }
      if (data.creditCards && Array.isArray(data.creditCards)) {
        await db.creditCards.bulkAdd(data.creditCards);
      }
      if (data.auditLogs && Array.isArray(data.auditLogs)) {
        await db.auditLogs.bulkAdd(data.auditLogs);
      }
      if (data.monthlyExpenseHistory && Array.isArray(data.monthlyExpenseHistory)) {
        await db.monthlyExpenseHistory.bulkAdd(data.monthlyExpenseHistory);
      }

      // Initialize default categories if needed
      await this.initializeDefaultCategories();

      // Invalidate category cache after import to ensure fresh data
      try {
        const { categoryCache } = await import('../services/categoryCache');
        categoryCache.invalidate();
        logger.debug('Category cache invalidated after import');
      } catch (error) {
        logger.warn('Could not invalidate category cache after import:', error);
      }

      logger.success('Data imported successfully');
    } catch (error) {
      logger.error('Error importing data:', error);
      throw new Error(`Failed to import data: ${error.message}`);
    }
  },

  validateImportData (data) {
    const errors = [];

    // Check if data is an object
    if (!data || typeof data !== 'object') {
      errors.push('Invalid data format');
      return { isValid: false, errors };
    }

    // Validate accounts if present
    if (data.accounts) {
      if (!Array.isArray(data.accounts)) {
        errors.push('Accounts must be an array');
      } else {
        data.accounts.forEach((account, index) => {
          if (!account.name || typeof account.name !== 'string') {
            errors.push(`Account ${index + 1}: Missing or invalid name`);
          }
          if (typeof account.currentBalance !== 'number') {
            errors.push(`Account ${index + 1}: Invalid balance`);
          }
          if (!account.type || !['checking', 'savings'].includes(account.type)) {
            errors.push(`Account ${index + 1}: Invalid account type`);
          }
        });
      }
    }

    // Validate pending transactions if present
    if (data.pendingTransactions) {
      if (!Array.isArray(data.pendingTransactions)) {
        errors.push('Pending transactions must be an array');
      } else {
        data.pendingTransactions.forEach((transaction, index) => {
          if (!transaction.accountId || typeof transaction.accountId !== 'number') {
            errors.push(`Transaction ${index + 1}: Missing or invalid account ID`);
          }
          if (typeof transaction.amount !== 'number') {
            errors.push(`Transaction ${index + 1}: Invalid amount`);
          }
          if (!transaction.description || typeof transaction.description !== 'string') {
            errors.push(`Transaction ${index + 1}: Missing or invalid description`);
          }
        });
      }
    }

    // Validate fixed expenses if present
    if (data.fixedExpenses) {
      if (!Array.isArray(data.fixedExpenses)) {
        errors.push('Fixed expenses must be an array');
      } else {
        data.fixedExpenses.forEach((expense, index) => {
          if (!expense.name || typeof expense.name !== 'string') {
            errors.push(`Expense ${index + 1}: Missing or invalid name`);
          }
          if (typeof expense.amount !== 'number') {
            errors.push(`Expense ${index + 1}: Invalid amount`);
          }
          if (!expense.dueDate || isNaN(new Date(expense.dueDate).getTime())) {
            errors.push(`Expense ${index + 1}: Invalid due date`);
          }
          // Validate new smart mapping fields (optional)
          if (expense.isAutoCreated !== undefined && typeof expense.isAutoCreated !== 'boolean') {
            errors.push(`Expense ${index + 1}: Invalid isAutoCreated field`);
          }
          if (expense.isManuallyMapped !== undefined && typeof expense.isManuallyMapped !== 'boolean') {
            errors.push(`Expense ${index + 1}: Invalid isManuallyMapped field`);
          }
          if (expense.mappingConfidence !== undefined && (typeof expense.mappingConfidence !== 'number' || expense.mappingConfidence < 0 || expense.mappingConfidence > 100)) {
            errors.push(`Expense ${index + 1}: Invalid mappingConfidence (must be 0-100)`);
          }
          if (expense.mappedAt !== undefined && expense.mappedAt !== null && isNaN(new Date(expense.mappedAt).getTime())) {
            errors.push(`Expense ${index + 1}: Invalid mappedAt date`);
          }
          // Validate credit card assignment (optional)
          if (expense.creditCardId !== undefined && expense.creditCardId !== null && (typeof expense.creditCardId !== 'number' || expense.creditCardId <= 0)) {
            errors.push(`Expense ${index + 1}: Invalid creditCardId (must be a positive number or null)`);
          }
        });
      }
    }

    // Validate categories if present
    if (data.categories) {
      if (!Array.isArray(data.categories)) {
        errors.push('Categories must be an array');
      } else {
        data.categories.forEach((category, index) => {
          if (!category.name || typeof category.name !== 'string') {
            errors.push(`Category ${index + 1}: Missing or invalid name`);
          }
          if (!category.color || typeof category.color !== 'string') {
            errors.push(`Category ${index + 1}: Missing or invalid color`);
          }
        });
      }
    }

    // Validate credit cards if present
    if (data.creditCards) {
      if (!Array.isArray(data.creditCards)) {
        errors.push('Credit cards must be an array');
      } else {
        data.creditCards.forEach((card, index) => {
          if (!card.name || typeof card.name !== 'string') {
            errors.push(`Credit card ${index + 1}: Missing or invalid name`);
          }
          if (typeof card.balance !== 'number' || card.balance < 0) {
            errors.push(`Credit card ${index + 1}: Invalid balance`);
          }
          if (typeof card.creditLimit !== 'number' || card.creditLimit <= 0) {
            errors.push(`Credit card ${index + 1}: Invalid credit limit`);
          }
          if (typeof card.interestRate !== 'number' || card.interestRate < 0) {
            errors.push(`Credit card ${index + 1}: Invalid interest rate`);
          }
          if (!card.dueDate || isNaN(new Date(card.dueDate).getTime())) {
            errors.push(`Credit card ${index + 1}: Invalid due date`);
          }
          if (typeof card.minimumPayment !== 'number' || card.minimumPayment < 0) {
            errors.push(`Credit card ${index + 1}: Invalid minimum payment`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  // Credit Card Management
  async getCreditCards () {
    try {
      const creditCards = await db.creditCards.toArray();
      return creditCards.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.error('Error getting credit cards:', error);
      throw new Error('Failed to get credit cards');
    }
  },

  async addCreditCard (creditCard) {
    try {
      const id = await db.creditCards.add({
        ...creditCard,
        balance: parseFloat(creditCard.balance) || 0,
        creditLimit: parseFloat(creditCard.creditLimit) || 0,
        interestRate: parseFloat(creditCard.interestRate) || 0,
        minimumPayment: parseFloat(creditCard.minimumPayment) || 0,
        createdAt: new Date().toISOString(),
      });

      // Auto-create a fixed expense for this credit card
      const minimumPayment = parseFloat(creditCard.minimumPayment) || 0;
      const dueDate = creditCard.dueDate || null;
      
      if (minimumPayment > 0) {
        const expenseData = {
          name: `${creditCard.name} Payment`,
          dueDate: dueDate,
          amount: minimumPayment,
          accountId: id, // Link to the credit card
          category: 'Credit Card Payment',
          paidAmount: 0,
          status: 'pending',
          isAutoCreated: true, // Flag to identify auto-created expenses
          createdAt: new Date().toISOString(),
        };

        await db.fixedExpenses.add(expenseData);
        logger.success(`Auto-created fixed expense for credit card: ${creditCard.name}`);
      }

      logger.success('Credit card added successfully');
      return id;
    } catch (error) {
      logger.error('Error adding credit card:', error);
      throw new Error('Failed to add credit card');
    }
  },

  async updateCreditCard (id, updates) {
    try {
      const payload = { ...updates };
      if (updates.balance !== undefined) payload.balance = parseFloat(updates.balance) || 0;
      if (updates.creditLimit !== undefined) payload.creditLimit = parseFloat(updates.creditLimit) || 0;
      if (updates.interestRate !== undefined) payload.interestRate = parseFloat(updates.interestRate) || 0;
      if (updates.minimumPayment !== undefined) payload.minimumPayment = parseFloat(updates.minimumPayment) || 0;

      await db.creditCards.update(id, payload);
      logger.success('Credit card updated successfully');
    } catch (error) {
      logger.error('Error updating credit card:', error);
      throw new Error('Failed to update credit card');
    }
  },

  async deleteCreditCard (id) {
    try {
      // Check for linked fixed expenses before deletion
      const linkedExpenses = await db.fixedExpenses.where('accountId').equals(id).toArray();
      
      if (linkedExpenses.length > 0) {
        logger.warn(`Credit card ${id} has ${linkedExpenses.length} linked fixed expenses`);
        // Note: The actual handling of linked expenses is done in the UI modal
        // This is just for logging and potential future server-side handling
      }

      await db.creditCards.delete(id);
      logger.success('Credit card deleted successfully');
    } catch (error) {
      logger.error('Error deleting credit card:', error);
      throw new Error('Failed to delete credit card');
    }
  },

  async getLinkedExpensesForCreditCard (creditCardId) {
    try {
      const expenses = await db.fixedExpenses.where('accountId').equals(creditCardId).toArray();
      return expenses;
    } catch (error) {
      logger.error('Error getting linked expenses for credit card:', error);
      throw new Error('Failed to get linked expenses');
    }
  },

  // Smart detection algorithm for existing credit card expenses
  async detectCreditCardExpenses () {
    try {
      const creditCards = await this.getCreditCards();
      const fixedExpenses = await this.getFixedExpenses();
      
      const detectedMappings = [];
      
      for (const card of creditCards) {
        const cardNameWords = card.name.toLowerCase().split(/\s+/);
        
        // Find potential matches
        const potentialMatches = fixedExpenses.filter(expense => {
          // Skip if already linked to this credit card
          if (expense.accountId === card.id) return false;
          
          const expenseName = expense.name.toLowerCase();
          
          // Direct name match
          if (expenseName.includes(card.name.toLowerCase())) {
            return true;
          }
          
          // Check if any significant word from card name is in expense name
          const significantWords = cardNameWords.filter(word => 
            word.length > 2 && !['card', 'credit', 'payment', 'the', 'and', 'of'].includes(word)
          );
          
          return significantWords.some(word => expenseName.includes(word));
        });
        
        // Score and rank matches
        potentialMatches.forEach(expense => {
          let confidence = 0;
          const expenseName = expense.name.toLowerCase();
          
          // Exact name match
          if (expenseName.includes(card.name.toLowerCase())) {
            confidence += 90;
          }
          
          // Contains "payment"
          if (expenseName.includes('payment')) {
            confidence += 20;
          }
          
          // Category is credit card related
          if (expense.category && expense.category.toLowerCase().includes('credit')) {
            confidence += 30;
          }
          
          // Word overlap scoring
          const overlap = cardNameWords.filter(word => 
            word.length > 2 && expenseName.includes(word)
          ).length;
          confidence += overlap * 15;
          
          // Amount similarity (if close to minimum payment)
          if (card.minimumPayment && Math.abs(expense.amount - card.minimumPayment) < 10) {
            confidence += 25;
          }
          
          detectedMappings.push({
            creditCardId: card.id,
            creditCardName: card.name,
            expenseId: expense.id,
            expenseName: expense.name,
            confidence: Math.min(confidence, 100),
            isAlreadyLinked: expense.accountId === card.id,
            suggestedAction: confidence > 70 ? 'auto-link' : confidence > 40 ? 'suggest' : 'manual'
          });
        });
      }
      
      // Sort by confidence
      detectedMappings.sort((a, b) => b.confidence - a.confidence);
      
      return detectedMappings;
    } catch (error) {
      logger.error('Error detecting credit card expenses:', error);
      throw new Error('Failed to detect credit card expenses');
    }
  },

  // Apply detected mappings to link existing expenses to credit cards
  async applyExpenseMappings (mappings) {
    try {
      let appliedCount = 0;
      const results = [];
      
      for (const mapping of mappings) {
        try {
          // Update the expense to link it to the credit card
          await db.fixedExpenses.update(mapping.expenseId, {
            accountId: mapping.creditCardId,
            isManuallyMapped: true, // Flag to indicate user-confirmed mapping
            mappingConfidence: mapping.confidence,
            mappedAt: new Date().toISOString()
          });
          
          appliedCount++;
          results.push({
            success: true,
            expenseId: mapping.expenseId,
            expenseName: mapping.expenseName,
            creditCardName: mapping.creditCardName,
            confidence: mapping.confidence
          });
          
          logger.success(`Mapped "${mapping.expenseName}" to "${mapping.creditCardName}"`);
        } catch (error) {
          results.push({
            success: false,
            expenseId: mapping.expenseId,
            expenseName: mapping.expenseName,
            creditCardName: mapping.creditCardName,
            error: error.message
          });
          logger.error(`Failed to map "${mapping.expenseName}" to "${mapping.creditCardName}":`, error);
        }
      }
      
      logger.success(`Applied ${appliedCount} expense mappings`);
      return { appliedCount, results };
    } catch (error) {
      logger.error('Error applying expense mappings:', error);
      throw new Error('Failed to apply expense mappings');
    }
  },

  // Clean up duplicate credit card expenses (for migration)
  async cleanupDuplicateCreditCardExpenses () {
    try {
      const fixedExpenses = await this.getFixedExpenses();
      const creditCards = await this.getCreditCards();
      
      const duplicatesRemoved = [];
      
      // Find auto-created expenses that have manual counterparts
      const autoCreatedExpenses = fixedExpenses.filter(expense => expense.isAutoCreated);
      
      for (const autoExpense of autoCreatedExpenses) {
        // Find manual expenses for the same credit card
        const manualExpenses = fixedExpenses.filter(expense => 
          !expense.isAutoCreated && 
          expense.accountId === autoExpense.accountId
        );
        
        // If there's a manual expense for the same credit card, remove the auto-created one
        if (manualExpenses.length > 0) {
          await db.fixedExpenses.delete(autoExpense.id);
          duplicatesRemoved.push({
            id: autoExpense.id,
            name: autoExpense.name,
            reason: 'Manual expense exists for same credit card'
          });
          logger.success(`Removed duplicate auto-created expense: ${autoExpense.name}`);
        }
      }
      
      logger.success(`Cleaned up ${duplicatesRemoved.length} duplicate expenses`);
      return duplicatesRemoved;
    } catch (error) {
      logger.error('Error cleaning up duplicate expenses:', error);
      throw new Error('Failed to clean up duplicate expenses');
    }
  },

  async createMissingCreditCardExpenses () {
    try {
      const creditCards = await this.getCreditCards();
      const fixedExpenses = await this.getFixedExpenses();
      
      let createdCount = 0;
      
      for (const card of creditCards) {
        // Check if this credit card already has ANY linked expense (auto-created OR manually linked)
        const hasLinkedExpense = fixedExpenses.some(expense => 
          expense.accountId === card.id
        );
        
        // Only create if minimum payment > 0 and no expense exists for this card
        if (card.minimumPayment > 0 && !hasLinkedExpense) {
          const expenseData = {
            name: `${card.name} Payment`,
            dueDate: card.dueDate,
            amount: card.minimumPayment,
            accountId: card.id,
            category: 'Credit Card Payment',
            paidAmount: 0,
            status: 'pending',
            isAutoCreated: true,
            createdAt: new Date().toISOString(),
          };

          await db.fixedExpenses.add(expenseData);
          createdCount++;
          logger.success(`Auto-created fixed expense for existing credit card: ${card.name}`);
        }
      }
      
      if (createdCount > 0) {
        logger.success(`Created ${createdCount} missing credit card expenses`);
      }
      
      return createdCount;
    } catch (error) {
      logger.error('Error creating missing credit card expenses:', error);
      throw new Error('Failed to create missing credit card expenses');
    }
  },

  async addCreditCardPayment (creditCardId, payment) {
    try {
      const creditCard = await db.creditCards.get(creditCardId);
      if (!creditCard) {
        throw new Error('Credit card not found');
      }

      const newBalance = creditCard.balance - parseFloat(payment.amount);
      await db.creditCards.update(creditCardId, { balance: Math.max(0, newBalance) });

      // Add payment to audit log
      await db.auditLogs.add({
        timestamp: new Date().toISOString(),
        actionType: 'payment',
        entityType: 'creditCard',
        entityId: creditCardId,
        details: {
          amount: payment.amount,
          previousBalance: creditCard.balance,
          newBalance: Math.max(0, newBalance),
          paymentDate: payment.date || new Date().toISOString(),
        },
      });

      logger.success('Credit card payment recorded successfully');
    } catch (error) {
      logger.error('Error recording credit card payment:', error);
      throw new Error('Failed to record payment');
    }
  },

  // User Preferences Management
  async getUserPreferences (component = 'fixedExpenses') {
    try {
      const prefs = await db.userPreferences.where('component').equals(component).first();
      return prefs ? prefs.preferences : null;
    } catch (error) {
      logger.error('Error getting user preferences:', error);
      return null;
    }
  },

  async updateUserPreferences (preferences, component = 'fixedExpenses') {
    try {
      const existing = await db.userPreferences.where('component').equals(component).first();

      if (existing) {
        await db.userPreferences.update(existing.id, { preferences });
      } else {
        await db.userPreferences.add({
          component,
          preferences,
          createdAt: new Date().toISOString(),
        });
      }

      logger.success('User preferences updated successfully');
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw new Error('Failed to update user preferences');
    }
  },

  // Analytics and Insights helpers
  async updateMonthlyExpenseHistory (expenseId, budgetAmount, actualAmount, overpaymentAmount) {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Check if entry already exists for this month
      const existing = await db.monthlyExpenseHistory
        .where(['expenseId', 'month', 'year'])
        .equals([expenseId, month, year])
        .first();

      if (existing) {
        // Update existing entry
        await db.monthlyExpenseHistory.update(existing.id, {
          budgetAmount,
          actualAmount,
          overpaymentAmount,
        });
      } else {
        // Create new entry
        await db.monthlyExpenseHistory.add({
          expenseId,
          month,
          year,
          budgetAmount,
          actualAmount,
          overpaymentAmount,
          createdAt: now.toISOString(),
        });
      }

      logger.debug(`Updated monthly history for expense ${expenseId}`);
    } catch (error) {
      logger.error('Error updating monthly expense history:', error);
    }
  },

  async getMonthlyExpenseHistory (months = 12) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      
      const history = await db.monthlyExpenseHistory
        .where('year').aboveOrEqual(cutoffDate.getFullYear())
        .toArray();

      return history.filter(entry => {
        const entryDate = new Date(entry.year, entry.month - 1);
        return entryDate >= cutoffDate;
      });
    } catch (error) {
      logger.error('Error getting monthly expense history:', error);
      return [];
    }
  },

  async getBudgetVsActualSummary () {
    try {
      const expenses = await this.getFixedExpenses();
      
      const summary = expenses.reduce((acc, expense) => {
        acc.totalBudget += expense.amount || 0;
        acc.totalActual += expense.paidAmount || 0;
        acc.totalOverpayment += expense.overpaymentAmount || 0;
        
        if (expense.significantOverpayment) {
          acc.significantOverpayments += 1;
        }
        
        return acc;
      }, {
        totalBudget: 0,
        totalActual: 0,
        totalOverpayment: 0,
        significantOverpayments: 0,
      });

      summary.budgetAccuracy = summary.totalBudget > 0 
        ? (summary.totalActual / summary.totalBudget) * 100 
        : 0;

      return summary;
    } catch (error) {
      logger.error('Error getting budget vs actual summary:', error);
      return {
        totalBudget: 0,
        totalActual: 0,
        totalOverpayment: 0,
        significantOverpayments: 0,
        budgetAccuracy: 0,
      };
    }
  },

  async getOverpaymentByCategory () {
    try {
      const expenses = await this.getFixedExpenses();
      
      const categoryData = expenses.reduce((acc, expense) => {
        const category = expense.category || 'Uncategorized';
        
        if (!acc[category]) {
          acc[category] = {
            totalBudget: 0,
            totalActual: 0,
            totalOverpayment: 0,
            expenseCount: 0,
            significantOverpayments: 0,
          };
        }
        
        acc[category].totalBudget += expense.amount || 0;
        acc[category].totalActual += expense.paidAmount || 0;
        acc[category].totalOverpayment += expense.overpaymentAmount || 0;
        acc[category].expenseCount += 1;
        
        if (expense.significantOverpayment) {
          acc[category].significantOverpayments += 1;
        }
        
        return acc;
      }, {});

      // Calculate percentages for each category
      Object.keys(categoryData).forEach(category => {
        const data = categoryData[category];
        data.overpaymentPercentage = data.totalBudget > 0 
          ? (data.totalOverpayment / data.totalBudget) * 100 
          : 0;
      });

      return categoryData;
    } catch (error) {
      logger.error('Error getting overpayment by category:', error);
      return {};
    }
  },

  async calculateDebtPayoff (balance, payment, interestRate) {
    try {
      const monthlyRate = interestRate / 100 / 12;
      let remainingBalance = balance;
      let totalInterest = 0;
      let months = 0;

      if (payment <= remainingBalance * monthlyRate) {
        // Payment doesn't cover interest, debt will never be paid off
        return {
          payoffMonths: -1,
          totalInterest: -1,
          payoffDate: null,
          monthlyInterest: remainingBalance * monthlyRate,
        };
      }

      while (remainingBalance > 0.01 && months < 600) {
        const interestPayment = remainingBalance * monthlyRate;
        const principalPayment = Math.min(payment - interestPayment, remainingBalance);

        totalInterest += interestPayment;
        remainingBalance -= principalPayment;
        months++;
      }

      const payoffDate = new Date();
      payoffDate.setMonth(payoffDate.getMonth() + months);

      return {
        payoffMonths: months,
        totalInterest: Math.round(totalInterest * 100) / 100,
        payoffDate: payoffDate.toISOString().split('T')[0],
        monthlyInterest: balance * monthlyRate,
      };
    } catch (error) {
      logger.error('Error calculating debt payoff:', error);
      return {
        payoffMonths: -1,
        totalInterest: -1,
        payoffDate: null,
        monthlyInterest: 0,
      };
    }
  },

  // This method is deprecated. Use dataManager.backupManager.restoreBackup() instead.
  async restoreFromBackup () {
    const { dataManager } = await import('../services/dataManager');
    const backup = await dataManager.backupManager.getLatestBackup();
    if (!backup) {
      throw new Error('No backup found');
    }
    await dataManager.backupManager.restoreBackup(backup.key);
  },
};

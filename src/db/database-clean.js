import Dexie from 'dexie';

import { dataIntegrity } from '../utils/crypto';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';

/**
 * Clean Consolidated Digibook Database Schema
 *
 * This is a clean, consolidated version that combines all features
 * into a logical, optimized structure with just 4 versions.
 */

export class DigibookDBClean extends Dexie {
  constructor(dbName = 'DigibookDB_Fresh') {
    super(dbName);

    // Single version with all features - simplified schema to avoid index conflicts
    this.version(1).stores({
      accounts: '++id, name, type, currentBalance, isDefault, createdAt',
      pendingTransactions:
        '++id, accountId, amount, category, description, createdAt',
      fixedExpenses:
        '++id, name, dueDate, amount, accountId, paidAmount, status, category, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, createdAt',
      categories: '++id, name, color, icon, isDefault, createdAt',
      creditCards:
        '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency, createdAt',
      userPreferences: '++id, component, preferences, createdAt',
      monthlyExpenseHistory:
        '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    });
  }
}

// Create the database instance
export const db = new DigibookDBClean();

// Initialize database with error handling
export async function initializeDatabase() {
  try {
    await db.open();
    logger.success('Database initialized successfully');
    return true;
  } catch (error) {
    logger.error('Database initialization failed:', error);

    // If initialization fails, try to force reset all databases
    try {
      logger.info('Attempting to force reset all databases...');

      // Force clear all databases
      await dbHelpers.forceResetAllDatabases();

      // Create a completely new database instance with unique name
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 15);
      const uniqueDbName = `DigibookDB_New_${timestamp}_${randomSuffix}`;
      logger.info(`Creating new database with name: ${uniqueDbName}`);
      const newDb = new DigibookDBClean(uniqueDbName);
      await newDb.open();

      // Replace the global db instance properties
      Object.setPrototypeOf(db, Object.getPrototypeOf(newDb));
      Object.assign(db, newDb);

      logger.success('Database recreated successfully');
      return true;
    } catch (recreateError) {
      logger.error('Database recreation failed:', recreateError);
      throw new Error(
        `Failed to initialize database: ${recreateError.message}`
      );
    }
  }
}

/**
 * Database helper functions
 * These provide a clean API for all database operations
 */
export const dbHelpers = {
  // Database management
  async clearDatabase() {
    try {
      await db.accounts.clear();
      await db.pendingTransactions.clear();
      await db.fixedExpenses.clear();
      await db.categories.clear();
      await db.creditCards.clear();
      await db.paycheckSettings.clear();
      await db.userPreferences.clear();
      await db.monthlyExpenseHistory.clear();
      await db.auditLogs.clear();
      logger.success('Database cleared successfully');
    } catch (error) {
      logger.error('Error clearing database:', error);
    }
  },

  // Reset database to fix version conflicts
  async resetDatabase() {
    try {
      logger.info('Resetting database to fix version conflicts...');
      await db.delete();
      await db.open();
      logger.success('Database reset successfully');
    } catch (error) {
      logger.error('Error resetting database:', error);
      throw error;
    }
  },

  // Force clear all IndexedDB databases for this origin
  async forceResetAllDatabases() {
    try {
      logger.info('Force resetting all IndexedDB databases...');

      // Close current database
      if (db.isOpen()) {
        await db.close();
      }

      // Get all database names
      const databases = await indexedDB.databases();
      logger.info(`Found ${databases.length} databases to check`);

      // Delete all databases that might be related
      const dbNamesToDelete = [
        'DigibookDB_Fresh',
        'DigibookDB',
        'DigibookDB_v1',
        'DigibookDB_v2',
        'DigibookDB_v3',
        'DigibookDB_v4',
        'DigibookDB_v5',
        'DigibookDB_v6',
        'DigibookDB_v7',
        'DigibookDB_v8',
        'DigibookDB_v9',
        'DigibookDB_v10',
      ];

      // Add any databases found by indexedDB.databases()
      for (const database of databases) {
        if (database.name && database.name.includes('Digibook')) {
          dbNamesToDelete.push(database.name);
        }
      }

      // Remove duplicates
      const uniqueDbNames = [...new Set(dbNamesToDelete)];

      // Delete all databases
      for (const dbName of uniqueDbNames) {
        try {
          logger.info(`Attempting to delete database: ${dbName}`);
          await new Promise((resolve, reject) => {
            const deleteReq = indexedDB.deleteDatabase(dbName);
            deleteReq.onsuccess = () => {
              logger.info(`Successfully deleted: ${dbName}`);
              resolve();
            };
            deleteReq.onerror = () => {
              logger.warn(`Failed to delete ${dbName}:`, deleteReq.error);
              resolve(); // Continue even if one fails
            };
            deleteReq.onblocked = () => {
              logger.warn(`Database ${dbName} is blocked, waiting...`);
              setTimeout(() => resolve(), 500);
            };
          });
        } catch (error) {
          logger.warn(`Error deleting ${dbName}:`, error);
        }
      }

      // Clear localStorage and sessionStorage as well
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('digibook')) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          logger.info(`Removed localStorage key: ${key}`);
        });
      } catch (error) {
        logger.warn('Error clearing localStorage:', error);
      }

      // Wait longer for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      logger.success('All databases and storage cleared successfully');
      return true;
    } catch (error) {
      logger.error('Error force resetting databases:', error);
      throw error;
    }
  },

  // Account helpers
  async getAccounts() {
    const accounts = await db.accounts.toArray();

    // Ensure there's always a default account if accounts exist
    if (accounts.length > 0) {
      const hasDefault = accounts.some(account => account.isDefault);
      if (!hasDefault) {
        await this.setDefaultAccount(accounts[0].id);
        return await db.accounts.toArray();
      }
    }

    return accounts;
  },

  // Credit card helpers
  async getCreditCards() {
    try {
      const creditCards = await db.creditCards.toArray();
      return creditCards.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.error('Error getting credit cards:', error);
      throw new Error('Failed to get credit cards');
    }
  },

  async addCreditCard(creditCard) {
    try {
      const creditCardData = {
        ...creditCard,
        createdAt: new Date().toISOString(),
      };

      const id = await db.creditCards.add(creditCardData);
      logger.success(`Credit card added successfully: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding credit card:', error);
      throw new Error(`Failed to add credit card: ${error.message}`);
    }
  },

  async updateCreditCard(id, updates) {
    try {
      await db.creditCards.update(id, updates);
      logger.success(`Credit card updated successfully: ${id}`);
    } catch (error) {
      logger.error('Error updating credit card:', error);
      throw new Error('Failed to update credit card');
    }
  },

  async deleteCreditCard(id) {
    try {
      await db.creditCards.delete(id);
      logger.success(`Credit card deleted successfully: ${id}`);
    } catch (error) {
      logger.error('Error deleting credit card:', error);
      throw new Error('Failed to delete credit card');
    }
  },

  // Pending transaction helpers
  async getPendingTransactions() {
    try {
      const transactions = await db.pendingTransactions.toArray();
      return transactions.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    } catch (error) {
      logger.error('Error getting pending transactions:', error);
      throw new Error('Failed to get pending transactions');
    }
  },

  async addPendingTransaction(transaction) {
    try {
      const transactionData = {
        ...transaction,
        createdAt: new Date().toISOString(),
      };

      const id = await db.pendingTransactions.add(transactionData);
      logger.success(`Pending transaction added successfully: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding pending transaction:', error);
      throw new Error(`Failed to add pending transaction: ${error.message}`);
    }
  },

  async updatePendingTransaction(id, updates) {
    try {
      await db.pendingTransactions.update(id, updates);
      logger.success(`Pending transaction updated successfully: ${id}`);
    } catch (error) {
      logger.error('Error updating pending transaction:', error);
      throw new Error('Failed to update pending transaction');
    }
  },

  async deletePendingTransaction(id) {
    try {
      await db.pendingTransactions.delete(id);
      logger.success(`Pending transaction deleted successfully: ${id}`);
    } catch (error) {
      logger.error('Error deleting pending transaction:', error);
      throw new Error('Failed to delete pending transaction');
    }
  },

  async completePendingTransaction(id) {
    try {
      await db.pendingTransactions.delete(id);
      logger.success(`Pending transaction completed successfully: ${id}`);
    } catch (error) {
      logger.error('Error completing pending transaction:', error);
      throw new Error('Failed to complete pending transaction');
    }
  },

  // Fixed expense helpers
  async getFixedExpenses() {
    try {
      const expenses = await db.fixedExpenses.toArray();
      return expenses.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    } catch (error) {
      logger.error('Error getting fixed expenses:', error);
      throw new Error('Failed to get fixed expenses');
    }
  },

  async addFixedExpense(expense) {
    try {
      // Validate expense data
      if (
        !expense.name ||
        !expense.dueDate ||
        !expense.amount ||
        !expense.accountId ||
        !expense.category
      ) {
        throw new Error('Missing required expense fields');
      }

      const expenseData = {
        ...expense,
        createdAt: new Date().toISOString(),

        // Ensure numeric fields are properly typed
        amount: parseFloat(expense.amount),
        paidAmount: parseFloat(expense.paidAmount || 0),
        accountId: expense.accountId,
        status: expense.status || 'pending',
      };

      const id = await db.fixedExpenses.add(expenseData);
      logger.success(`Fixed expense added successfully: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding fixed expense:', error);
      throw new Error(`Failed to add fixed expense: ${error.message}`);
    }
  },

  async updateFixedExpense(id, updates) {
    try {
      await db.fixedExpenses.update(id, updates);
      logger.success(`Fixed expense updated successfully: ${id}`);
    } catch (error) {
      logger.error('Error updating fixed expense:', error);
      throw new Error('Failed to update fixed expense');
    }
  },

  async deleteFixedExpense(id) {
    try {
      await db.fixedExpenses.delete(id);
      logger.success(`Fixed expense deleted successfully: ${id}`);
    } catch (error) {
      logger.error('Error deleting fixed expense:', error);
      throw new Error('Failed to delete fixed expense');
    }
  },

  async getDefaultAccount() {
    try {
      const accountCount = await db.accounts.count();
      if (accountCount === 0) {
        return null;
      }

      const allAccounts = await db.accounts.toArray();
      const defaultAccount = allAccounts.find(
        account => account.isDefault === true
      );

      if (defaultAccount) {
        return defaultAccount;
      }

      if (allAccounts.length > 0) {
        const firstAccount = allAccounts[0];
        await db.accounts.update(firstAccount.id, { isDefault: true });
        return { ...firstAccount, isDefault: true };
      }

      return null;
    } catch (error) {
      logger.warn('Error getting default account:', error);
      return null;
    }
  },

  async setDefaultAccount(accountId) {
    try {
      const allAccounts = await db.accounts.toArray();

      for (const account of allAccounts) {
        if (account.isDefault === true) {
          await db.accounts.update(account.id, { isDefault: false });
        }
      }

      await db.accounts.update(accountId, { isDefault: true });
      logger.success(`Default account set successfully: ${accountId}`);
    } catch (error) {
      logger.error('Error setting default account:', error);
      throw new Error('Failed to set default account');
    }
  },

  async addAccount(account) {
    try {
      // Validate account data
      const validation = dataIntegrity.validateAccount(account);
      if (!validation.isValid) {
        throw new Error(
          `Invalid account data: ${validation.errors.join(', ')}`
        );
      }

      // Sanitize account data
      const sanitizedAccount = {
        ...account,
        name: dataIntegrity.sanitizeString(account.name),
      };

      const accountCount = await db.accounts.count();
      const isFirstAccount = accountCount === 0;

      const accountData = {
        ...sanitizedAccount,
        isDefault: isFirstAccount,
        createdAt: new Date().toISOString(),
      };

      const id = await db.accounts.add(accountData);

      // If this is the first real account, clean up any placeholder default accounts
      if (isFirstAccount) {
        await this.cleanupDuplicateDefaults();
      }

      logger.success(`Account added successfully: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding account:', error);
      throw new Error(`Failed to add account: ${error.message}`);
    }
  },

  async updateAccount(id, updates) {
    try {
      await db.accounts.update(id, updates);
      logger.success(`Account updated successfully: ${id}`);
    } catch (error) {
      logger.error('Error updating account:', error);
      throw new Error('Failed to update account');
    }
  },

  async deleteAccount(id) {
    try {
      const pendingCount = await db.pendingTransactions
        .where('accountId')
        .equals(id)
        .count();
      if (pendingCount > 0) {
        throw new Error('Cannot delete account with pending transactions');
      }

      await db.accounts.delete(id);
      logger.success(`Account deleted successfully: ${id}`);
    } catch (error) {
      logger.error('Error deleting account:', error);
      throw error;
    }
  },

  // Category helpers
  async getCategories() {
    try {
      const categories = await db.categories.toArray();
      return categories;
    } catch (error) {
      logger.error('Error getting categories:', error);
      return [];
    }
  },

  async addCategory(category) {
    try {
      // Validate category data
      const validation = dataIntegrity.validateCategory(category);
      if (!validation.isValid) {
        throw new Error(
          `Invalid category data: ${validation.errors.join(', ')}`
        );
      }

      // Use sanitized data
      const sanitizedCategory = validation.sanitized;
      const trimmedName = sanitizedCategory.name.trim();

      const categoryData = {
        ...sanitizedCategory,
        name: trimmedName,
        isDefault: sanitizedCategory.isDefault || false,
        createdAt: new Date().toISOString(),
      };

      const id = await db.categories.add(categoryData);
      logger.success(`Category added successfully: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding category:', error);
      throw new Error(`Failed to add category: ${error.message}`);
    }
  },

  async updateCategory(id, updates) {
    try {
      const payload = { ...updates };
      if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
        const trimmedName = (updates.name || '').trim();
        payload.name = trimmedName;
      }
      await db.categories.update(id, payload);
      logger.success(`Category updated successfully: ${id}`);
    } catch (error) {
      logger.error('Error updating category:', error);
      throw new Error('Failed to update category');
    }
  },

  async deleteCategory(id) {
    try {
      const category = await db.categories.get(id);
      const affectedFixedExpenses = await db.fixedExpenses
        .where('category')
        .equals(category.name)
        .toArray();
      const affectedPendingTransactions = await db.pendingTransactions
        .where('category')
        .equals(category.name)
        .toArray();

      await db.categories.delete(id);
      logger.success(`Category deleted successfully: ${id}`);
      return {
        affectedFixedExpenses,
        affectedPendingTransactions,
      };
    } catch (error) {
      logger.error('Error deleting category:', error);
      throw new Error('Failed to delete category');
    }
  },

  async getExpensesByCategory(categoryName) {
    try {
      const expenses = await db.fixedExpenses
        .where('category')
        .equals(categoryName)
        .toArray();
      return expenses;
    } catch (error) {
      logger.error('Error getting expenses by category:', error);
      return [];
    }
  },

  async getTransactionsByCategory(categoryName) {
    try {
      const transactions = await db.pendingTransactions
        .where('category')
        .equals(categoryName)
        .toArray();
      return transactions;
    } catch (error) {
      logger.error('Error getting transactions by category:', error);
      return [];
    }
  },

  async reassignCategoryItems(oldCategoryName, newCategoryName, affectedItems) {
    try {
      // Update fixed expenses
      const expenseIds =
        affectedItems.fixedExpenses?.map(expense => expense.id) || [];
      for (const expenseId of expenseIds) {
        await db.fixedExpenses.update(expenseId, { category: newCategoryName });
      }

      // Update pending transactions
      const transactionIds =
        affectedItems.pendingTransactions?.map(transaction => transaction.id) ||
        [];
      for (const transactionId of transactionIds) {
        await db.pendingTransactions.update(transactionId, {
          category: newCategoryName,
        });
      }

      logger.success(
        `Reassigned ${expenseIds.length} expenses and ${transactionIds.length} transactions from ${oldCategoryName} to ${newCategoryName}`
      );
    } catch (error) {
      logger.error('Error reassigning category items:', error);
      throw new Error('Failed to reassign category items');
    }
  },

  async getCategoryUsageStats(categoryName) {
    try {
      const expenses = await db.fixedExpenses
        .where('category')
        .equals(categoryName)
        .toArray();
      const transactions = await db.pendingTransactions
        .where('category')
        .equals(categoryName)
        .toArray();

      return {
        expenseCount: expenses.length,
        transactionCount: transactions.length,
        totalExpenseAmount: expenses.reduce(
          (sum, expense) => sum + expense.amount,
          0
        ),
        totalTransactionAmount: transactions.reduce(
          (sum, transaction) => sum + transaction.amount,
          0
        ),
      };
    } catch (error) {
      logger.error('Error getting category usage stats:', error);
      return {
        expenseCount: 0,
        transactionCount: 0,
        totalExpenseAmount: 0,
        totalTransactionAmount: 0,
      };
    }
  },

  // Initialize default categories
  async initializeDefaultCategories() {
    try {
      const existingCategories = await db.categories.toArray();
      const existingCategoryNames = existingCategories.map(cat =>
        cat.name.toLowerCase()
      );

      const defaultCategories = [
        { name: 'Housing', color: '#3B82F6', icon: '🏠', isDefault: true },
        { name: 'Utilities', color: '#10B981', icon: '⚡', isDefault: true },
        { name: 'Insurance', color: '#F59E0B', icon: '🛡️', isDefault: true },
        {
          name: 'Transportation',
          color: '#8B5CF6',
          icon: '🚗',
          isDefault: true,
        },
        {
          name: 'Subscriptions',
          color: '#EC4899',
          icon: '📱',
          isDefault: true,
        },
        { name: 'Credit Card', color: '#F97316', icon: '💳', isDefault: true },
        { name: 'Debt', color: '#EF4444', icon: '📊', isDefault: true },
        { name: 'Healthcare', color: '#06B6D4', icon: '🏥', isDefault: true },
        { name: 'Education', color: '#84CC16', icon: '🎓', isDefault: true },
        { name: 'Other', color: '#6B7280', icon: '📦', isDefault: true },
      ];

      const categoriesToAdd = defaultCategories.filter(
        category => !existingCategoryNames.includes(category.name.toLowerCase())
      );

      if (categoriesToAdd.length > 0) {
        const withTimestamps = categoriesToAdd.map(c => ({
          ...c,
          createdAt: new Date().toISOString(),
        }));
        await db.categories.bulkAdd(withTimestamps);
        logger.success(`Added ${categoriesToAdd.length} default categories`);
      } else {
        logger.info('All default categories already exist');
      }
    } catch (error) {
      logger.error('Error initializing default categories:', error);
    }
  },

  // Paycheck settings helpers
  async getPaycheckSettings() {
    try {
      const settings = await db.paycheckSettings.toArray();
      return settings.length > 0 ? settings[0] : null;
    } catch (error) {
      logger.error('Error getting paycheck settings:', error);
      return null;
    }
  },

  async updatePaycheckSettings(settings) {
    try {
      // Validate settings before saving
      if (
        settings.lastPaycheckDate &&
        !DateUtils.isValidDate(settings.lastPaycheckDate)
      ) {
        throw new Error('Invalid date format for lastPaycheckDate');
      }

      if (settings.frequency && !['biweekly'].includes(settings.frequency)) {
        throw new Error('Invalid frequency value');
      }

      const existingSettings = await db.paycheckSettings.toArray();
      if (existingSettings.length > 0) {
        await db.paycheckSettings.update(existingSettings[0].id, settings);
      } else {
        await db.paycheckSettings.add({
          ...settings,
          createdAt: new Date().toISOString(),
        });
      }
      logger.success('Paycheck settings updated successfully');
    } catch (error) {
      logger.error('Error updating paycheck settings:', error);
      logger.error('Settings data:', settings);
      throw new Error(`Failed to update paycheck settings: ${error.message}`);
    }
  },

  // User preferences helpers
  async getUserPreferences(component) {
    try {
      const preferences = await db.userPreferences
        .filter(pref => pref.component === component)
        .toArray();
      return preferences.length > 0 ? preferences[0].preferences : null;
    } catch (error) {
      logger.error('Error getting user preferences:', error);
      return null;
    }
  },

  async setUserPreferences(component, preferences) {
    try {
      await db.userPreferences.put({
        component,
        preferences,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error setting user preferences:', error);
    }
  },

  async updateUserPreferences(preferences, component) {
    try {
      const existing = await db.userPreferences
        .filter(pref => pref.component === component)
        .first();
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

  // Default account helpers
  async getDefaultAccount() {
    try {
      const defaultAccount = await db.accounts
        .filter(account => account.isDefault === true)
        .first();
      return defaultAccount || null;
    } catch (error) {
      logger.error('Error getting default account:', error);
      return null;
    }
  },

  async ensureDefaultAccount() {
    try {
      // First, clean up any existing placeholder default accounts
      await this.cleanupDuplicateDefaults();

      const defaultAccount = await this.getDefaultAccount();
      const totalAccounts = await db.accounts.count();

      // Only ensure a default account exists if there are already accounts
      // Don't create a default account if no accounts exist - let users start fresh
      if (totalAccounts > 0 && !defaultAccount) {
        // If there are accounts but no default, make the first one the default
        const firstAccount = await db.accounts.orderBy('createdAt').first();
        if (firstAccount) {
          await db.accounts.update(firstAccount.id, { isDefault: true });
          logger.info(`Set ${firstAccount.name} as default account`);
        }
      }

      // Final cleanup pass to ensure no placeholder accounts remain
      await this.cleanupDuplicateDefaults();
    } catch (error) {
      logger.error('Error ensuring default account:', error);
    }
  },

  // Clean up duplicate default accounts and remove placeholder defaults
  async cleanupDuplicateDefaults() {
    try {
      const allAccounts = await db.accounts.toArray();
      const defaultAccounts = allAccounts.filter(
        account => account.isDefault === true
      );

      // If there are multiple default accounts, keep only the first one
      if (defaultAccounts.length > 1) {
        const accountsToUpdate = defaultAccounts.slice(1);
        for (const account of accountsToUpdate) {
          await db.accounts.update(account.id, { isDefault: false });
        }
        logger.info(
          `Cleaned up ${accountsToUpdate.length} duplicate default accounts`
        );
      }

      // Remove any "Default Account" placeholders if there are real accounts
      const realAccounts = allAccounts.filter(
        account => account.name !== 'Default Account'
      );

      if (realAccounts.length > 0) {
        // Remove ALL "Default Account" entries when real accounts exist
        const defaultAccountPlaceholders = allAccounts.filter(
          account => account.name === 'Default Account'
        );

        for (const placeholder of defaultAccountPlaceholders) {
          await db.accounts.delete(placeholder.id);
          logger.info(
            `Removed placeholder Default Account (ID: ${placeholder.id})`
          );
        }

        // If we removed placeholders and there's no default, make the first real account the default
        const remainingAccounts = await db.accounts.toArray();
        const hasDefault = remainingAccounts.some(
          account => account.isDefault === true
        );

        if (!hasDefault && remainingAccounts.length > 0) {
          const firstAccount = remainingAccounts[0];
          await db.accounts.update(firstAccount.id, { isDefault: true });
          logger.info(`Set ${firstAccount.name} as default account`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up duplicate defaults:', error);
    }
  },

  // Credit card migration helpers
  async detectCreditCardExpenses() {
    try {
      const expenses = await db.fixedExpenses.toArray();
      const creditCards = await db.creditCards.toArray();

      const mappings = [];
      for (const expense of expenses) {
        for (const card of creditCards) {
          if (
            expense.name.toLowerCase().includes(card.name.toLowerCase()) ||
            expense.description?.toLowerCase().includes(card.name.toLowerCase())
          ) {
            mappings.push({
              expenseId: expense.id,
              expenseName: expense.name,
              creditCardId: card.id,
              creditCardName: card.name,
              confidence: 0.8, // High confidence for name matches
            });
          }
        }
      }

      return mappings;
    } catch (error) {
      logger.error('Error detecting credit card expenses:', error);
      return [];
    }
  },

  async applyExpenseMappings(mappings) {
    try {
      let appliedCount = 0;
      const results = [];

      for (const mapping of mappings) {
        try {
          await db.fixedExpenses.update(mapping.expenseId, {
            accountId: mapping.creditCardId,
            isManuallyMapped: true,
            mappingConfidence: mapping.confidence,
            mappedAt: new Date().toISOString(),
          });
          appliedCount++;
          results.push({
            expenseId: mapping.expenseId,
            expenseName: mapping.expenseName,
            creditCardName: mapping.creditCardName,
            success: true,
          });
        } catch (error) {
          logger.error(`Failed to update expense ${mapping.expenseId}:`, error);
          results.push({
            expenseId: mapping.expenseId,
            expenseName: mapping.expenseName,
            creditCardName: mapping.creditCardName,
            success: false,
            error: error.message,
          });
        }
      }

      logger.success(`Applied ${appliedCount} expense mappings`);
      return { appliedCount, results };
    } catch (error) {
      logger.error('Error applying expense mappings:', error);
      throw new Error('Failed to apply expense mappings');
    }
  },

  async cleanupDuplicateCreditCardExpenses() {
    try {
      const expenses = await db.fixedExpenses.toArray();
      const duplicates = [];

      // Find duplicates based on name and amount
      const seen = new Map();
      for (const expense of expenses) {
        const key = `${expense.name}-${expense.amount}`;
        if (seen.has(key)) {
          duplicates.push(expense);
        } else {
          seen.set(key, expense);
        }
      }

      // Remove duplicates
      for (const duplicate of duplicates) {
        await db.fixedExpenses.delete(duplicate.id);
      }

      logger.success(
        `Cleaned up ${duplicates.length} duplicate credit card expenses`
      );
      return duplicates;
    } catch (error) {
      logger.error('Error cleaning up duplicate credit card expenses:', error);
      return [];
    }
  },

  async createMissingCreditCardExpenses() {
    try {
      const creditCards = await db.creditCards.toArray();
      const expenses = await db.fixedExpenses.toArray();
      let createdCount = 0;

      for (const card of creditCards) {
        // Check if there's already an expense for this card
        const hasExpense = expenses.some(
          expense => expense.accountId === card.id
        );

        if (!hasExpense) {
          // Create a minimum payment expense for any card without an existing expense
          // Use minimum payment if specified, otherwise calculate based on balance or use $25 default
          const expenseAmount =
            card.minimumPayment ||
            (card.balance > 0 ? Math.max(card.balance * 0.02, 25) : 25);

          await db.fixedExpenses.add({
            name: `${card.name} Minimum Payment`,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            amount: expenseAmount,
            accountId: card.id,
            category: 'Credit Card',
            paidAmount: 0,
            status: 'pending',
            isAutoCreated: true,
            createdAt: new Date().toISOString(),
          });
          createdCount++;
        }
      }

      logger.success(`Created ${createdCount} missing credit card expenses`);
      return createdCount;
    } catch (error) {
      logger.error('Error creating missing credit card expenses:', error);
      return 0;
    }
  },

  // Insights and analytics helpers
  async getBudgetVsActualSummary() {
    try {
      const expenses = await db.fixedExpenses.toArray();

      // Calculate totals across all expenses
      const totalBudget = expenses.reduce(
        (sum, expense) => sum + expense.amount,
        0
      );
      const totalActual = expenses.reduce(
        (sum, expense) => sum + (expense.paidAmount || 0),
        0
      );
      const totalOverpayment = expenses.reduce((sum, expense) => {
        const overpayment = (expense.paidAmount || 0) - expense.amount;
        return sum + Math.max(0, overpayment);
      }, 0);

      // Calculate budget accuracy percentage
      const budgetAccuracy =
        totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

      // Find significant overpayments (over 20% of budget)
      const significantOverpayments = expenses.filter(expense => {
        const overpayment = (expense.paidAmount || 0) - expense.amount;
        const overpaymentPercentage =
          expense.amount > 0 ? (overpayment / expense.amount) * 100 : 0;
        return overpaymentPercentage > 20;
      });

      return {
        totalBudget,
        totalActual,
        totalOverpayment,
        budgetAccuracy,
        significantOverpayments: significantOverpayments.length,
      };
    } catch (error) {
      logger.error('Error getting budget vs actual summary:', error);
      return {
        totalBudget: 0,
        totalActual: 0,
        totalOverpayment: 0,
        budgetAccuracy: 0,
        significantOverpayments: 0,
      };
    }
  },

  async getOverpaymentByCategory() {
    try {
      const expenses = await db.fixedExpenses.toArray();
      const overpayments = {};

      for (const expense of expenses) {
        if (expense.paidAmount > expense.amount) {
          const overpayment = expense.paidAmount - expense.amount;
          const category = expense.category || 'Uncategorized';

          if (!overpayments[category]) {
            overpayments[category] = 0;
          }
          overpayments[category] += overpayment;
        }
      }

      return overpayments;
    } catch (error) {
      logger.error('Error getting overpayment by category:', error);
      return {};
    }
  },

  async getMonthlyExpenseHistory(months = 12) {
    try {
      const expenses = await db.fixedExpenses.toArray();
      const history = {};

      // Generate last N months
      const now = new Date();
      for (let i = 0; i < months; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        history[monthKey] = {
          month: date.getMonth() + 1,
          year: date.getFullYear(),
          totalBudget: 0,
          totalPaid: 0,
          expenseCount: 0,
        };
      }

      // Calculate totals for each month
      for (const expense of expenses) {
        const expenseDate = new Date(expense.dueDate);
        const monthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;

        if (history[monthKey]) {
          history[monthKey].totalBudget += expense.amount;
          history[monthKey].totalPaid += expense.paidAmount || 0;
          history[monthKey].expenseCount += 1;
        }
      }

      return Object.values(history);
    } catch (error) {
      logger.error('Error getting monthly expense history:', error);
      return [];
    }
  },

  // Data management helpers
  async deleteDatabase() {
    try {
      await db.delete();
      logger.success('Database deleted successfully');
    } catch (error) {
      logger.error('Error deleting database:', error);
      throw new Error('Failed to delete database');
    }
  },

  async exportData() {
    try {
      const data = {
        accounts: await db.accounts.toArray(),
        creditCards: await db.creditCards.toArray(),
        pendingTransactions: await db.pendingTransactions.toArray(),
        fixedExpenses: await db.fixedExpenses.toArray(),
        categories: await db.categories.toArray(),
        paycheckSettings: await db.paycheckSettings.toArray(),
        userPreferences: await db.userPreferences.toArray(),
        monthlyExpenseHistory: await db.monthlyExpenseHistory.toArray(),
        auditLogs: await db.auditLogs.toArray(),
        exportDate: new Date().toISOString(),
        version: '1.0',
      };

      logger.success('Data exported successfully');
      return data;
    } catch (error) {
      logger.error('Error exporting data:', error);
      throw new Error('Failed to export data');
    }
  },

  async importData(data) {
    try {
      // Clear existing data
      await this.clearDatabase();

      // Import new data
      if (data.accounts) await db.accounts.bulkAdd(data.accounts);
      if (data.creditCards) await db.creditCards.bulkAdd(data.creditCards);
      if (data.pendingTransactions)
        await db.pendingTransactions.bulkAdd(data.pendingTransactions);
      if (data.fixedExpenses)
        await db.fixedExpenses.bulkAdd(data.fixedExpenses);
      if (data.categories) await db.categories.bulkAdd(data.categories);
      if (data.paycheckSettings)
        await db.paycheckSettings.bulkAdd(data.paycheckSettings);
      if (data.userPreferences)
        await db.userPreferences.bulkAdd(data.userPreferences);
      if (data.monthlyExpenseHistory)
        await db.monthlyExpenseHistory.bulkAdd(data.monthlyExpenseHistory);
      if (data.auditLogs) await db.auditLogs.bulkAdd(data.auditLogs);

      logger.success('Data imported successfully');
    } catch (error) {
      logger.error('Error importing data:', error);
      throw new Error('Failed to import data');
    }
  },

  async validateImportData(data) {
    try {
      const requiredFields = [
        'accounts',
        'creditCards',
        'pendingTransactions',
        'fixedExpenses',
        'categories',
      ];

      for (const field of requiredFields) {
        if (!data[field] || !Array.isArray(data[field])) {
          throw new Error(`Invalid data: missing or invalid ${field}`);
        }
      }

      return { isValid: true, errors: [] };
    } catch (error) {
      return { isValid: false, errors: [error.message] };
    }
  },

  // Audit log helpers
  async getAuditLogs() {
    try {
      const logs = await db.auditLogs.toArray();
      return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      return [];
    }
  },

  async addAuditLog(actionType, entityType, entityId, details = {}) {
    try {
      await db.auditLogs.add({
        timestamp: new Date().toISOString(),
        actionType,
        entityType,
        entityId,
        details,
      });
    } catch (error) {
      logger.error('Error adding audit log:', error);
    }
  },

  async clearAuditLogs() {
    try {
      await db.auditLogs.clear();
      logger.success('Audit logs cleared successfully');
    } catch (error) {
      logger.error('Error clearing audit logs:', error);
      throw new Error('Failed to clear audit logs');
    }
  },

  // Debt payoff calculator
  async calculateDebtPayoff(balance, payment, interestRate) {
    try {
      const monthlyRate = interestRate / 100 / 12;
      let remainingBalance = balance;
      let totalInterest = 0;
      let months = 0;
      const startDate = new Date();

      while (remainingBalance > 0.01 && months < 600) {
        // Max 50 years
        const interestPayment = remainingBalance * monthlyRate;
        const principalPayment = Math.min(
          payment - interestPayment,
          remainingBalance
        );

        totalInterest += interestPayment;
        remainingBalance -= principalPayment;
        months++;

        if (principalPayment <= 0) {
          // Payment is less than interest, debt will never be paid off
          return {
            success: false,
            message:
              'Payment amount is less than monthly interest. Debt will never be paid off.',
            payoffMonths: -1,
            totalInterest,
            months,
            finalBalance: remainingBalance,
            payoffDate: null,
          };
        }
      }

      // Calculate payoff date
      const payoffDate = new Date(startDate);
      payoffDate.setMonth(payoffDate.getMonth() + months);

      return {
        success: true,
        payoffMonths: months,
        months, // Keep for backward compatibility
        totalInterest,
        totalPaid: balance + totalInterest,
        finalBalance: Math.max(0, remainingBalance),
        payoffDate: payoffDate.toISOString(),
      };
    } catch (error) {
      logger.error('Error calculating debt payoff:', error);
      throw new Error('Failed to calculate debt payoff');
    }
  },

  // Initialize default data
  async initializeDefaultData() {
    try {
      // Clean up any duplicate default accounts first
      await this.cleanupDuplicateDefaults();

      const paycheckSettingsCount = await db.paycheckSettings.count();
      if (paycheckSettingsCount === 0) {
        await db.paycheckSettings.add({
          lastPaycheckDate: '',
          frequency: 'biweekly',
          createdAt: new Date().toISOString(),
        });
      }

      const categoryCount = await db.categories.count();
      if (categoryCount === 0) {
        logger.info('No categories found, initializing default categories');
        await this.initializeDefaultCategories();
      } else {
        logger.debug(
          `Found ${categoryCount} existing categories, skipping default initialization`
        );
      }

      logger.success('Default data initialized');
    } catch (error) {
      logger.error('Error initializing default data:', error);
    }
  },
};

// Emergency database reset function - can be called from browser console
window.digibookEmergencyReset = async () => {
  try {
    console.log('🚨 EMERGENCY DATABASE RESET STARTING...');
    await dbHelpers.forceResetAllDatabases();
    console.log('✅ Emergency reset complete! Please refresh the page.');
    return true;
  } catch (error) {
    console.error('❌ Emergency reset failed:', error);
    return false;
  }
};

// Manual cleanup function - can be called from browser console
window.digibookCleanupAccounts = async () => {
  try {
    console.log('🧹 CLEANING UP ACCOUNTS...');
    await dbHelpers.cleanupDuplicateDefaults();
    console.log('✅ Account cleanup complete! Please refresh the page.');
    return true;
  } catch (error) {
    console.error('❌ Account cleanup failed:', error);
    return false;
  }
};

export default db;

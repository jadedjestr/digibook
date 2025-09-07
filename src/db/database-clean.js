import { logger } from '../utils/logger';
import { dataIntegrity } from '../utils/crypto';
import Dexie from 'dexie';

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
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, createdAt',
      categories: '++id, name, color, icon, isDefault, createdAt',
      creditCards: '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency, createdAt',
      userPreferences: '++id, component, preferences, createdAt',
      monthlyExpenseHistory: '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
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
      throw new Error('Failed to initialize database: ' + recreateError.message);
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
        'DigibookDB_v10'
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

  // Pending transaction helpers
  async getPendingTransactions() {
    try {
      const transactions = await db.pendingTransactions.toArray();
      return transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      logger.error('Error getting pending transactions:', error);
      throw new Error('Failed to get pending transactions');
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

  async getDefaultAccount() {
    try {
      const accountCount = await db.accounts.count();
      if (accountCount === 0) {
        return null;
      }

      const allAccounts = await db.accounts.toArray();
      const defaultAccount = allAccounts.find(account => account.isDefault === true);

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
        throw new Error(`Invalid account data: ${validation.errors.join(', ')}`);
      }

      // Sanitize account data
      const sanitizedAccount = {
        ...account,
        name: dataIntegrity.sanitizeString(account.name)
      };

      const accountCount = await db.accounts.count();
      const isFirstAccount = accountCount === 0;

      const accountData = {
        ...sanitizedAccount,
        isDefault: isFirstAccount,
        createdAt: new Date().toISOString(),
      };

      const id = await db.accounts.add(accountData);
      logger.success('Account added successfully: ' + id);
      return id;
    } catch (error) {
      logger.error('Error adding account:', error);
      throw new Error('Failed to add account: ' + error.message);
    }
  },

  async updateAccount(id, updates) {
    try {
      await db.accounts.update(id, updates);
      logger.success('Account updated successfully: ' + id);
    } catch (error) {
      logger.error('Error updating account:', error);
      throw new Error('Failed to update account');
    }
  },

  async deleteAccount(id) {
    try {
      const pendingCount = await db.pendingTransactions.where('accountId').equals(id).count();
      if (pendingCount > 0) {
        throw new Error('Cannot delete account with pending transactions');
      }

      await db.accounts.delete(id);
      logger.success('Account deleted successfully: ' + id);
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
        throw new Error(`Invalid category data: ${validation.errors.join(', ')}`);
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
      logger.success('Category added successfully: ' + id);
      return id;
    } catch (error) {
      logger.error('Error adding category:', error);
      throw new Error('Failed to add category: ' + error.message);
    }
  },

  async updateCategory(id, updates) {
    try {
      let payload = { ...updates };
      if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
        const trimmedName = (updates.name || '').trim();
        payload.name = trimmedName;
      }
      await db.categories.update(id, payload);
      logger.success('Category updated successfully: ' + id);
    } catch (error) {
      logger.error('Error updating category:', error);
      throw new Error('Failed to update category');
    }
  },

  async deleteCategory(id) {
    try {
      const category = await db.categories.get(id);
      const affectedFixedExpenses = await db.fixedExpenses.where('category').equals(category.name).toArray();
      const affectedPendingTransactions = await db.pendingTransactions.where('category').equals(category.name).toArray();

      await db.categories.delete(id);
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

  // Initialize default categories
  async initializeDefaultCategories() {
    try {
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

      const categoriesToAdd = defaultCategories.filter(category =>
        !existingCategoryNames.includes(category.name.toLowerCase()),
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

  // User preferences helpers
  async getUserPreferences(component) {
    try {
      const preferences = await db.userPreferences.where('component').equals(component).toArray();
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

  // Default account helpers
  async getDefaultAccount() {
    try {
      const defaultAccount = await db.accounts.where('isDefault').equals(true).first();
      return defaultAccount || null;
    } catch (error) {
      logger.error('Error getting default account:', error);
      return null;
    }
  },

  async ensureDefaultAccount() {
    try {
      const defaultAccount = await this.getDefaultAccount();
      const totalAccounts = await db.accounts.count();
      
      // Only create a default account if there are NO accounts at all
      if (!defaultAccount && totalAccounts === 0) {
        const defaultAccountData = {
          name: 'Default Account',
          type: 'checking',
          currentBalance: 0,
          isDefault: true,
          createdAt: new Date().toISOString(),
        };
        await db.accounts.add(defaultAccountData);
        logger.info('Created default account (no accounts existed)');
      } else if (totalAccounts > 0 && !defaultAccount) {
        // If there are accounts but no default, make the first one the default
        const firstAccount = await db.accounts.orderBy('createdAt').first();
        if (firstAccount) {
          await db.accounts.update(firstAccount.id, { isDefault: true });
          logger.info(`Set ${firstAccount.name} as default account`);
        }
      }
    } catch (error) {
      logger.error('Error ensuring default account:', error);
    }
  },

  // Clean up duplicate default accounts
  async cleanupDuplicateDefaults() {
    try {
      const defaultAccounts = await db.accounts.where('isDefault').equals(true).toArray();
      if (defaultAccounts.length > 1) {
        // Keep the first one, remove the rest
        const accountsToUpdate = defaultAccounts.slice(1);
        for (const account of accountsToUpdate) {
          await db.accounts.update(account.id, { isDefault: false });
        }
        logger.info(`Cleaned up ${accountsToUpdate.length} duplicate default accounts`);
      }
    } catch (error) {
      logger.error('Error cleaning up duplicate defaults:', error);
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
        logger.debug(`Found ${categoryCount} existing categories, skipping default initialization`);
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

export default db;

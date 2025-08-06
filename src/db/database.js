import { logger } from "../utils/logger";
import Dexie from 'dexie';

export class DigibookDB extends Dexie {
  constructor() {
    super('DigibookDB');
    
    this.version(3).stores({
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status, category',
      categories: '++id, name, color, icon, isDefault',
      paycheckSettings: '++id, lastPaycheckDate, frequency',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details'
    });
  }
}

export const db = new DigibookDB();

// Database helper functions
export const dbHelpers = {
  // Clear database (for development/testing)
  async clearDatabase() {
    try {
      await db.accounts.clear();
      await db.pendingTransactions.clear();
      await db.fixedExpenses.clear();
      await db.categories.clear();
      await db.paycheckSettings.clear();
      await db.auditLogs.clear();
      logger.success("Database cleared successfully");
    } catch (error) {
      logger.error("Error clearing database:", error);
    }
  },

  // Fix database schema (add missing fields)
  async fixDatabaseSchema() {
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
          frequency: 'biweekly'
        });
      }

      // Initialize default categories
      await this.initializeDefaultCategories();
      
      logger.success("Database schema fixed");
    } catch (error) {
      logger.error("Error fixing database schema:", error);
    }
  },

  // Account helpers
  async getAccounts() {
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

  async ensureDefaultAccount() {
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
      logger.error("Error ensuring default account:", error);
    }
  },

  async getDefaultAccount() {
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
      logger.warn("Error getting default account:", error);
      return null;
    }
  },

  async setDefaultAccount(accountId) {
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
      logger.error("Error setting default account:", error);
      throw new Error('Failed to set default account');
    }
  },

  async addAccount(account) {
    try {
      // Check if this is the first account
      const accountCount = await db.accounts.count();
      const isFirstAccount = accountCount === 0;
      
      const id = await db.accounts.add({
        ...account,
        isDefault: isFirstAccount, // Set first account as default
        createdAt: new Date().toISOString()
      });
      
      // Log the action
      await this.addAuditLog('CREATE', 'account', id, {
        name: account.name,
        type: account.type,
        balance: account.currentBalance,
        isDefault: isFirstAccount
      });
      
      logger.success('Account added successfully: ' + id);
      return id;
    } catch (error) {
      logger.error('Error adding account:', error);
      throw new Error('Failed to add account');
    }
  },

  async updateAccount(id, updates) {
    try {
      await db.accounts.update(id, updates);
      await this.addAuditLog('UPDATE', 'account', id, updates);
      logger.success('Account updated successfully: ' + id);
    } catch (error) {
      logger.error('Error updating account:', error);
      throw new Error('Failed to update account');
    }
  },

  async deleteAccount(id) {
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
  async getPendingTransactions() {
    try {
      const transactions = await db.pendingTransactions.toArray();
      return transactions;
    } catch (error) {
      logger.error('Error getting pending transactions:', error);
      return [];
    }
  },

  async addPendingTransaction(transaction) {
    try {
      const id = await db.pendingTransactions.add({
        ...transaction,
        createdAt: new Date().toISOString()
      });
      
      await this.addAuditLog('CREATE', 'pendingTransaction', id, {
        accountId: transaction.accountId,
        amount: transaction.amount,
        category: transaction.category,
        description: transaction.description
      });
      
      logger.success('Pending transaction added successfully: ' + id);
      return id;
    } catch (error) {
      logger.error('Error adding pending transaction:', error);
      throw new Error('Failed to add pending transaction');
    }
  },

  async updatePendingTransaction(id, updates) {
    try {
      await db.pendingTransactions.update(id, updates);
      await this.addAuditLog('UPDATE', 'pendingTransaction', id, updates);
      logger.success('Pending transaction updated successfully: ' + id);
    } catch (error) {
      logger.error('Error updating pending transaction:', error);
      throw new Error('Failed to update pending transaction');
    }
  },

  async deletePendingTransaction(id) {
    try {
      await db.pendingTransactions.delete(id);
      await this.addAuditLog('DELETE', 'pendingTransaction', id, {});
      logger.success('Pending transaction deleted successfully: ' + id);
    } catch (error) {
      logger.error('Error deleting pending transaction:', error);
      throw new Error('Failed to delete pending transaction');
    }
  },

  async completePendingTransaction(id) {
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
          currentBalance: account.currentBalance + balanceChange
        });
        await db.pendingTransactions.delete(id);
      });
      
      await this.addAuditLog('COMPLETE', 'pendingTransaction', id, {
        accountId: transaction.accountId,
        amount: transaction.amount,
        newBalance: account.currentBalance + balanceChange
      });
      
      logger.success('Pending transaction completed successfully: ' + id);
    } catch (error) {
      logger.error('Error completing pending transaction:', error);
      throw new Error('Failed to complete pending transaction');
    }
  },

  // Fixed expenses helpers
  async getFixedExpenses() {
    try {
      const expenses = await db.fixedExpenses.toArray();
      return expenses;
    } catch (error) {
      logger.error('Error getting fixed expenses:', error);
      return [];
    }
  },

  async addFixedExpense(expense) {
    try {
      const id = await db.fixedExpenses.add({
        ...expense,
        createdAt: new Date().toISOString()
      });
      
      await this.addAuditLog('CREATE', 'fixedExpense', id, expense);
      
      logger.success('Fixed expense added successfully: ' + id);
      return id;
    } catch (error) {
      logger.error('Error adding fixed expense:', error);
      throw new Error('Failed to add fixed expense');
    }
  },

  async updateFixedExpense(id, updates) {
    try {
      await db.fixedExpenses.update(id, updates);
      await this.addAuditLog('UPDATE', 'fixedExpense', id, updates);
      logger.success('Fixed expense updated successfully: ' + id);
    } catch (error) {
      logger.error('Error updating fixed expense:', error);
      throw new Error('Failed to update fixed expense');
    }
  },

  async deleteFixedExpense(id) {
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
  async getPaycheckSettings() {
    try {
      logger.debug("Getting paycheck settings...");
      const settings = await db.paycheckSettings.toArray();
      logger.debug("Found settings:", settings);
      return settings.length > 0 ? settings[0] : null;
    } catch (error) {
      logger.error("Error getting paycheck settings:", error);
      return null;
    }
  },

  async updatePaycheckSettings(settings) {
    try {
      logger.debug("updatePaycheckSettings called with:", settings);
      const existing = await this.getPaycheckSettings();
      logger.debug("Existing settings:", existing);
      
      if (existing) {
        logger.debug(`Updating existing settings with ID: ${existing.id}`);
        await db.paycheckSettings.update(existing.id, settings);
      } else {
        logger.debug("Adding new settings");
        await db.paycheckSettings.add(settings);
      }
      
      await this.addAuditLog('UPDATE', 'paycheckSettings', existing?.id || 'new', settings);
      logger.success("Paycheck settings updated successfully");
    } catch (error) {
      logger.error("Error in updatePaycheckSettings:", error);
      throw error;
    }
  },

  // Audit log helpers
  async addAuditLog(actionType, entityType, entityId, details) {
    try {
      await db.auditLogs.add({
        timestamp: new Date().toISOString(),
        actionType,
        entityType,
        entityId,
        details: JSON.stringify(details)
      });
    } catch (error) {
      logger.error('Error adding audit log:', error);
      // Don't throw here - audit logs shouldn't break the main functionality
    }
  },

  async getAuditLogs() {
    try {
      const logs = await db.auditLogs.orderBy('timestamp').reverse().toArray();
      return logs;
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      return [];
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
      const id = await db.categories.add({
        ...category,
        isDefault: category.isDefault || false, // Ensure isDefault is explicitly set
        createdAt: new Date().toISOString()
      });
      
      await this.addAuditLog('CREATE', 'category', id, category);
      
      logger.success('Category added successfully: ' + id);
      return id;
    } catch (error) {
      logger.error('Error adding category:', error);
      throw new Error('Failed to add category');
    }
  },

  async updateCategory(id, updates) {
    try {
      await db.categories.update(id, updates);
      await this.addAuditLog('UPDATE', 'category', id, updates);
      logger.success('Category updated successfully: ' + id);
    } catch (error) {
      logger.error('Error updating category:', error);
      throw new Error('Failed to update category');
    }
  },

  async deleteCategory(id) {
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
        affectedPendingTransactions: affectedPendingTransactions.length
      });
      
      logger.success('Category deleted successfully: ' + id);
      return {
        affectedFixedExpenses,
        affectedPendingTransactions
      };
    } catch (error) {
      logger.error('Error deleting category:', error);
      throw new Error('Failed to delete category');
    }
  },

  async reassignCategoryItems(oldCategoryName, newCategoryName, affectedItems) {
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
        updates: updates
      });
      
      logger.success(`Reassigned ${updates.length} items from "${oldCategoryName}" to "${newCategoryName}"`);
    } catch (error) {
      logger.error('Error reassigning category items:', error);
      throw new Error('Failed to reassign category items');
    }
  },

  async initializeDefaultCategories() {
    try {
      const categoriesCount = await db.categories.count();
      if (categoriesCount === 0) {
        const defaultCategories = [
          { name: 'Housing', color: '#3B82F6', icon: '🏠', isDefault: true },
          { name: 'Utilities', color: '#10B981', icon: '⚡', isDefault: true },
          { name: 'Insurance', color: '#F59E0B', icon: '🛡️', isDefault: true },
          { name: 'Transportation', color: '#8B5CF6', icon: '🚗', isDefault: true },
          { name: 'Subscriptions', color: '#EC4899', icon: '📱', isDefault: true },
          { name: 'Debt', color: '#EF4444', icon: '💳', isDefault: true },
          { name: 'Healthcare', color: '#06B6D4', icon: '🏥', isDefault: true },
          { name: 'Education', color: '#84CC16', icon: '🎓', isDefault: true },
          { name: 'Other', color: '#6B7280', icon: '📦', isDefault: true }
        ];
        
        await db.categories.bulkAdd(defaultCategories);
        logger.success('Default categories initialized');
      }
    } catch (error) {
      logger.error('Error initializing default categories:', error);
    }
  },

  // Export/Import helpers
  async exportData() {
    try {
      const accounts = await this.getAccounts();
      const pendingTransactions = await this.getPendingTransactions();
      const fixedExpenses = await this.getFixedExpenses();
      const categories = await this.getCategories();
      const paycheckSettings = await this.getPaycheckSettings();
      const auditLogs = await this.getAuditLogs();
      
      const exportData = {
        accounts,
        pendingTransactions,
        fixedExpenses,
        categories,
        paycheckSettings,
        auditLogs,
        exportedAt: new Date().toISOString()
      };
      
      logger.success('Data exported successfully');
      return exportData;
    } catch (error) {
      logger.error('Error exporting data:', error);
      throw new Error('Failed to export data');
    }
  },

  async importData(data) {
    try {
      await db.transaction('rw', db.accounts, db.pendingTransactions, db.fixedExpenses, db.categories, db.paycheckSettings, db.auditLogs, async () => {
        // Clear existing data
        await db.accounts.clear();
        await db.pendingTransactions.clear();
        await db.fixedExpenses.clear();
        await db.categories.clear();
        await db.paycheckSettings.clear();
        await db.auditLogs.clear();
        
        // Import new data
        if (data.accounts) {
          await db.accounts.bulkAdd(data.accounts);
        }
        if (data.pendingTransactions) {
          await db.pendingTransactions.bulkAdd(data.pendingTransactions);
        }
        if (data.fixedExpenses) {
          await db.fixedExpenses.bulkAdd(data.fixedExpenses);
        }
        if (data.categories) {
          await db.categories.bulkAdd(data.categories);
        }
        if (data.paycheckSettings) {
          await db.paycheckSettings.bulkAdd(data.paycheckSettings);
        }
        if (data.auditLogs) {
          await db.auditLogs.bulkAdd(data.auditLogs);
        }
      });
      
      logger.success('Data imported successfully');
    } catch (error) {
      logger.error('Error importing data:', error);
      throw new Error('Failed to import data');
    }
  }
}; 
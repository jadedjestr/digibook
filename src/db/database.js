import Dexie from 'dexie';

export class DigibookDB extends Dexie {
  constructor() {
    super('DigibookDB');
    
    this.version(1).stores({
      accounts: '++id, name, type, currentBalance, isDefault',
      pendingTransactions: '++id, accountId, amount, category, description, createdAt',
      fixedExpenses: '++id, name, dueDate, amount, accountId, paidAmount, status',
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
      await db.paycheckSettings.clear();
      await db.auditLogs.clear();
      console.log('Database cleared successfully');
    } catch (error) {
      console.error('Error clearing database:', error);
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
      
      console.log('Database schema fixed');
    } catch (error) {
      console.error('Error fixing database schema:', error);
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
        console.log('Set first account as default:', firstAccount.name);
      }
    } catch (error) {
      console.error('Error ensuring default account:', error);
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
      console.warn('Error getting default account:', error);
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
      
      console.log('Default account set successfully:', accountId);
    } catch (error) {
      console.error('Error setting default account:', error);
      throw new Error('Failed to set default account');
    }
  },

  async addAccount(account) {
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
    
    return id;
  },

  async updateAccount(id, updates) {
    await db.accounts.update(id, updates);
    
    await this.addAuditLog('UPDATE', 'account', id, updates);
  },

  async deleteAccount(id) {
    // Check if account has pending transactions
    const pendingCount = await db.pendingTransactions.where('accountId').equals(id).count();
    if (pendingCount > 0) {
      throw new Error('Cannot delete account with pending transactions');
    }
    
    await db.accounts.delete(id);
    
    await this.addAuditLog('DELETE', 'account', id, {});
  },

  // Pending transaction helpers
  async getPendingTransactions() {
    return await db.pendingTransactions.toArray();
  },

  async addPendingTransaction(transaction) {
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
    
    return id;
  },

  async updatePendingTransaction(id, updates) {
    await db.pendingTransactions.update(id, updates);
    
    await this.addAuditLog('UPDATE', 'pendingTransaction', id, updates);
  },

  async deletePendingTransaction(id) {
    await db.pendingTransactions.delete(id);
    
    await this.addAuditLog('DELETE', 'pendingTransaction', id, {});
  },

  async completePendingTransaction(id) {
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
  },

  // Fixed expenses helpers
  async getFixedExpenses() {
    return await db.fixedExpenses.toArray();
  },

  async addFixedExpense(expense) {
    const id = await db.fixedExpenses.add({
      ...expense,
      createdAt: new Date().toISOString()
    });
    
    await this.addAuditLog('CREATE', 'fixedExpense', id, expense);
    
    return id;
  },

  async updateFixedExpense(id, updates) {
    await db.fixedExpenses.update(id, updates);
    
    await this.addAuditLog('UPDATE', 'fixedExpense', id, updates);
  },

  async deleteFixedExpense(id) {
    await db.fixedExpenses.delete(id);
    
    await this.addAuditLog('DELETE', 'fixedExpense', id, {});
  },

  // Paycheck settings helpers
  async getPaycheckSettings() {
    const settings = await db.paycheckSettings.toArray();
    return settings.length > 0 ? settings[0] : null;
  },

  async updatePaycheckSettings(settings) {
    const existing = await this.getPaycheckSettings();
    if (existing) {
      await db.paycheckSettings.update(existing.id, settings);
    } else {
      await db.paycheckSettings.add(settings);
    }
    
    await this.addAuditLog('UPDATE', 'paycheckSettings', existing?.id || 'new', settings);
  },

  // Audit log helpers
  async addAuditLog(actionType, entityType, entityId, details) {
    await db.auditLogs.add({
      timestamp: new Date().toISOString(),
      actionType,
      entityType,
      entityId,
      details: JSON.stringify(details)
    });
  },

  async getAuditLogs() {
    return await db.auditLogs.orderBy('timestamp').reverse().toArray();
  },

  async clearAuditLogs() {
    await db.auditLogs.clear();
  },

  // Export/Import helpers
  async exportData() {
    const accounts = await this.getAccounts();
    const pendingTransactions = await this.getPendingTransactions();
    const fixedExpenses = await this.getFixedExpenses();
    const paycheckSettings = await this.getPaycheckSettings();
    const auditLogs = await this.getAuditLogs();
    
    return {
      accounts,
      pendingTransactions,
      fixedExpenses,
      paycheckSettings,
      auditLogs,
      exportedAt: new Date().toISOString()
    };
  },

  async importData(data) {
    await db.transaction('rw', db.accounts, db.pendingTransactions, db.fixedExpenses, db.paycheckSettings, db.auditLogs, async () => {
      // Clear existing data
      await db.accounts.clear();
      await db.pendingTransactions.clear();
      await db.fixedExpenses.clear();
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
      if (data.paycheckSettings) {
        await db.paycheckSettings.bulkAdd(data.paycheckSettings);
      }
      if (data.auditLogs) {
        await db.auditLogs.bulkAdd(data.auditLogs);
      }
    });
  }
}; 
/**
 * Mock Database for Testing
 *
 * Provides a simple in-memory database implementation for testing
 * without the complexity of IndexedDB constraints.
 */

export class MockDatabase {
  constructor() {
    this.data = {
      accounts: new Map(),
      pendingTransactions: new Map(),
      fixedExpenses: new Map(),
      categories: new Map(),
      creditCards: new Map(),
      paycheckSettings: new Map(),
      userPreferences: new Map(),
      monthlyExpenseHistory: new Map(),
      auditLogs: new Map(),
    };
    this.nextId = 1;
  }

  // Generate unique ID
  generateId() {
    return this.nextId++;
  }

  // Clear all data
  clear() {
    Object.values(this.data).forEach(store => store.clear());
    this.nextId = 1;
  }

  // Account operations
  async addAccount(account) {
    if (!account || !account.name) {
      throw new Error('Account data is required');
    }

    const id = this.generateId();
    const accountData = {
      ...account,
      id,
      isDefault: this.data.accounts.size === 0,
      createdAt: new Date().toISOString(),
    };
    this.data.accounts.set(id, accountData);
    return id;
  }

  async getAccounts() {
    const accounts = Array.from(this.data.accounts.values());

    // Ensure there's always a default account if accounts exist
    if (accounts.length > 0) {
      const hasDefault = accounts.some(account => account.isDefault);
      if (!hasDefault) {
        const firstAccount = accounts[0];
        firstAccount.isDefault = true;
        this.data.accounts.set(firstAccount.id, firstAccount);
        return Array.from(this.data.accounts.values());
      }
    }

    return accounts;
  }

  async updateAccount(id, updates) {
    const account = this.data.accounts.get(id);
    if (!account) {
      throw new Error('Account not found');
    }
    const updatedAccount = { ...account, ...updates };
    this.data.accounts.set(id, updatedAccount);
  }

  async deleteAccount(id) {
    const account = this.data.accounts.get(id);
    if (!account) {
      throw new Error('Account not found');
    }

    const pendingCount = Array.from(
      this.data.pendingTransactions.values()
    ).filter(transaction => transaction.accountId === id).length;

    if (pendingCount > 0) {
      throw new Error('Cannot delete account with pending transactions');
    }

    this.data.accounts.delete(id);
  }

  async getDefaultAccount() {
    const accounts = Array.from(this.data.accounts.values());
    if (accounts.length === 0) {
      return null;
    }

    const defaultAccount = accounts.find(account => account.isDefault === true);
    if (defaultAccount) {
      return defaultAccount;
    }

    if (accounts.length > 0) {
      const firstAccount = accounts[0];
      firstAccount.isDefault = true;
      this.data.accounts.set(firstAccount.id, firstAccount);
      return firstAccount;
    }

    return null;
  }

  async setDefaultAccount(accountId) {
    const allAccounts = Array.from(this.data.accounts.values());

    for (const account of allAccounts) {
      if (account.isDefault === true) {
        account.isDefault = false;
        this.data.accounts.set(account.id, account);
      }
    }

    const targetAccount = this.data.accounts.get(accountId);
    if (targetAccount) {
      targetAccount.isDefault = true;
      this.data.accounts.set(accountId, targetAccount);
    }
  }

  // Category operations
  async addCategory(category) {
    const trimmedName = (category.name || '').trim();
    if (!trimmedName) {
      throw new Error('Category name is required');
    }

    // Check for duplicate names (case insensitive)
    const existingCategories = Array.from(this.data.categories.values());
    const nameExists = existingCategories.some(
      cat => cat.nameLower === trimmedName.toLowerCase()
    );

    if (nameExists) {
      throw new Error('Category with this name already exists');
    }

    const id = this.generateId();
    const categoryData = {
      ...category,
      id,
      name: trimmedName,
      nameLower: trimmedName.toLowerCase(),
      isDefault: category.isDefault || false,
      createdAt: new Date().toISOString(),
    };
    this.data.categories.set(id, categoryData);
    return id;
  }

  async getCategories() {
    return Array.from(this.data.categories.values());
  }

  async updateCategory(id, updates) {
    const category = this.data.categories.get(id);
    if (!category) {
      throw new Error('Category not found');
    }

    const payload = { ...updates };
    if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
      const trimmedName = (updates.name || '').trim();
      payload.name = trimmedName;
      payload.nameLower = trimmedName.toLowerCase();
    }

    const updatedCategory = { ...category, ...payload };
    this.data.categories.set(id, updatedCategory);
  }

  async deleteCategory(id) {
    const category = this.data.categories.get(id);
    if (!category) {
      throw new Error('Category not found');
    }

    const affectedFixedExpenses = Array.from(
      this.data.fixedExpenses.values()
    ).filter(expense => expense.category === category.name);
    const affectedPendingTransactions = Array.from(
      this.data.pendingTransactions.values()
    ).filter(transaction => transaction.category === category.name);

    this.data.categories.delete(id);

    return {
      affectedFixedExpenses,
      affectedPendingTransactions,
    };
  }

  async initializeDefaultCategories() {
    const existingCategories = Array.from(this.data.categories.values());
    const existingCategoryNames = existingCategories.map(cat =>
      cat.name.toLowerCase()
    );

    const defaultCategories = [
      { name: 'Housing', color: '#3B82F6', icon: '🏠', isDefault: true },
      { name: 'Utilities', color: '#10B981', icon: '⚡', isDefault: true },
      { name: 'Insurance', color: '#F59E0B', icon: '🛡️', isDefault: true },
      { name: 'Transportation', color: '#8B5CF6', icon: '🚗', isDefault: true },
      { name: 'Subscriptions', color: '#EC4899', icon: '📱', isDefault: true },
      { name: 'Credit Card', color: '#F97316', icon: '💳', isDefault: true },
      { name: 'Debt', color: '#EF4444', icon: '📊', isDefault: true },
      { name: 'Healthcare', color: '#06B6D4', icon: '🏥', isDefault: true },
      { name: 'Education', color: '#84CC16', icon: '🎓', isDefault: true },
      { name: 'Other', color: '#6B7280', icon: '📦', isDefault: true },
    ];

    const categoriesToAdd = defaultCategories.filter(
      category => !existingCategoryNames.includes(category.name.toLowerCase())
    );

    for (const category of categoriesToAdd) {
      await this.addCategory(category);
    }
  }

  // Audit log operations
  async addAuditLog(actionType, entityType, entityId, details) {
    const id = this.generateId();
    const logData = {
      id,
      timestamp: new Date().toISOString(),
      actionType,
      entityType,
      entityId,
      details: JSON.stringify(details),
    };
    this.data.auditLogs.set(id, logData);
  }

  async getAuditLogs() {
    return Array.from(this.data.auditLogs.values()).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  // Database schema operations
  async fixDatabaseSchema() {
    const accounts = Array.from(this.data.accounts.values());
    for (const account of accounts) {
      if (account.isDefault === undefined) {
        account.isDefault = false;
        this.data.accounts.set(account.id, account);
      }
    }

    if (this.data.paycheckSettings.size === 0) {
      const id = this.generateId();
      this.data.paycheckSettings.set(id, {
        id,
        lastPaycheckDate: '',
        frequency: 'biweekly',
        createdAt: new Date().toISOString(),
      });
    }

    if (this.data.categories.size === 0) {
      await this.initializeDefaultCategories();
    }
  }

  async ensureDefaultAccount() {
    const accounts = Array.from(this.data.accounts.values());

    if (accounts.length === 0) {
      return;
    }

    const hasDefault = accounts.some(account => account.isDefault === true);

    if (!hasDefault) {
      const firstAccount = accounts[0];
      firstAccount.isDefault = true;
      this.data.accounts.set(firstAccount.id, firstAccount);
    }
  }

  // Direct table access for tests
  get accounts() {
    return {
      add: data => this.addAccount(data),
      get: id => this.data.accounts.get(id),
      update: (id, updates) => this.updateAccount(id, updates),
      delete: id => this.deleteAccount(id),
      toArray: () => Array.from(this.data.accounts.values()),
      count: () => this.data.accounts.size,
      where: field => ({
        equals: value => ({
          count: () =>
            Array.from(this.data.accounts.values()).filter(
              account => account[field] === value
            ).length,
        }),
      }),
    };
  }

  get pendingTransactions() {
    return {
      add: data => {
        const id = this.generateId();
        const transactionData = {
          ...data,
          id,
          createdAt: new Date().toISOString(),
        };
        this.data.pendingTransactions.set(id, transactionData);
        return id;
      },
      where: field => ({
        equals: value => ({
          count: () =>
            Array.from(this.data.pendingTransactions.values()).filter(
              transaction => transaction[field] === value
            ).length,
        }),
      }),
    };
  }

  get fixedExpenses() {
    return {
      add: data => {
        const id = this.generateId();
        const expenseData = {
          ...data,
          id,
          createdAt: new Date().toISOString(),
        };
        this.data.fixedExpenses.set(id, expenseData);
        return id;
      },
      get: id => this.data.fixedExpenses.get(id),
      update: (id, updates) => {
        const expense = this.data.fixedExpenses.get(id);
        if (!expense) {
          throw new Error('Expense not found');
        }
        const updatedExpense = { ...expense, ...updates };
        this.data.fixedExpenses.set(id, updatedExpense);
      },
      where: field => ({
        equals: value => ({
          toArray: () =>
            Array.from(this.data.fixedExpenses.values()).filter(
              expense => expense[field] === value
            ),
        }),
      }),
    };
  }

  get categories() {
    return {
      add: data => this.addCategory(data),
      get: id => this.data.categories.get(id),
      update: (id, updates) => this.updateCategory(id, updates),
      delete: id => this.deleteCategory(id),
      toArray: () => Array.from(this.data.categories.values()),
      count: () => this.data.categories.size,
    };
  }

  get creditCards() {
    return {
      add: data => {
        const id = this.generateId();
        const cardData = { ...data, id, createdAt: new Date().toISOString() };
        this.data.creditCards.set(id, cardData);
        return id;
      },
      get: id => this.data.creditCards.get(id),
      count: () => this.data.creditCards.size,
    };
  }

  get paycheckSettings() {
    return {
      add: data => {
        const id = this.generateId();
        const settingsData = {
          ...data,
          id,
          createdAt: new Date().toISOString(),
        };
        this.data.paycheckSettings.set(id, settingsData);
        return id;
      },
      count: () => this.data.paycheckSettings.size,
    };
  }

  get userPreferences() {
    return {
      add: data => {
        const id = this.generateId();
        const prefsData = { ...data, id, createdAt: new Date().toISOString() };
        this.data.userPreferences.set(id, prefsData);
        return id;
      },
      count: () => this.data.userPreferences.size,
    };
  }

  get monthlyExpenseHistory() {
    return {
      add: data => {
        const id = this.generateId();
        const historyData = {
          ...data,
          id,
          createdAt: new Date().toISOString(),
        };
        this.data.monthlyExpenseHistory.set(id, historyData);
        return id;
      },
      count: () => this.data.monthlyExpenseHistory.size,
    };
  }

  get auditLogs() {
    return {
      add: data => {
        const id = this.generateId();
        const logData = { ...data, id };
        this.data.auditLogs.set(id, logData);
        return id;
      },
      orderBy: field => ({
        reverse: () => ({
          toArray: () => this.getAuditLogs(),
        }),
      }),
    };
  }
}

export default MockDatabase;

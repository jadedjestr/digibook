import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MockDatabase from './mock-database';

// Mock logger to reduce noise in tests
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Database Operations', () => {
  let mockDb;
  let dbHelpers;

  beforeEach(async () => {
    // Create a fresh mock database for each test
    mockDb = new MockDatabase();
    dbHelpers = {
      async clearDatabase() {
        mockDb.clear();
      },

      async addAccount(account) {
        try {
          const accountCount = mockDb.data.accounts.size;
          const isFirstAccount = accountCount === 0;

          const accountData = {
            ...account,
            isDefault: isFirstAccount,
            createdAt: new Date().toISOString(),
          };

          const id = await mockDb.addAccount(accountData);
          return id;
        } catch (error) {
          throw new Error('Failed to add account: ' + error.message);
        }
      },

      async getAccounts() {
        return await mockDb.getAccounts();
      },

      async setDefaultAccount(accountId) {
        try {
          await mockDb.setDefaultAccount(accountId);
        } catch (error) {
          throw new Error('Failed to set default account');
        }
      },

      async getDefaultAccount() {
        return await mockDb.getDefaultAccount();
      },

      async updateAccount(id, updates) {
        try {
          await mockDb.updateAccount(id, updates);
        } catch (error) {
          throw new Error('Failed to update account');
        }
      },

      async deleteAccount(id) {
        try {
          await mockDb.deleteAccount(id);
        } catch (error) {
          throw new Error('Failed to delete account');
        }
      },

      async addCategory(category) {
        try {
          return await mockDb.addCategory(category);
        } catch (error) {
          throw new Error('Failed to add category: ' + error.message);
        }
      },

      async getCategories() {
        return await mockDb.getCategories();
      },

      async updateCategory(id, updates) {
        try {
          await mockDb.updateCategory(id, updates);
        } catch (error) {
          throw new Error('Failed to update category');
        }
      },

      async deleteCategory(id) {
        try {
          return await mockDb.deleteCategory(id);
        } catch (error) {
          throw new Error('Failed to delete category');
        }
      },

      async initializeDefaultCategories() {
        await mockDb.initializeDefaultCategories();
      },

      async addAuditLog(actionType, entityType, entityId, details) {
        await mockDb.addAuditLog(actionType, entityType, entityId, details);
      },

      async getAuditLogs() {
        return await mockDb.getAuditLogs();
      },

      async fixDatabaseSchema() {
        await mockDb.fixDatabaseSchema();
      },

      async ensureDefaultAccount() {
        await mockDb.ensureDefaultAccount();
      }
    };
    await dbHelpers.clearDatabase();
  });

  afterEach(async () => {
    // Clean up mock database
    if (mockDb) {
      mockDb.clear();
    }
  });

  describe('Account Operations', () => {
    it('should add a new account', async () => {
      const accountData = {
        name: 'Test Checking Account',
        type: 'checking',
        currentBalance: 1000.50
      };

      const accountId = await dbHelpers.addAccount(accountData);
      expect(accountId).toBeDefined();

      const accounts = await dbHelpers.getAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        name: 'Test Checking Account',
        type: 'checking',
        currentBalance: 1000.50,
        isDefault: true // First account should be default
      });
    });

    it('should set first account as default', async () => {
      const account1 = {
        name: 'First Account',
        type: 'checking',
        currentBalance: 1000
      };

      const account2 = {
        name: 'Second Account',
        type: 'savings',
        currentBalance: 2000
      };

      await dbHelpers.addAccount(account1);
      await dbHelpers.addAccount(account2);

      const accounts = await dbHelpers.getAccounts();
      expect(accounts[0].isDefault).toBe(true);
      expect(accounts[1].isDefault).toBe(false);
    });

    it('should update account', async () => {
      const accountData = {
        name: 'Test Account',
        type: 'checking',
        currentBalance: 1000
      };

      const accountId = await dbHelpers.addAccount(accountData);
      
      await dbHelpers.updateAccount(accountId, {
        name: 'Updated Account',
        currentBalance: 1500
      });

      const accounts = await dbHelpers.getAccounts();
      expect(accounts[0]).toMatchObject({
        name: 'Updated Account',
        currentBalance: 1500
      });
    });

    it('should delete account', async () => {
      const accountData = {
        name: 'Test Account',
        type: 'checking',
        currentBalance: 1000
      };

      const accountId = await dbHelpers.addAccount(accountData);
      
      await dbHelpers.deleteAccount(accountId);

      const accounts = await dbHelpers.getAccounts();
      expect(accounts).toHaveLength(0);
    });

    it('should get default account', async () => {
      const accountData = {
        name: 'Default Account',
        type: 'checking',
        currentBalance: 1000
      };

      await dbHelpers.addAccount(accountData);
      
      const defaultAccount = await dbHelpers.getDefaultAccount();
      expect(defaultAccount).toMatchObject({
        name: 'Default Account',
        isDefault: true
      });
    });

    it('should set new default account', async () => {
      const account1 = {
        name: 'First Account',
        type: 'checking',
        currentBalance: 1000
      };

      const account2 = {
        name: 'Second Account',
        type: 'savings',
        currentBalance: 2000
      };

      const id1 = await dbHelpers.addAccount(account1);
      const id2 = await dbHelpers.addAccount(account2);

      await dbHelpers.setDefaultAccount(id2);

      const accounts = await dbHelpers.getAccounts();
      expect(accounts.find(a => a.id === id1).isDefault).toBe(false);
      expect(accounts.find(a => a.id === id2).isDefault).toBe(true);
    });
  });

  describe('Category Operations', () => {
    it('should add a new category', async () => {
      const categoryData = {
        name: 'Test Category',
        color: '#FF0000',
        icon: '🏠'
      };

      const categoryId = await dbHelpers.addCategory(categoryData);
      expect(categoryId).toBeDefined();

      const categories = await dbHelpers.getCategories();
      expect(categories).toHaveLength(1);
      expect(categories[0]).toMatchObject({
        name: 'Test Category',
        nameLower: 'test category',
        color: '#FF0000',
        icon: '🏠',
        isDefault: false
      });
    });

    it('should update category', async () => {
      const categoryData = {
        name: 'Test Category',
        color: '#FF0000',
        icon: '🏠'
      };

      const categoryId = await dbHelpers.addCategory(categoryData);
      
      await dbHelpers.updateCategory(categoryId, {
        name: 'Updated Category',
        color: '#00FF00'
      });

      const categories = await dbHelpers.getCategories();
      expect(categories[0]).toMatchObject({
        name: 'Updated Category',
        nameLower: 'updated category',
        color: '#00FF00'
      });
    });

    it('should delete category', async () => {
      const categoryData = {
        name: 'Test Category',
        color: '#FF0000',
        icon: '🏠'
      };

      const categoryId = await dbHelpers.addCategory(categoryData);
      
      const result = await dbHelpers.deleteCategory(categoryId);
      expect(result.affectedFixedExpenses).toHaveLength(0);
      expect(result.affectedPendingTransactions).toHaveLength(0);

      const categories = await dbHelpers.getCategories();
      expect(categories).toHaveLength(0);
    });

    it('should initialize default categories', async () => {
      await dbHelpers.initializeDefaultCategories();
      
      const categories = await dbHelpers.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      
      const categoryNames = categories.map(c => c.name);
      expect(categoryNames).toContain('Housing');
      expect(categoryNames).toContain('Utilities');
      expect(categoryNames).toContain('Insurance');
    });

    it('should not create duplicate default categories', async () => {
      await dbHelpers.initializeDefaultCategories();
      const firstCount = (await dbHelpers.getCategories()).length;
      
      await dbHelpers.initializeDefaultCategories();
      const secondCount = (await dbHelpers.getCategories()).length;
      
      expect(firstCount).toBe(secondCount);
    });
  });

  describe('Database Schema Operations', () => {
    it('should fix database schema', async () => {
      // Add an account without isDefault field
      await mockDb.accounts.add({
        name: 'Test Account',
        type: 'checking',
        currentBalance: 1000
      });

      await dbHelpers.fixDatabaseSchema();

      const accounts = await dbHelpers.getAccounts();
      expect(accounts[0].isDefault).toBeDefined();
    });

    it('should ensure default account exists', async () => {
      // Add accounts without setting default
      await mockDb.accounts.add({
        name: 'Account 1',
        type: 'checking',
        currentBalance: 1000,
        isDefault: false
      });

      await mockDb.accounts.add({
        name: 'Account 2',
        type: 'savings',
        currentBalance: 2000,
        isDefault: false
      });

      await dbHelpers.ensureDefaultAccount();

      const accounts = await dbHelpers.getAccounts();
      const hasDefault = accounts.some(account => account.isDefault === true);
      expect(hasDefault).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    it('should add audit log', async () => {
      await dbHelpers.addAuditLog('CREATE', 'account', 1, {
        name: 'Test Account',
        type: 'checking'
      });

      const logs = await dbHelpers.getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        actionType: 'CREATE',
        entityType: 'account',
        entityId: 1
      });
    });

    it('should get audit logs in reverse chronological order', async () => {
      await dbHelpers.addAuditLog('CREATE', 'account', 1, {});
      
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await dbHelpers.addAuditLog('UPDATE', 'account', 1, {});

      const logs = await dbHelpers.getAuditLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].actionType).toBe('UPDATE');
      expect(logs[1].actionType).toBe('CREATE');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Try to add account with invalid data
      await expect(
        dbHelpers.addAccount(null)
      ).rejects.toThrow('Failed to add account');
    });

    it('should handle missing account in update', async () => {
      await expect(
        dbHelpers.updateAccount(999, { name: 'Test' })
      ).rejects.toThrow('Failed to update account');
    });

    it('should handle missing account in delete', async () => {
      await expect(
        dbHelpers.deleteAccount(999)
      ).rejects.toThrow('Failed to delete account');
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity', async () => {
      const accountData = {
        name: 'Test Account',
        type: 'checking',
        currentBalance: 1000
      };

      const accountId = await dbHelpers.addAccount(accountData);

      // Add a pending transaction linked to the account
      await mockDb.pendingTransactions.add({
        accountId: accountId,
        amount: -100,
        description: 'Test transaction',
        category: 'Test',
        createdAt: new Date().toISOString()
      });

      // Try to delete account with linked transaction
      await expect(
        dbHelpers.deleteAccount(accountId)
      ).rejects.toThrow('Failed to delete account');
    });

    it('should handle category name case insensitivity', async () => {
      await dbHelpers.addCategory({
        name: 'Test Category',
        color: '#FF0000',
        icon: '🏠'
      });

      // Try to add category with same name but different case
      await expect(
        dbHelpers.addCategory({
          name: 'test category',
          color: '#00FF00',
          icon: '🚗'
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle bulk operations efficiently', async () => {
      const startTime = performance.now();

      // Add multiple accounts
      const accounts = Array.from({ length: 100 }, (_, i) => ({
        name: `Account ${i}`,
        type: 'checking',
        currentBalance: 1000 + i
      }));

      for (const account of accounts) {
        await dbHelpers.addAccount(account);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds

      const allAccounts = await dbHelpers.getAccounts();
      expect(allAccounts).toHaveLength(100);
    });

    it('should handle large category lists efficiently', async () => {
      const startTime = performance.now();

      // Add multiple categories
      const categories = Array.from({ length: 50 }, (_, i) => ({
        name: `Category ${i}`,
        color: `#${i.toString(16).padStart(6, '0')}`,
        icon: '🏠'
      }));

      for (const category of categories) {
        await dbHelpers.addCategory(category);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000); // 3 seconds

      const allCategories = await dbHelpers.getCategories();
      expect(allCategories).toHaveLength(50);
    });
  });
});

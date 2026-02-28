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

    // Version 1: Original schema
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

    // Version 2: Add recurring expenses functionality
    this.version(2).stores({
      accounts: '++id, name, type, currentBalance, isDefault, createdAt',
      pendingTransactions:
        '++id, accountId, amount, category, description, createdAt',
      fixedExpenses:
        '++id, name, dueDate, amount, accountId, paidAmount, status, category, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, recurringTemplateId, createdAt',
      categories: '++id, name, color, icon, isDefault, createdAt',
      creditCards:
        '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency, createdAt',
      userPreferences: '++id, component, preferences, createdAt',
      monthlyExpenseHistory:
        '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
      recurringExpenseTemplates:
        '++id, name, baseAmount, frequency, intervalValue, startDate, lastGenerated, nextDueDate, category, accountId, notes, isActive, isVariableAmount, createdAt, updatedAt',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    });

    // Version 3: Add targetCreditCardId for explicit credit card payment tracking
    this.version(3).stores({
      accounts: '++id, name, type, currentBalance, isDefault, createdAt',
      pendingTransactions:
        '++id, accountId, amount, category, description, createdAt',
      fixedExpenses:
        '++id, name, dueDate, amount, accountId, paidAmount, status, category, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, recurringTemplateId, targetCreditCardId, createdAt',
      categories: '++id, name, color, icon, isDefault, createdAt',
      creditCards:
        '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency, createdAt',
      userPreferences: '++id, component, preferences, createdAt',
      monthlyExpenseHistory:
        '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
      recurringExpenseTemplates:
        '++id, name, baseAmount, frequency, intervalValue, startDate, lastGenerated, nextDueDate, category, accountId, notes, isActive, isVariableAmount, createdAt, updatedAt',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    });

    // Version 4: Dual Foreign Key Architecture - Separate accountId and creditCardId
    this.version(4).stores({
      accounts: '++id, name, type, currentBalance, isDefault, createdAt',
      pendingTransactions:
        '++id, accountId, amount, category, description, createdAt',
      fixedExpenses:
        '++id, name, dueDate, amount, accountId, creditCardId, targetCreditCardId, category, paidAmount, status, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, recurringTemplateId, createdAt',
      categories: '++id, name, color, icon, isDefault, createdAt',
      creditCards:
        '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
      paycheckSettings: '++id, lastPaycheckDate, frequency, createdAt',
      userPreferences: '++id, component, preferences, createdAt',
      monthlyExpenseHistory:
        '++id, expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
      recurringExpenseTemplates:
        '++id, name, baseAmount, frequency, intervalValue, startDate, lastGenerated, nextDueDate, category, accountId, notes, isActive, isVariableAmount, createdAt, updatedAt',
      auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
    });
  }
}

// Create the database instance
export const db = new DigibookDBClean();

// Initialize database with error handling
export async function initializeDatabase() {
  try {
    logger.debug('Database: Starting initialization...');
    logger.debug('Database: db object =', db);
    logger.debug('Database: db.name =', db.name);
    logger.debug('Database: db.verno =', db.verno);

    await db.open();

    logger.debug('Database: After opening...');
    logger.debug('Database: db.isOpen() =', db.isOpen());
    logger.debug(
      'Database: db.tables =',
      db.tables.map(t => t.name),
    );
    logger.debug('Database: Looking for recurringExpenseTemplates table...');
    const recurringTable = db.tables.find(
      t => t.name === 'recurringExpenseTemplates',
    );
    logger.debug(
      'Database: recurringExpenseTemplates table found:',
      !!recurringTable,
    );

    if (recurringTable) {
      logger.debug(
        'Database: recurringExpenseTemplates table schema:',
        recurringTable.schema,
      );
    }

    logger.success('Database initialized successfully');
    return true;
  } catch (error) {
    logger.error('Database: Initialization error:', error);

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
        `Failed to initialize database: ${recreateError.message}`,
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
      await db.recurringExpenseTemplates.clear();
      await db.auditLogs.clear();
      logger.success('Database cleared successfully');
    } catch (error) {
      logger.error('Error clearing database:', error);
      throw new Error(`Failed to clear database: ${error.message}`);
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
          await new Promise((resolve, _reject) => {
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
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
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
      await db.transaction(
        'rw',
        db.pendingTransactions,
        db.accounts,
        db.auditLogs,
        async () => {
          const transaction = await db.pendingTransactions.get(id);
          if (!transaction) {
            throw new Error(`Transaction with ID ${id} not found`);
          }

          // Update the account balance (adding the transaction amount)
          // For income, this adds to balance. For expense (negative), it subtracts.
          const account = await db.accounts.get(transaction.accountId);
          if (account) {
            const previousBalance = account.currentBalance;
            const newBalance = previousBalance + transaction.amount;

            await db.accounts.update(account.id, {
              currentBalance: newBalance,
            });

            // Log the completion in audit logs
            await db.auditLogs.add({
              timestamp: new Date().toISOString(),
              actionType: 'COMPLETE_TRANSACTION',
              entityType: 'PendingTransaction',
              entityId: id,
              details: {
                amount: transaction.amount,
                accountId: transaction.accountId,
                description: transaction.description,
                category: transaction.category,
                previousBalance,
                newBalance,
              },
            });
          } else {
            logger.warn(
              `Account ${transaction.accountId} not found for transaction ${id}`,
            );
          }

          // Finally, delete the pending transaction
          await db.pendingTransactions.delete(id);
        },
      );
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

  /**
   * @deprecated Use addFixedExpenseV4() instead. This does not support V4 dual
   * foreign key format (creditCardId). Will be removed in a future version.
   */
  async addFixedExpense(expense) {
    logger.warn(
      'addFixedExpense() is deprecated. Use addFixedExpenseV4() instead for proper V4 format support.',
    );
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

  /**
   * @deprecated Use updateFixedExpenseV4() instead. This does not support V4
   * dual foreign key format (creditCardId). Will be removed in a future version.
   */
  async updateFixedExpense(id, updates) {
    logger.warn(
      'updateFixedExpense() is deprecated. Use updateFixedExpenseV4() instead for proper V4 format support.',
    );
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

  // Recurring Expense Template Operations
  async addRecurringExpenseTemplate(template) {
    try {
      // Validate template data
      if (
        !template.name ||
        !template.baseAmount ||
        !template.frequency ||
        !template.startDate ||
        !template.category
      ) {
        throw new Error('Missing required recurring template fields');
      }

      // Use caller's nextDueDate when valid; else fall back to computed.
      let nextDueDate;
      const callerNextDue = template.nextDueDate;
      const startParsed = DateUtils.parseDate(template.startDate);
      let callerNextParsed = null;
      if (callerNextDue && DateUtils.isValidDate(callerNextDue)) {
        callerNextParsed = DateUtils.parseDate(callerNextDue);
      }
      if (
        callerNextParsed &&
        startParsed &&
        !isNaN(startParsed.getTime()) &&
        callerNextParsed.getTime() >= startParsed.getTime()
      ) {
        nextDueDate = callerNextDue;
      } else {
        nextDueDate = this.calculateNextDueDate(
          template.startDate,
          template.frequency,
          template.intervalValue || 1,
          template.intervalUnit || 'months',
        );
      }

      const templateData = {
        ...template,
        intervalUnit: template.intervalUnit || 'months', // Ensure intervalUnit is always set
        nextDueDate,
        lastGenerated: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const id = await db.recurringExpenseTemplates.add(templateData);
      logger.success(`Recurring expense template created: ${template.name}`);
      return id;
    } catch (error) {
      logger.error('Error adding recurring expense template:', error);
      throw new Error(
        `Failed to add recurring expense template: ${error.message}`,
      );
    }
  },

  async updateRecurringExpenseTemplate(id, updates) {
    try {
      const template = await db.recurringExpenseTemplates.get(id);
      if (!template) {
        throw new Error('Template not found');
      }

      // Normalize existing template's intervalUnit
      const normalizedTemplate = {
        ...template,
        intervalUnit: template.intervalUnit || 'months',
      };

      const updateData = {
        ...updates,

        // Ensure intervalUnit is always set
        intervalUnit:
          updates.intervalUnit !== undefined
            ? updates.intervalUnit
            : normalizedTemplate.intervalUnit,
        updatedAt: new Date().toISOString(),
      };

      // If frequency or start date changed, recalculate next due date
      if (
        updates.frequency ||
        updates.startDate ||
        updates.intervalValue ||
        updates.intervalUnit
      ) {
        updateData.nextDueDate = this.calculateNextDueDate(
          updates.startDate || normalizedTemplate.startDate,
          updates.frequency || normalizedTemplate.frequency,
          updates.intervalValue || normalizedTemplate.intervalValue || 1,
          updateData.intervalUnit || 'months',
        );
      }

      await db.recurringExpenseTemplates.update(id, updateData);
      logger.success(`Recurring expense template updated: ${id}`);
    } catch (error) {
      logger.error('Error updating recurring expense template:', error);
      throw new Error('Failed to update recurring expense template');
    }
  },

  async deleteRecurringExpenseTemplate(id) {
    try {
      await db.recurringExpenseTemplates.delete(id);
      logger.success(`Recurring expense template deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting recurring expense template:', error);
      throw new Error('Failed to delete recurring expense template');
    }
  },

  async getRecurringExpenseTemplates() {
    try {
      logger.debug('dbHelpers: Starting getRecurringExpenseTemplates...');
      logger.debug('dbHelpers: db object =', db);
      logger.debug(
        'dbHelpers: db.recurringExpenseTemplates =',
        db.recurringExpenseTemplates,
      );

      // Test if the table exists
      logger.debug('dbHelpers: Testing table existence...');
      const tableExists = db.tables.find(
        table => table.name === 'recurringExpenseTemplates',
      );
      logger.debug(
        'dbHelpers: recurringExpenseTemplates table exists:',
        !!tableExists,
      );

      if (!tableExists) {
        logger.error(
          'dbHelpers: recurringExpenseTemplates table does not exist!',
        );
        throw new Error('recurringExpenseTemplates table does not exist');
      }

      logger.debug('dbHelpers: Performing query...');

      // Use toArray() and filter instead of indexed where query to avoid DataError
      const allTemplates = await db.recurringExpenseTemplates.toArray();
      logger.debug('dbHelpers: Got all templates:', allTemplates);

      const result = allTemplates
        .filter(template => template.isActive === true)
        .map(template => ({
          ...template,

          // Normalize intervalUnit for backward compatibility
          intervalUnit: template.intervalUnit || 'months',
        }));
      logger.debug('dbHelpers: Filtered active templates:', result);

      logger.debug('dbHelpers: Query result:', result);
      return result;
    } catch (error) {
      logger.error('Error fetching recurring expense templates:', error);
      throw new Error('Failed to fetch recurring expense templates');
    }
  },

  async getRecurringExpenseTemplate(id) {
    try {
      const template = await db.recurringExpenseTemplates.get(id);
      if (template) {
        // Normalize intervalUnit for backward compatibility
        return {
          ...template,
          intervalUnit: template.intervalUnit || 'months',
        };
      }
      return template;
    } catch (error) {
      logger.error('Error fetching recurring expense template:', error);
      throw new Error('Failed to fetch recurring expense template');
    }
  },

  // Helper function to calculate next due date based on frequency
  calculateNextDueDate(
    startDate,
    frequency,
    intervalValue = 1,
    intervalUnit = 'months',
  ) {
    // Ensure intervalValue is a valid number
    const validIntervalValue =
      Number.isInteger(intervalValue) && intervalValue > 0 ? intervalValue : 1;

    // Ensure intervalUnit is valid
    const validIntervalUnit = ['days', 'weeks', 'months', 'years'].includes(
      intervalUnit,
    )
      ? intervalUnit
      : 'months';

    const date = DateUtils.parseDate(startDate);
    if (!date || isNaN(date.getTime())) {
      throw new Error(`Invalid start date for recurring expense: ${startDate}`);
    }

    switch (frequency) {
      case 'monthly':
        date.setMonth(date.getMonth() + validIntervalValue);
        break;
      case 'quarterly': {
        const addMonths = 3 * validIntervalValue;
        date.setMonth(date.getMonth() + addMonths);
        break;
      }
      case 'biannually': {
        const addMonths = 6 * validIntervalValue;
        date.setMonth(date.getMonth() + addMonths);
        break;
      }
      case 'annually':
        date.setFullYear(date.getFullYear() + validIntervalValue);
        break;
      case 'custom':
        // Handle different interval units
        switch (validIntervalUnit) {
          case 'days':
            date.setDate(date.getDate() + validIntervalValue);
            break;
          case 'weeks': {
            const addDays = validIntervalValue * 7;
            date.setDate(date.getDate() + addDays);
            break;
          }
          case 'months':
            date.setMonth(date.getMonth() + validIntervalValue);
            break;
          case 'years':
            date.setFullYear(date.getFullYear() + validIntervalValue);
            break;
          default:
            // Fallback to months for backward compatibility
            date.setMonth(date.getMonth() + validIntervalValue);
        }
        break;
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }

    return DateUtils.formatDate(date);
  },

  // Generate next occurrence from template
  async generateRecurringExpense(templateId) {
    try {
      const template = await db.recurringExpenseTemplates.get(templateId);
      if (!template || !template.isActive) {
        throw new Error('Template not found or inactive');
      }

      // Check if template has an end date and if we've passed it
      if (template.endDate) {
        const todayString = DateUtils.today();
        const today = DateUtils.parseDate(todayString);
        const endDate = DateUtils.parseDate(template.endDate);

        if (endDate && today && today > endDate) {
          // Template has expired, deactivate it
          await this.updateRecurringExpenseTemplate(templateId, {
            isActive: false,
          });
          throw new Error('Template has reached its end date');
        }
      }

      // Normalize intervalUnit for backward compatibility
      const normalizedTemplate = {
        ...template,
        intervalUnit: template.intervalUnit || 'months',
      };

      // Create new fixed expense from template using V4 format
      const newExpense = {
        name: normalizedTemplate.name,
        dueDate: normalizedTemplate.nextDueDate,
        amount: normalizedTemplate.baseAmount,
        accountId: normalizedTemplate.accountId || null,
        creditCardId: normalizedTemplate.creditCardId || null,
        targetCreditCardId: normalizedTemplate.targetCreditCardId || null, // credit card payments
        category: normalizedTemplate.category,
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: templateId,
      };

      const expenseId = await this.addFixedExpenseV4(newExpense);

      // Calculate next due date
      const newNextDueDate = this.calculateNextDueDate(
        normalizedTemplate.nextDueDate,
        normalizedTemplate.frequency,
        normalizedTemplate.intervalValue || 1,
        normalizedTemplate.intervalUnit || 'months',
      );

      // Check if the next due date would exceed the end date
      let shouldDeactivate = false;
      if (template.endDate) {
        const endDate = DateUtils.parseDate(template.endDate);
        const nextDue = DateUtils.parseDate(newNextDueDate);

        if (endDate && nextDue && nextDue > endDate) {
          // Next occurrence would be after end date, deactivate template
          shouldDeactivate = true;
        }
      }

      await this.updateRecurringExpenseTemplate(templateId, {
        lastGenerated: template.nextDueDate,
        nextDueDate: shouldDeactivate ? null : newNextDueDate,
        isActive: !shouldDeactivate, // Deactivate if we've reached the end
      });

      logger.success(`Generated recurring expense: ${template.name}`);
      return expenseId;
    } catch (error) {
      logger.error('Error generating recurring expense:', error);
      throw new Error('Failed to generate recurring expense');
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
          `Invalid account data: ${validation.errors.join(', ')}`,
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
          `Invalid category data: ${validation.errors.join(', ')}`,
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

  /**
   * Rename a category and update all references in expenses and transactions
   * This is an atomic operation - if any update fails, the category rename is rolled back
   * @param {number} categoryId - ID of the category to rename
   * @param {string} oldName - Current category name
   * @param {string} newName - New category name
   * @returns {Object} Summary of updated items
   */
  async renameCategory(categoryId, oldName, newName) {
    try {
      // Validate inputs
      if (!categoryId || !oldName || !newName) {
        throw new Error('Category ID, old name, and new name are required');
      }

      if (oldName === newName) {
        return {
          expensesUpdated: 0,
          transactionsUpdated: 0,
          totalUpdated: 0,
        };
      }

      // Get the category to verify it exists
      const category = await db.categories.get(categoryId);
      if (!category) {
        throw new Error(`Category with ID ${categoryId} not found`);
      }

      if (category.name !== oldName) {
        throw new Error(
          `Category name mismatch. Expected "${oldName}", found "${category.name}"`,
        );
      }

      // Check if new name already exists
      const existingCategory = await db.categories
        .where('name')
        .equals(newName)
        .first();
      if (existingCategory && existingCategory.id !== categoryId) {
        throw new Error(`Category with name "${newName}" already exists`);
      }

      // Find all expenses with the old category name
      const expensesToUpdate = await db.fixedExpenses
        .where('category')
        .equals(oldName)
        .toArray();

      // Find all pending transactions with the old category name
      const transactionsToUpdate = await db.pendingTransactions
        .where('category')
        .equals(oldName)
        .toArray();

      // Update category name first
      await db.categories.update(categoryId, { name: newName });

      // Update all expenses using batch operations
      let expensesUpdated = 0;
      for (const expense of expensesToUpdate) {
        try {
          await this.updateFixedExpenseV4(expense.id, { category: newName });
          expensesUpdated++;
        } catch (error) {
          logger.error(
            `Failed to update expense ${expense.id} during category rename:`,
            error,
          );

          // Rollback category name change
          await db.categories.update(categoryId, { name: oldName });
          throw new Error(
            `Failed to update expense references. Category rename rolled back. Error: ${error.message}`,
          );
        }
      }

      // Update all pending transactions
      let transactionsUpdated = 0;
      for (const transaction of transactionsToUpdate) {
        try {
          await this.updatePendingTransaction(transaction.id, {
            category: newName,
          });
          transactionsUpdated++;
        } catch (error) {
          logger.error(
            `Failed to update transaction ${transaction.id} during category rename:`,
            error,
          );

          // Rollback category name change
          await db.categories.update(categoryId, { name: oldName });

          // Rollback expense updates
          for (const expense of expensesToUpdate.slice(0, expensesUpdated)) {
            try {
              await this.updateFixedExpenseV4(expense.id, {
                category: oldName,
              });
            } catch (rollbackError) {
              logger.error(
                `Failed to rollback expense ${expense.id}:`,
                rollbackError,
              );
            }
          }
          throw new Error(
            `Failed to update transaction references. Category rename rolled back. Error: ${error.message}`,
          );
        }
      }

      const totalUpdated = expensesUpdated + transactionsUpdated;
      logger.success(
        `Category renamed from "${oldName}" to "${newName}". Updated ${expensesUpdated} expenses and ${transactionsUpdated} transactions.`,
      );

      return {
        expensesUpdated,
        transactionsUpdated,
        totalUpdated,
      };
    } catch (error) {
      logger.error('Error renaming category:', error);
      throw error;
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
        `Reassigned ${expenseIds.length} expenses and ${transactionIds.length} transactions from ${oldCategoryName} to ${newCategoryName}`,
      );
    } catch (error) {
      logger.error('Error reassigning category items:', error);
      throw new Error('Failed to reassign category items');
    }
  },

  /**
   * Detect orphaned expenses (expenses with category names that don't exist)
   * @returns {Object} Map of orphaned category names to their usage counts
   */
  async detectOrphanedExpenses() {
    try {
      // Get all unique category names from expenses
      const allExpenses = await db.fixedExpenses.toArray();
      const expenseCategoryNames = new Set(
        allExpenses.map(expense => expense.category).filter(Boolean),
      );

      // Get all unique category names from pending transactions
      const allTransactions = await db.pendingTransactions.toArray();
      const transactionCategoryNames = new Set(
        allTransactions
          .map(transaction => transaction.category)
          .filter(Boolean),
      );

      // Get all valid category names
      const allCategories = await db.categories.toArray();
      const validCategoryNames = new Set(
        allCategories.map(category => category.name),
      );

      // Find orphaned category names
      const orphanedCategories = new Map();

      // Check expense categories
      expenseCategoryNames.forEach(categoryName => {
        if (!validCategoryNames.has(categoryName)) {
          const existing = orphanedCategories.get(categoryName) || {
            expenseCount: 0,
            transactionCount: 0,
          };
          existing.expenseCount = allExpenses.filter(
            e => e.category === categoryName,
          ).length;
          orphanedCategories.set(categoryName, existing);
        }
      });

      // Check transaction categories
      transactionCategoryNames.forEach(categoryName => {
        if (!validCategoryNames.has(categoryName)) {
          const existing = orphanedCategories.get(categoryName) || {
            expenseCount: 0,
            transactionCount: 0,
          };
          existing.transactionCount = allTransactions.filter(
            t => t.category === categoryName,
          ).length;
          orphanedCategories.set(categoryName, existing);
        }
      });

      return Array.from(orphanedCategories.entries()).map(([name, counts]) => ({
        categoryName: name,
        expenseCount: counts.expenseCount,
        transactionCount: counts.transactionCount,
        totalCount: counts.expenseCount + counts.transactionCount,
      }));
    } catch (error) {
      logger.error('Error detecting orphaned expenses:', error);
      throw error;
    }
  },

  /**
   * Fix orphaned expenses by reassigning them to a target category
   * @param {string} orphanedCategoryName - The orphaned category name to fix
   * @param {string} targetCategoryName - The target category to reassign to
   * @returns {Object} Summary of fixed items
   */
  async fixOrphanedExpenses(orphanedCategoryName, targetCategoryName) {
    try {
      // Validate target category exists
      const targetCategory = await db.categories
        .where('name')
        .equals(targetCategoryName)
        .first();
      if (!targetCategory) {
        throw new Error(`Target category "${targetCategoryName}" not found`);
      }

      // Find all expenses with orphaned category
      const orphanedExpenses = await db.fixedExpenses
        .where('category')
        .equals(orphanedCategoryName)
        .toArray();

      // Find all transactions with orphaned category
      const orphanedTransactions = await db.pendingTransactions
        .where('category')
        .equals(orphanedCategoryName)
        .toArray();

      // Update expenses
      let expensesFixed = 0;
      for (const expense of orphanedExpenses) {
        try {
          await this.updateFixedExpenseV4(expense.id, {
            category: targetCategoryName,
          });
          expensesFixed++;
        } catch (error) {
          logger.error(`Failed to fix expense ${expense.id}:`, error);
        }
      }

      // Update transactions
      let transactionsFixed = 0;
      for (const transaction of orphanedTransactions) {
        try {
          await this.updatePendingTransaction(transaction.id, {
            category: targetCategoryName,
          });
          transactionsFixed++;
        } catch (error) {
          logger.error(`Failed to fix transaction ${transaction.id}:`, error);
        }
      }

      logger.success(
        `Fixed orphaned category "${orphanedCategoryName}": ${expensesFixed} expenses and ${transactionsFixed} transactions reassigned to "${targetCategoryName}"`,
      );

      return {
        expensesFixed,
        transactionsFixed,
        totalFixed: expensesFixed + transactionsFixed,
      };
    } catch (error) {
      logger.error('Error fixing orphaned expenses:', error);
      throw error;
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
          0,
        ),
        totalTransactionAmount: transactions.reduce(
          (sum, transaction) => sum + transaction.amount,
          0,
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
        cat.name.toLowerCase(),
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
        category =>
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
        account => account.isDefault === true,
      );

      // If there are multiple default accounts, keep only the first one
      if (defaultAccounts.length > 1) {
        const accountsToUpdate = defaultAccounts.slice(1);
        for (const account of accountsToUpdate) {
          await db.accounts.update(account.id, { isDefault: false });
        }
        logger.info(
          `Cleaned up ${accountsToUpdate.length} duplicate default accounts`,
        );
      }

      // Remove any "Default Account" placeholders if there are real accounts
      const realAccounts = allAccounts.filter(
        account => account.name !== 'Default Account',
      );

      if (realAccounts.length > 0) {
        // Remove ALL "Default Account" entries when real accounts exist
        const defaultAccountPlaceholders = allAccounts.filter(
          account => account.name === 'Default Account',
        );

        for (const placeholder of defaultAccountPlaceholders) {
          await db.accounts.delete(placeholder.id);
          logger.info(
            `Removed placeholder Default Account (ID: ${placeholder.id})`,
          );
        }

        // No default after removing placeholders: use first real account
        const remainingAccounts = await db.accounts.toArray();
        const hasDefault = remainingAccounts.some(
          account => account.isDefault === true,
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
          // Use V4 format: set creditCardId, not accountId
          await this.updateFixedExpenseV4(mapping.expenseId, {
            creditCardId: mapping.creditCardId,
            accountId: null, // Ensure accountId is null when using creditCardId
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
        `Cleaned up ${duplicates.length} duplicate credit card expenses`,
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
      const accounts = await db.accounts.toArray();
      let createdCount = 0;

      // Find the default checking account to use as funding source
      const defaultAccount =
        accounts.find(acc => acc.isDefault) ||
        accounts.find(acc => acc.type === 'checking') ||
        accounts[0];

      if (!defaultAccount) {
        logger.warn(
          'No checking/savings account found. Cannot create credit card payment expenses.',
        );
        return 0;
      }

      for (const card of creditCards) {
        // Check if there's already a credit card payment expense for this card
        const hasPaymentExpense = expenses.some(
          expense =>
            expense.category === 'Credit Card Payment' &&
            expense.targetCreditCardId === card.id,
        );

        if (!hasPaymentExpense) {
          // Create a minimum payment expense using the new two-field system
          // Min payment if set, else from balance or $25 default
          const expenseAmount =
            card.minimumPayment ||
            (card.balance > 0 ? Math.max(card.balance * 0.02, 25) : 25);

          // Use V4 format with proper validation
          await this.addFixedExpenseV4({
            name: `${card.name} Payment`,
            dueDate: card.dueDate || new Date().toISOString().split('T')[0],
            amount: expenseAmount,
            accountId: defaultAccount.id, // ← Funding source (checking/savings)
            creditCardId: null, // ← Credit card payments don't use creditCardId
            targetCreditCardId: card.id, // ← Target credit card to pay
            category: 'Credit Card Payment', // ← Proper category for two-field system
            paidAmount: 0,
            status: 'pending',
            isAutoCreated: true,
          });
          createdCount++;
        }
      }

      logger.success(`Created ${createdCount} credit card payment expenses`);
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
        0,
      );
      const totalActual = expenses.reduce(
        (sum, expense) => sum + (expense.paidAmount || 0),
        0,
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
        recurringExpenseTemplates: await db.recurringExpenseTemplates.toArray(),
        exportDate: new Date().toISOString(),
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
      const CHUNK_SIZE = 1000;
      const bulkPutChunked = async (table, items) => {
        if (!Array.isArray(items) || items.length === 0) return;
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
          const chunk = items.slice(i, i + CHUNK_SIZE);
          await table.bulkPut(chunk);
        }
      };

      // Atomic full-replace import:
      // - Everything is cleared and written inside one IndexedDB transaction.
      // - Any failure aborts the transaction, rolling back the clears/writes.
      await db.transaction(
        'rw',
        db.accounts,
        db.categories,
        db.paycheckSettings,
        db.userPreferences,
        db.recurringExpenseTemplates,
        db.creditCards,
        db.pendingTransactions,
        db.fixedExpenses,
        db.monthlyExpenseHistory,
        db.auditLogs,
        async () => {
          // Clear existing data (inline so failures abort the transaction)
          await db.accounts.clear();
          await db.pendingTransactions.clear();
          await db.fixedExpenses.clear();
          await db.categories.clear();
          await db.creditCards.clear();
          await db.paycheckSettings.clear();
          await db.userPreferences.clear();
          await db.monthlyExpenseHistory.clear();
          await db.recurringExpenseTemplates.clear();
          await db.auditLogs.clear();

          // Import core data first (order matters for app invariants)
          await bulkPutChunked(db.accounts, data.accounts);
          await bulkPutChunked(db.categories, data.categories);
          await bulkPutChunked(db.paycheckSettings, data.paycheckSettings);
          await bulkPutChunked(db.userPreferences, data.userPreferences);

          // Import recurring templates before fixed expenses (they may reference templates)
          await bulkPutChunked(
            db.recurringExpenseTemplates,
            data.recurringExpenseTemplates,
          );

          // Import expenses and transactions
          await bulkPutChunked(db.creditCards, data.creditCards);
          await bulkPutChunked(
            db.pendingTransactions,
            data.pendingTransactions,
          );
          await bulkPutChunked(db.fixedExpenses, data.fixedExpenses);

          // Import historical and audit data
          await bulkPutChunked(
            db.monthlyExpenseHistory,
            data.monthlyExpenseHistory,
          );
          await bulkPutChunked(db.auditLogs, data.auditLogs);
        },
      );

      logger.success('Data imported successfully (atomic transaction)');
    } catch (error) {
      logger.error('Error importing data:', error);
      throw new Error(`Failed to import data: ${error.message}`);
    }
  },

  async validateImportData(data) {
    try {
      const errors = [];

      if (!data || typeof data !== 'object') {
        return { isValid: false, errors: ['Invalid data: expected an object'] };
      }

      // Full-replace import expects these core tables.
      const requiredArrayFields = [
        'accounts',
        'creditCards',
        'pendingTransactions',
        'fixedExpenses',
        'categories',
      ];

      for (const field of requiredArrayFields) {
        if (!Array.isArray(data[field])) {
          errors.push(`Invalid data: missing or invalid ${field} array`);
        }
      }

      // Optional arrays: if present, must be arrays.
      const optionalArrayFields = [
        'paycheckSettings',
        'userPreferences',
        'monthlyExpenseHistory',
        'auditLogs',
        'recurringExpenseTemplates',
      ];
      for (const field of optionalArrayFields) {
        if (data[field] !== undefined && data[field] !== null) {
          if (!Array.isArray(data[field])) {
            errors.push(
              `Invalid data: ${field} must be an array when provided`,
            );
          }
        }
      }

      if (errors.length > 0) {
        return { isValid: false, errors };
      }

      // Basic referential integrity checks (fail-fast)
      const toId = value => {
        if (value === null || value === undefined || value === '') return null;
        const n =
          typeof value === 'number' ? value : Number.parseInt(value, 10);
        return Number.isFinite(n) ? n : null;
      };

      const accountIds = new Set((data.accounts || []).map(a => toId(a.id)));
      accountIds.delete(null);
      const creditCardIds = new Set(
        (data.creditCards || []).map(c => toId(c.id)),
      );
      creditCardIds.delete(null);
      const templateIds = new Set(
        (data.recurringExpenseTemplates || []).map(t => toId(t.id)),
      );
      templateIds.delete(null);

      // Pending transactions must reference an account
      for (const [idx, txn] of (data.pendingTransactions || []).entries()) {
        const accountId = toId(txn?.accountId);
        if (!accountId || !accountIds.has(accountId)) {
          errors.push(
            `pendingTransactions[${idx}]: invalid accountId (${txn?.accountId})`,
          );
        }
      }

      const hasValue = v => v !== null && v !== undefined && v !== '';

      // Fixed expenses must reference exactly one payment source, and valid IDs
      for (const [idx, exp] of (data.fixedExpenses || []).entries()) {
        const accountId = toId(exp?.accountId);
        const creditCardId = toId(exp?.creditCardId);
        const targetCreditCardId = toId(exp?.targetCreditCardId);
        const recurringTemplateId = toId(exp?.recurringTemplateId);

        const hasAccount = hasValue(accountId);
        const hasCreditCard = hasValue(creditCardId);

        if (hasAccount && hasCreditCard) {
          errors.push(
            `fixedExpenses[${idx}]: cannot have both accountId and creditCardId`,
          );
        } else if (!hasAccount && !hasCreditCard) {
          errors.push(
            `fixedExpenses[${idx}]: must have either accountId or creditCardId`,
          );
        }

        if (hasAccount && !accountIds.has(accountId)) {
          errors.push(
            `fixedExpenses[${idx}]: accountId (${exp?.accountId}) not found in accounts`,
          );
        }
        if (hasCreditCard && !creditCardIds.has(creditCardId)) {
          errors.push(
            `fixedExpenses[${idx}]: creditCardId (${exp?.creditCardId}) not found in creditCards`,
          );
        }

        if (exp?.category === 'Credit Card Payment') {
          if (!hasAccount) {
            errors.push(
              `fixedExpenses[${idx}]: Credit Card Payment must have funding accountId`,
            );
          }
          if (!targetCreditCardId || !creditCardIds.has(targetCreditCardId)) {
            errors.push(
              `fixedExpenses[${idx}]: Credit Card Payment must have valid targetCreditCardId`,
            );
          }
          if (hasCreditCard) {
            errors.push(
              `fixedExpenses[${idx}]: Credit Card Payment cannot use creditCardId (use targetCreditCardId)`,
            );
          }
        } else if (hasValue(targetCreditCardId)) {
          errors.push(
            `fixedExpenses[${idx}]: targetCreditCardId must be null unless category is Credit Card Payment`,
          );
        }

        if (
          hasValue(recurringTemplateId) &&
          !templateIds.has(recurringTemplateId)
        ) {
          errors.push(
            `fixedExpenses[${idx}]: recurringTemplateId (${exp?.recurringTemplateId}) not found in recurringExpenseTemplates`,
          );
        }
      }

      // Recurring templates (if present) must also obey payment-source constraints and reference
      // valid IDs
      for (const [idx, tpl] of (
        data.recurringExpenseTemplates || []
      ).entries()) {
        const accountId = toId(tpl?.accountId);
        const creditCardId = toId(tpl?.creditCardId);
        const targetCreditCardId = toId(tpl?.targetCreditCardId);

        const hasAccount = hasValue(accountId);
        const hasCreditCard = hasValue(creditCardId);

        if (hasAccount && hasCreditCard) {
          errors.push(
            `recurringExpenseTemplates[${idx}]: cannot have both accountId and creditCardId`,
          );
        } else if (!hasAccount && !hasCreditCard) {
          errors.push(
            `recurringExpenseTemplates[${idx}]: must have either accountId or creditCardId`,
          );
        }

        if (hasAccount && !accountIds.has(accountId)) {
          errors.push(
            `recurringExpenseTemplates[${idx}]: accountId (${tpl?.accountId}) not found in accounts`,
          );
        }
        if (hasCreditCard && !creditCardIds.has(creditCardId)) {
          errors.push(
            `recurringExpenseTemplates[${idx}]: creditCardId (${tpl?.creditCardId}) not found in creditCards`,
          );
        }

        if (tpl?.category === 'Credit Card Payment') {
          if (!hasAccount) {
            errors.push(
              `recurringExpenseTemplates[${idx}]: Credit Card Payment must have funding accountId`,
            );
          }
          if (!targetCreditCardId || !creditCardIds.has(targetCreditCardId)) {
            errors.push(
              `recurringExpenseTemplates[${idx}]: Credit Card Payment must have valid targetCreditCardId`,
            );
          }
          if (hasCreditCard) {
            errors.push(
              `recurringExpenseTemplates[${idx}]: Credit Card Payment cannot use creditCardId (use targetCreditCardId)`,
            );
          }
        } else if (hasValue(targetCreditCardId)) {
          errors.push(
            `recurringExpenseTemplates[${idx}]: targetCreditCardId must be null unless category is Credit Card Payment`,
          );
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
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
          remainingBalance,
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
          `Found ${categoryCount} existing categories, skipping default initialization`,
        );
      }

      logger.success('Default data initialized');
    } catch (error) {
      logger.error('Error initializing default data:', error);
    }
  },

  // ===== VERSION 4 DATABASE OPERATIONS =====
  // New operations for dual foreign key architecture

  /**
   * Add fixed expense with V4 validation (dual foreign key)
   */
  async addFixedExpenseV4(expenseData) {
    try {
      // Import validation functions
      const { validateExpense, sanitizeExpenseData } = await import(
        '../utils/expenseValidation'
      );

      // Sanitize and validate the expense data
      const sanitizedData = sanitizeExpenseData(expenseData);
      validateExpense(sanitizedData);

      const id = await db.fixedExpenses.add({
        ...sanitizedData,
        createdAt: new Date().toISOString(),
      });

      logger.success(`Added V4 expense: ${sanitizedData.name}`);
      return id;
    } catch (error) {
      logger.error('Error adding V4 expense:', error);
      throw error;
    }
  },

  /**
   * Update fixed expense with V4 validation (dual foreign key)
   *
   * @param {number} id - Expense ID to update
   * @param {Object} updates - Fields to update
   * @param {Object} [options={}] - Optional validation options
   * @param {boolean} [options.skipPaymentSourceValidation=false] - Skip
   *   payment source validation during update if true
   */
  async updateFixedExpenseV4(id, updates, options = {}) {
    try {
      // Import validation functions
      const { validateExpense, sanitizeExpenseData } = await import(
        '../utils/expenseValidation'
      );

      // Get current expense to merge with updates
      const currentExpense = await db.fixedExpenses.get(id);
      if (!currentExpense) {
        throw new Error(`Expense with ID ${id} not found`);
      }

      // Merge current data with updates and validate
      const updatedExpense = { ...currentExpense, ...updates };
      const sanitizedData = sanitizeExpenseData(updatedExpense);
      validateExpense(sanitizedData, options);

      // Only update the fields that were actually changed
      const sanitizedUpdates = sanitizeExpenseData(updates);
      await db.fixedExpenses.update(id, sanitizedUpdates);

      logger.success(`Updated V4 expense ID: ${id}`);
    } catch (error) {
      logger.error('Error updating V4 expense:', error);
      throw error;
    }
  },

  /**
   * Apply a paidAmount change atomically (expense + balances).
   *
   * This prevents partial commits where balances update but the expense does not
   * (or vice versa). Audit log is best-effort by design.
   *
   * @param {number} expenseId - Expense ID to update
   * @param {Object} updates - Fields to update (must include paidAmount)
   * @param {Object} [options={}] - Optional validation options for validateExpense
   */
  async applyExpensePaymentChangeAtomic(expenseId, updates, options = {}) {
    if (!updates || typeof updates.paidAmount !== 'number') {
      throw new Error(
        'applyExpensePaymentChangeAtomic requires numeric paidAmount',
      );
    }

    // Import validators outside the transaction callback to avoid IndexedDB
    // transaction inactivity across non-DB awaits.
    const { validateExpense, sanitizeExpenseData } = await import(
      '../utils/expenseValidation'
    );

    await db.transaction(
      'rw',
      db.fixedExpenses,
      db.accounts,
      db.creditCards,
      db.auditLogs,
      async () => {
        const currentExpense = await db.fixedExpenses.get(expenseId);
        if (!currentExpense) {
          throw new Error(`Expense with ID ${expenseId} not found`);
        }

        const updatedExpense = { ...currentExpense, ...updates };
        const sanitizedExpense = sanitizeExpenseData(updatedExpense);
        validateExpense(sanitizedExpense, options);

        const previousPaidAmount = Number(currentExpense.paidAmount || 0);
        const newPaidAmount = Number(sanitizedExpense.paidAmount || 0);
        const paymentDifference = newPaidAmount - previousPaidAmount;

        const derivedStatus =
          sanitizedExpense.amount > 0 &&
          newPaidAmount >= sanitizedExpense.amount
            ? 'paid'
            : 'pending';

        const updatesWithDerived = {
          ...updates,
          paidAmount: newPaidAmount,
          status: derivedStatus,
        };

        // Persist expense first (within the same transaction).
        const sanitizedUpdates = sanitizeExpenseData(updatesWithDerived);
        await db.fixedExpenses.update(expenseId, sanitizedUpdates);

        // No balance change needed.
        if (paymentDifference === 0) {
          return;
        }

        // Apply balance deltas based on payment source.
        if (sanitizedExpense.category === 'Credit Card Payment') {
          if (!sanitizedExpense.accountId) {
            throw new Error('Credit Card Payment requires funding accountId');
          }
          if (!sanitizedExpense.targetCreditCardId) {
            throw new Error('Credit Card Payment requires targetCreditCardId');
          }

          const fundingAccount = await db.accounts.get(
            sanitizedExpense.accountId,
          );
          if (!fundingAccount) {
            throw new Error(
              `Funding account not found: ${sanitizedExpense.accountId}`,
            );
          }

          const targetCard = await db.creditCards.get(
            sanitizedExpense.targetCreditCardId,
          );
          if (!targetCard) {
            throw new Error(
              `Target credit card not found: ${sanitizedExpense.targetCreditCardId}`,
            );
          }

          const newAccountBalance =
            Number(fundingAccount.currentBalance || 0) - paymentDifference;
          const newCardBalance =
            Number(targetCard.balance || 0) - paymentDifference;

          await db.accounts.update(fundingAccount.id, {
            currentBalance: newAccountBalance,
          });
          await db.creditCards.update(targetCard.id, {
            balance: newCardBalance,
          });

          // Best-effort audit log
          try {
            await db.auditLogs.add({
              timestamp: new Date().toISOString(),
              actionType: 'PAYMENT',
              entityType: 'creditCardPayment',
              entityId: expenseId,
              details: {
                amount: paymentDifference,
                fundingAccountId: fundingAccount.id,
                targetCreditCardId: targetCard.id,
                newAccountBalance,
                newCreditCardBalance: newCardBalance,
              },
            });
          } catch (auditError) {
            logger.error('Error adding payment audit log:', auditError);
          }
          return;
        }

        if (sanitizedExpense.accountId) {
          const account = await db.accounts.get(sanitizedExpense.accountId);
          if (!account) {
            throw new Error(`Account not found: ${sanitizedExpense.accountId}`);
          }

          const newBalance =
            Number(account.currentBalance || 0) - paymentDifference;
          await db.accounts.update(account.id, { currentBalance: newBalance });

          try {
            await db.auditLogs.add({
              timestamp: new Date().toISOString(),
              actionType: 'PAYMENT',
              entityType: 'account',
              entityId: account.id,
              details: {
                expenseId,
                amount: paymentDifference,
                newBalance,
              },
            });
          } catch (auditError) {
            logger.error('Error adding payment audit log:', auditError);
          }
          return;
        }

        if (sanitizedExpense.creditCardId) {
          const creditCard = await db.creditCards.get(
            sanitizedExpense.creditCardId,
          );
          if (!creditCard) {
            throw new Error(
              `Credit card not found: ${sanitizedExpense.creditCardId}`,
            );
          }

          // Credit card charges increase debt.
          const newBalance =
            Number(creditCard.balance || 0) + paymentDifference;
          await db.creditCards.update(creditCard.id, { balance: newBalance });

          try {
            await db.auditLogs.add({
              timestamp: new Date().toISOString(),
              actionType: 'PAYMENT',
              entityType: 'creditCard',
              entityId: creditCard.id,
              details: {
                expenseId,
                amount: paymentDifference,
                newBalance,
              },
            });
          } catch (auditError) {
            logger.error('Error adding payment audit log:', auditError);
          }
          return;
        }

        throw new Error(
          'No payment source specified (expected accountId or creditCardId)',
        );
      },
    );
  },

  /**
   * Get fixed expense by ID (V4 compatible)
   */
  async getFixedExpenseV4(id) {
    try {
      const expense = await db.fixedExpenses.get(id);
      if (!expense) {
        logger.warn(`Expense with ID ${id} not found`);
        return null;
      }

      return expense;
    } catch (error) {
      logger.error('Error getting V4 expense:', error);
      throw error;
    }
  },

  /**
   * Get all fixed expenses (V4 compatible)
   */
  async getFixedExpensesV4() {
    try {
      const expenses = await db.fixedExpenses.toArray();
      return expenses;
    } catch (error) {
      logger.error('Error getting V4 expenses:', error);
      throw error;
    }
  },

  /**
   * Validate expense payment source references
   * Ensures that accountId and creditCardId reference valid records
   */
  async validateExpenseReferences(expense) {
    try {
      if (expense.accountId) {
        const account = await db.accounts.get(expense.accountId);
        if (!account) {
          throw new Error(`Account with ID ${expense.accountId} not found`);
        }
      }

      if (expense.creditCardId) {
        const creditCard = await db.creditCards.get(expense.creditCardId);
        if (!creditCard) {
          throw new Error(
            `Credit card with ID ${expense.creditCardId} not found`,
          );
        }
      }

      if (expense.targetCreditCardId) {
        const targetCreditCard = await db.creditCards.get(
          expense.targetCreditCardId,
        );
        if (!targetCreditCard) {
          throw new Error(
            `Target credit card with ID ${expense.targetCreditCardId} not found`,
          );
        }
      }

      return true;
    } catch (error) {
      logger.error('Error validating expense references:', error);
      throw error;
    }
  },

  /**
   * Migrate V3 expense to V4 format
   * Converts old accountId format to new dual foreign key format
   */
  async migrateExpenseToV4(expenseId) {
    try {
      const expense = await db.fixedExpenses.get(expenseId);
      if (!expense) {
        throw new Error(`Expense with ID ${expenseId} not found`);
      }

      // Check if accountId is in old format (string with cc- prefix)
      if (
        typeof expense.accountId === 'string' &&
        expense.accountId.startsWith('cc-')
      ) {
        // Convert to new format
        const creditCardId = parseInt(expense.accountId.slice(3));

        await this.updateFixedExpenseV4(expenseId, {
          accountId: null,
          creditCardId,
        });

        logger.success(`Migrated expense ${expenseId} from V3 to V4 format`);
      }

      return true;
    } catch (error) {
      logger.error('Error migrating expense to V4:', error);
      throw error;
    }
  },

  /**
   * Bulk migrate all expenses from V3 to V4 format
   */
  async migrateAllExpensesToV4() {
    try {
      const expenses = await db.fixedExpenses.toArray();
      let migratedCount = 0;

      for (const expense of expenses) {
        if (
          typeof expense.accountId === 'string' &&
          expense.accountId.startsWith('cc-')
        ) {
          await this.migrateExpenseToV4(expense.id);
          migratedCount++;
        }
      }

      logger.success(`Migrated ${migratedCount} expenses from V3 to V4 format`);
      return migratedCount;
    } catch (error) {
      logger.error('Error bulk migrating expenses to V4:', error);
      throw error;
    }
  },

  /**
   * Audit expenses to check for legacy format issues
   * Identifies expenses that need migration to V4 format
   *
   * @returns {Object} Audit report with findings
   */
  async auditExpenseFormat() {
    try {
      const expenses = await db.fixedExpenses.toArray();
      const accounts = await db.accounts.toArray();
      const creditCards = await db.creditCards.toArray();

      const accountIds = new Set(accounts.map(acc => acc.id));
      const creditCardIds = new Set(creditCards.map(card => card.id));

      const report = {
        totalExpenses: expenses.length,
        issues: {
          accountIdMatchesCreditCard: [],
          missingCreditCardId: [],
          bothFieldsSet: [],
          noPaymentSource: [],
          stringAccountId: [],
        },
        summary: {},
      };

      expenses.forEach(expense => {
        // Check for string accountId (V3 format with "cc-" prefix)
        if (typeof expense.accountId === 'string') {
          report.issues.stringAccountId.push({
            id: expense.id,
            name: expense.name,
            accountId: expense.accountId,
          });
        }

        // Check for expenses with both accountId and creditCardId set
        if (expense.accountId && expense.creditCardId) {
          report.issues.bothFieldsSet.push({
            id: expense.id,
            name: expense.name,
            accountId: expense.accountId,
            creditCardId: expense.creditCardId,
          });
        }

        // Check for expenses with no payment source
        if (!expense.accountId && !expense.creditCardId) {
          report.issues.noPaymentSource.push({
            id: expense.id,
            name: expense.name,
          });
        }

        // Check if accountId matches a credit card ID (legacy numeric format)
        if (
          expense.accountId &&
          typeof expense.accountId === 'number' &&
          !expense.creditCardId
        ) {
          if (
            creditCardIds.has(expense.accountId) &&
            !accountIds.has(expense.accountId)
          ) {
            report.issues.accountIdMatchesCreditCard.push({
              id: expense.id,
              name: expense.name,
              accountId: expense.accountId,
              shouldBeCreditCardId: expense.accountId,
            });
          }
        }

        // Check for expenses that should have creditCardId but don't
        // (This is harder to detect, but we can check if accountId doesn't match any account)
        if (
          expense.accountId &&
          typeof expense.accountId === 'number' &&
          !expense.creditCardId &&
          !accountIds.has(expense.accountId) &&
          !creditCardIds.has(expense.accountId)
        ) {
          report.issues.missingCreditCardId.push({
            id: expense.id,
            name: expense.name,
            accountId: expense.accountId,
            note: 'accountId does not match any account or credit card',
          });
        }
      });

      // Generate summary
      report.summary = {
        totalIssues:
          report.issues.accountIdMatchesCreditCard.length +
          report.issues.missingCreditCardId.length +
          report.issues.bothFieldsSet.length +
          report.issues.noPaymentSource.length +
          report.issues.stringAccountId.length,
        accountIdMatchesCreditCard:
          report.issues.accountIdMatchesCreditCard.length,
        missingCreditCardId: report.issues.missingCreditCardId.length,
        bothFieldsSet: report.issues.bothFieldsSet.length,
        noPaymentSource: report.issues.noPaymentSource.length,
        stringAccountId: report.issues.stringAccountId.length,
      };

      // Log summary
      logger.info('Expense Format Audit Results:', report.summary);
      if (report.summary.totalIssues > 0) {
        logger.warn(
          `Found ${report.summary.totalIssues} expenses with format issues`,
        );
      } else {
        logger.success('All expenses are in V4 format');
      }

      return report;
    } catch (error) {
      logger.error('Error auditing expense format:', error);
      throw error;
    }
  },

  /**
   * Migrate expenses from legacy format to V4 format
   * Moves credit card IDs from accountId field to creditCardId field
   *
   * @returns {Object} Migration report with counts and details
   */
  async migrateExpensesToV4Format() {
    try {
      const expenses = await db.fixedExpenses.toArray();
      const accounts = await db.accounts.toArray();
      const creditCards = await db.creditCards.toArray();

      const accountIds = new Set(accounts.map(acc => acc.id));
      const creditCardIds = new Set(creditCards.map(card => card.id));

      const report = {
        totalExpenses: expenses.length,
        migrated: [],
        failed: [],
        skipped: [],
        summary: {},
      };

      for (const expense of expenses) {
        try {
          // Skip if already in V4 format (has creditCardId set)
          if (expense.creditCardId) {
            report.skipped.push({
              id: expense.id,
              name: expense.name,
              reason: 'Already has creditCardId',
            });
            continue;
          }

          // Check if accountId is a string with "cc-" prefix (V3 format)
          if (
            typeof expense.accountId === 'string' &&
            expense.accountId.startsWith('cc-')
          ) {
            const creditCardId = parseInt(expense.accountId.slice(3));
            if (creditCardIds.has(creditCardId)) {
              await this.updateFixedExpenseV4(expense.id, {
                accountId: null,
                creditCardId,
              });
              report.migrated.push({
                id: expense.id,
                name: expense.name,
                from: `accountId: "${expense.accountId}"`,
                to: `creditCardId: ${creditCardId}`,
              });
              continue;
            }
          }

          // Check if numeric accountId matches a credit card ID (legacy numeric format)
          if (
            expense.accountId &&
            typeof expense.accountId === 'number' &&
            !expense.creditCardId
          ) {
            if (
              creditCardIds.has(expense.accountId) &&
              !accountIds.has(expense.accountId)
            ) {
              await this.updateFixedExpenseV4(expense.id, {
                accountId: null,
                creditCardId: expense.accountId,
              });
              report.migrated.push({
                id: expense.id,
                name: expense.name,
                from: `accountId: ${expense.accountId} (credit card ID)`,
                to: `creditCardId: ${expense.accountId}`,
              });
              continue;
            }
          }

          // Skip if accountId matches a valid account (correct format)
          if (expense.accountId && accountIds.has(expense.accountId)) {
            report.skipped.push({
              id: expense.id,
              name: expense.name,
              reason: 'accountId matches valid account',
            });
            continue;
          }

          // Skip if no accountId (might be credit card payment with targetCreditCardId)
          if (!expense.accountId) {
            report.skipped.push({
              id: expense.id,
              name: expense.name,
              reason: 'No accountId (may be credit card payment)',
            });
            continue;
          }

          // If we get here, we couldn't determine what to do
          report.skipped.push({
            id: expense.id,
            name: expense.name,
            reason: 'Could not determine migration path',
            accountId: expense.accountId,
          });
        } catch (error) {
          logger.error(`Failed to migrate expense ${expense.id}:`, error);
          report.failed.push({
            id: expense.id,
            name: expense.name,
            error: error.message,
          });
        }
      }

      // Generate summary
      report.summary = {
        total: expenses.length,
        migrated: report.migrated.length,
        failed: report.failed.length,
        skipped: report.skipped.length,
      };

      // Log results
      logger.info('Expense Migration Results:', report.summary);
      if (report.migrated.length > 0) {
        logger.success(
          `Migrated ${report.migrated.length} expenses to V4 format`,
        );
      }
      if (report.failed.length > 0) {
        logger.error(`Failed to migrate ${report.failed.length} expenses`);
      }

      return report;
    } catch (error) {
      logger.error('Error migrating expenses to V4 format:', error);
      throw error;
    }
  },
};

// Emergency database reset function - can be called from browser console
window.digibookEmergencyReset = async () => {
  try {
    logger.info('🚨 EMERGENCY DATABASE RESET STARTING...');
    await dbHelpers.forceResetAllDatabases();
    logger.info('✅ Emergency reset complete! Please refresh the page.');
    return true;
  } catch (error) {
    logger.error('❌ Emergency reset failed:', error);
    return false;
  }
};

// Manual cleanup function - can be called from browser console
window.digibookCleanupAccounts = async () => {
  try {
    logger.info('🧹 CLEANING UP ACCOUNTS...');
    await dbHelpers.cleanupDuplicateDefaults();
    logger.info('✅ Account cleanup complete! Please refresh the page.');
    return true;
  } catch (error) {
    logger.error('❌ Account cleanup failed:', error);
    return false;
  }
};

export default db;

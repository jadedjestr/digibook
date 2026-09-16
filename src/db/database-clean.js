import Dexie from 'dexie';

import {
  advanceDueDateByFrequency,
  calculateNextPayDates,
  DEFAULT_PAY_FREQUENCY,
  getMostRecentImpliedPayDate,
  VALID_PAY_FREQUENCIES,
} from '../constants/payFrequency';
import {
  getAppearanceSnapshot,
  applyAppearanceSnapshot,
} from '../utils/appearance';
import { getDefaultMinimumPaymentAmount } from '../utils/creditCardUtils';
import { dataIntegrity } from '../utils/crypto';
import { DateUtils } from '../utils/dateUtils';
import { generateId } from '../utils/generateId';
import { logger } from '../utils/logger';
import { calculateNextDueDate } from '../utils/recurrenceMath';
import { parseMoneyInput, validatePaidAmount } from '../utils/validation';
import { computeCycleStates } from '../utils/virtualLedger';

const MAX_AUDIT_LOG_ENTRIES = 500;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const nowIso = () => new Date().toISOString();
const isValidUuid = value =>
  typeof value === 'string' && UUID_REGEX.test(value.trim());

/**
 * Clean Consolidated Digibook Database Schema
 *
 * Consolidated Dexie schema, currently at version 10 (see this.version(10)
 * below for the full migration history). Not the same as
 * CURRENT_DATA_VERSION in services/dataManager.js, which gates the
 * separate JSON/backup export-import file contract.
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

    // Version 5: monthlyExpenseHistory compound primary key for upsert by [expenseId+month+year]
    this.version(5)
      .stores({
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
          '[expenseId+month+year], expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
        recurringExpenseTemplates:
          '++id, name, baseAmount, frequency, intervalValue, startDate, lastGenerated, nextDueDate, category, accountId, notes, isActive, isVariableAmount, createdAt, updatedAt',
        auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
      })
      .upgrade(() => {});

    // Version 6: backups table, userPreferences.lastExportDate
    this.version(6)
      .stores({
        accounts: '++id, name, type, currentBalance, isDefault, createdAt',
        pendingTransactions:
          '++id, accountId, amount, category, description, createdAt',
        fixedExpenses:
          '++id, name, dueDate, amount, accountId, creditCardId, targetCreditCardId, category, paidAmount, status, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, recurringTemplateId, createdAt',
        categories: '++id, name, color, icon, isDefault, createdAt',
        creditCards:
          '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
        paycheckSettings: '++id, lastPaycheckDate, frequency, createdAt',
        userPreferences:
          '++id, component, preferences, createdAt, lastExportDate',
        monthlyExpenseHistory:
          '[expenseId+month+year], expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
        recurringExpenseTemplates:
          '++id, name, baseAmount, frequency, intervalValue, startDate, lastGenerated, nextDueDate, category, accountId, notes, isActive, isVariableAmount, createdAt, updatedAt',
        auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
        backups: '++id, reason, timestamp, version, createdAt',
      })
      .upgrade(() => {});

    // Version 7: categories.sortOrder for custom ordering
    this.version(7)
      .stores({
        accounts: '++id, name, type, currentBalance, isDefault, createdAt',
        pendingTransactions:
          '++id, accountId, amount, category, description, createdAt',
        fixedExpenses:
          '++id, name, dueDate, amount, accountId, creditCardId, targetCreditCardId, category, paidAmount, status, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, recurringTemplateId, createdAt',
        categories: '++id, name, color, icon, isDefault, createdAt, sortOrder',
        creditCards:
          '++id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt',
        paycheckSettings: '++id, lastPaycheckDate, frequency, createdAt',
        userPreferences:
          '++id, component, preferences, createdAt, lastExportDate',
        monthlyExpenseHistory:
          '[expenseId+month+year], expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt',
        recurringExpenseTemplates:
          '++id, name, baseAmount, frequency, intervalValue, startDate, lastGenerated, nextDueDate, category, accountId, notes, isActive, isVariableAmount, createdAt, updatedAt',
        auditLogs: '++id, timestamp, actionType, entityType, entityId, details',
        backups: '++id, reason, timestamp, version, createdAt',
      })
      .upgrade(async tx => {
        const categories = await tx.table('categories').toArray();
        if (categories.length === 0) return;
        const sorted = [...categories].sort((a, b) =>
          (a.name || '').localeCompare(b.name || ''),
        );
        for (let i = 0; i < sorted.length; i++) {
          await tx.table('categories').put({ ...sorted[i], sortOrder: i });
        }
      });

    // Version 8: UUID string primary keys, soft deletes, categoryId, timestamps
    this.version(8)
      .stores({
        accounts:
          'id, name, type, currentBalance, isDefault, createdAt, updatedAt, deletedAt',
        pendingTransactions:
          'id, accountId, amount, category, description, createdAt, updatedAt, deletedAt, categoryId',
        fixedExpenses:
          'id, name, dueDate, amount, accountId, creditCardId, targetCreditCardId, category, paidAmount, status, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, recurringTemplateId, createdAt, updatedAt, deletedAt, categoryId',
        categories:
          'id, name, color, icon, isDefault, createdAt, sortOrder, updatedAt, deletedAt',
        creditCards:
          'id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt, updatedAt, deletedAt',
        paycheckSettings:
          'id, lastPaycheckDate, frequency, createdAt, updatedAt, deletedAt',
        userPreferences:
          'id, component, preferences, createdAt, lastExportDate, updatedAt, deletedAt',
        monthlyExpenseHistory:
          '[expenseId+month+year], expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt, updatedAt, deletedAt',
        recurringExpenseTemplates:
          'id, name, baseAmount, frequency, intervalValue, startDate, lastGenerated, nextDueDate, category, accountId, notes, isActive, isVariableAmount, createdAt, updatedAt, deletedAt, categoryId',
        auditLogs:
          'id, timestamp, actionType, entityType, entityId, details, updatedAt, deletedAt',
        backups:
          'id, reason, timestamp, version, createdAt, updatedAt, deletedAt',
      })
      .upgrade(() => {});

    // Version 9: incomeSources table, and incomeSourceId on pendingTransactions
    // so auto-generated payday rows can be traced back to their source.
    this.version(9)
      .stores({
        accounts:
          'id, name, type, currentBalance, isDefault, createdAt, updatedAt, deletedAt',
        pendingTransactions:
          'id, accountId, amount, category, description, createdAt, updatedAt, deletedAt, categoryId, incomeSourceId',
        fixedExpenses:
          'id, name, dueDate, amount, accountId, creditCardId, targetCreditCardId, category, paidAmount, status, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, recurringTemplateId, createdAt, updatedAt, deletedAt, categoryId',
        categories:
          'id, name, color, icon, isDefault, createdAt, sortOrder, updatedAt, deletedAt',
        creditCards:
          'id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt, updatedAt, deletedAt',
        paycheckSettings:
          'id, lastPaycheckDate, frequency, createdAt, updatedAt, deletedAt',
        userPreferences:
          'id, component, preferences, createdAt, lastExportDate, updatedAt, deletedAt',
        monthlyExpenseHistory:
          '[expenseId+month+year], expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt, updatedAt, deletedAt',
        recurringExpenseTemplates:
          'id, name, baseAmount, frequency, intervalValue, startDate, lastGenerated, nextDueDate, category, accountId, notes, isActive, isVariableAmount, createdAt, updatedAt, deletedAt, categoryId',
        auditLogs:
          'id, timestamp, actionType, entityType, entityId, details, updatedAt, deletedAt',
        backups:
          'id, reason, timestamp, version, createdAt, updatedAt, deletedAt',
        incomeSources:
          'id, accountId, isEnabled, lastGeneratedDate, createdAt, updatedAt, deletedAt',
      })
      .upgrade(() => {});

    // Version 10: recurringResolutionLog table. Records every time a
    // recurring cycle is resolved (Pay Full / Partial / Skip) so the
    // cadence can advance immediately without pre-generating rows, and so
    // Undo has an exact prior state to reverse to rather than re-deriving
    // one from frequency math.
    this.version(10)
      .stores({
        accounts:
          'id, name, type, currentBalance, isDefault, createdAt, updatedAt, deletedAt',
        pendingTransactions:
          'id, accountId, amount, category, description, createdAt, updatedAt, deletedAt, categoryId, incomeSourceId',
        fixedExpenses:
          'id, name, dueDate, amount, accountId, creditCardId, targetCreditCardId, category, paidAmount, status, overpaymentAmount, overpaymentPercentage, budgetSatisfied, significantOverpayment, isAutoCreated, isManuallyMapped, mappingConfidence, mappedAt, recurringTemplateId, createdAt, updatedAt, deletedAt, categoryId',
        categories:
          'id, name, color, icon, isDefault, createdAt, sortOrder, updatedAt, deletedAt',
        creditCards:
          'id, name, balance, creditLimit, interestRate, dueDate, statementClosingDate, minimumPayment, createdAt, updatedAt, deletedAt',
        paycheckSettings:
          'id, lastPaycheckDate, frequency, createdAt, updatedAt, deletedAt',
        userPreferences:
          'id, component, preferences, createdAt, lastExportDate, updatedAt, deletedAt',
        monthlyExpenseHistory:
          '[expenseId+month+year], expenseId, month, year, budgetAmount, actualAmount, overpaymentAmount, createdAt, updatedAt, deletedAt',
        recurringExpenseTemplates:
          'id, name, baseAmount, frequency, intervalValue, startDate, lastGenerated, nextDueDate, category, accountId, notes, isActive, isVariableAmount, createdAt, updatedAt, deletedAt, categoryId',
        auditLogs:
          'id, timestamp, actionType, entityType, entityId, details, updatedAt, deletedAt',
        backups:
          'id, reason, timestamp, version, createdAt, updatedAt, deletedAt',
        incomeSources:
          'id, accountId, isEnabled, lastGeneratedDate, createdAt, updatedAt, deletedAt',
        recurringResolutionLog:
          'id, templateId, expenseId, adjustmentExpenseId, cycleDueDate, resolvedAt, createdAt, updatedAt, deletedAt',
      })
      .upgrade(() => {});
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
 * Normalize paycheckSettings for import so the app always has exactly one valid row.
 * Mutates data.paycheckSettings in place. Used by importData (file import and backup restore).
 * @param {Object} data - Full import data object
 */
function normalizePaycheckSettings(data) {
  const ts = new Date().toISOString();
  const defaultRow = {
    id: generateId(),
    lastPaycheckDate: '',
    frequency: DEFAULT_PAY_FREQUENCY,
    createdAt: ts,
  };

  if (
    data.paycheckSettings == null ||
    !Array.isArray(data.paycheckSettings) ||
    data.paycheckSettings.length === 0
  ) {
    data.paycheckSettings = [defaultRow];
    return;
  }

  const first = data.paycheckSettings[0];
  const lastPaycheckDate =
    first.lastPaycheckDate && DateUtils.isValidDate(first.lastPaycheckDate)
      ? first.lastPaycheckDate
      : '';
  const frequency = VALID_PAY_FREQUENCIES.includes(first.frequency)
    ? first.frequency
    : DEFAULT_PAY_FREQUENCY;
  const createdAt =
    first.createdAt && typeof first.createdAt === 'string'
      ? first.createdAt
      : ts;

  const id = isValidUuid(first.id) ? first.id.trim() : generateId();

  const normalized = {
    id,
    lastPaycheckDate,
    frequency,
    createdAt,
  };

  data.paycheckSettings = [normalized];
}

const IMPORT_CHUNK_SIZE = 1000;

/**
 * Bulk-write items into a Dexie table in fixed-size chunks (upsert semantics).
 * Used by both the full-replace importData() and the single-table importSingleTable().
 */
async function bulkPutChunked(table, items, chunkSize = IMPORT_CHUNK_SIZE) {
  if (!Array.isArray(items) || items.length === 0) return;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await table.bulkPut(chunk);
  }
}

/**
 * Validate cross-table references for a single-table import (CSV merge path).
 * Mirrors the payment-source rules in dbHelpers.validateImportData, but checks
 * against the live DB instead of sibling arrays (a single-table payload has none).
 * Returns an array of error strings (empty if valid).
 */
async function validateSingleTableReferences(tableName, items) {
  const toRefId = value => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return null;
  };
  const hasValue = v => v !== null && v !== undefined && v !== '';
  const errors = [];

  if (tableName === 'accounts') {
    for (const [idx, item] of items.entries()) {
      if (!Number.isFinite(item?.currentBalance)) {
        errors.push(
          `accounts[${idx}]: currentBalance must be a finite number (got ${item?.currentBalance})`,
        );
      }
    }
    return errors;
  }

  if (tableName === 'pendingTransactions') {
    const accountIds = new Set(
      (await db.accounts.toArray()).map(a => toRefId(a?.id)).filter(Boolean),
    );
    for (const [idx, txn] of items.entries()) {
      const accountId = toRefId(txn?.accountId);
      if (!accountId || !accountIds.has(accountId)) {
        errors.push(
          `pendingTransactions[${idx}]: invalid accountId (${txn?.accountId})`,
        );
      }
    }
    return errors;
  }

  if (
    tableName === 'fixedExpenses' ||
    tableName === 'recurringExpenseTemplates'
  ) {
    const accountIds = new Set(
      (await db.accounts.toArray()).map(a => toRefId(a?.id)).filter(Boolean),
    );
    const creditCardIds = new Set(
      (await db.creditCards.toArray()).map(c => toRefId(c?.id)).filter(Boolean),
    );
    const templateIds =
      tableName === 'fixedExpenses'
        ? new Set(
            (await db.recurringExpenseTemplates.toArray())
              .map(t => toRefId(t?.id))
              .filter(Boolean),
          )
        : null;

    for (const [idx, item] of items.entries()) {
      const accountId = toRefId(item?.accountId);
      const creditCardId = toRefId(item?.creditCardId);
      const targetCreditCardId = toRefId(item?.targetCreditCardId);
      const recurringTemplateId = toRefId(item?.recurringTemplateId);

      const hasAccount = hasValue(accountId);
      const hasCreditCard = hasValue(creditCardId);

      if (hasAccount && hasCreditCard) {
        errors.push(
          `${tableName}[${idx}]: cannot have both accountId and creditCardId`,
        );
      } else if (!hasAccount && !hasCreditCard) {
        errors.push(
          `${tableName}[${idx}]: must have either accountId or creditCardId`,
        );
      }

      if (hasAccount && !accountIds.has(accountId)) {
        errors.push(
          `${tableName}[${idx}]: accountId (${item?.accountId}) not found in accounts`,
        );
      }
      if (hasCreditCard && !creditCardIds.has(creditCardId)) {
        errors.push(
          `${tableName}[${idx}]: creditCardId (${item?.creditCardId}) not found in creditCards`,
        );
      }

      if (item?.category === 'Credit Card Payment') {
        if (!hasAccount) {
          errors.push(
            `${tableName}[${idx}]: Credit Card Payment must have funding accountId`,
          );
        }
        if (!targetCreditCardId || !creditCardIds.has(targetCreditCardId)) {
          errors.push(
            `${tableName}[${idx}]: Credit Card Payment must have valid targetCreditCardId`,
          );
        }
        if (hasCreditCard) {
          errors.push(
            `${tableName}[${idx}]: Credit Card Payment cannot use creditCardId (use targetCreditCardId)`,
          );
        }
      } else if (hasValue(targetCreditCardId)) {
        errors.push(
          `${tableName}[${idx}]: targetCreditCardId must be null unless category is Credit Card Payment`,
        );
      }

      if (
        tableName === 'fixedExpenses' &&
        hasValue(recurringTemplateId) &&
        !templateIds.has(recurringTemplateId)
      ) {
        errors.push(
          `${tableName}[${idx}]: recurringTemplateId (${item?.recurringTemplateId}) not found in recurringExpenseTemplates`,
        );
      }
    }
    return errors;
  }

  return errors;
}

/**
 * Internal (non-exported) audit log add. Transaction-safe; does not call trim.
 */
async function addAuditLogEntry(actionType, entityType, entityId, details) {
  const ts = nowIso();
  await db.auditLogs.add({
    id: generateId(),
    timestamp: ts,
    actionType,
    entityType,
    entityId,
    details: details ?? {},
    updatedAt: ts,
    deletedAt: null,
  });
}

/**
 * Apply the balance-mutation side of a payment change: debit/credit the
 * right account(s)/card(s) for paymentDifference, and write a best-effort
 * audit log entry. Shared by applyExpensePaymentChangeAtomic and
 * resolveCycle so the credit-card dual-balance-update logic (and every
 * other payment-source branch) lives in exactly one place - a Balance Due
 * payment reuses this unmodified, with zero duplication, since it still
 * goes through applyExpensePaymentChangeAtomic like any other expense.
 *
 * Caller must invoke this from inside an open 'rw' transaction whose table
 * list includes db.accounts, db.creditCards, and db.auditLogs, and must
 * not call it when paymentDifference === 0.
 *
 * @param {Object} sanitizedExpense - the expense as it will be after the
 *   update, already sanitized (category/accountId/creditCardId/
 *   targetCreditCardId kept mutually consistent)
 * @param {number} paymentDifference - newPaidAmount - previousPaidAmount
 * @param {string} expenseId
 * @param {string} ts - ISO timestamp, shared with the caller's other
 *   writes in the same transaction
 */
async function applyPaymentDelta(
  sanitizedExpense,
  paymentDifference,
  expenseId,
  ts,
) {
  if (sanitizedExpense.category === 'Credit Card Payment') {
    if (!sanitizedExpense.accountId) {
      throw new Error('Credit Card Payment requires funding accountId');
    }
    if (!sanitizedExpense.targetCreditCardId) {
      throw new Error('Credit Card Payment requires targetCreditCardId');
    }

    const fundingAccount = await db.accounts.get(sanitizedExpense.accountId);
    if (!fundingAccount) {
      throw new Error(
        `Funding account not found: ${sanitizedExpense.accountId}`,
      );
    }

    const targetCard = await db.creditCards.get(
      sanitizedExpense.targetCreditCardId,
    );
    if (!targetCard || targetCard.deletedAt) {
      throw new Error(
        `Target credit card not found: ${sanitizedExpense.targetCreditCardId}`,
      );
    }

    const newAccountBalance =
      Number(fundingAccount.currentBalance || 0) - paymentDifference;
    const newCardBalance = Number(targetCard.balance || 0) - paymentDifference;

    await db.accounts.update(fundingAccount.id, {
      currentBalance: newAccountBalance,
      updatedAt: ts,
    });
    await db.creditCards.update(targetCard.id, {
      balance: newCardBalance,
      updatedAt: ts,
    });

    try {
      await addAuditLogEntry('PAYMENT', 'creditCardPayment', expenseId, {
        amount: paymentDifference,
        fundingAccountId: fundingAccount.id,
        targetCreditCardId: targetCard.id,
        newAccountBalance,
        newCreditCardBalance: newCardBalance,
      });
    } catch (auditErr) {
      logger.warn('Audit log (credit card payment) failed:', auditErr);
    }
  } else if (sanitizedExpense.accountId) {
    const account = await db.accounts.get(sanitizedExpense.accountId);
    if (!account) {
      throw new Error(`Account not found: ${sanitizedExpense.accountId}`);
    }

    const newBalance = Number(account.currentBalance || 0) - paymentDifference;
    await db.accounts.update(account.id, {
      currentBalance: newBalance,
      updatedAt: ts,
    });

    try {
      await addAuditLogEntry('PAYMENT', 'account', account.id, {
        expenseId,
        amount: paymentDifference,
        newBalance,
      });
    } catch (auditErr) {
      logger.warn('Audit log (account payment) failed:', auditErr);
    }
  } else if (sanitizedExpense.creditCardId) {
    const creditCard = await db.creditCards.get(sanitizedExpense.creditCardId);
    if (!creditCard || creditCard.deletedAt) {
      throw new Error(
        `Credit card not found: ${sanitizedExpense.creditCardId}`,
      );
    }

    // Credit card charges increase debt.
    const newBalance = Number(creditCard.balance || 0) + paymentDifference;
    await db.creditCards.update(creditCard.id, {
      balance: newBalance,
      updatedAt: ts,
    });

    try {
      await addAuditLogEntry('PAYMENT', 'creditCard', creditCard.id, {
        expenseId,
        amount: paymentDifference,
        newBalance,
      });
    } catch (auditErr) {
      logger.warn('Audit log (credit card charge) failed:', auditErr);
    }
  } else {
    throw new Error(
      'No payment source specified (expected accountId or creditCardId)',
    );
  }
}

/**
 * Compute what a recurring template's current cycle amount actually is
 * right now - the fixed baseAmount for most templates, or (for a
 * credit-card-payment template, isVariableAmount) the card's current
 * minimum payment. The one place this computation lives, so a lazily
 * materialized real row and a not-yet-real "virtual" ledger entry always
 * agree on what the amount would be.
 * @param {Object} template
 * @returns {Promise<number>}
 */
async function computeTemplateCycleAmount(template) {
  if (!template.targetCreditCardId) return template.baseAmount;
  const card = await db.creditCards.get(template.targetCreditCardId);
  if (!card) return template.baseAmount;
  if (card.balance <= 0) return 0;
  if (template.minimumPaymentOverride != null) {
    return template.minimumPaymentOverride;
  }
  return getDefaultMinimumPaymentAmount(card);
}

/**
 * Resolve category UUID from display name (non-deleted category only).
 * @param {string|null|undefined} categoryName
 * @returns {Promise<string|null>}
 */
async function resolveCategoryIdByName(categoryName) {
  if (!categoryName || typeof categoryName !== 'string') return null;
  const trimmed = categoryName.trim();
  if (!trimmed) return null;
  const cat = await db.categories.where('name').equals(trimmed).first();
  if (!cat || cat.deletedAt) return null;
  return cat.id;
}

/**
 * Build the partial row to persist, taking each changed field from the
 * sanitized WHOLE expense rather than from a sanitized patch.
 *
 * sanitizeExpenseData reasons about a complete expense - it nulls
 * targetCreditCardId when category isn't 'Credit Card Payment', nulls the
 * unused payment source, and so on. Run it on a bare patch and those rules
 * fire against fields the patch never mentioned: a `{paidAmount, status}`
 * update has no category, so every card payment silently unlinked the
 * expense from the card it paid, leaving that payment uncorrectable.
 */
function pickSanitizedUpdates(sanitizedFullExpense, updates) {
  const picked = {};
  for (const key of Object.keys(updates)) {
    picked[key] = sanitizedFullExpense[key];
  }
  return picked;
}

// Collapses concurrent same-tick calls to ensureCreditCardPaymentExpensesLinked
// (e.g. React StrictMode's double-invoked mount effect) into one shared run.
// Not a general mutex - see createExpenseForCard's own transaction for the
// real cross-entry-point race fix.
let ensureCreditCardPaymentExpensesLinkedPromise = null;

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
      await db.incomeSources.clear();
      await db.recurringResolutionLog.clear();
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
    const rows = await db.accounts.toArray();
    return rows.filter(r => !r.deletedAt);
  },

  // Credit card helpers
  async getCreditCards() {
    try {
      const creditCards = (await db.creditCards.toArray()).filter(
        c => !c.deletedAt,
      );
      return creditCards.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.error('Error getting credit cards:', error);
      throw new Error('Failed to get credit cards');
    }
  },

  async addCreditCard(creditCard) {
    try {
      if (
        !creditCard?.name ||
        typeof creditCard.name !== 'string' ||
        !creditCard.name.trim()
      ) {
        throw new Error('Credit card name is required');
      }
      if (!Number.isFinite(creditCard.balance)) {
        throw new Error('Credit card balance must be a finite number');
      }

      const creditCardData = {
        ...creditCard,
        id: generateId(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      };

      await db.creditCards.add(creditCardData);
      const id = creditCardData.id;
      logger.success(`Credit card added successfully: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding credit card:', error);
      throw new Error(`Failed to add credit card: ${error.message}`);
    }
  },

  /**
   * Sync due date to all fixed expenses linked to this credit card.
   * Call this when a credit card's due date changes so linked CC payment
   * expenses stay in sync.
   * @param {number} cardId - Credit card ID
   * @param {string} dueDate - ISO date string (YYYY-MM-DD)
   * @private Internal helper - use updateCreditCard for external updates
   */
  async syncCreditCardDueDateToExpenses(cardId, dueDate) {
    if (dueDate == null) return;
    const linked = await db.fixedExpenses
      .where('targetCreditCardId')
      .equals(cardId)
      .filter(e => e.category === 'Credit Card Payment' && !e.deletedAt)
      .toArray();
    const ts = nowIso();
    for (const expense of linked) {
      await db.fixedExpenses.update(expense.id, { dueDate, updatedAt: ts });
    }
    if (linked.length > 0) {
      logger.success(
        `Synced due date to ${linked.length} linked expense(s) for card ${cardId}`,
      );
    }
  },

  async syncCreditCardToTemplates(cardId, updates) {
    try {
      const templates = await db.recurringExpenseTemplates
        .filter(
          t =>
            t.targetCreditCardId === cardId &&
            t.category === 'Credit Card Payment' &&
            t.isActive,
        )
        .toArray();

      if (!templates.length) return;

      const card = await db.creditCards.get(cardId);
      if (!card) return;

      for (const template of templates) {
        const templateUpdates = {};

        if (
          updates.balance !== undefined ||
          updates.minimumPayment !== undefined
        ) {
          templateUpdates.baseAmount =
            card.balance > 0 ? getDefaultMinimumPaymentAmount(card) : 0;
        }

        if (updates.dueDate !== undefined && updates.dueDate) {
          templateUpdates.nextDueDate = updates.dueDate;
        }

        if (Object.keys(templateUpdates).length > 0) {
          await db.recurringExpenseTemplates.update(template.id, {
            ...templateUpdates,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      if (templates.length > 0) {
        logger.success(
          `Synced ${templates.length} recurring template(s) for card ${cardId}`,
        );
      }
    } catch (error) {
      logger.error('Error syncing credit card to templates:', error);
    }
  },

  async updateFundingAccountForCard(cardId, accountId) {
    try {
      const templates = await db.recurringExpenseTemplates
        .filter(
          t =>
            t.targetCreditCardId === cardId &&
            t.category === 'Credit Card Payment' &&
            t.isActive,
        )
        .toArray();

      if (!templates.length) return;

      const templateIds = new Set(templates.map(t => t.id));
      const now = new Date().toISOString();

      for (const template of templates) {
        await db.recurringExpenseTemplates.update(template.id, {
          accountId,
          updatedAt: now,
        });
      }

      const linkedExpenses = await db.fixedExpenses
        .filter(
          e =>
            e.targetCreditCardId === cardId &&
            templateIds.has(e.recurringTemplateId),
        )
        .toArray();

      const ts = nowIso();
      for (const expense of linkedExpenses) {
        await db.fixedExpenses.update(expense.id, { accountId, updatedAt: ts });
      }

      logger.success(
        `Updated funding account for card ${cardId} (${templates.length} template(s), ${linkedExpenses.length} expense(s))`,
      );
    } catch (error) {
      logger.error('Error updating funding account for card:', error);
      throw error;
    }
  },

  /**
   * Recompute `amount` on pending (unpaid), template-linked Credit Card
   * Payment expenses for this card after balance/minimumPayment changes,
   * mirroring the same calculation computeTemplateCycleAmount() uses. Never
   * touches already-paid expenses, so settled payment history is never
   * rewritten.
   */
  async syncCreditCardAmountToExpenses(cardId, updates) {
    if (updates.balance === undefined && updates.minimumPayment === undefined) {
      return;
    }

    const linked = await db.fixedExpenses
      .where('targetCreditCardId')
      .equals(cardId)
      .filter(
        e =>
          e.category === 'Credit Card Payment' &&
          !e.deletedAt &&
          e.status !== 'paid',
      )
      .toArray();
    if (linked.length === 0) return;

    const updatedCard = await db.creditCards.get(cardId);
    if (!updatedCard) return;

    const ts = nowIso();
    for (const expense of linked) {
      let newAmount;
      if (Number(updatedCard.balance) <= 0) {
        newAmount = 0;
      } else {
        let override = null;
        if (expense.recurringTemplateId) {
          const template = await db.recurringExpenseTemplates.get(
            expense.recurringTemplateId,
          );
          if (template && template.minimumPaymentOverride != null) {
            override = template.minimumPaymentOverride;
          }
        }
        newAmount =
          override != null
            ? override
            : getDefaultMinimumPaymentAmount(updatedCard);
      }
      await db.fixedExpenses.update(expense.id, {
        amount: newAmount,
        updatedAt: ts,
      });
    }
    logger.success(
      `Synced amount to ${linked.length} linked pending expense(s) for card ${cardId}`,
    );
  },

  async updateCreditCard(id, updates, expectedUpdatedAt) {
    try {
      await db.transaction(
        'rw',
        db.creditCards,
        db.fixedExpenses,
        db.recurringExpenseTemplates,
        async () => {
          const current = await db.creditCards.get(id);
          if (!current || current.deletedAt) {
            throw new Error(`Credit card not found: ${id}`);
          }
          if (
            expectedUpdatedAt !== undefined &&
            current.updatedAt !== expectedUpdatedAt
          ) {
            throw new Error(
              'STALE_WRITE: This card was changed elsewhere. Close and reopen the edit form to see the latest values.',
            );
          }

          const ts = nowIso();
          await db.creditCards.update(id, { ...updates, updatedAt: ts });

          if (updates.dueDate !== undefined) {
            await this.syncCreditCardDueDateToExpenses(id, updates.dueDate);
          }
          if (
            updates.balance !== undefined ||
            updates.minimumPayment !== undefined
          ) {
            await this.syncCreditCardAmountToExpenses(id, updates);
          }
          await this.syncCreditCardToTemplates(id, updates);
        },
      );
      logger.success(`Credit card updated successfully: ${id}`);
    } catch (error) {
      logger.error('Error updating credit card:', error);
      if (
        typeof error.message === 'string' &&
        error.message.startsWith('STALE_WRITE')
      ) {
        throw error;
      }
      throw new Error('Failed to update credit card');
    }
  },

  async deleteCreditCard(id) {
    try {
      const ts = nowIso();
      await db.transaction(
        'rw',
        db.creditCards,
        db.recurringExpenseTemplates,
        async () => {
          // Deactivate any recurring templates that would otherwise keep
          // manufacturing new expenses against (or paying into) a card
          // that no longer exists.
          const templates = await db.recurringExpenseTemplates.toArray();
          const linkedActiveTemplates = templates.filter(
            t =>
              !t.deletedAt &&
              t.isActive &&
              (t.creditCardId === id || t.targetCreditCardId === id),
          );
          for (const template of linkedActiveTemplates) {
            await this.updateRecurringExpenseTemplate(template.id, {
              isActive: false,
            });
          }

          await db.creditCards.update(id, { deletedAt: ts, updatedAt: ts });
        },
      );
      logger.success(`Credit card deleted successfully: ${id}`);
    } catch (error) {
      logger.error('Error deleting credit card:', error);
      throw new Error('Failed to delete credit card');
    }
  },

  // Pending transaction helpers
  async getPendingTransactions() {
    try {
      const transactions = (await db.pendingTransactions.toArray()).filter(
        t => !t.deletedAt,
      );
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
      const categoryId =
        transaction.categoryId ??
        (await resolveCategoryIdByName(transaction.category));
      const transactionData = {
        ...transaction,
        id: generateId(),
        categoryId: categoryId ?? null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      };

      await db.pendingTransactions.add(transactionData);
      const id = transactionData.id;
      logger.success(`Pending transaction added successfully: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding pending transaction:', error);
      throw new Error(`Failed to add pending transaction: ${error.message}`);
    }
  },

  async updatePendingTransaction(id, updates) {
    try {
      const payload = { ...updates, updatedAt: nowIso() };
      if (Object.prototype.hasOwnProperty.call(updates, 'category')) {
        payload.categoryId =
          updates.categoryId !== undefined
            ? updates.categoryId
            : await resolveCategoryIdByName(updates.category);
      }
      await db.pendingTransactions.update(id, payload);
      logger.success(`Pending transaction updated successfully: ${id}`);
    } catch (error) {
      logger.error('Error updating pending transaction:', error);
      throw new Error('Failed to update pending transaction');
    }
  },

  async deletePendingTransaction(id) {
    try {
      const ts = nowIso();
      await db.pendingTransactions.update(id, { deletedAt: ts, updatedAt: ts });
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
              updatedAt: nowIso(),
            });

            // Log the completion in audit logs
            await addAuditLogEntry(
              'COMPLETE_TRANSACTION',
              'PendingTransaction',
              id,
              {
                amount: transaction.amount,
                accountId: transaction.accountId,
                description: transaction.description,
                category: transaction.category,
                previousBalance,
                newBalance,
              },
            );
          } else {
            logger.warn(
              `Account ${transaction.accountId} not found for transaction ${id}`,
            );
          }

          const ts = nowIso();
          await db.pendingTransactions.update(id, {
            // completedAt positively marks "this money actually arrived".
            // Soft-delete alone can't say that - a row swept when a feature
            // is switched off looks identical - so anything reading back
            // real history must key off this, not off deletedAt.
            completedAt: ts,
            deletedAt: ts,
            updatedAt: ts,
          });
        },
      );
      void this.trimAuditLogs();
      logger.success(`Pending transaction completed successfully: ${id}`);
    } catch (error) {
      logger.error('Error completing pending transaction:', error);
      throw new Error('Failed to complete pending transaction');
    }
  },

  // Fixed expense helpers
  async getFixedExpenses() {
    try {
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
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

      const categoryId =
        expense.categoryId ?? (await resolveCategoryIdByName(expense.category));
      const expenseData = {
        ...expense,
        id: generateId(),
        categoryId: categoryId ?? null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,

        // Ensure numeric fields are properly typed
        amount: parseFloat(expense.amount),
        paidAmount: parseFloat(expense.paidAmount || 0),
        accountId: expense.accountId,
        status: expense.status || 'pending',
      };

      await db.fixedExpenses.add(expenseData);
      const id = expenseData.id;
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
      const payload = { ...updates, updatedAt: nowIso() };
      if (Object.prototype.hasOwnProperty.call(updates, 'category')) {
        payload.categoryId =
          updates.categoryId !== undefined
            ? updates.categoryId
            : await resolveCategoryIdByName(updates.category);
      }
      await db.fixedExpenses.update(id, payload);
      logger.success(`Fixed expense updated successfully: ${id}`);
    } catch (error) {
      logger.error('Error updating fixed expense:', error);
      throw new Error('Failed to update fixed expense');
    }
  },

  async deleteFixedExpense(id) {
    try {
      const ts = nowIso();
      await db.fixedExpenses.update(id, { deletedAt: ts, updatedAt: ts });
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

      const categoryId =
        template.categoryId ??
        (await resolveCategoryIdByName(template.category));
      const templateData = {
        ...template,
        id: generateId(),
        categoryId: categoryId ?? null,
        intervalUnit: template.intervalUnit || 'months', // Ensure intervalUnit is always set
        nextDueDate,
        lastGenerated: null,
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      };

      await db.recurringExpenseTemplates.add(templateData);
      const id = templateData.id;
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
        updatedAt: nowIso(),
      };

      if (Object.prototype.hasOwnProperty.call(updates, 'category')) {
        updateData.categoryId =
          updates.categoryId !== undefined
            ? updates.categoryId
            : await resolveCategoryIdByName(updates.category);
      }

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
      const ts = nowIso();
      await db.recurringExpenseTemplates.update(id, {
        deletedAt: ts,
        updatedAt: ts,
      });
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
        .filter(template => template.isActive === true && !template.deletedAt)
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
      if (template && template.deletedAt) {
        return null;
      }
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

  // Helper function to calculate next due date based on frequency.
  // Delegates to the standalone calculateNextDueDate in utils/recurrenceMath
  // (imported above) so DB-free callers, like the Virtual Ledger, can use
  // the exact same logic without pulling in Dexie.
  calculateNextDueDate(
    startDate,
    frequency,
    intervalValue = 1,
    intervalUnit = 'months',
  ) {
    return calculateNextDueDate(
      startDate,
      frequency,
      intervalValue,
      intervalUnit,
    );
  },

  // Generate next occurrence from template
  /**
   * Materialize a template's current cycle as a real fixedExpenses row, if
   * (and only if) it's actually due and doesn't already exist. This is the
   * single place a real row for a recurring template ever gets created -
   * replaces the old bulk "pre-generate 6 months" approach entirely.
   *
   * Deliberately does NOT touch template.nextDueDate/lastGenerated - the
   * cadence only ever advances when a cycle is resolved (see
   * resolveCycle), never on materialization. That split is what makes
   * this function safe to call repeatedly (every app load, every Fixed
   * Expenses page visit) without ever creating a second row for an
   * unresolved cycle.
   *
   * @param {string} templateId
   * @param {Object} [options]
   * @param {boolean} [options.allowFuture=false] - materialize the current
   *   cycle even when nextDueDate is still ahead of today. Callers opt in
   *   when a first occurrence lands within the current pay period (e.g. a
   *   bill just created in AddExpensePanel) so it is actionable in the
   *   priority list and hero totals instead of existing only as a virtual
   *   calendar forecast. Idempotency and every other guard are unchanged.
   * @returns {Promise<string|null>} the (existing or newly-created)
   *   expense id, or null if nothing is due yet
   */
  async materializeCurrentCycle(templateId, { allowFuture = false } = {}) {
    const template = await db.recurringExpenseTemplates.get(templateId);
    if (!template || !template.isActive) {
      throw new Error('Template not found or inactive');
    }

    // Self-heal: stop materializing from a template whose linked credit
    // card has since been (soft-)deleted - covers installs where the
    // card was deleted before deleteCreditCard started deactivating
    // linked templates.
    const linkedCardId = template.targetCreditCardId || template.creditCardId;
    if (linkedCardId) {
      const linkedCard = await db.creditCards.get(linkedCardId);
      if (!linkedCard || linkedCard.deletedAt) {
        await this.updateRecurringExpenseTemplate(templateId, {
          isActive: false,
        });
        throw new Error(
          'Linked credit card has been deleted; template deactivated',
        );
      }
    }

    // Check if template has an end date and if we've passed it
    if (template.endDate) {
      const todayString = DateUtils.today();
      const today = DateUtils.parseDate(todayString);
      const endDate = DateUtils.parseDate(template.endDate);

      if (endDate && today && today > endDate) {
        await this.updateRecurringExpenseTemplate(templateId, {
          isActive: false,
        });
        throw new Error('Template has reached its end date');
      }
    }

    if (!template.nextDueDate) return null;

    // Default: only materialize a cycle that is actually due. allowFuture
    // opts in to materializing it ahead of its due date (see jsdoc above) -
    // everything below (idempotency, cadence hands-off) is identical.
    if (!allowFuture && template.nextDueDate > DateUtils.today()) {
      return null; // not due yet
    }

    const existing = await db.fixedExpenses
      .where('recurringTemplateId')
      .equals(templateId)
      .filter(e => !e.deletedAt && e.dueDate === template.nextDueDate)
      .first();
    if (existing) return existing.id; // already materialized - idempotent

    const normalizedTemplate = {
      ...template,
      intervalUnit: template.intervalUnit || 'months',
    };
    const expenseAmount = await computeTemplateCycleAmount(normalizedTemplate);

    const newExpense = {
      name: normalizedTemplate.name,
      dueDate: normalizedTemplate.nextDueDate,
      amount: expenseAmount,
      accountId: normalizedTemplate.accountId || null,
      creditCardId: normalizedTemplate.creditCardId || null,
      targetCreditCardId: normalizedTemplate.targetCreditCardId || null,
      category: normalizedTemplate.category,
      paidAmount: 0,
      status: 'pending',
      recurringTemplateId: templateId,
      isAutoCreated: normalizedTemplate.isAutoCreated || false,
    };

    return this.addFixedExpenseV4(newExpense);
  },

  /**
   * Materialize the current cycle for every active template. Safe to call
   * on every app load / page visit - materializeCurrentCycle is
   * idempotent, and one template's failure doesn't block the rest.
   * @returns {Promise<Array<{templateId: string, expenseId: string}>>}
   */
  async materializeDueTemplates() {
    const templates = await this.getRecurringExpenseTemplates();
    const results = [];
    for (const template of templates) {
      try {
        const expenseId = await this.materializeCurrentCycle(template.id);
        if (expenseId) results.push({ templateId: template.id, expenseId });
      } catch (error) {
        logger.warn(
          `materializeCurrentCycle failed for template ${template.id}:`,
          error,
        );
      }
    }
    return results;
  },

  async setDefaultAccount(accountId) {
    try {
      const allAccounts = await db.accounts.toArray();
      const ts = nowIso();

      for (const account of allAccounts) {
        if (account.isDefault === true) {
          await db.accounts.update(account.id, {
            isDefault: false,
            updatedAt: ts,
          });
        }
      }

      await db.accounts.update(accountId, { isDefault: true, updatedAt: ts });
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
        id: generateId(),
        isDefault: isFirstAccount,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      };

      await db.accounts.add(accountData);
      const id = accountData.id;

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

  async updateAccount(id, updates, expectedUpdatedAt) {
    try {
      if (
        updates.currentBalance !== undefined &&
        !Number.isFinite(updates.currentBalance)
      ) {
        throw new Error('Account balance must be a finite number');
      }

      await db.transaction('rw', db.accounts, async () => {
        const current = await db.accounts.get(id);
        if (!current || current.deletedAt) {
          throw new Error(`Account not found: ${id}`);
        }
        if (
          expectedUpdatedAt !== undefined &&
          current.updatedAt !== expectedUpdatedAt
        ) {
          throw new Error(
            'STALE_WRITE: This account was changed elsewhere. Reload to see the latest values.',
          );
        }

        await db.accounts.update(id, { ...updates, updatedAt: nowIso() });
      });

      logger.success(`Account updated successfully: ${id}`);
    } catch (error) {
      logger.error('Error updating account:', error);
      if (
        typeof error.message === 'string' &&
        error.message.startsWith('STALE_WRITE')
      ) {
        throw error;
      }
      throw new Error(`Failed to update account: ${error.message}`);
    }
  },

  async deleteAccount(id) {
    try {
      const pendingRows = await db.pendingTransactions
        .where('accountId')
        .equals(id)
        .toArray();
      const pendingCount = pendingRows.filter(t => !t.deletedAt).length;
      if (pendingCount > 0) {
        throw new Error('Cannot delete account with pending transactions');
      }

      const ts = nowIso();
      await db.accounts.update(id, { deletedAt: ts, updatedAt: ts });
      logger.success(`Account deleted successfully: ${id}`);
    } catch (error) {
      logger.error('Error deleting account:', error);
      throw error;
    }
  },

  // Category helpers
  async getCategories() {
    try {
      const categories = (await db.categories.toArray()).filter(
        c => !c.deletedAt,
      );
      return categories;
    } catch (error) {
      logger.error('Error getting categories:', error);
      return [];
    }
  },

  async getCategoryById(id) {
    try {
      if (id == null || id === '') return null;
      const category = await db.categories.get(id);
      if (!category || category.deletedAt) return null;
      return category;
    } catch (error) {
      logger.error('Error getting category by id:', error);
      return null;
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
        id: generateId(),
        name: trimmedName,
        isDefault: sanitizedCategory.isDefault || false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      };

      await db.categories.add(categoryData);
      const id = categoryData.id;
      logger.success(`Category added successfully: ${id}`);
      return id;
    } catch (error) {
      logger.error('Error adding category:', error);
      throw new Error(`Failed to add category: ${error.message}`);
    }
  },

  async updateCategory(id, updates) {
    try {
      const payload = { ...updates, updatedAt: nowIso() };
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
      if (!category) {
        // Can happen if the caller still holds an optimistic-add placeholder
        // id (see CategoryContext's `temp-${Date.now()}`) instead of the
        // real id assigned once the add finishes.
        throw new Error(
          'Category not found. It may still be saving — please try again in a moment.',
        );
      }
      const affectedFixedExpenses = await db.fixedExpenses
        .where('category')
        .equals(category.name)
        .toArray();
      const affectedPendingTransactions = await db.pendingTransactions
        .where('category')
        .equals(category.name)
        .toArray();

      const ts = nowIso();
      await db.categories.update(id, { deletedAt: ts, updatedAt: ts });
      logger.success(`Category deleted successfully: ${id}`);
      return {
        affectedFixedExpenses,
        affectedPendingTransactions,
      };
    } catch (error) {
      logger.error('Error deleting category:', error);
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  },

  async getExpensesByCategory(categoryName) {
    try {
      const expenses = (
        await db.fixedExpenses.where('category').equals(categoryName).toArray()
      ).filter(e => !e.deletedAt);
      return expenses;
    } catch (error) {
      logger.error('Error getting expenses by category:', error);
      return [];
    }
  },

  async getTransactionsByCategory(categoryName) {
    try {
      const transactions = (
        await db.pendingTransactions
          .where('category')
          .equals(categoryName)
          .toArray()
      ).filter(t => !t.deletedAt);
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
          templatesUpdated: 0,
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

      // Find all recurring expense templates with the old category name
      const templatesToUpdate = await db.recurringExpenseTemplates
        .where('category')
        .equals(oldName)
        .toArray();

      await db.transaction(
        'rw',
        db.categories,
        db.fixedExpenses,
        db.pendingTransactions,
        db.recurringExpenseTemplates,
        async () => {
          // Update category name first
          await db.categories.update(categoryId, {
            name: newName,
            updatedAt: nowIso(),
          });

          // Update all expenses using batch operations
          for (const expense of expensesToUpdate) {
            await this.updateFixedExpenseV4(expense.id, { category: newName });
          }

          // Update all pending transactions
          for (const transaction of transactionsToUpdate) {
            await this.updatePendingTransaction(transaction.id, {
              category: newName,
            });
          }

          // Update all recurring expense templates
          for (const template of templatesToUpdate) {
            await db.recurringExpenseTemplates.update(template.id, {
              category: newName,
              categoryId,
              updatedAt: nowIso(),
            });
          }
        },
      );

      const expensesUpdated = expensesToUpdate.length;
      const transactionsUpdated = transactionsToUpdate.length;
      const templatesUpdated = templatesToUpdate.length;
      const totalUpdated =
        expensesUpdated + transactionsUpdated + templatesUpdated;

      logger.success(
        `Category renamed from "${oldName}" to "${newName}". Updated ${expensesUpdated} expenses, ${transactionsUpdated} transactions, and ${templatesUpdated} templates.`,
      );

      return {
        expensesUpdated,
        transactionsUpdated,
        templatesUpdated,
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
        await this.updateFixedExpenseV4(expenseId, {
          category: newCategoryName,
        });
      }

      // Update pending transactions
      const transactionIds =
        affectedItems.pendingTransactions?.map(transaction => transaction.id) ||
        [];
      for (const transactionId of transactionIds) {
        await this.updatePendingTransaction(transactionId, {
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
      const allExpenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      const expenseCategoryNames = new Set(
        allExpenses.map(expense => expense.category).filter(Boolean),
      );

      // Get all unique category names from pending transactions
      const allTransactions = (await db.pendingTransactions.toArray()).filter(
        t => !t.deletedAt,
      );
      const transactionCategoryNames = new Set(
        allTransactions
          .map(transaction => transaction.category)
          .filter(Boolean),
      );

      // Get all recurring expense templates and their category names
      const allTemplates = (
        await db.recurringExpenseTemplates.toArray()
      ).filter(t => !t.deletedAt);
      const templateCategoryNames = new Set(
        allTemplates.map(t => t.category).filter(Boolean),
      );

      // Get all valid category names
      const allCategories = (await db.categories.toArray()).filter(
        c => !c.deletedAt,
      );
      const validCategoryNames = new Set(
        allCategories.map(category => category.name),
      );

      // Find orphaned category names; each entry has expenseCount, transactionCount, templateCount
      const orphanedCategories = new Map();

      // Check expense categories
      expenseCategoryNames.forEach(categoryName => {
        if (!validCategoryNames.has(categoryName)) {
          const existing = orphanedCategories.get(categoryName) || {
            expenseCount: 0,
            transactionCount: 0,
            templateCount: 0,
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
            templateCount: 0,
          };
          existing.transactionCount = allTransactions.filter(
            t => t.category === categoryName,
          ).length;
          orphanedCategories.set(categoryName, existing);
        }
      });

      // Check template categories
      templateCategoryNames.forEach(categoryName => {
        if (!validCategoryNames.has(categoryName)) {
          const existing = orphanedCategories.get(categoryName) || {
            expenseCount: 0,
            transactionCount: 0,
            templateCount: 0,
          };
          existing.templateCount = allTemplates.filter(
            t => t.category === categoryName,
          ).length;
          orphanedCategories.set(categoryName, existing);
        }
      });

      return Array.from(orphanedCategories.entries()).map(([name, counts]) => ({
        categoryName: name,
        expenseCount: counts.expenseCount,
        transactionCount: counts.transactionCount,
        templateCount: counts.templateCount ?? 0,
        totalCount:
          (counts.expenseCount || 0) +
          (counts.transactionCount || 0) +
          (counts.templateCount || 0),
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

      // Find all recurring expense templates with orphaned category
      const orphanedTemplates = await db.recurringExpenseTemplates
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

      // Update recurring expense templates
      let templatesFixed = 0;
      for (const template of orphanedTemplates) {
        try {
          await db.recurringExpenseTemplates.update(template.id, {
            category: targetCategoryName,
          });
          templatesFixed++;
        } catch (error) {
          logger.error(`Failed to fix template ${template.id}:`, error);
        }
      }

      const totalFixed = expensesFixed + transactionsFixed + templatesFixed;
      logger.success(
        `Fixed orphaned category "${orphanedCategoryName}": ${expensesFixed} expenses, ${transactionsFixed} transactions, and ${templatesFixed} templates reassigned to "${targetCategoryName}"`,
      );

      return {
        expensesFixed,
        transactionsFixed,
        templatesFixed,
        totalFixed,
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

  async updateCategorySortOrder(orderedIds) {
    const ts = nowIso();
    await db.transaction('rw', db.categories, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.categories.update(orderedIds[i], {
          sortOrder: i,
          updatedAt: ts,
        });
      }
    });
  },

  async bulkUpdateCategories(ids, updates) {
    await db.transaction('rw', db.categories, async () => {
      await db.categories
        .where('id')
        .anyOf(ids)
        .modify({ ...updates, updatedAt: nowIso() });
    });
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
          id: generateId(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
          deletedAt: null,
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
      const settings = (await db.paycheckSettings.toArray()).filter(
        s => !s.deletedAt,
      );
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

      if (
        settings.frequency &&
        !VALID_PAY_FREQUENCIES.includes(settings.frequency)
      ) {
        throw new Error('Invalid frequency value');
      }

      const existingSettings = (await db.paycheckSettings.toArray()).filter(
        s => !s.deletedAt,
      );
      if (existingSettings.length > 0) {
        await db.paycheckSettings.update(existingSettings[0].id, {
          ...settings,
          updatedAt: nowIso(),
        });
      } else {
        await db.paycheckSettings.add({
          ...settings,
          id: generateId(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
          deletedAt: null,
        });
      }
      logger.success('Paycheck settings updated successfully');
    } catch (error) {
      logger.error('Error updating paycheck settings:', error);
      logger.error('Settings data:', settings);
      throw new Error(`Failed to update paycheck settings: ${error.message}`);
    }
  },

  /**
   * Self-heal the paycheck cadence anchor (lastPaycheckDate) when it has
   * drifted stale - e.g. the app wasn't opened for a while, or the user
   * changed frequency. calculateNextPayDates always rolls the anchor
   * forward to the next date >= today, so it can't itself say how far past
   * the expected payday we are; getMostRecentImpliedPayDate can.
   *
   * A gap of up to 2 days is the "safe zone" and is left alone - it's
   * normal for the user to open the app a little before or after payday.
   * A gap of 3+ days silently advances the anchor to the most recent
   * implied payday and records a best-effort audit log entry.
   *
   * @returns {Promise<{advanced: boolean, previousDate?: string, newDate?: string}>}
   */
  async selfHealPaycheckAnchor() {
    const settings = await this.getPaycheckSettings();
    if (!settings?.lastPaycheckDate || !settings?.frequency) {
      return { advanced: false };
    }

    const today = DateUtils.today();
    const impliedDate = getMostRecentImpliedPayDate(
      settings.lastPaycheckDate,
      settings.frequency,
      today,
    );
    const daysPast = DateUtils.daysBetween(impliedDate, today);

    if (daysPast === null || daysPast <= 2) {
      return { advanced: false };
    }

    const previousDate = settings.lastPaycheckDate;
    await this.updatePaycheckSettings({
      lastPaycheckDate: impliedDate,
      frequency: settings.frequency,
    });

    try {
      await addAuditLogEntry(
        'SELF_HEAL_PAYCHECK_ANCHOR',
        'paycheckSettings',
        settings.id,
        {
          previousDate,
          newDate: impliedDate,
          daysPast,
        },
      );
    } catch (auditErr) {
      logger.warn('Audit log (self-heal paycheck anchor) failed:', auditErr);
    }

    return { advanced: true, previousDate, newDate: impliedDate };
  },

  // Income source helpers
  //
  // An income source says where a paycheck lands and roughly how much to
  // expect. It never moves a balance: on payday it creates a *pending*
  // income transaction, which the user confirms when the money actually
  // arrives. That keeps an inaccurate estimate incapable of producing an
  // inaccurate balance.
  async getIncomeSources() {
    try {
      const rows = await db.incomeSources.toArray();
      return rows.filter(r => !r.deletedAt);
    } catch (error) {
      logger.error('Error getting income sources:', error);
      return [];
    }
  },

  async getPrimaryIncomeSource() {
    const sources = await this.getIncomeSources();
    return sources.length > 0 ? sources[0] : null;
  },

  /**
   * Create or update the single income source. Phase 1 keeps exactly one
   * row - the table is a list so a second source can be added later without
   * a migration, but nothing surfaces more than one yet.
   */
  async upsertIncomeSource(updates) {
    try {
      if (updates.expectedAmount !== undefined) {
        const parsed = parseMoneyInput(updates.expectedAmount);
        if (!parsed.ok) {
          throw new Error('Expected amount must be a valid amount');
        }
        if (parsed.value < 0) {
          throw new Error('Expected amount cannot be negative');
        }
        updates = { ...updates, expectedAmount: parsed.value };
      }

      if (updates.accountId) {
        const account = await db.accounts.get(updates.accountId);
        if (!account || account.deletedAt) {
          throw new Error(`Account not found: ${updates.accountId}`);
        }
      }

      const existing = await this.getPrimaryIncomeSource();
      if (existing) {
        await db.incomeSources.update(existing.id, {
          ...updates,
          updatedAt: nowIso(),
        });
        return existing.id;
      }

      const row = {
        name: 'Paycheck',
        accountId: null,
        expectedAmount: 0,
        isEnabled: false,
        lastGeneratedDate: null,
        ...updates,
        id: generateId(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      };
      await db.incomeSources.add(row);
      logger.success(`Income source created: ${row.id}`);
      return row.id;
    } catch (error) {
      logger.error('Error saving income source:', error);
      throw new Error(`Failed to save income source: ${error.message}`);
    }
  },

  /**
   * Remove un-confirmed payday rows for a source. Confirmed paychecks are
   * real history (soft-deleted by completePendingTransaction) and are left
   * alone; only predictions the user never acted on are swept.
   */
  async sweepUnconfirmedIncome(sourceId) {
    try {
      const rows = (await db.pendingTransactions.toArray()).filter(
        t => t.incomeSourceId === sourceId && !t.deletedAt,
      );
      const ts = nowIso();
      for (const row of rows) {
        await db.pendingTransactions.update(row.id, {
          deletedAt: ts,
          updatedAt: ts,
        });
      }
      if (rows.length > 0) {
        logger.success(`Swept ${rows.length} unconfirmed income row(s)`);
      }
      return rows.length;
    } catch (error) {
      logger.error('Error sweeping unconfirmed income:', error);
      return 0;
    }
  },

  /**
   * What this source's paychecks have actually been worth lately.
   *
   * Reads only rows the user confirmed (completedAt set) - a prediction that
   * was swept when the feature was switched off is soft-deleted too, and
   * counting it would average in a paycheck that never arrived. Returns null
   * until there's enough history to beat the user's own estimate.
   *
   * @returns {Promise<number|null>} average of the last few actual amounts
   */
  async getLearnedIncomeAmount(sourceId) {
    const MIN_HISTORY = 3;
    try {
      const confirmed = (await db.pendingTransactions.toArray())
        .filter(t => t.incomeSourceId === sourceId && t.completedAt)
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
        .slice(0, MIN_HISTORY);

      if (confirmed.length < MIN_HISTORY) return null;

      const total = confirmed.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return Math.round((total / confirmed.length) * 100) / 100;
    } catch (error) {
      logger.error('Error reading income history:', error);
      return null;
    }
  },

  /**
   * Create a pending income row for every payday that has passed since the
   * last one generated. Safe to call on every app load - `lastGeneratedDate`
   * is the high-water mark, so a second run in the same day creates nothing.
   *
   * Note it does NOT use calculateNextPayDates: that function rolls forward
   * past today by design, so it can only ever report future paydays and can
   * never tell you one has already passed. It also can't use the recurring
   * generator's "set of dates already materialised" trick, because a
   * confirmed paycheck is soft-deleted and would vanish from that set,
   * causing it to be generated a second time.
   *
   * @returns {Promise<{ generated: number }>}
   */
  async generateDueIncome() {
    try {
      const source = await this.getPrimaryIncomeSource();
      if (!source || !source.isEnabled || !source.accountId) {
        return { generated: 0 };
      }

      const account = await db.accounts.get(source.accountId);
      if (!account || account.deletedAt) {
        // Target account is gone - disable rather than orphan the income.
        await db.incomeSources.update(source.id, {
          isEnabled: false,
          updatedAt: nowIso(),
        });
        logger.warn('Income source disabled: target account no longer exists');
        return { generated: 0 };
      }

      const settings = await this.getPaycheckSettings();
      const anchor = source.lastGeneratedDate || settings?.lastPaycheckDate;
      if (!anchor) return { generated: 0 };

      const frequency = settings?.frequency || DEFAULT_PAY_FREQUENCY;
      const today = DateUtils.today();

      // What actually arrived beats what the user guessed. Their typed
      // figure is left untouched as the fallback and starting point.
      const learned = await this.getLearnedIncomeAmount(source.id);
      const amount = learned ?? Math.abs(Number(source.expectedAmount) || 0);

      // A long absence must not flood the list with back-pay.
      const MAX_CATCH_UP = 7;

      const dueDates = [];
      let cursor = anchor;
      while (dueDates.length < MAX_CATCH_UP) {
        const next = advanceDueDateByFrequency(cursor, frequency);
        if (!next || !DateUtils.parseDate(next)) break;
        if (next > today) break;
        dueDates.push(next);
        cursor = next;
      }

      if (dueDates.length === 0) return { generated: 0 };

      for (const dueDate of dueDates) {
        await this.addPendingTransaction({
          accountId: source.accountId,
          amount, // positive: income adds to the balance on completion
          category: 'Other',
          description: source.name || 'Paycheck',
          date: dueDate,
          type: 'income',
          incomeSourceId: source.id,
        });
      }

      await db.incomeSources.update(source.id, {
        lastGeneratedDate: cursor,
        updatedAt: nowIso(),
      });

      logger.success(
        `Generated ${dueDates.length} pending income row(s) for ${source.name}`,
      );
      return { generated: dueDates.length };
    } catch (error) {
      logger.error('Error generating due income:', error);
      return { generated: 0 };
    }
  },

  // User preferences helpers
  async getUserPreferences(component) {
    try {
      const preferences = (
        await db.userPreferences
          .filter(pref => pref.component === component)
          .toArray()
      ).filter(p => !p.deletedAt);
      return preferences.length > 0 ? preferences[0].preferences : null;
    } catch (error) {
      logger.error('Error getting user preferences:', error);
      return null;
    }
  },

  async setUserPreferences(component, preferences) {
    try {
      const existing = await db.userPreferences
        .filter(pref => pref.component === component && !pref.deletedAt)
        .first();
      const ts = nowIso();
      if (existing) {
        await db.userPreferences.update(existing.id, {
          preferences,
          updatedAt: ts,
        });
      } else {
        await db.userPreferences.add({
          id: generateId(),
          component,
          preferences,
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
        });
      }
    } catch (error) {
      logger.error('Error setting user preferences:', error);
    }
  },

  async updateUserPreferences(preferences, component) {
    try {
      const existing = await db.userPreferences
        .filter(pref => pref.component === component && !pref.deletedAt)
        .first();
      if (existing) {
        await db.userPreferences.update(existing.id, {
          preferences,
          updatedAt: nowIso(),
        });
      } else {
        const ts = nowIso();
        await db.userPreferences.add({
          id: generateId(),
          component,
          preferences,
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
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
        .filter(account => account.isDefault === true && !account.deletedAt)
        .first();
      return defaultAccount || null;
    } catch (error) {
      logger.error('Error getting default account:', error);
      return null;
    }
  },

  async getFundableAccounts() {
    try {
      const accounts = await db.accounts.toArray();
      return accounts.filter(
        a => !a.deletedAt && (a.type === 'checking' || a.type === 'savings'),
      );
    } catch (error) {
      logger.error('Error getting fundable accounts:', error);
      return [];
    }
  },

  async getFundingAccountIdForCard(cardId) {
    try {
      const templates = await db.recurringExpenseTemplates
        .filter(
          t =>
            t.targetCreditCardId === cardId &&
            t.category === 'Credit Card Payment' &&
            t.isActive &&
            !t.deletedAt,
        )
        .toArray();
      return templates.length > 0 ? templates[0].accountId : null;
    } catch (error) {
      logger.error('Error getting funding account for card:', error);
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
        const active = (await db.accounts.toArray()).filter(a => !a.deletedAt);
        const firstAccount = active.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        )[0];
        if (firstAccount) {
          await db.accounts.update(firstAccount.id, {
            isDefault: true,
            updatedAt: nowIso(),
          });
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
      const allAccounts = (await db.accounts.toArray()).filter(
        a => !a.deletedAt,
      );
      const defaultAccounts = allAccounts.filter(
        account => account.isDefault === true,
      );
      const ts = nowIso();

      // If there are multiple default accounts, keep only the first one
      if (defaultAccounts.length > 1) {
        const accountsToUpdate = defaultAccounts.slice(1);
        for (const account of accountsToUpdate) {
          await db.accounts.update(account.id, {
            isDefault: false,
            updatedAt: ts,
          });
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
          await db.accounts.update(placeholder.id, {
            deletedAt: ts,
            updatedAt: ts,
          });
          logger.info(
            `Removed placeholder Default Account (ID: ${placeholder.id})`,
          );
        }

        // No default after removing placeholders: use first real account
        const remainingAccounts = (await db.accounts.toArray()).filter(
          a => !a.deletedAt,
        );
        const hasDefault = remainingAccounts.some(
          account => account.isDefault === true,
        );

        if (!hasDefault && remainingAccounts.length > 0) {
          const firstAccount = remainingAccounts[0];
          await db.accounts.update(firstAccount.id, {
            isDefault: true,
            updatedAt: ts,
          });
          logger.info(`Set ${firstAccount.name} as default account`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up duplicate defaults:', error);
    }
  },

  async cleanupDuplicateCreditCardExpenses() {
    try {
      // Scoped to Credit Card Payment expenses only, and keyed to include
      // dueDate - a bare name+amount key (with no category/date scoping)
      // would risk conflating separate months of a legitimate recurring
      // expense like rent that happens to share a name and amount.
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt && e.category === 'Credit Card Payment',
      );
      const duplicates = [];

      const seen = new Map();
      for (const expense of expenses) {
        const key = expense.recurringTemplateId
          ? `${expense.recurringTemplateId}-${expense.dueDate}`
          : `${expense.name}-${expense.amount}-${expense.dueDate}`;
        if (seen.has(key)) {
          duplicates.push(expense);
        } else {
          seen.set(key, expense);
        }
      }

      const ts = nowIso();
      for (const duplicate of duplicates) {
        await db.fixedExpenses.update(duplicate.id, {
          deletedAt: ts,
          updatedAt: ts,
        });
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

  /**
   * Deactivate duplicate active Credit Card Payment templates for the same
   * card (e.g. created by a race before createExpenseForCard's atomic
   * check-and-create fix). Keeps the oldest template, deactivates the rest.
   */
  async cleanupDuplicateCreditCardTemplates() {
    try {
      const templates = (await db.recurringExpenseTemplates.toArray()).filter(
        t => !t.deletedAt && t.isActive && t.category === 'Credit Card Payment',
      );
      const byCard = new Map();
      for (const template of templates) {
        const list = byCard.get(template.targetCreditCardId) || [];
        list.push(template);
        byCard.set(template.targetCreditCardId, list);
      }

      const deactivated = [];
      for (const list of byCard.values()) {
        if (list.length <= 1) continue;
        list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        for (const extra of list.slice(1)) {
          await this.updateRecurringExpenseTemplate(extra.id, {
            isActive: false,
          });
          deactivated.push(extra);
        }
      }

      if (deactivated.length > 0) {
        logger.success(
          `Deactivated ${deactivated.length} duplicate credit card payment template(s)`,
        );
      }
      return deactivated;
    } catch (error) {
      logger.error('Error cleaning up duplicate credit card templates:', error);
      return [];
    }
  },

  async getOrphanedCreditCards() {
    try {
      const creditCards = (await db.creditCards.toArray()).filter(
        c => !c.deletedAt,
      );
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      const templates = (await db.recurringExpenseTemplates.toArray()).filter(
        t => !t.deletedAt,
      );
      return creditCards.filter(
        card =>
          !expenses.some(
            e =>
              e.category === 'Credit Card Payment' &&
              e.targetCreditCardId === card.id,
          ) &&
          !templates.some(
            t =>
              t.category === 'Credit Card Payment' &&
              t.targetCreditCardId === card.id &&
              t.isActive,
          ),
      );
    } catch (error) {
      logger.error('Error getting orphaned credit cards:', error);
      return [];
    }
  },

  async createExpenseForCard(cardId, accountId) {
    try {
      // The existence-check and template-insert must be atomic to prevent a
      // race (e.g. React StrictMode's double-invoked mount effect, or two
      // page visits close together) from both seeing "no template yet" and
      // both creating one. materializeCurrentCycle() is deliberately kept
      // OUTSIDE this transaction - it calls addFixedExpenseV4(), which does
      // a dynamic `await import(...)` partway through, and running a
      // dynamic import mid-transaction can throw TransactionInactiveError
      // (the same reason applyExpensePaymentChangeAtomic hoists its own
      // validator import above its transaction).
      const result = await db.transaction(
        'rw',
        db.recurringExpenseTemplates,
        db.creditCards,
        db.categories,
        async () => {
          const existingTemplates = await db.recurringExpenseTemplates
            .filter(
              t =>
                t.targetCreditCardId === cardId &&
                t.category === 'Credit Card Payment' &&
                t.isActive,
            )
            .toArray();

          if (existingTemplates.length > 0) {
            return { created: false };
          }

          const card = await db.creditCards.get(cardId);
          if (!card) {
            throw new Error(`Credit card not found: ${cardId}`);
          }

          const startDate =
            card.dueDate || new Date().toISOString().split('T')[0];

          const templateId = await this.addRecurringExpenseTemplate({
            name: `${card.name} Payment`,
            baseAmount: getDefaultMinimumPaymentAmount(card),
            frequency: 'monthly',
            intervalValue: 1,
            intervalUnit: 'months',
            startDate,
            nextDueDate: startDate,
            category: 'Credit Card Payment',
            accountId,
            targetCreditCardId: card.id,
            isActive: true,
            isVariableAmount: true,
            isAutoCreated: true,
          });

          return { created: true, templateId, cardName: card.name };
        },
      );

      if (!result.created) {
        await this.updateFundingAccountForCard(cardId, accountId);
        return;
      }

      // allowFuture: the card's due date is often still ahead of today, and
      // the payment bill must be actionable (priority list, hero totals) as
      // soon as the template exists, not only as a calendar forecast.
      await this.materializeCurrentCycle(result.templateId, {
        allowFuture: true,
      });
      logger.success(
        `Created payment expense for card "${result.cardName}" (template ${result.templateId})`,
      );
    } catch (error) {
      logger.error('Error creating expense for card:', error);
      throw error;
    }
  },

  async createMissingCreditCardExpenses() {
    try {
      const creditCards = await db.creditCards.toArray();
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      const templates = await db.recurringExpenseTemplates.toArray();
      let createdCount = 0;

      let defaultAccount = await this.getDefaultAccount();
      if (!defaultAccount) {
        const accounts = await db.accounts.toArray();
        defaultAccount =
          accounts.find(acc => acc.type === 'checking') || accounts[0];
      }

      if (!defaultAccount) {
        logger.warn(
          'No checking/savings account found. Cannot create credit card payment expenses.',
        );
        return 0;
      }

      for (const card of creditCards) {
        const hasPaymentExpense = expenses.some(
          e =>
            e.category === 'Credit Card Payment' &&
            e.targetCreditCardId === card.id,
        );
        const hasPaymentTemplate = templates.some(
          t =>
            t.category === 'Credit Card Payment' &&
            t.targetCreditCardId === card.id &&
            t.isActive,
        );

        if (!hasPaymentExpense && !hasPaymentTemplate) {
          await this.createExpenseForCard(card.id, defaultAccount.id);
          createdCount++;
        }
      }

      logger.success(
        `Created ${createdCount} recurring credit card payment template(s)`,
      );
      return createdCount;
    } catch (error) {
      logger.error('Error creating missing credit card expenses:', error);
      return 0;
    }
  },

  /**
   * Repair Credit Card Payment templates and fixed expenses that have missing or invalid accountId.
   * Sets accountId to the default account so every payment expense has a funding source.
   * @returns {{ repairedTemplates: number, repairedExpenses: number }}
   */
  async repairCreditCardPaymentFundingSource() {
    try {
      let defaultAccount = await this.getDefaultAccount();
      if (!defaultAccount) {
        const accounts = await db.accounts.toArray();
        defaultAccount =
          accounts.find(acc => acc.type === 'checking') || accounts[0];
      }
      if (!defaultAccount) {
        logger.warn(
          'No checking/savings account found. Cannot repair credit card payment funding.',
        );
        return { repairedTemplates: 0, repairedExpenses: 0 };
      }

      const accounts = await db.accounts.toArray();
      const validAccountIds = new Set(accounts.map(a => a.id));
      let repairedTemplates = 0;
      let repairedExpenses = 0;

      const templates = await db.recurringExpenseTemplates.toArray();
      const ccTemplates = templates.filter(
        t => t.category === 'Credit Card Payment' && t.isActive,
      );
      const ts = nowIso();
      for (const template of ccTemplates) {
        if (
          template.accountId == null ||
          !validAccountIds.has(template.accountId)
        ) {
          await db.recurringExpenseTemplates.update(template.id, {
            accountId: defaultAccount.id,
            updatedAt: ts,
          });
          repairedTemplates++;
        }
      }

      const expenses = await db.fixedExpenses.toArray();
      const ccExpenses = expenses.filter(
        e =>
          e.category === 'Credit Card Payment' &&
          !e.deletedAt &&
          (e.accountId == null || !validAccountIds.has(e.accountId)),
      );
      for (const expense of ccExpenses) {
        await db.fixedExpenses.update(expense.id, {
          accountId: defaultAccount.id,
          updatedAt: ts,
        });
        repairedExpenses++;
      }

      if (repairedTemplates > 0 || repairedExpenses > 0) {
        logger.success(
          `Repaired funding source: ${repairedTemplates} template(s), ${repairedExpenses} expense(s)`,
        );
      }
      return { repairedTemplates, repairedExpenses };
    } catch (error) {
      logger.error('Error repairing credit card payment funding:', error);
      return { repairedTemplates: 0, repairedExpenses: 0 };
    }
  },

  /**
   * Ensure every credit card has a payment expense and every payment expense has
   * a valid funding source. Runs repair first, creates any missing expenses,
   * then self-heals any duplicate templates/expenses left over from before
   * createExpenseForCard's atomic check-and-create fix.
   * @returns {{ createdCount: number, repairedTemplates: number,
   *   repairedExpenses: number, duplicatesRemoved: number }}
   */
  async ensureCreditCardPaymentExpensesLinked() {
    if (ensureCreditCardPaymentExpensesLinkedPromise) {
      return ensureCreditCardPaymentExpensesLinkedPromise;
    }
    ensureCreditCardPaymentExpensesLinkedPromise = (async () => {
      const repair = await this.repairCreditCardPaymentFundingSource();
      const createdCount = await this.createMissingCreditCardExpenses();
      const duplicateTemplates =
        await this.cleanupDuplicateCreditCardTemplates();
      const duplicateExpenses = await this.cleanupDuplicateCreditCardExpenses();
      return {
        createdCount,
        repairedTemplates: repair.repairedTemplates,
        repairedExpenses: repair.repairedExpenses,
        duplicatesRemoved: duplicateTemplates.length + duplicateExpenses.length,
      };
    })();
    try {
      return await ensureCreditCardPaymentExpensesLinkedPromise;
    } finally {
      ensureCreditCardPaymentExpensesLinkedPromise = null;
    }
  },

  // Insights and analytics helpers
  async getBudgetVsActualSummary() {
    try {
      const { month, year } = await this.getCurrentCycleMonth();
      const allExpenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      const expenses = allExpenses.filter(e => {
        const d = new Date(e.dueDate);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });

      // Calculate totals for current cycle
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

  async getCurrentCycleMonth() {
    try {
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      const now = new Date();
      if (expenses.length === 0) {
        return { month: now.getMonth() + 1, year: now.getFullYear() };
      }
      const countByKey = {};
      const keysWithCounts = [];
      for (const expense of expenses) {
        const d = new Date(expense.dueDate);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const key = `${y}-${m}`;
        countByKey[key] = (countByKey[key] || 0) + 1;
        if (!keysWithCounts.some(([k]) => k === key)) {
          keysWithCounts.push([key, y, m]);
        }
      }
      const maxCount = Math.max(...Object.values(countByKey));
      const tied = keysWithCounts.filter(
        ([key]) => countByKey[key] === maxCount,
      );
      const best = tied.reduce((b, [k, y, m]) => {
        if (!b) return [k, y, m];
        const [, by, bm] = b;
        if (y > by) return [k, y, m];
        if (y === by && m > bm) return [k, y, m];
        return b;
      }, null);
      return { month: best[2], year: best[1] };
    } catch (error) {
      logger.error('Error getting current cycle month:', error);
      const now = new Date();
      return { month: now.getMonth() + 1, year: now.getFullYear() };
    }
  },

  async getBudgetVsActualSummaryForMonth(month, year) {
    try {
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      const now = new Date();
      let currentMonth, currentYear;
      if (expenses.length === 0) {
        currentMonth = now.getMonth() + 1;
        currentYear = now.getFullYear();
      } else {
        const countByKey = {};
        const keysWithCounts = [];
        for (const expense of expenses) {
          const d = new Date(expense.dueDate);
          const m = d.getMonth() + 1;
          const y = d.getFullYear();
          const key = `${y}-${m}`;
          countByKey[key] = (countByKey[key] || 0) + 1;
          if (!keysWithCounts.some(([k]) => k === key)) {
            keysWithCounts.push([key, y, m]);
          }
        }
        const maxCount = Math.max(...Object.values(countByKey));
        const tied = keysWithCounts.filter(
          ([key]) => countByKey[key] === maxCount,
        );
        const best = tied.reduce((b, [k, y, m]) => {
          if (!b) return [k, y, m];
          const [, by, bm] = b;
          if (y > by) return [k, y, m];
          if (y === by && m > bm) return [k, y, m];
          return b;
        }, null);
        currentMonth = best[2];
        currentYear = best[1];
      }

      if (month === currentMonth && year === currentYear) {
        return await this.getBudgetVsActualSummary();
      }

      const historyRecords = await db.monthlyExpenseHistory.toArray();
      const forMonth = historyRecords.filter(
        r => r.month === month && r.year === year,
      );
      if (forMonth.length === 0) {
        return {
          totalBudget: 0,
          totalActual: 0,
          totalOverpayment: 0,
          budgetAccuracy: 0,
          significantOverpayments: 0,
        };
      }

      const totalBudget = forMonth.reduce(
        (s, r) => s + (r.budgetAmount || 0),
        0,
      );
      const totalActual = forMonth.reduce(
        (s, r) => s + (r.actualAmount || 0),
        0,
      );
      const totalOverpayment = forMonth.reduce(
        (s, r) => s + (r.overpaymentAmount || 0),
        0,
      );
      const budgetAccuracy =
        totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
      const significantOverpayments = forMonth.filter(r => {
        const b = r.budgetAmount || 0;
        if (b <= 0) return false;
        const over = (r.actualAmount || 0) - b;
        return (over / b) * 100 > 20;
      }).length;

      return {
        totalBudget,
        totalActual,
        totalOverpayment,
        budgetAccuracy,
        significantOverpayments,
      };
    } catch (error) {
      logger.error('Error getting budget vs actual summary for month:', error);
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
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      const byCategory = {};

      for (const expense of expenses) {
        if ((expense.paidAmount || 0) <= expense.amount) continue;

        const category = expense.category || 'Uncategorized';
        if (!byCategory[category]) {
          byCategory[category] = {
            totalBudget: 0,
            totalActual: 0,
            totalOverpayment: 0,
            expenseCount: 0,
            significantOverpayments: 0,
          };
        }

        const amount = expense.amount;
        const paid = expense.paidAmount || 0;
        const overpayment = Math.max(0, paid - amount);

        byCategory[category].totalBudget += amount;
        byCategory[category].totalActual += paid;
        byCategory[category].totalOverpayment += overpayment;
        byCategory[category].expenseCount += 1;

        if (amount > 0 && (overpayment / amount) * 100 > 20) {
          byCategory[category].significantOverpayments += 1;
        }
      }

      const result = {};
      for (const [name, data] of Object.entries(byCategory)) {
        if (data.totalOverpayment <= 0) continue;
        result[name] = {
          totalBudget: data.totalBudget,
          totalActual: data.totalActual,
          totalOverpayment: data.totalOverpayment,
          overpaymentPercentage:
            data.totalBudget > 0
              ? (data.totalOverpayment / data.totalBudget) * 100
              : 0,
          expenseCount: data.expenseCount,
          significantOverpayments: data.significantOverpayments,
        };
      }
      return result;
    } catch (error) {
      logger.error('Error getting overpayment by category:', error);
      return {};
    }
  },

  async getMonthlyExpenseHistory(months = 12) {
    try {
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      const now = new Date();

      // Current cycle month: most common dueDate month across fixedExpenses;
      // tie-break = most recent.
      let currentMonth, currentYear;
      if (expenses.length === 0) {
        currentMonth = now.getMonth() + 1;
        currentYear = now.getFullYear();
      } else {
        const countByKey = {};
        const keysWithCounts = [];
        for (const expense of expenses) {
          const d = new Date(expense.dueDate);
          const m = d.getMonth() + 1;
          const y = d.getFullYear();
          const key = `${y}-${m}`;
          countByKey[key] = (countByKey[key] || 0) + 1;
          if (!keysWithCounts.some(([k]) => k === key)) {
            keysWithCounts.push([key, y, m]);
          }
        }
        const maxCount = Math.max(...Object.values(countByKey));
        const tied = keysWithCounts.filter(
          ([key]) => countByKey[key] === maxCount,
        );
        const [_, pickY, pickM] = tied.reduce((best, [k, y, m]) => {
          if (!best) return [k, y, m];
          const [_, by, bm] = best;
          if (y > by) return [k, y, m];
          if (y === by && m > bm) return [k, y, m];
          return best;
        }, null);
        currentMonth = pickM;
        currentYear = pickY;
      }

      // Build list of (month, year) for last N months
      const monthList = [];
      for (let i = 0; i < months; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthList.push({
          month: date.getMonth() + 1,
          year: date.getFullYear(),
        });
      }

      // For completed cycles, load monthlyExpenseHistory once.
      // Current cycle always comes from fixedExpenses only, and any history
      // for that month is ignored by design.
      const historyRecords = await db.monthlyExpenseHistory.toArray();

      const result = monthList.map(({ month, year }) => {
        const isCurrentCycle = month === currentMonth && year === currentYear;

        if (isCurrentCycle) {
          const inMonth = expenses.filter(e => {
            const d = new Date(e.dueDate);
            return d.getMonth() + 1 === month && d.getFullYear() === year;
          });
          let budgetAmount = 0;
          let actualAmount = 0;
          let overpaymentAmount = 0;
          for (const e of inMonth) {
            budgetAmount += e.amount;
            actualAmount += e.paidAmount || 0;
            overpaymentAmount += Math.max(0, (e.paidAmount || 0) - e.amount);
          }
          return {
            month,
            year,
            budgetAmount,
            actualAmount,
            overpaymentAmount,
            expenseCount: inMonth.length,
          };
        }

        const forMonth = historyRecords.filter(
          r => r.month === month && r.year === year,
        );
        const budgetAmount = forMonth.reduce(
          (s, r) => s + (r.budgetAmount || 0),
          0,
        );
        const actualAmount = forMonth.reduce(
          (s, r) => s + (r.actualAmount || 0),
          0,
        );
        const overpaymentAmount = forMonth.reduce(
          (s, r) => s + (r.overpaymentAmount || 0),
          0,
        );
        return {
          month,
          year,
          budgetAmount,
          actualAmount,
          overpaymentAmount,
          expenseCount: forMonth.length,
        };
      });

      // Sort oldest to newest
      result.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      return result;
    } catch (error) {
      logger.error('Error getting monthly expense history:', error);
      return [];
    }
  },

  /**
   * Snapshot paid expense data into monthlyExpenseHistory (for pay cycle reset).
   * Reads fresh from db.fixedExpenses; only expenses with paidAmount > 0 are written.
   * Non-blocking: on failure logs and returns; never throws.
   */
  async snapshotExpensesForMonth() {
    try {
      await db.transaction(
        'rw',
        db.fixedExpenses,
        db.monthlyExpenseHistory,
        async () => {
          const expenses = (await db.fixedExpenses.toArray()).filter(
            e => !e.deletedAt,
          );
          for (const expense of expenses) {
            if ((expense.paidAmount || 0) <= 0) continue;
            const parsed = DateUtils.parseDate(expense.dueDate);
            if (!parsed) {
              logger.warn('Snapshot skipping expense with invalid dueDate', {
                expenseId: expense.id,
              });
              continue;
            }
            const month = parsed.getMonth() + 1;
            const year = parsed.getFullYear();
            const paid = expense.paidAmount || 0;
            const snapTs = nowIso();
            const record = {
              expenseId: expense.id,
              month,
              year,
              budgetAmount: expense.amount,
              actualAmount: paid,
              overpaymentAmount: Math.max(0, paid - expense.amount),
              createdAt: snapTs,
              updatedAt: snapTs,
              deletedAt: null,
            };
            await db.monthlyExpenseHistory.put(record);
          }
        },
      );
    } catch (error) {
      logger.error('Snapshot expenses for month failed', error);
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
        incomeSources: await db.incomeSources.toArray(),
        recurringResolutionLog: await db.recurringResolutionLog.toArray(),

        // Not a table — appearance lives in localStorage because it must be
        // applied before first paint. It rides along so a backup opened on
        // another device looks like the device it came from.
        appearance: getAppearanceSnapshot(),

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
      normalizePaycheckSettings(data);

      // Atomic full-replace import:
      // - Everything is cleared and written inside one IndexedDB transaction.
      // - Any failure aborts the transaction, rolling back the clears/writes.
      // - db.backups is deliberately excluded: backup history is local
      //   infrastructure, not portable user data, and must survive a restore
      //   untouched (see dbHelpers.exportData).
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
        db.incomeSources,
        db.recurringResolutionLog,
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
          await db.incomeSources.clear();
          await db.recurringResolutionLog.clear();

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

          // Income sources reference an account, so they follow accounts.
          await bulkPutChunked(db.incomeSources, data.incomeSources);

          // Resolution log rows reference both a recurring template and a
          // fixed expense (plus optionally a second fixed expense as the
          // adjustment row), so they must follow both of those imports.
          await bulkPutChunked(
            db.recurringResolutionLog,
            data.recurringResolutionLog,
          );
        },
      );

      logger.success('Data imported successfully (atomic transaction)');

      // Appearance is applied only after the transaction has committed. It
      // lives in localStorage, which no IndexedDB transaction can roll back,
      // so writing it earlier would leave a failed import having silently
      // restyled the app while changing none of the data. A backup with no
      // appearance section — every file written before this shipped — is a
      // no-op here and leaves the current theme alone.
      try {
        const applied = applyAppearanceSnapshot(data.appearance);
        if (applied) {
          logger.info('Applied appearance settings from backup', applied);
        }
      } catch (error) {
        // The data landed; a theme that did not is not worth failing over.
        logger.warn('Could not apply appearance settings from backup', error);
      }
    } catch (error) {
      logger.error('Error importing data:', error);
      throw new Error(`Failed to import data: ${error.message}`);
    }
  },

  /**
   * Non-destructive, single-table upsert (CSV merge import). Unlike importData,
   * this never clears any table - only the rows present in `items` are written,
   * matched by id (bulkPut overwrites on matching id, adds otherwise).
   */
  async importSingleTable(tableName, items) {
    try {
      if (!db.tables.map(t => t.name).includes(tableName)) {
        throw new Error(`Unknown table: ${tableName}`);
      }
      if (!Array.isArray(items)) {
        throw new Error(`Expected an array of items for table "${tableName}"`);
      }

      const fkErrors = await validateSingleTableReferences(tableName, items);
      if (fkErrors.length > 0) {
        throw new Error(`Invalid references: ${fkErrors.join(', ')}`);
      }

      await db.transaction('rw', db[tableName], async () => {
        await bulkPutChunked(db[tableName], items);
      });

      logger.success(`Imported ${items.length} row(s) into ${tableName}`);
    } catch (error) {
      logger.error(`Error importing into ${tableName}:`, error);
      throw new Error(`Failed to import ${tableName}: ${error.message}`);
    }
  },

  async saveBackup(backupRecord) {
    const ts = nowIso();
    const row = {
      ...backupRecord,
      id: backupRecord?.id ?? generateId(),
      createdAt: backupRecord?.createdAt ?? ts,
      updatedAt: ts,
      deletedAt: null,
    };
    return await db.backups.add(row);
  },

  async listBackups() {
    const rows = (
      await db.backups.orderBy('timestamp').reverse().toArray()
    ).filter(b => !b.deletedAt);
    return rows;
  },

  async deleteBackupById(id) {
    await db.backups.delete(id);
  },

  async getLatestBackup() {
    return await db.backups.orderBy('timestamp').last();
  },

  async updateLastExportDate(dateString) {
    const all = (await db.userPreferences.toArray()).filter(p => !p.deletedAt);
    const first = all[0];
    const ts = nowIso();
    if (first) {
      await db.userPreferences.update(first.id, {
        lastExportDate: dateString,
        updatedAt: ts,
      });
    } else {
      await db.userPreferences.add({
        id: generateId(),
        component: 'dataManagement',
        preferences: {},
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        lastExportDate: dateString,
      });
    }
  },

  async getLastExportDate() {
    const all = (await db.userPreferences.toArray()).filter(p => !p.deletedAt);
    return all[0]?.lastExportDate ?? null;
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

      // `appearance` is deliberately not validated here. It is cosmetic, and
      // applyAppearanceSnapshot already checks every field independently and
      // ignores what it cannot read. Failing an otherwise-good import of real
      // financial data over a malformed colour would be the wrong trade.

      // Optional arrays: if present, must be arrays.
      const optionalArrayFields = [
        'paycheckSettings',
        'userPreferences',
        'monthlyExpenseHistory',
        'auditLogs',
        'recurringExpenseTemplates',
        'backups',
        'incomeSources',
        'recurringResolutionLog',
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

      // Balance sanity checks - a corrupted or hand-edited backup should be
      // rejected here rather than silently written to IndexedDB.
      data.accounts.forEach((account, idx) => {
        if (!Number.isFinite(account?.currentBalance)) {
          errors.push(
            `accounts[${idx}]: currentBalance must be a finite number (got ${account?.currentBalance})`,
          );
        }
      });
      data.creditCards.forEach((card, idx) => {
        if (!Number.isFinite(card?.balance)) {
          errors.push(
            `creditCards[${idx}]: balance must be a finite number (got ${card?.balance})`,
          );
        }
      });

      if (errors.length > 0) {
        return { isValid: false, errors };
      }

      // Basic referential integrity checks (fail-fast)
      const toRefId = value => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim();
        }
        return null;
      };

      const accountIds = new Set(
        (data.accounts || []).map(a => toRefId(a?.id)).filter(Boolean),
      );
      const creditCardIds = new Set(
        (data.creditCards || []).map(c => toRefId(c?.id)).filter(Boolean),
      );
      const templateIds = new Set(
        (data.recurringExpenseTemplates || [])
          .map(t => toRefId(t?.id))
          .filter(Boolean),
      );

      // Pending transactions must reference an account
      for (const [idx, txn] of (data.pendingTransactions || []).entries()) {
        const accountId = toRefId(txn?.accountId);
        if (!accountId || !accountIds.has(accountId)) {
          errors.push(
            `pendingTransactions[${idx}]: invalid accountId (${txn?.accountId})`,
          );
        }
      }

      // An income source that names an account must name a real one. A null
      // accountId is fine - that's an un-configured source.
      for (const [idx, source] of (data.incomeSources || []).entries()) {
        const accountId = toRefId(source?.accountId);
        if (accountId && !accountIds.has(accountId)) {
          errors.push(
            `incomeSources[${idx}]: invalid accountId (${source?.accountId})`,
          );
        }
      }

      const hasValue = v => v !== null && v !== undefined && v !== '';

      // Fixed expenses must reference exactly one payment source, and valid IDs
      for (const [idx, exp] of (data.fixedExpenses || []).entries()) {
        const accountId = toRefId(exp?.accountId);
        const creditCardId = toRefId(exp?.creditCardId);
        const targetCreditCardId = toRefId(exp?.targetCreditCardId);
        const recurringTemplateId = toRefId(exp?.recurringTemplateId);

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
        const accountId = toRefId(tpl?.accountId);
        const creditCardId = toRefId(tpl?.creditCardId);
        const targetCreditCardId = toRefId(tpl?.targetCreditCardId);

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

      // Resolution log rows must reference a real template and a real
      // expense. adjustmentExpenseId is optional - a Skip resolution creates
      // no Balance Due row, so it's legitimately null/undefined there.
      const fixedExpenseIds = new Set(
        (data.fixedExpenses || []).map(e => toRefId(e?.id)).filter(Boolean),
      );
      for (const [idx, entry] of (
        data.recurringResolutionLog || []
      ).entries()) {
        const templateId = toRefId(entry?.templateId);
        const expenseId = toRefId(entry?.expenseId);
        const adjustmentExpenseId = toRefId(entry?.adjustmentExpenseId);

        if (!templateId || !templateIds.has(templateId)) {
          errors.push(
            `recurringResolutionLog[${idx}]: invalid templateId (${entry?.templateId})`,
          );
        }
        if (!expenseId || !fixedExpenseIds.has(expenseId)) {
          errors.push(
            `recurringResolutionLog[${idx}]: invalid expenseId (${entry?.expenseId})`,
          );
        }
        if (adjustmentExpenseId && !fixedExpenseIds.has(adjustmentExpenseId)) {
          errors.push(
            `recurringResolutionLog[${idx}]: invalid adjustmentExpenseId (${entry?.adjustmentExpenseId})`,
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
      const logs = (await db.auditLogs.toArray()).filter(l => !l.deletedAt);
      return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      return [];
    }
  },

  async addAuditLog(actionType, entityType, entityId, details = {}) {
    try {
      await addAuditLogEntry(actionType, entityType, entityId, details);
      void this.trimAuditLogs();
    } catch (error) {
      logger.error('Error adding audit log:', error);
    }
  },

  async trimAuditLogs() {
    try {
      const count = await db.auditLogs.count();
      if (count <= MAX_AUDIT_LOG_ENTRIES) return;
      const all = await db.auditLogs.orderBy('timestamp').toArray();
      const toDelete = all.slice(0, count - MAX_AUDIT_LOG_ENTRIES);
      const ids = toDelete.map(e => e.id);
      await db.auditLogs.bulkDelete(ids);
    } catch (error) {
      logger.warn('Failed to trim audit logs', error);
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
            monthlyInterest: interestPayment,
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
        const ts = nowIso();
        await db.paycheckSettings.add({
          id: generateId(),
          lastPaycheckDate: '',
          frequency: DEFAULT_PAY_FREQUENCY,
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
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

      const categoryId =
        sanitizedData.categoryId ??
        (await resolveCategoryIdByName(sanitizedData.category));
      const ts = nowIso();
      const row = {
        ...sanitizedData,
        id: generateId(),
        categoryId: categoryId ?? null,
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
      };
      await db.fixedExpenses.add(row);

      logger.success(`Added V4 expense: ${sanitizedData.name}`);
      return row.id;
    } catch (error) {
      logger.error('Error adding V4 expense:', error);
      throw error;
    }
  },

  /**
   * Update fixed expense with V4 validation (dual foreign key)
   *
   * @param {string} id - Expense ID to update
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
      if (!currentExpense || currentExpense.deletedAt) {
        throw new Error(`Expense with ID ${id} not found`);
      }

      // Merge current data with updates and validate
      const updatedExpense = { ...currentExpense, ...updates };
      const sanitizedData = sanitizeExpenseData(updatedExpense);
      validateExpense(sanitizedData, options);

      // Only update the fields that were actually changed
      const sanitizedUpdates = pickSanitizedUpdates(sanitizedData, updates);
      if (Object.prototype.hasOwnProperty.call(updates, 'category')) {
        sanitizedUpdates.categoryId =
          updates.categoryId !== undefined
            ? updates.categoryId
            : await resolveCategoryIdByName(updates.category);
      }
      await db.fixedExpenses.update(id, {
        ...sanitizedUpdates,
        updatedAt: nowIso(),
      });

      // Sync due date to credit card when a CC payment expense due date changes
      if (
        sanitizedUpdates.dueDate !== undefined &&
        currentExpense.targetCreditCardId
      ) {
        await this.updateCreditCard(currentExpense.targetCreditCardId, {
          dueDate: sanitizedUpdates.dueDate,
        });
      }

      // Sync funding account to template and linked expenses when CC payment accountId changes
      if (
        sanitizedUpdates.accountId !== undefined &&
        currentExpense.category === 'Credit Card Payment' &&
        currentExpense.recurringTemplateId &&
        currentExpense.targetCreditCardId
      ) {
        await this.updateFundingAccountForCard(
          currentExpense.targetCreditCardId,
          sanitizedUpdates.accountId,
        );
      }

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
   * @param {string} expenseId - Expense ID to update
   * @param {Object} updates - Fields to update (must include paidAmount)
   * @param {Object} [options={}] - Optional validation options for validateExpense
   */
  async applyExpensePaymentChangeAtomic(expenseId, updates, options = {}) {
    if (!updates || typeof updates.paidAmount !== 'number') {
      throw new Error(
        'applyExpensePaymentChangeAtomic requires numeric paidAmount',
      );
    }

    const paidAmountCheck = validatePaidAmount(updates.paidAmount);
    if (!paidAmountCheck.isValid) {
      throw new Error(paidAmountCheck.error);
    }

    // Import validators outside the transaction callback to avoid IndexedDB
    // transaction inactivity across non-DB awaits.
    const { validateExpense, sanitizeExpenseData } = await import(
      '../utils/expenseValidation'
    );

    // Note: this function no longer advances a recurring template's
    // cadence, even when the payment reaches the full amount. That's
    // resolveCycle's job now (see below) - it's the only path that should
    // ever move a template's nextDueDate forward, so "was this cycle
    // resolved" always has exactly one source of truth (the
    // recurringResolutionLog), not two different call paths that could
    // disagree. A recurring-template expense should be paid through
    // resolveCycle, not this function directly; this function still
    // handles one-off expenses (including Balance Due, which is just a
    // normal one-off) exactly as before.
    const result = await db.transaction(
      'rw',
      db.fixedExpenses,
      db.accounts,
      db.creditCards,
      db.auditLogs,
      async () => {
        const currentExpense = await db.fixedExpenses.get(expenseId);
        if (!currentExpense || currentExpense.deletedAt) {
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
        const sanitizedUpdates = pickSanitizedUpdates(
          sanitizeExpenseData({ ...updatedExpense, ...updatesWithDerived }),
          updatesWithDerived,
        );
        const ts = nowIso();
        await db.fixedExpenses.update(expenseId, {
          ...sanitizedUpdates,
          updatedAt: ts,
        });

        // No balance change needed.
        if (paymentDifference === 0) {
          return {};
        }

        await applyPaymentDelta(
          sanitizedExpense,
          paymentDifference,
          expenseId,
          ts,
        );
        return {};
      },
    );
    void this.trimAuditLogs();

    return result;
  },

  /**
   * Resolve a recurring template's current cycle: Pay Full, Partial, or
   * Skip. Skip is simply paidAmount: 0 - same path, same rules, not a
   * separate mechanism. Any resolution - full, partial, or skip -
   * advances the template's cadence immediately; it never waits for a
   * full payment the way the old fast path inside
   * applyExpensePaymentChangeAtomic used to.
   *
   * A shortfall (paidAmount less than the cycle's committed amount) never
   * silently assumes what it means - the caller must say whether the
   * shortfall is 'deferred' (still owed, just later - spins off a Balance
   * Due due-dated at the user's next paycheck, or today if no paycheck is
   * configured) or 'forgiven' (no longer owed at all - no Balance Due is
   * created). A deferred Balance Due is a normal one-off fixedExpenses
   * row that inherits the origin bill's
   * category/accountId/creditCardId/targetCreditCardId verbatim - this is
   * what makes a deferred credit-card payment's Balance Due correctly
   * reduce the card's tracked balance when it's eventually paid, since
   * only an expense carrying that category/link goes through the
   * credit-card branch of applyPaymentDelta. Forgiving a shortfall can
   * also pause the template atomically (see pauseTemplateOnForgive) - the
   * two are folded into one transaction so a failure never leaves a
   * forgiven cycle with the template still silently active.
   *
   * Writes a recurringResolutionLog row as a HARD write inside the same
   * transaction as the payment/balance mutation and the cadence advance -
   * unlike the best-effort audit log below, a failure here must abort the
   * whole transaction, since this table is the source of truth for Undo
   * and Payment History, not a trace.
   *
   * @param {string} expenseId - the real, currently-pending row for this
   *   template's current cycle
   * @param {Object} params
   * @param {number} params.paidAmount - amount being paid now (0 for Skip)
   * @param {'deferred'|'forgiven'} [params.shortfallOutcome] - required
   *   when paidAmount leaves a shortfall; illegal when it doesn't
   * @param {boolean} [params.pauseTemplateOnForgive] - only legal
   *   alongside shortfallOutcome: 'forgiven'; pauses the template in the
   *   same transaction
   * @returns {Promise<{logId: string, adjustmentExpenseId: string|null, templateId: string}>}
   */
  async resolveCycle(
    expenseId,
    { paidAmount, shortfallOutcome = null, pauseTemplateOnForgive = false },
  ) {
    const paidAmountCheck = validatePaidAmount(paidAmount);
    if (!paidAmountCheck.isValid) {
      throw new Error(paidAmountCheck.error);
    }
    if (
      shortfallOutcome !== null &&
      shortfallOutcome !== 'deferred' &&
      shortfallOutcome !== 'forgiven'
    ) {
      throw new Error(
        'shortfallOutcome must be "deferred", "forgiven", or omitted',
      );
    }
    if (pauseTemplateOnForgive && shortfallOutcome !== 'forgiven') {
      throw new Error(
        'pauseTemplateOnForgive is only valid alongside shortfallOutcome: "forgiven"',
      );
    }

    // Hoisted above the transaction for the same reason
    // applyExpensePaymentChangeAtomic and createExpenseForCard do this: a
    // dynamic import mid-transaction can throw TransactionInactiveError.
    const { validateExpense, sanitizeExpenseData } = await import(
      '../utils/expenseValidation'
    );

    const result = await db.transaction(
      'rw',
      db.fixedExpenses,
      db.accounts,
      db.creditCards,
      db.auditLogs,
      db.recurringExpenseTemplates,
      db.recurringResolutionLog,
      db.paycheckSettings,
      async () => {
        const expense = await db.fixedExpenses.get(expenseId);
        if (!expense || expense.deletedAt) {
          throw new Error(`Expense with ID ${expenseId} not found`);
        }
        if (!expense.recurringTemplateId) {
          throw new Error(
            'resolveCycle requires a recurring-template expense; use applyExpensePaymentChangeAtomic (via updateExpenseV4) for one-offs and Balance Due',
          );
        }

        const template = await db.recurringExpenseTemplates.get(
          expense.recurringTemplateId,
        );
        if (!template) {
          throw new Error(`Template not found: ${expense.recurringTemplateId}`);
        }

        const committedAmount = Number(expense.amount || 0);

        // Partial payment is disabled entirely for variable-amount bills -
        // only Full or Skip are ever legal here, enforced at the DB layer
        // too, not just hidden in the UI.
        if (
          template.isVariableAmount &&
          paidAmount !== 0 &&
          paidAmount !== committedAmount
        ) {
          throw new Error(
            'Partial payment is not available for variable-amount bills',
          );
        }
        if (paidAmount > committedAmount) {
          throw new Error('paidAmount cannot exceed the committed amount');
        }

        const previousPaidAmount = Number(expense.paidAmount || 0);
        const paymentDifference = paidAmount - previousPaidAmount;
        const ts = nowIso();
        const newStatus =
          committedAmount > 0 && paidAmount >= committedAmount
            ? 'paid'
            : 'pending';

        const sanitizedExpense = sanitizeExpenseData({
          ...expense,
          paidAmount,
          status: newStatus,
        });
        validateExpense(sanitizedExpense);

        await db.fixedExpenses.update(expenseId, {
          paidAmount,
          status: newStatus,
          updatedAt: ts,
        });

        if (paymentDifference !== 0) {
          await applyPaymentDelta(
            sanitizedExpense,
            paymentDifference,
            expenseId,
            ts,
          );
        }

        // Shortfall never silently means "owed today" - the caller must
        // say whether it's deferred (still owed, later) or forgiven (not
        // owed at all). See resolveCycle's own docstring.
        let adjustmentExpenseId = null;
        let deferredDueDate = null;
        const shortfall = committedAmount - paidAmount;
        if (shortfall > 0.004) {
          if (shortfallOutcome === null) {
            throw new Error(
              'shortfallOutcome ("deferred" or "forgiven") is required when paidAmount leaves a shortfall',
            );
          }
          if (shortfallOutcome === 'deferred') {
            deferredDueDate = DateUtils.today();
            const paycheckRows = await db.paycheckSettings.toArray();
            const settings = paycheckRows.find(s => !s.deletedAt) || null;
            if (settings?.lastPaycheckDate) {
              const { nextPayDate } = calculateNextPayDates(
                settings.lastPaycheckDate,
                settings.frequency,
              );
              if (nextPayDate) {
                deferredDueDate = nextPayDate;
              }
            }

            const balanceDueData = sanitizeExpenseData({
              name: `${expense.name} (Balance Due)`,
              dueDate: deferredDueDate,
              amount: shortfall,
              accountId: expense.accountId || null,
              creditCardId: expense.creditCardId || null,
              targetCreditCardId: expense.targetCreditCardId || null,
              category: expense.category,
              categoryId: expense.categoryId ?? null,
              paidAmount: 0,
              status: 'pending',
              recurringTemplateId: null,
              isAutoCreated: true,
            });
            validateExpense(balanceDueData);
            adjustmentExpenseId = generateId();
            await db.fixedExpenses.add({
              ...balanceDueData,
              id: adjustmentExpenseId,
              createdAt: ts,
              updatedAt: ts,
              deletedAt: null,
            });
          }

          // 'forgiven': no Balance Due row at all - adjustmentExpenseId
          // stays null.
        } else if (shortfallOutcome !== null) {
          throw new Error(
            'shortfallOutcome must not be provided when there is no shortfall',
          );
        }

        // Advance cadence unconditionally - Full, Partial, and Skip all
        // advance. This is the core behavior change from the old
        // full-payment-only fast path.
        const previousNextDueDate = template.nextDueDate;
        const previousLastGenerated = template.lastGenerated;
        let nextDueToSet = null;
        let shouldDeactivate = false;
        if (previousNextDueDate) {
          const newNextDueDate = calculateNextDueDate(
            previousNextDueDate,
            template.frequency,
            template.intervalValue || 1,
            template.intervalUnit || 'months',
          );
          nextDueToSet = newNextDueDate;
          if (template.endDate) {
            const endDate = DateUtils.parseDate(template.endDate);
            const nextDue = DateUtils.parseDate(newNextDueDate);
            if (endDate && nextDue && nextDue > endDate) {
              shouldDeactivate = true;
              nextDueToSet = null;
            }
          }
        }

        // Pausing on forgive is folded into this same atomic update and
        // the same transaction as everything else here - a separate
        // follow-up call from the UI could fail independently and leave
        // a forgiven cycle with the template still silently active.
        const shouldPauseForForgive =
          shortfallOutcome === 'forgiven' && pauseTemplateOnForgive === true;
        await this.updateRecurringExpenseTemplate(template.id, {
          lastGenerated: previousNextDueDate,
          nextDueDate: nextDueToSet,
          ...((shouldDeactivate || shouldPauseForForgive) && {
            isActive: false,
          }),
        });

        // HARD write - no try/catch swallow, unlike the audit log below.
        // A failure here must abort the whole transaction.
        const logId = generateId();
        await db.recurringResolutionLog.add({
          id: logId,
          templateId: template.id,
          expenseId,
          cycleDueDate: expense.dueDate,
          resolvedAt: ts,
          committedAmount,
          paidAmount,
          wasSkipped: paidAmount === 0,
          adjustmentExpenseId,
          shortfallOutcome,
          deferredDueDate,
          templatePausedOnForgive: shouldPauseForForgive,
          previousNextDueDate,
          previousLastGenerated,
          previousExpensePaidAmount: previousPaidAmount,
          previousExpenseStatus: expense.status,
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
        });

        try {
          await addAuditLogEntry('RESOLVE_CYCLE', 'fixedExpense', expenseId, {
            templateId: template.id,
            paidAmount,
            committedAmount,
            adjustmentExpenseId,
            shortfallOutcome,
            templatePausedOnForgive: shouldPauseForForgive,
          });
        } catch (auditErr) {
          logger.warn('Audit log (resolve cycle) failed:', auditErr);
        }

        return { logId, adjustmentExpenseId, templateId: template.id };
      },
    );

    void this.trimAuditLogs();

    // Best-effort, outside the transaction - idempotent/upsert by design,
    // safe to call on every resolution rather than only on a manual reset.
    try {
      await this.snapshotExpensesForMonth();
    } catch (snapshotErr) {
      logger.warn('Snapshot after resolveCycle failed:', snapshotErr);
    }

    return result;
  },

  /**
   * Every non-deleted (not undone) resolution log entry, across every
   * template. Read-only, for UI code that needs to know which expense ids
   * are "already resolved" (should stop showing as actionable) and which
   * expense ids are "a spun-off Balance Due" (should get its own badge) -
   * see FixedExpenses.jsx for how these two derived sets get built and
   * passed down.
   * @returns {Promise<Array>}
   */
  async getRecurringResolutionLogEntries() {
    return db.recurringResolutionLog.filter(e => !e.deletedAt).toArray();
  },

  /**
   * The Virtual Ledger for one template within [rangeStart, rangeEnd] -
   * every cycle classified resolved/pending/virtual (see
   * src/utils/virtualLedger.js for what each means), each entry enriched
   * with the template itself so a caller has name/category/etc without a
   * second fetch. The one place "what does this cadence imply" gets
   * computed for display purposes - Calendar's forecast (virtual entries
   * in a future window) and the past_month nudge's gap detection (virtual
   * entries in a past window) are both thin filters over this same
   * result, not separate computations.
   * @param {string} templateId
   * @param {string} rangeStart - YYYY-MM-DD, inclusive
   * @param {string} rangeEnd - YYYY-MM-DD, inclusive
   * @returns {Promise<Array>}
   */
  async getVirtualLedger(templateId, rangeStart, rangeEnd) {
    const template = await db.recurringExpenseTemplates.get(templateId);
    if (!template || template.deletedAt) return [];

    const [resolutionLogEntries, realExpenses] = await Promise.all([
      db.recurringResolutionLog
        .where('templateId')
        .equals(templateId)
        .toArray(),
      db.fixedExpenses
        .where('recurringTemplateId')
        .equals(templateId)
        .toArray(),
    ]);
    const estimatedAmount = await computeTemplateCycleAmount(template);

    return computeCycleStates(template, {
      resolutionLogEntries,
      realExpenses,
      rangeStart,
      rangeEnd,
      estimatedAmount,
    }).map(entry => ({ ...entry, template }));
  },

  /**
   * Read-only: the most recent non-deleted recurringResolutionLog entry
   * for a template, if it's currently undoable (not blocked by a settled
   * Balance Due). Backs both an Undo button's enabled state and its
   * confirmation copy.
   * @param {string} templateId
   * @returns {Promise<{entry: Object, blockedReason: string|null}|null>}
   */
  async getLastUndoableResolution(templateId) {
    const entries = await db.recurringResolutionLog
      .where('templateId')
      .equals(templateId)
      .filter(e => !e.deletedAt)
      .toArray();
    if (entries.length === 0) return null;

    entries.sort((a, b) => (b.resolvedAt > a.resolvedAt ? 1 : -1));
    const entry = entries[0];

    let blockedReason = null;
    if (entry.adjustmentExpenseId) {
      const balanceDue = await db.fixedExpenses.get(entry.adjustmentExpenseId);
      if (balanceDue && Number(balanceDue.paidAmount || 0) > 0) {
        blockedReason =
          'The Balance Due this created already has a payment on it';
      }
    }

    return { entry, blockedReason };
  },

  /**
   * Undo a template's single most recent resolution (Pay Full / Partial /
   * Skip) - LIFO, one step, the same rule undo follows anywhere else in
   * the app. Blocked if the Balance Due it created has already been paid
   * against, since undoing would erase a real payment. Reverses the
   * payment/balance delta, restores the row's prior status, soft-deletes
   * the Balance Due it created (if any), restores the template's cadence
   * from the entry's own snapshot, and soft-deletes the log entry itself
   * (never hard-deleted, so history stays inspectable).
   * @param {string} templateId
   */
  async undoLastResolution(templateId) {
    const candidateInfo = await this.getLastUndoableResolution(templateId);
    if (!candidateInfo) {
      throw new Error('Nothing to undo for this template');
    }
    if (candidateInfo.blockedReason) {
      throw new Error(candidateInfo.blockedReason);
    }
    const candidate = candidateInfo.entry;

    return db.transaction(
      'rw',
      db.fixedExpenses,
      db.accounts,
      db.creditCards,
      db.auditLogs,
      db.recurringExpenseTemplates,
      db.recurringResolutionLog,
      async () => {
        const expense = await db.fixedExpenses.get(candidate.expenseId);
        const ts = nowIso();

        if (expense) {
          const reverseDelta =
            candidate.previousExpensePaidAmount -
            Number(expense.paidAmount || 0);
          if (reverseDelta !== 0) {
            await applyPaymentDelta(
              { ...expense, paidAmount: candidate.previousExpensePaidAmount },
              reverseDelta,
              candidate.expenseId,
              ts,
            );
          }
          await db.fixedExpenses.update(candidate.expenseId, {
            paidAmount: candidate.previousExpensePaidAmount,
            status: candidate.previousExpenseStatus,
            updatedAt: ts,
          });
        }

        if (candidate.adjustmentExpenseId) {
          await db.fixedExpenses.update(candidate.adjustmentExpenseId, {
            deletedAt: ts,
            updatedAt: ts,
          });
        }

        // Undoing a resolution can only ever un-deactivate a template
        // (resolving a cycle requires it to have been active beforehand),
        // never deactivate one. This also correctly un-pauses a template
        // that resolveCycle paused via templatePausedOnForgive - no
        // separate handling needed, since it was active when this
        // resolution began either way.
        await this.updateRecurringExpenseTemplate(templateId, {
          nextDueDate: candidate.previousNextDueDate,
          lastGenerated: candidate.previousLastGenerated,
          isActive: true,
        });

        await db.recurringResolutionLog.update(candidate.id, {
          deletedAt: ts,
          updatedAt: ts,
        });

        try {
          await addAuditLogEntry(
            'UNDO_RESOLVE_CYCLE',
            'fixedExpense',
            candidate.expenseId,
            { templateId, logId: candidate.id },
          );
        } catch (auditErr) {
          logger.warn('Audit log (undo resolve cycle) failed:', auditErr);
        }

        return { undone: candidate.id };
      },
    );
  },

  /**
   * Get fixed expense by ID (V4 compatible)
   */
  async getFixedExpenseV4(id) {
    try {
      const expense = await db.fixedExpenses.get(id);
      if (!expense || expense.deletedAt) {
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
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
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
        if (!account || account.deletedAt) {
          throw new Error(`Account with ID ${expense.accountId} not found`);
        }
      }

      if (expense.creditCardId) {
        const creditCard = await db.creditCards.get(expense.creditCardId);
        if (!creditCard || creditCard.deletedAt) {
          throw new Error(
            `Credit card with ID ${expense.creditCardId} not found`,
          );
        }
      }

      if (expense.targetCreditCardId) {
        const targetCreditCard = await db.creditCards.get(
          expense.targetCreditCardId,
        );
        if (!targetCreditCard || targetCreditCard.deletedAt) {
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
   * Audit expenses to check for legacy format issues
   * Identifies expenses that need migration to V4 format
   *
   * @returns {Object} Audit report with findings
   */
  async auditExpenseFormat() {
    try {
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      const accounts = (await db.accounts.toArray()).filter(a => !a.deletedAt);
      const creditCards = (await db.creditCards.toArray()).filter(
        c => !c.deletedAt,
      );

      const accountIds = new Set(accounts.map(acc => acc.id));
      const creditCardIds = new Set(creditCards.map(card => card.id));

      const report = {
        totalExpenses: expenses.length,
        issues: {
          accountIdMatchesCreditCard: [],
          missingCreditCardId: [],
          bothFieldsSet: [],
          noPaymentSource: [],
        },
        summary: {},
      };

      expenses.forEach(expense => {
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

        // accountId holds a credit card ID (should be in creditCardId instead)
        if (
          expense.accountId &&
          !expense.creditCardId &&
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

        // accountId does not reference any account or card
        if (
          expense.accountId &&
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
          report.issues.noPaymentSource.length,
        accountIdMatchesCreditCard:
          report.issues.accountIdMatchesCreditCard.length,
        missingCreditCardId: report.issues.missingCreditCardId.length,
        bothFieldsSet: report.issues.bothFieldsSet.length,
        noPaymentSource: report.issues.noPaymentSource.length,
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
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      const accounts = (await db.accounts.toArray()).filter(a => !a.deletedAt);
      const creditCards = (await db.creditCards.toArray()).filter(
        c => !c.deletedAt,
      );

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

          // accountId is a credit card ID: move to creditCardId
          if (
            expense.accountId &&
            !expense.creditCardId &&
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

import { dbHelpers } from '../db/database-clean';
import {
  validatePaymentSource,
  validateCreditCardPayment,
  validateLoanPayment,
  sanitizeExpenseData,
} from '../utils/expenseValidation';
import { logger } from '../utils/logger';
import { parseMoneyInput } from '../utils/validation';

// Money columns per CSV table. A row whose money cell can't be parsed is
// skipped and reported rather than imported with a substituted value.
const CSV_MONEY_FIELDS = {
  accounts: ['currentBalance'],
  pendingTransactions: ['amount'],
  fixedExpenses: ['amount', 'paidAmount'],
  recurringExpenseTemplates: ['baseAmount'],
  incomeSources: ['expectedAmount'],
  loans: ['balance', 'unpaidInterest'],
  creditCards: ['balance', 'creditLimit', 'minimumPayment'],
};

// Export/import data-format version - distinct from the Dexie schema version
// in database-clean.js (this gates the JSON/backup file contract, not the
// IndexedDB structure). Review this whenever a schema change alters that
// contract (e.g. the V8 migration to UUID string ids, which this constant
// was never bumped for).
// 7 adds the `appearance` object (glass tint, ambient strength, ambient
// colours). It is additive and optional: a version 6 file imports fine and
// simply leaves the current theme alone.
// 8 adds `recurringResolutionLog` (Undo / Payment History for the recurring
// "resolve cycle" flow). It is additive and optional: a version 7 file
// imports fine and simply starts with no resolution history.
// 9 adds `loans` (installment-debt tracking, mirroring creditCards). It is
// additive and optional: a version 8 file imports fine and simply starts
// with no loans.
// 10 adds real-interest-tracking fields to `loans` (unpaidInterest,
// interestAccruedThrough, interestStateVersion, lastInterestOperation). It
// is additive and optional: a version 9 file imports fine and its loans
// simply stay untracked (interestAccruedThrough absent/null).
const CURRENT_DATA_VERSION = 10;

/**
 * Normalize version to number for comparison
 * Handles both string ('2.0') and number (4) formats
 * @param {string|number} version - Version to normalize
 * @returns {number} Normalized version number
 */
function normalizeVersion(version) {
  if (typeof version === 'number') {
    return version;
  }
  if (typeof version === 'string') {
    // Extract major version number from '2.0' format
    const majorVersion = parseInt(version.split('.')[0], 10);
    if (!isNaN(majorVersion)) {
      return majorVersion;
    }
  }

  // Default to 0 if version is invalid
  return 0;
}

class DataManager {
  constructor() {
    this.backupManager = new BackupManager();
    this.initializeBackupSystem();
  }

  /**
   * Initialize the backup system with automatic scheduling and optional localStorage migration
   */
  initializeBackupSystem() {
    try {
      void this.backupManager.catchUpMissedBackup();
      this.backupManager.scheduleAutomaticBackups();

      const keys = Object.keys(localStorage).filter(k =>
        k.startsWith(BACKUP_PREFIX),
      );
      if (keys.length > 0) {
        this.migrateLocalStorageBackups(keys).catch(err => {
          logger.warn('LocalStorage backup migration failed:', err);
        });
      }

      logger.info('Backup system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize backup system:', error);
    }
  }

  /**
   * One-time migration: copy backups from localStorage to IndexedDB, then remove from localStorage
   */
  async migrateLocalStorageBackups(keys) {
    let migrated = 0;
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const backup = JSON.parse(raw);
        if (
          !backup.data ||
          !backup.checksum ||
          !backup.reason ||
          !backup.timestamp ||
          backup.version == null
        ) {
          logger.warn(`Skipping invalid backup at ${key}`);
          continue;
        }
        await dbHelpers.saveBackup({
          reason: backup.reason,
          timestamp: backup.timestamp,
          version: backup.version,
          createdAt: backup.timestamp || new Date().toISOString(),
          data: backup.data,
          checksum: backup.checksum,
        });
        localStorage.removeItem(key);
        migrated++;
      } catch (err) {
        logger.warn(`Failed to migrate backup ${key}:`, err);
      }
    }
    if (migrated > 0) {
      logger.success(
        `Migrated ${migrated} backup(s) from localStorage to IndexedDB`,
      );
    }
  }

  // Database Management
  async clearAllData(createBackup = true) {
    try {
      if (createBackup) {
        await this.backupManager.createBackup('pre_clear_all');
      }

      await dbHelpers.clearDatabase();
      await dbHelpers.initializeDefaultCategories(); // Reinitialize default categories

      logger.success('All data cleared successfully');
    } catch (error) {
      logger.error('Error clearing all data:', error);
      throw new Error(`Failed to clear all data: ${error.message}`);
    }
  }

  // Audit Log Management
  async getAuditLogs() {
    try {
      return await dbHelpers.getAuditLogs();
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }
  }

  async clearAuditLogs() {
    try {
      await dbHelpers.clearAuditLogs();
      logger.success('Audit logs cleared successfully');
    } catch (error) {
      logger.error('Error clearing audit logs:', error);
      throw new Error(`Failed to clear audit logs: ${error.message}`);
    }
  }

  // File Reading and Validation
  async readImportFile(file) {
    try {
      const text = await file.text();
      const fileType = file.name.toLowerCase().endsWith('.json')
        ? 'json'
        : 'csv';

      if (fileType === 'json') {
        return { data: await this.parseAndValidateJSON(text), fileType };
      }

      const { data, skipped } = await this.parseAndValidateCSV(text);
      return { data, fileType, skipped };
    } catch (error) {
      logger.error('Error reading import file:', error);
      throw new Error(`Failed to read import file: ${error.message}`);
    }
  }

  async parseAndValidateJSON(text) {
    try {
      const data = JSON.parse(text);

      // Check data format version using normalized comparison
      if (data.version) {
        const normalizedVersion = normalizeVersion(data.version);
        if (normalizedVersion > CURRENT_DATA_VERSION) {
          throw new Error(
            `Data format version ${data.version} is not supported. Current version: ${CURRENT_DATA_VERSION}`,
          );
        }

        // Log version migration scenario
        if (normalizedVersion < CURRENT_DATA_VERSION) {
          logger.info(
            `Importing data from version ${data.version}, will migrate to version ${CURRENT_DATA_VERSION}`,
          );
        }
      }

      // Validate data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format: expected an object');
      }

      return data;
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
  }

  async parseAndValidateCSV(text) {
    try {
      const Papa = await import('papaparse');
      const result = Papa.parse(text, { header: true });

      if (result.errors && result.errors.length > 0) {
        throw new Error(
          `CSV parsing errors: ${result.errors.map(e => e.message).join(', ')}`,
        );
      }

      if (!result.data || result.data.length === 0) {
        throw new Error('CSV file is empty or has no valid data');
      }

      return this.detectAndConvertCSVData(result.data);
    } catch (error) {
      throw new Error(`Invalid CSV format: ${error.message}`);
    }
  }

  detectAndConvertCSVData(csvData) {
    const firstRow = csvData[0] || {};
    const headers = Object.keys(firstRow);

    const convert = tableName => {
      const { rows, skipped } = this.convertCSVData(csvData, tableName);
      return { data: { [tableName]: rows }, skipped };
    };

    // Detect data type from headers
    if (
      headers.includes('name') &&
      headers.includes('type') &&
      headers.includes('currentBalance')
    ) {
      return convert('accounts');
    }
    if (
      headers.includes('accountId') &&
      headers.includes('amount') &&
      headers.includes('description')
    ) {
      return convert('pendingTransactions');
    }
    if (
      headers.includes('dueDate') &&
      headers.includes('amount') &&
      headers.includes('name')
    ) {
      return convert('fixedExpenses');
    }
    if (headers.includes('name') && headers.includes('color')) {
      return convert('categories');
    }
    if (headers.includes('lastPaycheckDate') && headers.includes('frequency')) {
      return convert('paycheckSettings');
    }
    if (
      headers.includes('name') &&
      headers.includes('baseAmount') &&
      headers.includes('frequency') &&
      headers.includes('startDate')
    ) {
      return convert('recurringExpenseTemplates');
    }

    throw new Error('Could not detect CSV data type from headers');
  }

  convertCSVData(csvData, dataType) {
    const moneyFields = CSV_MONEY_FIELDS[dataType] || [];
    const rows = [];
    const skipped = [];

    csvData.forEach((row, index) => {
      const converted = { ...row };

      // Parse money cells first: a cell we can't read is a row we refuse to
      // import, rather than one we quietly turn into 0.
      let rejected = null;
      for (const field of moneyFields) {
        const parsed = parseMoneyInput(row[field], {
          // A blank paidAmount legitimately means "nothing paid yet".
          allowEmpty: field === 'paidAmount',
        });
        if (!parsed.ok) {
          // +2: row 1 of the file is the header, so data row 0 is line 2.
          rejected = { line: index + 2, field, reason: parsed.reason };
          break;
        }
        converted[field] = parsed.value;
      }
      if (rejected) {
        skipped.push(rejected);
        return;
      }

      switch (dataType) {
        case 'accounts':
          converted.isDefault =
            row.isDefault === 'true' ||
            row.isDefault === '1' ||
            row.isDefault === 'Yes';
          break;
        case 'pendingTransactions':
          converted.accountId = row.accountId;
          converted.createdAt = row.createdAt
            ? new Date(row.createdAt).toISOString()
            : new Date().toISOString();
          break;
        case 'fixedExpenses':
          // V4 format: handle both accountId and creditCardId
          converted.accountId = row.accountId || null;
          converted.creditCardId = row.creditCardId || null;
          converted.targetCreditCardId = row.targetCreditCardId || null;
          converted.targetLoanId = row.targetLoanId || null;
          converted.dueDate = row.dueDate
            ? new Date(row.dueDate).toISOString().split('T')[0]
            : '';
          break;
        case 'categories':
          converted.isDefault =
            row.isDefault === 'true' ||
            row.isDefault === '1' ||
            row.isDefault === 'Yes';
          break;
        case 'paycheckSettings':
          // Ensure date is in YYYY-MM-DD format
          if (row.lastPaycheckDate) {
            const date = new Date(row.lastPaycheckDate);
            if (!isNaN(date.getTime())) {
              converted.lastPaycheckDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            } else {
              converted.lastPaycheckDate = '';
            }
          } else {
            converted.lastPaycheckDate = '';
          }
          break;
        case 'recurringExpenseTemplates':
          converted.intervalValue = parseInt(row.intervalValue) || 1;

          // V4 format: handle both accountId and creditCardId
          converted.accountId = row.accountId || null;
          converted.creditCardId = row.creditCardId || null;
          converted.targetCreditCardId = row.targetCreditCardId || null;
          converted.targetLoanId = row.targetLoanId || null;
          converted.isActive =
            row.isActive === 'true' ||
            row.isActive === '1' ||
            row.isActive === 'Yes' ||
            row.isActive === true;
          converted.isVariableAmount =
            row.isVariableAmount === 'true' ||
            row.isVariableAmount === '1' ||
            row.isVariableAmount === 'Yes' ||
            row.isVariableAmount === true;

          // Convert dates to ISO strings
          if (row.startDate) {
            const startDate = new Date(row.startDate);
            converted.startDate = !isNaN(startDate.getTime())
              ? startDate.toISOString().split('T')[0]
              : '';
          }
          if (row.lastGenerated) {
            const lastGenerated = new Date(row.lastGenerated);
            converted.lastGenerated = !isNaN(lastGenerated.getTime())
              ? lastGenerated.toISOString().split('T')[0]
              : null;
          }
          if (row.nextDueDate) {
            const nextDueDate = new Date(row.nextDueDate);
            converted.nextDueDate = !isNaN(nextDueDate.getTime())
              ? nextDueDate.toISOString().split('T')[0]
              : '';
          }
          if (row.createdAt) {
            const createdAt = new Date(row.createdAt);
            converted.createdAt = !isNaN(createdAt.getTime())
              ? createdAt.toISOString()
              : new Date().toISOString();
          }
          if (row.updatedAt) {
            const updatedAt = new Date(row.updatedAt);
            converted.updatedAt = !isNaN(updatedAt.getTime())
              ? updatedAt.toISOString()
              : new Date().toISOString();
          }
          break;
      }

      rows.push(converted);
    });

    return { rows, skipped };
  }

  /**
   * Shared: validate then write validated import data to DB.
   * Used by importData. JSON is a full-replace (all tables); CSV is a
   * scoped, non-destructive merge into whichever single table it detected
   * (a CSV file only ever carries one table's worth of data - see
   * detectAndConvertCSVData - so validateImportData's cross-table required-
   * fields check would always fail for it).
   * @private
   */
  async _applyValidatedImport(validatedData, fileType, onProgress = () => {}) {
    onProgress('Validating data structure...');

    if (fileType === 'csv') {
      const tableKeys = Object.keys(validatedData).filter(key =>
        Array.isArray(validatedData[key]),
      );
      if (tableKeys.length !== 1) {
        throw new Error(
          `Expected exactly one table in CSV import data, found: ${tableKeys.join(', ') || 'none'}`,
        );
      }
      const [tableName] = tableKeys;
      onProgress(`Merging into ${tableName}...`);
      await dbHelpers.importSingleTable(tableName, validatedData[tableName]);
      return;
    }

    const validationResult = await this.validateImportData(validatedData);
    if (!validationResult.isValid) {
      throw new Error(
        `Import validation failed: ${validationResult.errors.join(', ')}`,
      );
    }
    onProgress('Applying import (atomic transaction)...');
    await dbHelpers.importData(validatedData);
  }

  // Import Process
  async importData(file, onProgress = () => {}) {
    try {
      onProgress('Reading file...');
      const { data, fileType, skipped = [] } = await this.readImportFile(file);

      onProgress('Creating backup...');
      await this.backupManager.createBackup('pre_import');

      onProgress('Validating and migrating data to V4 format...');

      // Validate and migrate data to V4 format
      const validatedData = validateImportedDataV4(data);

      await this._applyValidatedImport(validatedData, fileType, onProgress);

      onProgress('Import completed successfully!');
      logger.success(`Data imported successfully from ${fileType} file`);
      if (skipped.length > 0) {
        logger.warn(`Skipped ${skipped.length} unreadable row(s) on import`);
      }
      return { skipped };
    } catch (error) {
      logger.error('Import failed:', error);
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  // Export Process
  async exportData(format = 'json', onProgress = () => {}) {
    try {
      onProgress('Preparing data...');
      const data = await dbHelpers.exportData();

      data.version = CURRENT_DATA_VERSION;
      data.exportedAt = new Date().toISOString();

      onProgress('Creating file...');
      if (format === 'json') {
        const result = this.createJSONExport(data);
        await dbHelpers.updateLastExportDate(new Date().toISOString());
        return result;
      }
      return this.createCSVExport(data);
    } catch (error) {
      logger.error('Export failed:', error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  async createJSONExport(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    return {
      blob,
      filename: `digibook_backup_${new Date().toISOString().split('T')[0]}.json`,
    };
  }

  async createCSVExport(data) {
    const Papa = await import('papaparse');
    const files = [];

    // Export each table as a separate CSV file
    for (const [table, items] of Object.entries(data)) {
      if (Array.isArray(items) && items.length > 0) {
        const csv = Papa.unparse(items);
        const blob = new Blob([csv], { type: 'text/csv' });
        files.push({
          blob,
          filename: `${table}_${new Date().toISOString().split('T')[0]}.csv`,
        });
      }
    }

    return files;
  }

  // Export only credit cards as CSV
  async exportCreditCardsCSV(onProgress = () => {}) {
    try {
      onProgress('Preparing credit card data...');
      const creditCards = await dbHelpers.getCreditCards();

      if (!creditCards || creditCards.length === 0) {
        throw new Error('No credit cards found to export');
      }

      onProgress('Creating CSV file...');
      const Papa = await import('papaparse');
      const csv = Papa.unparse(creditCards);
      const blob = new Blob([csv], { type: 'text/csv' });

      return {
        blob,
        filename: `credit_cards_${new Date().toISOString().split('T')[0]}.csv`,
      };
    } catch (error) {
      logger.error('Credit card export failed:', error);
      throw new Error(`Credit card export failed: ${error.message}`);
    }
  }

  // Data Validation
  async validateImportData(data) {
    return dbHelpers.validateImportData(data);
  }
}

const BACKUP_PREFIX = 'digibook_backup_';

class BackupManager {
  constructor() {
    this.MAX_BACKUPS = 5;
  }

  async createBackup(reason) {
    try {
      const data = await dbHelpers.exportData();

      const cleanedData = await this.cleanExportData(data);

      const checksum = await this.generateChecksum(cleanedData);

      const backup = {
        data: cleanedData,
        checksum,
        reason,
        timestamp: new Date().toISOString(),
        version: CURRENT_DATA_VERSION,
        compressed: true,
        size: JSON.stringify(cleanedData).length,
        originalSize: JSON.stringify(data).length,
      };

      const verificationResult = await this.verifyBackupIntegrity(backup);
      if (!verificationResult.isValid) {
        throw new Error(
          `Backup integrity verification failed: ${verificationResult.errors.join(', ')}`,
        );
      }

      const id = await dbHelpers.saveBackup({
        reason: backup.reason,
        timestamp: backup.timestamp,
        version: backup.version,
        createdAt: new Date().toISOString(),
        data: backup.data,
        checksum: backup.checksum,
      });

      await this.rotateBackups();

      const compressionRatio = backup.originalSize
        ? backup.size / backup.originalSize
        : 0;
      const compressionPct = Math.round((1 - compressionRatio) * 100);

      logger.success(
        `Backup created successfully (${backup.size} bytes, ${compressionPct}% compressed)`,
      );
      return id;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  async rotateBackups() {
    try {
      const backups = await dbHelpers.listBackups();
      if (backups.length <= this.MAX_BACKUPS) return;
      const excess = backups.slice(this.MAX_BACKUPS);
      for (const backup of excess) {
        await dbHelpers.deleteBackupById(backup.id);
      }
    } catch (error) {
      logger.warn('Failed to rotate backups:', error);
    }
  }

  async listBackups() {
    return await dbHelpers.listBackups();
  }

  /**
   * If no tab was open for the scheduled 2am backup, create one now.
   * Runs once per app load, alongside scheduleAutomaticBackups().
   */
  async catchUpMissedBackup() {
    try {
      const backups = await dbHelpers.listBackups();
      const lastScheduled = backups.find(b => b.reason === 'scheduled_daily');

      const MISSED_THRESHOLD_MS = 25 * 60 * 60 * 1000; // 25 hours
      const isMissed =
        !lastScheduled ||
        Date.now() - new Date(lastScheduled.timestamp).getTime() >
          MISSED_THRESHOLD_MS;

      if (isMissed) {
        await this.createBackup('scheduled_daily');
        logger.success('Caught up on missed scheduled daily backup');
      }
    } catch (error) {
      logger.error('Failed to catch up on missed backup:', error);
    }
  }

  async restoreBackup(id) {
    try {
      const backups = await dbHelpers.listBackups();
      const backup = backups.find(b => b.id === id);
      if (!backup) {
        throw new Error('Backup not found');
      }

      const integrityResult = await this.verifyBackupIntegrity(backup);
      if (!integrityResult.isValid) {
        throw new Error(
          `Backup integrity check failed: ${integrityResult.errors.join(', ')}`,
        );
      }

      await this.createBackup('pre_restore');

      const dataToRestore = backup.data;

      await dbHelpers.importData(dataToRestore);

      logger.success('Backup restored successfully');
    } catch (error) {
      logger.error('Failed to restore backup:', error);
      throw new Error(`Failed to restore backup: ${error.message}`);
    }
  }

  async getLatestBackup() {
    return await dbHelpers.getLatestBackup();
  }

  /**
   * Generate checksum for data integrity verification
   */
  async generateChecksum(data) {
    try {
      const jsonString = JSON.stringify(data);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(jsonString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      logger.error('Error generating checksum:', error);
      throw new Error('Failed to generate checksum');
    }
  }

  /**
   * Clean export data by removing null/undefined and empty values
   */
  async cleanExportData(data) {
    try {
      const cleaned = JSON.parse(
        JSON.stringify(data, (key, value) => {
          if (value === null || value === undefined) return undefined;
          if (typeof value === 'string' && value.trim() === '')
            return undefined;
          if (Array.isArray(value) && value.length === 0) return undefined;
          if (typeof value === 'object' && Object.keys(value).length === 0)
            return undefined;
          return value;
        }),
      );
      return cleaned;
    } catch (error) {
      logger.error('Error cleaning export data:', error);
      return data;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity(backup) {
    const errors = [];

    try {
      // Check required fields
      if (!backup.data) errors.push('Missing backup data');
      if (!backup.checksum) errors.push('Missing checksum');
      if (!backup.timestamp) errors.push('Missing timestamp');
      if (!backup.version) errors.push('Missing version');

      // Verify checksum if data exists
      if (backup.data && backup.checksum) {
        const currentChecksum = await this.generateChecksum(backup.data);
        if (currentChecksum !== backup.checksum) {
          errors.push('Checksum mismatch - data may be corrupted');
        }
      }

      // Verify timestamp format
      if (backup.timestamp && isNaN(new Date(backup.timestamp).getTime())) {
        errors.push('Invalid timestamp format');
      }

      // Verify version compatibility using normalized comparison
      if (backup.version) {
        const normalizedVersion = normalizeVersion(backup.version);
        if (normalizedVersion > CURRENT_DATA_VERSION) {
          errors.push(
            `Backup version ${backup.version} is newer than current version ${CURRENT_DATA_VERSION}`,
          );
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      logger.error('Error verifying backup integrity:', error);
      return {
        isValid: false,
        errors: [`Integrity verification failed: ${error.message}`],
      };
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutomaticBackups() {
    try {
      // Clear any existing schedule
      if (this.backupInterval) {
        clearInterval(this.backupInterval);
      }

      // Create daily backup at 2 AM
      const now = new Date();
      const nextBackup = new Date();
      nextBackup.setHours(2, 0, 0, 0);

      // If it's already past 2 AM today, schedule for tomorrow
      if (now.getHours() >= 2) {
        nextBackup.setDate(nextBackup.getDate() + 1);
      }

      const timeUntilBackup = nextBackup.getTime() - now.getTime();

      // Schedule the first backup
      setTimeout(async () => {
        try {
          await this.createBackup('scheduled_daily');
          logger.success('Scheduled daily backup completed');
        } catch (error) {
          logger.error('Scheduled daily backup failed:', error);
        }
      }, timeUntilBackup);

      // Schedule recurring backups every 24 hours
      this.backupInterval = setInterval(
        async () => {
          try {
            await this.createBackup('scheduled_daily');
            logger.success('Scheduled daily backup completed');
          } catch (error) {
            logger.error('Scheduled daily backup failed:', error);
          }
        },
        24 * 60 * 60 * 1000,
      ); // 24 hours

      logger.info(
        `Automatic backups scheduled. Next backup at: ${nextBackup.toISOString()}`,
      );
    } catch (error) {
      logger.error('Failed to schedule automatic backups:', error);
    }
  }
}

/**
 * Validation and conversion utilities for Version 4 data format
 * These functions ensure data integrity during import/export operations
 */

/**
 * Validate and sanitize expense data for V4 format
 * Ensures expenses follow dual foreign key architecture constraints
 *
 * @param {Object} expense - Raw expense data
 * @returns {Object} Validated and sanitized expense data
 */
export const validateExpenseDataV4 = expense => {
  try {
    // Sanitize the data first (handles type conversions, null values)
    const sanitizedExpense = sanitizeExpenseData(expense);

    // Validate payment source constraints
    validatePaymentSource(sanitizedExpense);

    // Validate credit card payment specific rules
    if (sanitizedExpense.category === 'Credit Card Payment') {
      validateCreditCardPayment(sanitizedExpense);
    }

    // Validate loan payment specific rules
    if (sanitizedExpense.category === 'Loan Payment') {
      validateLoanPayment(sanitizedExpense);
    }

    logger.debug(`Validated expense: ${sanitizedExpense.name}`);
    return sanitizedExpense;
  } catch (error) {
    logger.warn(
      `Expense validation failed for "${expense.name || 'Unknown'}": ${error.message}`,
    );

    // Attempt to fix common issues
    return fixCommonExpenseIssues(expense);
  }
};

/**
 * Convert V3 expense format to V4 format
 * Handles migration from old accountId string format to new dual foreign key format
 *
 * @param {Object} v3Expense - Expense in V3 format
 * @returns {Object} Expense in V4 format
 */
export const convertV3ToV4Expense = v3Expense => {
  const v4Expense = { ...v3Expense };

  // Ensure V4 format compliance
  return validateExpenseDataV4(v4Expense);
};

/**
 * Fix common expense data issues during import
 * Attempts to repair expenses that don't meet V4 constraints
 *
 * @param {Object} expense - Problematic expense data
 * @returns {Object} Fixed expense data
 */
export const fixCommonExpenseIssues = expense => {
  const fixedExpense = { ...expense };

  // Issue 1: Both accountId and creditCardId are set
  if (fixedExpense.accountId && fixedExpense.creditCardId) {
    logger.warn(
      `Expense "${fixedExpense.name}" has both payment sources - keeping accountId, removing creditCardId`,
    );
    fixedExpense.creditCardId = null;
  }

  // Issue 2: Credit card payment has a stray creditCardId (should use
  // targetCreditCardId instead). A missing accountId/targetCreditCardId
  // here has no safe default to fall back to - it's left as-is and caught
  // by downstream validation instead.
  if (
    fixedExpense.category === 'Credit Card Payment' &&
    fixedExpense.creditCardId
  ) {
    logger.warn(
      `Credit card payment "${fixedExpense.name}" has creditCardId - removing (use targetCreditCardId)`,
    );
    fixedExpense.creditCardId = null;
  }

  logger.debug(`Fixed expense data issues for: ${fixedExpense.name}`);
  return fixedExpense;
};

/**
 * Validate imported data for V4 format compliance
 * Checks all data types and applies fixes as needed
 *
 * @param {Object} importedData - Full imported data object
 * @returns {Object} Validated and fixed data
 */
export const validateImportedDataV4 = importedData => {
  const validatedData = { ...importedData };

  // Validate and fix expenses
  if (
    validatedData.fixedExpenses &&
    Array.isArray(validatedData.fixedExpenses)
  ) {
    validatedData.fixedExpenses = validatedData.fixedExpenses.map(
      (expense, index) => {
        try {
          // Try V4 validation first
          return validateExpenseDataV4(expense);
        } catch (error) {
          logger.warn(
            `Expense ${index + 1} failed V4 validation, attempting V3→V4 conversion`,
          );
          try {
            // Try V3→V4 conversion
            return convertV3ToV4Expense(expense);
          } catch (conversionError) {
            logger.error(
              `Failed to convert expense ${index + 1}:`,
              conversionError,
            );

            // Return the expense with basic fixes applied
            return fixCommonExpenseIssues(expense);
          }
        }
      },
    );

    logger.success(
      `Validated ${validatedData.fixedExpenses.length} expenses for V4 format`,
    );
  }

  // Version stamping
  validatedData.version = CURRENT_DATA_VERSION;
  validatedData.migratedAt = new Date().toISOString();

  return validatedData;
};

export const dataManager = new DataManager();

import { dbHelpers } from '../db/database-clean';
import {
  validatePaymentSource,
  validateCreditCardPayment,
  sanitizeExpenseData,
} from '../utils/expenseValidation';
import { logger } from '../utils/logger';

// Current data format version
const CURRENT_DATA_VERSION = 4; // Updated to support dual foreign key architecture

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

      let data;
      if (fileType === 'json') {
        data = await this.parseAndValidateJSON(text);
      } else {
        data = await this.parseAndValidateCSV(text);
      }

      return { data, fileType };
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

    // Detect data type from headers
    if (
      headers.includes('name') &&
      headers.includes('type') &&
      headers.includes('currentBalance')
    ) {
      return { accounts: this.convertCSVData(csvData, 'accounts') };
    }
    if (
      headers.includes('accountId') &&
      headers.includes('amount') &&
      headers.includes('description')
    ) {
      return {
        pendingTransactions: this.convertCSVData(
          csvData,
          'pendingTransactions',
        ),
      };
    }
    if (
      headers.includes('dueDate') &&
      headers.includes('amount') &&
      headers.includes('name')
    ) {
      return { fixedExpenses: this.convertCSVData(csvData, 'fixedExpenses') };
    }
    if (headers.includes('name') && headers.includes('color')) {
      return { categories: this.convertCSVData(csvData, 'categories') };
    }
    if (headers.includes('lastPaycheckDate') && headers.includes('frequency')) {
      return {
        paycheckSettings: this.convertCSVData(csvData, 'paycheckSettings'),
      };
    }
    if (
      headers.includes('name') &&
      headers.includes('baseAmount') &&
      headers.includes('frequency') &&
      headers.includes('startDate')
    ) {
      return {
        recurringExpenseTemplates: this.convertCSVData(
          csvData,
          'recurringExpenseTemplates',
        ),
      };
    }

    throw new Error('Could not detect CSV data type from headers');
  }

  convertCSVData(csvData, dataType) {
    return csvData.map(row => {
      const converted = { ...row };

      switch (dataType) {
        case 'accounts':
          converted.currentBalance = parseFloat(row.currentBalance) || 0;
          converted.isDefault =
            row.isDefault === 'true' ||
            row.isDefault === '1' ||
            row.isDefault === 'Yes';
          break;
        case 'pendingTransactions':
          converted.accountId = row.accountId;
          converted.amount = parseFloat(row.amount) || 0;
          converted.createdAt = row.createdAt
            ? new Date(row.createdAt).toISOString()
            : new Date().toISOString();
          break;
        case 'fixedExpenses':
          converted.amount = parseFloat(row.amount) || 0;
          converted.paidAmount = parseFloat(row.paidAmount) || 0;

          // V4 format: handle both accountId and creditCardId
          converted.accountId = row.accountId || null;
          converted.creditCardId = row.creditCardId || null;
          converted.targetCreditCardId = row.targetCreditCardId || null;
          converted.dueDate = row.dueDate
            ? new Date(row.dueDate).toISOString()
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
          converted.baseAmount = parseFloat(row.baseAmount) || 0;
          converted.intervalValue = parseInt(row.intervalValue) || 1;

          // V4 format: handle both accountId and creditCardId
          converted.accountId = row.accountId || null;
          converted.creditCardId = row.creditCardId || null;
          converted.targetCreditCardId = row.targetCreditCardId || null;
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
              ? startDate.toISOString()
              : '';
          }
          if (row.lastGenerated) {
            const lastGenerated = new Date(row.lastGenerated);
            converted.lastGenerated = !isNaN(lastGenerated.getTime())
              ? lastGenerated.toISOString()
              : null;
          }
          if (row.nextDueDate) {
            const nextDueDate = new Date(row.nextDueDate);
            converted.nextDueDate = !isNaN(nextDueDate.getTime())
              ? nextDueDate.toISOString()
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

      return converted;
    });
  }

  /**
   * Shared: validate then write validated import data to DB.
   * Used by importData.
   * @private
   */
  async _applyValidatedImport(validatedData, onProgress = () => {}) {
    onProgress('Validating data structure...');
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
      const { data, fileType } = await this.readImportFile(file);

      onProgress('Creating backup...');
      await this.backupManager.createBackup('pre_import');

      onProgress('Validating and migrating data to V4 format...');

      // Validate and migrate data to V4 format
      const validatedData = validateImportedDataV4(data);

      await this._applyValidatedImport(validatedData, onProgress);

      onProgress('Import completed successfully!');
      logger.success(`Data imported successfully from ${fileType} file`);
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

  // Issue 2: No payment source specified
  if (!fixedExpense.accountId && !fixedExpense.creditCardId) {
    logger.warn(
      `Expense "${fixedExpense.name}" has no payment source - setting default account`,
    );
    fixedExpense.accountId = 1; // Default to first account
    fixedExpense.creditCardId = null;
  }

  // Issue 3: Credit card payment missing required fields
  if (fixedExpense.category === 'Credit Card Payment') {
    if (!fixedExpense.accountId) {
      logger.warn(
        `Credit card payment "${fixedExpense.name}" missing funding account - setting default`,
      );
      fixedExpense.accountId = 1;
    }
    if (!fixedExpense.targetCreditCardId) {
      logger.warn(
        `Credit card payment "${fixedExpense.name}" missing target credit card - setting default`,
      );
      fixedExpense.targetCreditCardId = 1;
    }
    if (fixedExpense.creditCardId) {
      logger.warn(
        `Credit card payment "${fixedExpense.name}" has creditCardId - removing (use targetCreditCardId)`,
      );
      fixedExpense.creditCardId = null;
    }
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

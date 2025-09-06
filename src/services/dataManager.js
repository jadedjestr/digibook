import { logger } from '../utils/logger';
import { dbHelpers } from '../db/database';

// Current data format version
const CURRENT_DATA_VERSION = 1;

class DataManager {
  constructor () {
    this.backupManager = new BackupManager();
  }

  // Database Management
  async deleteDatabase () {
    try {
      await dbHelpers.deleteDatabase();
      logger.success('Database deleted successfully');
    } catch (error) {
      logger.error('Error deleting database:', error);
      throw new Error(`Failed to delete database: ${error.message}`);
    }
  }

  async clearAllData (createBackup = true) {
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
  async getAuditLogs () {
    try {
      return await dbHelpers.getAuditLogs();
    } catch (error) {
      logger.error('Error getting audit logs:', error);
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }
  }

  async clearAuditLogs () {
    try {
      await dbHelpers.clearAuditLogs();
      logger.success('Audit logs cleared successfully');
    } catch (error) {
      logger.error('Error clearing audit logs:', error);
      throw new Error(`Failed to clear audit logs: ${error.message}`);
    }
  }

  // File Reading and Validation
  async readImportFile (file) {
    try {
      const text = await file.text();
      const fileType = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';

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

  async parseAndValidateJSON (text) {
    try {
      const data = JSON.parse(text);

      // Check data format version
      if (data.version && data.version > CURRENT_DATA_VERSION) {
        throw new Error(`Data format version ${data.version} is not supported. Current version: ${CURRENT_DATA_VERSION}`);
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

  async parseAndValidateCSV (text) {
    try {
      const Papa = await import('papaparse');
      const result = Papa.parse(text, { header: true });

      if (result.errors && result.errors.length > 0) {
        throw new Error(`CSV parsing errors: ${result.errors.map(e => e.message).join(', ')}`);
      }

      if (!result.data || result.data.length === 0) {
        throw new Error('CSV file is empty or has no valid data');
      }

      return this.detectAndConvertCSVData(result.data);
    } catch (error) {
      throw new Error(`Invalid CSV format: ${error.message}`);
    }
  }

  detectAndConvertCSVData (csvData) {
    const firstRow = csvData[0] || {};
    const headers = Object.keys(firstRow);

    // Detect data type from headers
    if (headers.includes('name') && headers.includes('type') && headers.includes('currentBalance')) {
      return { accounts: this.convertCSVData(csvData, 'accounts') };
    }
    if (headers.includes('accountId') && headers.includes('amount') && headers.includes('description')) {
      return { pendingTransactions: this.convertCSVData(csvData, 'pendingTransactions') };
    }
    if (headers.includes('dueDate') && headers.includes('amount') && headers.includes('name')) {
      return { fixedExpenses: this.convertCSVData(csvData, 'fixedExpenses') };
    }
    if (headers.includes('name') && headers.includes('color')) {
      return { categories: this.convertCSVData(csvData, 'categories') };
    }
    if (headers.includes('lastPaycheckDate') && headers.includes('frequency')) {
      return { paycheckSettings: this.convertCSVData(csvData, 'paycheckSettings') };
    }

    throw new Error('Could not detect CSV data type from headers');
  }

  convertCSVData (csvData, dataType) {
    return csvData.map(row => {
      const converted = { ...row };

      switch (dataType) {
      case 'accounts':
        converted.currentBalance = parseFloat(row.currentBalance) || 0;
        converted.isDefault = row.isDefault === 'true' || row.isDefault === '1' || row.isDefault === 'Yes';
        break;
      case 'pendingTransactions':
        converted.accountId = parseInt(row.accountId) || 0;
        converted.amount = parseFloat(row.amount) || 0;
        converted.createdAt = row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString();
        break;
      case 'fixedExpenses':
        converted.amount = parseFloat(row.amount) || 0;
        converted.paidAmount = parseFloat(row.paidAmount) || 0;
        converted.accountId = parseInt(row.accountId) || 0;
        converted.dueDate = row.dueDate ? new Date(row.dueDate).toISOString() : '';
        break;
      case 'categories':
        converted.isDefault = row.isDefault === 'true' || row.isDefault === '1' || row.isDefault === 'Yes';
        break;
      case 'paycheckSettings':
        converted.lastPaycheckDate = row.lastPaycheckDate ? new Date(row.lastPaycheckDate).toISOString() : '';
        break;
      }

      return converted;
    });
  }

  // Import Process
  async importData (file, onProgress = () => {}) {
    try {
      onProgress('Reading file...');
      const { data, fileType } = await this.readImportFile(file);

      onProgress('Creating backup...');
      await this.backupManager.createBackup('pre_import');

      onProgress('Validating data...');
      const validationResult = await this.validateImportData(data);
      if (!validationResult.isValid) {
        throw new Error(`Import validation failed: ${validationResult.errors.join(', ')}`);
      }

      onProgress('Importing data...');
      await dbHelpers.importData(data);

      onProgress('Import completed successfully!');
      logger.success(`Data imported successfully from ${fileType} file`);
    } catch (error) {
      logger.error('Import failed:', error);
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  // Export Process
  async exportData (format = 'json', onProgress = () => {}) {
    try {
      onProgress('Preparing data...');
      const data = await dbHelpers.exportData();

      // Add format version
      data.version = CURRENT_DATA_VERSION;
      data.exportedAt = new Date().toISOString();

      onProgress('Creating file...');
      if (format === 'json') {
        return this.createJSONExport(data);
      } else {
        return this.createCSVExport(data);
      }
    } catch (error) {
      logger.error('Export failed:', error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  async createJSONExport (data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    return {
      blob,
      filename: `digibook_backup_${new Date().toISOString().split('T')[0]}.json`,
    };
  }

  async createCSVExport (data) {
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

  // Data Validation
  async validateImportData (data) {
    return dbHelpers.validateImportData(data);
  }
}

class BackupManager {
  constructor () {
    this.BACKUP_PREFIX = 'digibook_backup_';
    this.MAX_BACKUPS = 5;
  }

  async createBackup (reason) {
    try {
      const data = await dbHelpers.exportData();
      const backup = {
        data,
        reason,
        timestamp: new Date().toISOString(),
        version: CURRENT_DATA_VERSION,
      };

      // Store backup
      const key = `${this.BACKUP_PREFIX}${reason}_${backup.timestamp}`;
      localStorage.setItem(key, JSON.stringify(backup));

      // Rotate old backups
      await this.rotateBackups();

      logger.success('Backup created successfully');
      return key;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  async rotateBackups () {
    try {
      const backups = this.listBackups();
      if (backups.length > this.MAX_BACKUPS) {
        // Remove oldest backups
        backups
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(this.MAX_BACKUPS)
          .forEach(backup => localStorage.removeItem(backup.key));
      }
    } catch (error) {
      logger.warn('Failed to rotate backups:', error);
    }
  }

  listBackups () {
    const backups = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.BACKUP_PREFIX)) {
        try {
          const backup = JSON.parse(localStorage.getItem(key));
          backups.push({ ...backup, key });
        } catch (error) {
          logger.warn(`Invalid backup found at ${key}:`, error);
        }
      }
    }
    return backups;
  }

  async restoreBackup (key) {
    try {
      const backupJson = localStorage.getItem(key);
      if (!backupJson) {
        throw new Error('Backup not found');
      }

      const backup = JSON.parse(backupJson);

      // Validate backup
      if (!backup.data || !backup.timestamp || !backup.version) {
        throw new Error('Invalid backup format');
      }

      // Create safety backup before restore
      await this.createBackup('pre_restore');

      // Restore data
      await dbHelpers.importData(backup.data);

      logger.success('Backup restored successfully');
    } catch (error) {
      logger.error('Failed to restore backup:', error);
      throw new Error(`Failed to restore backup: ${error.message}`);
    }
  }

  async getLatestBackup () {
    const backups = this.listBackups();
    if (backups.length === 0) {
      return null;
    }

    return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  }

  clearBackups () {
    const backups = this.listBackups();
    backups.forEach(backup => localStorage.removeItem(backup.key));
    logger.success('All backups cleared');
  }
}

export const dataManager = new DataManager();

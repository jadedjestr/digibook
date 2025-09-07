import { logger } from '../utils/logger';
import { dbHelpers } from '../db/database-clean';
import { secureDataHandling } from '../utils/crypto';

// Current data format version
const CURRENT_DATA_VERSION = 1;

class DataManager {
  constructor () {
    this.backupManager = new BackupManager();
    this.initializeBackupSystem();
  }

  /**
   * Initialize the backup system with automatic scheduling
   */
  initializeBackupSystem () {
    try {
      // Schedule automatic backups
      this.backupManager.scheduleAutomaticBackups();
      
      // Run backup testing on app startup (in development)
      if (process.env.NODE_ENV === 'development') {
        setTimeout(async () => {
          try {
            await this.backupManager.runAutomatedBackupTesting();
          } catch (error) {
            logger.warn('Automated backup testing failed on startup:', error);
          }
        }, 5000); // Wait 5 seconds after app startup
      }
      
      logger.info('Backup system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize backup system:', error);
    }
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

  // Secure Import Process with decryption
  async importDataSecure (file, password, onProgress = () => {}) {
    try {
      onProgress('Reading encrypted file...');
      const { data, fileType } = await this.readImportFile(file);

      // Check if it's an encrypted export
      if (!data.encrypted) {
        throw new Error('File is not encrypted. Use regular import for unencrypted files.');
      }

      onProgress('Creating backup...');
      await this.backupManager.createBackup('pre_secure_import');

      onProgress('Decrypting data...');
      const decryptedData = await secureDataHandling.importData(data, password);

      onProgress('Validating decrypted data...');
      const validationResult = await this.validateImportData(decryptedData);
      if (!validationResult.isValid) {
        throw new Error(`Import validation failed: ${validationResult.errors.join(', ')}`);
      }

      onProgress('Importing data...');
      await dbHelpers.importData(decryptedData);

      onProgress('Secure import completed successfully!');
      logger.success(`Encrypted data imported successfully from ${fileType} file`);
    } catch (error) {
      logger.error('Secure import failed:', error);
      throw new Error(`Secure import failed: ${error.message}`);
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

  // Secure Export Process with encryption
  async exportDataSecure (password, onProgress = () => {}) {
    try {
      onProgress('Preparing data...');
      const data = await dbHelpers.exportData();

      // Add format version and metadata
      data.version = CURRENT_DATA_VERSION;
      data.exportedAt = new Date().toISOString();

      onProgress('Encrypting data...');
      const encryptedExport = await secureDataHandling.exportData(data, password);

      onProgress('Creating secure file...');
      const blob = new Blob([JSON.stringify(encryptedExport, null, 2)], { 
        type: 'application/json' 
      });
      
      return {
        blob,
        filename: `digibook_secure_backup_${new Date().toISOString().split('T')[0]}.json`,
        encrypted: true
      };
    } catch (error) {
      logger.error('Secure export failed:', error);
      throw new Error(`Secure export failed: ${error.message}`);
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
      
      // Generate integrity checksum
      const checksum = await this.generateChecksum(data);
      
      // Compress backup data
      const compressedData = await this.compressData(data);
      
      const backup = {
        data: compressedData,
        checksum,
        reason,
        timestamp: new Date().toISOString(),
        version: CURRENT_DATA_VERSION,
        compressed: true,
        size: JSON.stringify(compressedData).length,
        originalSize: JSON.stringify(data).length
      };

      // Verify backup integrity before storing
      const verificationResult = await this.verifyBackupIntegrity(backup);
      if (!verificationResult.isValid) {
        throw new Error(`Backup integrity verification failed: ${verificationResult.errors.join(', ')}`);
      }

      // Store backup
      const key = `${this.BACKUP_PREFIX}${reason}_${backup.timestamp}`;
      localStorage.setItem(key, JSON.stringify(backup));

      // Rotate old backups
      await this.rotateBackups();

      logger.success(`Backup created successfully (${backup.size} bytes, ${Math.round((1 - backup.size / backup.originalSize) * 100)}% compressed)`);
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

      // Verify backup integrity
      const integrityResult = await this.verifyBackupIntegrity(backup);
      if (!integrityResult.isValid) {
        throw new Error(`Backup integrity check failed: ${integrityResult.errors.join(', ')}`);
      }

      // Create safety backup before restore
      await this.createBackup('pre_restore');

      // Decompress data if needed
      const dataToRestore = backup.compressed ? 
        await this.decompressData(backup.data) : 
        backup.data;

      // Restore data
      await dbHelpers.importData(dataToRestore);

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

  // === ENHANCED BACKUP FEATURES ===

  /**
   * Generate checksum for data integrity verification
   */
  async generateChecksum (data) {
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
   * Compress backup data using simple compression techniques
   */
  async compressData (data) {
    try {
      // Simple compression by removing unnecessary whitespace and null values
      const compressed = JSON.parse(JSON.stringify(data, (key, value) => {
        // Remove null/undefined values
        if (value === null || value === undefined) return undefined;
        // Remove empty strings
        if (typeof value === 'string' && value.trim() === '') return undefined;
        // Remove empty arrays
        if (Array.isArray(value) && value.length === 0) return undefined;
        // Remove empty objects
        if (typeof value === 'object' && Object.keys(value).length === 0) return undefined;
        return value;
      }));
      
      return compressed;
    } catch (error) {
      logger.error('Error compressing data:', error);
      // Return original data if compression fails
      return data;
    }
  }

  /**
   * Decompress backup data
   */
  async decompressData (compressedData) {
    try {
      // For now, compression is just cleanup, so no decompression needed
      return compressedData;
    } catch (error) {
      logger.error('Error decompressing data:', error);
      throw new Error('Failed to decompress data');
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity (backup) {
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
      
      // Verify version compatibility
      if (backup.version && backup.version > CURRENT_DATA_VERSION) {
        errors.push(`Backup version ${backup.version} is newer than current version ${CURRENT_DATA_VERSION}`);
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      logger.error('Error verifying backup integrity:', error);
      return {
        isValid: false,
        errors: ['Integrity verification failed: ' + error.message]
      };
    }
  }

  /**
   * Test backup restore functionality
   */
  async testBackupRestore (backupKey) {
    try {
      logger.info(`Testing backup restore for: ${backupKey}`);
      
      // Get the backup
      const backupJson = localStorage.getItem(backupKey);
      if (!backupJson) {
        throw new Error('Backup not found');
      }
      
      const backup = JSON.parse(backupJson);
      
      // Verify integrity
      const integrityResult = await this.verifyBackupIntegrity(backup);
      if (!integrityResult.isValid) {
        throw new Error(`Backup integrity check failed: ${integrityResult.errors.join(', ')}`);
      }
      
      // Decompress data
      const decompressedData = await this.decompressData(backup.data);
      
      // Validate data structure
      const validationResult = await this.validateImportData(decompressedData);
      if (!validationResult.isValid) {
        throw new Error(`Data validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      logger.success(`Backup restore test passed for: ${backupKey}`);
      return {
        success: true,
        message: 'Backup restore test completed successfully'
      };
    } catch (error) {
      logger.error(`Backup restore test failed for ${backupKey}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run automated backup testing on all backups
   */
  async runAutomatedBackupTesting () {
    try {
      logger.info('Running automated backup testing...');
      const backups = this.listBackups();
      const results = [];
      
      for (const backup of backups) {
        const testResult = await this.testBackupRestore(backup.key);
        results.push({
          key: backup.key,
          timestamp: backup.timestamp,
          reason: backup.reason,
          ...testResult
        });
      }
      
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      
      logger.info(`Automated backup testing completed: ${successCount}/${totalCount} backups passed`);
      
      return {
        total: totalCount,
        passed: successCount,
        failed: totalCount - successCount,
        results
      };
    } catch (error) {
      logger.error('Automated backup testing failed:', error);
      throw new Error(`Automated backup testing failed: ${error.message}`);
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutomaticBackups () {
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
      this.backupInterval = setInterval(async () => {
        try {
          await this.createBackup('scheduled_daily');
          logger.success('Scheduled daily backup completed');
        } catch (error) {
          logger.error('Scheduled daily backup failed:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours
      
      logger.info(`Automatic backups scheduled. Next backup at: ${nextBackup.toISOString()}`);
    } catch (error) {
      logger.error('Failed to schedule automatic backups:', error);
    }
  }

  /**
   * Stop automatic backup scheduling
   */
  stopAutomaticBackups () {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      logger.info('Automatic backups stopped');
    }
  }
}

export const dataManager = new DataManager();

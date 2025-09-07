# Digibook Data Recovery Procedures

## Overview
This document outlines the comprehensive data recovery procedures for the Digibook personal finance application. The system includes automatic backups, integrity verification, and multiple recovery options.

## Backup System Architecture

### Automatic Backups
- **Frequency**: Daily at 2:00 AM
- **Retention**: 5 most recent backups
- **Location**: Browser localStorage
- **Format**: Compressed JSON with integrity checksums

### Manual Backups
- **Trigger**: Before major operations (import, clear data, etc.)
- **Naming**: `digibook_backup_{reason}_{timestamp}`
- **Verification**: Automatic integrity checks before storage

## Recovery Procedures

### 1. Automatic Recovery (Recommended)

#### For Data Corruption
```javascript
// The system automatically detects and handles corruption
const backupManager = dataManager.backupManager;

// List available backups
const backups = backupManager.listBackups();

// Get the most recent backup
const latestBackup = await backupManager.getLatestBackup();

// Restore from latest backup
await backupManager.restoreBackup(latestBackup.key);
```

#### For Complete Data Loss
```javascript
// Check if any backups exist
const backups = backupManager.listBackups();

if (backups.length > 0) {
  // Restore from most recent backup
  const latestBackup = await backupManager.getLatestBackup();
  await backupManager.restoreBackup(latestBackup.key);
} else {
  // No backups available - initialize with defaults
  await dbHelpers.initializeDefaultCategories();
}
```

### 2. Manual Recovery Procedures

#### Step 1: Assess the Situation
1. Check browser console for error messages
2. Verify localStorage is accessible
3. Check if any backups exist

#### Step 2: List Available Backups
```javascript
const backups = dataManager.backupManager.listBackups();
console.log('Available backups:', backups);
```

#### Step 3: Verify Backup Integrity
```javascript
// Test a specific backup
const testResult = await dataManager.backupManager.testBackupRestore(backupKey);
console.log('Backup test result:', testResult);
```

#### Step 4: Restore from Backup
```javascript
// Restore from specific backup
await dataManager.backupManager.restoreBackup(backupKey);
```

### 3. Emergency Recovery (No Backups Available)

#### Option A: Reset to Defaults
```javascript
// Clear all data and start fresh
await dataManager.clearAllData(false); // Don't create backup since we're resetting
await dbHelpers.initializeDefaultCategories();
```

#### Option B: Import from External Backup
```javascript
// If you have an exported file
const fileInput = document.getElementById('backup-file');
const file = fileInput.files[0];

// For encrypted backups
await dataManager.importDataSecure(file, password, (progress) => {
  console.log('Import progress:', progress);
});

// For regular backups
await dataManager.importData(file, (progress) => {
  console.log('Import progress:', progress);
});
```

## Backup Verification

### Automated Testing
The system automatically tests all backups on app startup (development mode):

```javascript
// Run comprehensive backup testing
const testResults = await dataManager.backupManager.runAutomatedBackupTesting();
console.log('Backup test results:', testResults);
```

### Manual Verification
```javascript
// Verify specific backup
const backup = JSON.parse(localStorage.getItem(backupKey));
const integrityResult = await dataManager.backupManager.verifyBackupIntegrity(backup);
console.log('Integrity check:', integrityResult);
```

## Recovery Time Objectives

| Scenario | Target Recovery Time | Method |
|----------|---------------------|---------|
| Data corruption | < 30 seconds | Automatic backup restore |
| Complete data loss | < 2 minutes | Manual backup selection |
| Emergency reset | < 1 minute | Reset to defaults |
| External import | < 5 minutes | File import process |

## Prevention Measures

### 1. Regular Backup Testing
- Automated testing runs daily in development
- Manual testing recommended weekly in production
- All backups verified before storage

### 2. Data Validation
- All data validated before database operations
- Input sanitization prevents corruption
- Checksums verify data integrity

### 3. Error Handling
- Comprehensive error logging
- Graceful degradation on failures
- Automatic fallback procedures

## Troubleshooting

### Common Issues

#### "Backup not found"
- Check if backup key is correct
- Verify localStorage is accessible
- List all available backups

#### "Backup integrity check failed"
- Backup may be corrupted
- Try restoring from different backup
- Check browser storage limits

#### "Import validation failed"
- Data format may be incompatible
- Check file format and version
- Verify data structure

### Recovery Commands

```javascript
// Emergency commands for console

// 1. List all backups
dataManager.backupManager.listBackups()

// 2. Test all backups
dataManager.backupManager.runAutomatedBackupTesting()

// 3. Clear corrupted backups
dataManager.backupManager.clearBackups()

// 4. Create emergency backup
dataManager.backupManager.createBackup('emergency')

// 5. Reset to defaults
dataManager.clearAllData(false)
```

## Best Practices

### For Users
1. **Regular Exports**: Export data monthly to external files
2. **Multiple Backups**: Keep both automatic and manual backups
3. **Test Restores**: Periodically test backup restoration
4. **Monitor Storage**: Ensure sufficient browser storage space

### For Developers
1. **Error Logging**: Monitor backup creation and restore logs
2. **Performance**: Monitor backup creation time and size
3. **Testing**: Run automated backup tests regularly
4. **Documentation**: Keep recovery procedures updated

## Security Considerations

### Backup Encryption
- Automatic backups stored in localStorage (browser security)
- Manual exports can be encrypted with password
- Sensitive data protected by browser security model

### Access Control
- Backups only accessible from same browser/domain
- No network transmission of backup data
- Local-only storage for privacy

## Monitoring and Alerts

### Backup Health Monitoring
```javascript
// Check backup system health
const healthCheck = {
  totalBackups: dataManager.backupManager.listBackups().length,
  latestBackup: await dataManager.backupManager.getLatestBackup(),
  automaticBackupsEnabled: dataManager.backupManager.backupInterval !== null
};

console.log('Backup system health:', healthCheck);
```

### Performance Metrics
- Backup creation time
- Backup size and compression ratio
- Restore operation time
- Integrity check duration

---

*Last Updated: December 2024*  
*Version: 1.0*

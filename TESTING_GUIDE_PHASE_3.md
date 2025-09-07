# Phase 3: Security & Backup Features - Testing Guide

## 🧪 Testing Overview
This guide provides step-by-step instructions to test all the new security and backup features implemented in Phase 3. Each test includes clear pass/fail criteria.

---

## 🔐 **TEST 1: PIN Encryption & Security**

### **Test 1.1: PIN Storage Encryption**
**Objective:** Verify that PINs are stored encrypted, not in plain text

**Steps:**
1. Open your browser's Developer Tools (F12)
2. Go to the **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Expand **Local Storage** → **http://localhost:5173**
4. Look for these keys:
   - `digibook_encrypted_pin` (should exist)
   - `digibook_pin` (should NOT exist or be empty)
   - `digibook_device_key` (should exist)

**Expected Result:**
- ✅ **PASS:** You see `digibook_encrypted_pin` with encrypted data (long string)
- ✅ **PASS:** You see `digibook_device_key` with a UUID
- ❌ **FAIL:** You see `digibook_pin` with your actual PIN in plain text

**Test Command (Optional):**
```javascript
// Run this in browser console to check PIN storage
console.log('Encrypted PIN exists:', !!localStorage.getItem('digibook_encrypted_pin'));
console.log('Device key exists:', !!localStorage.getItem('digibook_device_key'));
console.log('Plain PIN exists:', !!localStorage.getItem('digibook_pin'));
```

---

### **Test 1.2: PIN Verification**
**Objective:** Verify that PIN verification works correctly

**Steps:**
1. Set a PIN (if not already set)
2. Lock the app (refresh the page)
3. Enter the correct PIN
4. Try entering an incorrect PIN

**Expected Result:**
- ✅ **PASS:** Correct PIN unlocks the app
- ✅ **PASS:** Incorrect PIN shows error message
- ❌ **FAIL:** App doesn't unlock with correct PIN
- ❌ **FAIL:** App unlocks with incorrect PIN

---

## 💾 **TEST 2: Backup System**

### **Test 2.1: Automatic Backup Creation**
**Objective:** Verify that automatic backups are being created

**Steps:**
1. Open browser Developer Tools (F12)
2. Go to **Console** tab
3. Look for log messages about backups
4. Check Local Storage for backup keys

**Expected Result:**
- ✅ **PASS:** You see log messages like "Backup created successfully"
- ✅ **PASS:** You see backup keys in Local Storage starting with `digibook_backup_`
- ❌ **FAIL:** No backup-related log messages
- ❌ **FAIL:** No backup keys in Local Storage

**Test Command:**
```javascript
// Run this in browser console to check backups
const backups = Object.keys(localStorage).filter(key => key.startsWith('digibook_backup_'));
console.log('Number of backups:', backups.length);
console.log('Backup keys:', backups);
```

---

### **Test 2.2: Backup Integrity Verification**
**Objective:** Verify that backups have integrity checksums

**Steps:**
1. Create a manual backup (add some data, then import/export)
2. Open browser console
3. Run the integrity check command

**Test Command:**
```javascript
// Run this in browser console to test backup integrity
const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('digibook_backup_'));
if (backupKeys.length > 0) {
  const backup = JSON.parse(localStorage.getItem(backupKeys[0]));
  console.log('Backup has checksum:', !!backup.checksum);
  console.log('Backup is compressed:', !!backup.compressed);
  console.log('Backup size info:', { size: backup.size, originalSize: backup.originalSize });
} else {
  console.log('No backups found');
}
```

**Expected Result:**
- ✅ **PASS:** Backup has a `checksum` field
- ✅ **PASS:** Backup has `compressed: true`
- ✅ **PASS:** Backup has size information
- ❌ **FAIL:** Backup missing checksum or compression info

---

### **Test 2.3: Backup Compression**
**Objective:** Verify that backups are compressed

**Steps:**
1. Add some data to your app (accounts, expenses, etc.)
2. Create a backup
3. Check the backup size information

**Test Command:**
```javascript
// Run this in browser console to check compression
const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('digibook_backup_'));
if (backupKeys.length > 0) {
  const backup = JSON.parse(localStorage.getItem(backupKeys[0]));
  const compressionRatio = ((backup.originalSize - backup.size) / backup.originalSize * 100).toFixed(1);
  console.log(`Compression: ${backup.size} bytes (${compressionRatio}% reduction from ${backup.originalSize} bytes)`);
} else {
  console.log('No backups found');
}
```

**Expected Result:**
- ✅ **PASS:** Shows compression ratio (typically 20-40%)
- ✅ **PASS:** Compressed size is smaller than original size
- ❌ **FAIL:** No compression or compression ratio is 0%

---

## 🔄 **TEST 3: Data Validation & Sanitization**

### **Test 3.1: Input Validation**
**Objective:** Verify that invalid data is rejected

**Steps:**
1. Try to add an account with invalid data:
   - Empty name
   - Invalid balance (text instead of number)
   - Invalid account type
2. Try to add an expense with invalid data:
   - Empty name
   - Negative amount
   - Invalid date

**Expected Result:**
- ✅ **PASS:** Invalid data shows error messages
- ✅ **PASS:** Invalid data is not saved to database
- ❌ **FAIL:** Invalid data is accepted and saved

**Test Command:**
```javascript
// Run this in browser console to test validation
// This will test the validation functions directly
import { dataIntegrity } from './src/utils/crypto.js';
console.log('Testing account validation...');
const invalidAccount = { name: '', currentBalance: 'invalid', type: 'invalid' };
const result = dataIntegrity.validateAccount(invalidAccount);
console.log('Validation result:', result);
```

---

### **Test 3.2: XSS Protection**
**Objective:** Verify that malicious input is sanitized

**Steps:**
1. Try to add an account or expense with HTML/JavaScript code:
   - Name: `<script>alert('xss')</script>`
   - Description: `<img src=x onerror=alert('xss')>`
2. Check if the code is executed or sanitized

**Expected Result:**
- ✅ **PASS:** HTML/JavaScript code is displayed as text (sanitized)
- ✅ **PASS:** No alert boxes or script execution
- ❌ **FAIL:** HTML/JavaScript code is executed
- ❌ **FAIL:** Alert boxes appear

---

## 🔒 **TEST 4: Secure Export/Import**

### **Test 4.1: Secure Export**
**Objective:** Verify that secure export creates encrypted files

**Steps:**
1. Go to Settings page
2. Try to export data with a password
3. Check the exported file

**Expected Result:**
- ✅ **PASS:** Export creates a file with encrypted data
- ✅ **PASS:** File contains encrypted fields (ciphertext, iv, salt)
- ❌ **FAIL:** Export creates plain text file
- ❌ **FAIL:** No export functionality available

**Test Command:**
```javascript
// Run this in browser console to test secure export
// Note: This requires the export functionality to be available in the UI
console.log('Testing secure export...');
// The actual test would be through the UI export feature
```

---

### **Test 4.2: Secure Import**
**Objective:** Verify that secure import can decrypt files

**Steps:**
1. Create a secure export with a password
2. Try to import the same file with the correct password
3. Try to import with an incorrect password

**Expected Result:**
- ✅ **PASS:** Correct password successfully imports data
- ✅ **PASS:** Incorrect password shows error message
- ❌ **FAIL:** Import fails with correct password
- ❌ **FAIL:** Import succeeds with incorrect password

---

## 🧪 **TEST 5: Automated Backup Testing**

### **Test 5.1: Backup Testing System**
**Objective:** Verify that automated backup testing works

**Steps:**
1. Open browser console
2. Run the automated backup testing command

**Test Command:**
```javascript
// Run this in browser console to test backup system
const dataManager = window.dataManager || (await import('./src/services/dataManager.js')).dataManager;
try {
  const results = await dataManager.backupManager.runAutomatedBackupTesting();
  console.log('Backup test results:', results);
  console.log(`Passed: ${results.passed}/${results.total}`);
} catch (error) {
  console.error('Backup testing failed:', error);
}
```

**Expected Result:**
- ✅ **PASS:** Shows test results with pass/fail counts
- ✅ **PASS:** All backups pass integrity tests
- ❌ **FAIL:** Testing fails or shows errors
- ❌ **FAIL:** Some backups fail integrity tests

---

## 📊 **TEST 6: Performance & Monitoring**

### **Test 6.1: Backup Performance**
**Objective:** Verify that backups are created quickly

**Steps:**
1. Open browser console
2. Create a backup and measure the time

**Test Command:**
```javascript
// Run this in browser console to test backup performance
const startTime = performance.now();
try {
  const dataManager = window.dataManager || (await import('./src/services/dataManager.js')).dataManager;
  await dataManager.backupManager.createBackup('performance_test');
  const endTime = performance.now();
  console.log(`Backup created in ${(endTime - startTime).toFixed(2)}ms`);
} catch (error) {
  console.error('Backup creation failed:', error);
}
```

**Expected Result:**
- ✅ **PASS:** Backup created in less than 1000ms (1 second)
- ✅ **PASS:** No errors during backup creation
- ❌ **FAIL:** Backup takes longer than 5 seconds
- ❌ **FAIL:** Backup creation fails

---

## 🚨 **TEST 7: Error Handling**

### **Test 7.1: Graceful Error Handling**
**Objective:** Verify that errors are handled gracefully

**Steps:**
1. Try to restore from a non-existent backup
2. Try to import an invalid file
3. Check console for error messages

**Test Command:**
```javascript
// Run this in browser console to test error handling
try {
  const dataManager = window.dataManager || (await import('./src/services/dataManager.js')).dataManager;
  await dataManager.backupManager.restoreBackup('non_existent_backup');
} catch (error) {
  console.log('Error handled gracefully:', error.message);
}
```

**Expected Result:**
- ✅ **PASS:** Errors show user-friendly messages
- ✅ **PASS:** App continues to work after errors
- ❌ **FAIL:** Errors crash the app
- ❌ **FAIL:** Errors show technical stack traces to users

---

## 📋 **Testing Checklist**

### **Quick Test Summary:**
- [ ] **PIN Encryption:** PIN stored encrypted, not plain text
- [ ] **PIN Verification:** Correct PIN unlocks, incorrect PIN fails
- [ ] **Automatic Backups:** Backups created automatically
- [ ] **Backup Integrity:** Backups have checksums and compression
- [ ] **Data Validation:** Invalid data rejected with error messages
- [ ] **XSS Protection:** Malicious input sanitized
- [ ] **Secure Export:** Creates encrypted files with password
- [ ] **Secure Import:** Decrypts files with correct password
- [ ] **Backup Testing:** Automated testing works
- [ ] **Performance:** Backups created quickly (< 1 second)
- [ ] **Error Handling:** Errors handled gracefully

### **Pass/Fail Criteria:**
- **PASS:** All tests show expected results
- **FAIL:** Any test shows unexpected results or errors

---

## 🆘 **Troubleshooting**

### **Common Issues:**

#### **"No backups found"**
- **Cause:** No data has been added yet
- **Solution:** Add some accounts/expenses first, then test

#### **"Import/Export not available"**
- **Cause:** Feature not implemented in UI yet
- **Solution:** Test through console commands

#### **"PIN not encrypted"**
- **Cause:** Old PIN still in localStorage
- **Solution:** Clear localStorage and set new PIN

#### **"Backup testing fails"**
- **Cause:** No backups to test
- **Solution:** Create some data and backups first

### **Emergency Commands:**
```javascript
// Clear all data and start fresh
localStorage.clear();
location.reload();

// Check system status
console.log('Local Storage keys:', Object.keys(localStorage));
console.log('Backup count:', Object.keys(localStorage).filter(k => k.startsWith('digibook_backup_')).length);
```

---

*Testing Guide Version: 1.0*  
*Last Updated: December 2024*  
*Phase: 3.2 - Data Backup & Recovery*

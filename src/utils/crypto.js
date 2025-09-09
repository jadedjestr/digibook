/**
 * Cryptographic utilities for secure data handling
 * Uses Web Crypto API for encryption/decryption operations
 */

const CRYPTO_KEY_NAME = 'digibook_crypto_key';
const STORAGE_PREFIX = 'digibook_encrypted_';

/**
 * Generate a cryptographic key for encryption/decryption
 * Uses PBKDF2 for key derivation from a password
 */
async function generateKey(password, salt) {
  try {
    // Import the password as a key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive the encryption key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000, // OWASP recommended minimum
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return key;
  } catch (error) {
    console.error('Error generating crypto key:', error);
    throw new Error('Failed to generate encryption key');
  }
}

/**
 * Generate a random salt for key derivation
 */
function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Encrypt data using AES-GCM
 */
async function encryptData(data, password) {
  try {
    const salt = generateSalt();
    const key = await generateKey(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      new TextEncoder().encode(data)
    );

    // Combine salt, IV, and encrypted data
    const combined = new Uint8Array(
      salt.length + iv.length + encryptedData.byteLength
    );
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Error encrypting data:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-GCM
 */
async function decryptData(encryptedData, password) {
  try {
    // Convert from base64
    const combined = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(char => char.charCodeAt(0))
    );

    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);

    const key = await generateKey(password, salt);

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encrypted
    );

    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error('Error decrypting data:', error);
    throw new Error(
      'Failed to decrypt data - invalid password or corrupted data'
    );
  }
}

/**
 * Secure PIN storage with encryption
 */
export const securePINStorage = {
  /**
   * Store PIN securely using encryption
   */
  async setPIN(pin) {
    try {
      if (!pin || pin.length === 0) {
        localStorage.removeItem(`${STORAGE_PREFIX}pin`);
        return;
      }

      // Use a device-specific key for encryption
      const deviceKey = await this.getDeviceKey();
      const encryptedPIN = await encryptData(pin, deviceKey);

      localStorage.setItem(`${STORAGE_PREFIX}pin`, encryptedPIN);
      return true;
    } catch (error) {
      console.error('Error storing PIN securely:', error);

      // Fallback to unencrypted storage with warning
      console.warn('Falling back to unencrypted PIN storage');
      localStorage.setItem('digibook_pin', pin);
      return false;
    }
  },

  /**
   * Retrieve and decrypt PIN
   */
  async getPIN() {
    try {
      const encryptedPIN = localStorage.getItem(`${STORAGE_PREFIX}pin`);
      if (!encryptedPIN) {
        // Check for legacy unencrypted PIN
        return localStorage.getItem('digibook_pin') || '';
      }

      const deviceKey = await this.getDeviceKey();
      const decryptedPIN = await decryptData(encryptedPIN, deviceKey);
      return decryptedPIN;
    } catch (error) {
      console.error('Error retrieving PIN:', error);

      // Fallback to unencrypted storage
      return localStorage.getItem('digibook_pin') || '';
    }
  },

  /**
   * Clear stored PIN
   */
  clearPIN() {
    localStorage.removeItem(`${STORAGE_PREFIX}pin`);
    localStorage.removeItem('digibook_pin'); // Clear legacy storage too
  },

  /**
   * Get or generate a device-specific key for encryption
   * This creates a consistent key based on device characteristics
   */
  async getDeviceKey() {
    try {
      // Try to get existing key
      const existingKey = localStorage.getItem(CRYPTO_KEY_NAME);
      if (existingKey) {
        return existingKey;
      }

      // Generate new device key based on available browser characteristics
      const deviceInfo = [
        navigator.userAgent,
        navigator.language,
        `${screen.width}x${screen.height}`,
        new Date().getTimezoneOffset().toString(),

        // Add some randomness
        Math.random().toString(36),
      ].join('|');

      // Create a hash of the device info
      const encoder = new TextEncoder();
      const data = encoder.encode(deviceInfo);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const deviceKey = hashArray
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Store the key
      localStorage.setItem(CRYPTO_KEY_NAME, deviceKey);
      return deviceKey;
    } catch (error) {
      console.error('Error generating device key:', error);

      // Fallback to a simple key
      return `digibook_fallback_key_${Date.now()}`;
    }
  },
};

/**
 * Data integrity utilities
 */
export const dataIntegrity = {
  /**
   * Validate data structure before database operations
   */
  validateAccount(account) {
    const errors = [];

    if (
      !account.name ||
      typeof account.name !== 'string' ||
      account.name.trim().length === 0
    ) {
      errors.push('Account name is required and must be a non-empty string');
    }

    if (
      typeof account.currentBalance !== 'number' ||
      isNaN(account.currentBalance)
    ) {
      errors.push('Account balance must be a valid number');
    }

    if (!account.type || !['checking', 'savings'].includes(account.type)) {
      errors.push('Account type must be either "checking" or "savings"');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate expense data
   */
  validateExpense(expense) {
    const errors = [];

    if (
      !expense.name ||
      typeof expense.name !== 'string' ||
      expense.name.trim().length === 0
    ) {
      errors.push('Expense name is required and must be a non-empty string');
    }

    if (
      typeof expense.amount !== 'number' ||
      isNaN(expense.amount) ||
      expense.amount <= 0
    ) {
      errors.push('Expense amount must be a positive number');
    }

    if (!expense.dueDate || isNaN(new Date(expense.dueDate).getTime())) {
      errors.push('Expense due date must be a valid date');
    }

    if (
      expense.accountId &&
      (typeof expense.accountId !== 'number' || expense.accountId <= 0)
    ) {
      errors.push('Account ID must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate transaction data
   */
  validateTransaction(transaction) {
    const errors = [];

    if (
      !transaction.accountId ||
      typeof transaction.accountId !== 'number' ||
      transaction.accountId <= 0
    ) {
      errors.push('Account ID is required and must be a positive number');
    }

    if (typeof transaction.amount !== 'number' || isNaN(transaction.amount)) {
      errors.push('Transaction amount must be a valid number');
    }

    if (
      !transaction.description ||
      typeof transaction.description !== 'string' ||
      transaction.description.trim().length === 0
    ) {
      errors.push(
        'Transaction description is required and must be a non-empty string'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Sanitize string input to prevent XSS
   */
  sanitizeString(input) {
    if (typeof input !== 'string') return input;

    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  },

  /**
   * Validate and sanitize category data
   */
  validateCategory(category) {
    const errors = [];

    if (
      !category.name ||
      typeof category.name !== 'string' ||
      category.name.trim().length === 0
    ) {
      errors.push('Category name is required and must be a non-empty string');
    }

    if (category.name && category.name.length > 50) {
      errors.push('Category name must be 50 characters or less');
    }

    if (
      !category.color ||
      typeof category.color !== 'string' ||
      !/^#[0-9A-F]{6}$/i.test(category.color)
    ) {
      errors.push('Category color must be a valid hex color (e.g., #FF0000)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        ...category,
        name: this.sanitizeString(category.name),
      },
    };
  },
};

/**
 * Secure data export/import utilities
 */
export const secureDataHandling = {
  /**
   * Export data with encryption
   */
  async exportData(data, password) {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      const encryptedData = await encryptData(jsonData, password);

      return {
        version: '1.0',
        encrypted: true,
        data: encryptedData,
        timestamp: new Date().toISOString(),
        checksum: await this.generateChecksum(jsonData),
      };
    } catch (error) {
      console.error('Error exporting data securely:', error);
      throw new Error('Failed to export data securely');
    }
  },

  /**
   * Import and decrypt data
   */
  async importData(encryptedExport, password) {
    try {
      if (!encryptedExport.encrypted) {
        throw new Error('Invalid export format - not encrypted');
      }

      const decryptedData = await decryptData(encryptedExport.data, password);
      const data = JSON.parse(decryptedData);

      // Verify checksum if available
      if (encryptedExport.checksum) {
        const currentChecksum = await this.generateChecksum(decryptedData);
        if (currentChecksum !== encryptedExport.checksum) {
          throw new Error(
            'Data integrity check failed - file may be corrupted'
          );
        }
      }

      return data;
    } catch (error) {
      console.error('Error importing data securely:', error);
      throw new Error(
        'Failed to import data - invalid password or corrupted file'
      );
    }
  },

  /**
   * Generate checksum for data integrity
   */
  async generateChecksum(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },
};

export default {
  securePINStorage,
  dataIntegrity,
  secureDataHandling,
  encryptData,
  decryptData,
};

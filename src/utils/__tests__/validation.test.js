import { describe, it, expect } from 'vitest';
import {
  validateAccountName,
  validateAmount,
  validatePIN,
  validateDescription,
  validateDate,
  validateCategoryName,
  sanitizeString,
} from '../validation';

describe('Validation Utils', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const result = sanitizeString('<script>alert("xss")</script>Hello');
      expect(result).toBe('scriptalert("xss")/scriptHello');
    });

    it('should remove javascript: protocol', () => {
      const result = sanitizeString('javascript:alert("xss")');
      expect(result).toBe('alert("xss")');
    });

    it('should trim whitespace', () => {
      const result = sanitizeString('  hello world  ');
      expect(result).toBe('hello world');
    });

    it('should limit length', () => {
      const longString = 'a'.repeat(1500);
      const result = sanitizeString(longString);
      expect(result.length).toBe(1000);
    });
  });

  describe('validateAccountName', () => {
    it('should validate correct account names', () => {
      const result = validateAccountName('My Checking Account');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('My Checking Account');
    });

    it('should reject empty names', () => {
      const result = validateAccountName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Account name is required');
    });

    it('should reject names that are too short', () => {
      const result = validateAccountName('A');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Account name must be at least 2 characters');
    });

    it('should reject names that are too long', () => {
      const longName = 'A'.repeat(60);
      const result = validateAccountName(longName);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Account name must be less than 50 characters');
    });
  });

  describe('validateAmount', () => {
    it('should validate correct amounts', () => {
      const result = validateAmount('100.50');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(100.50);
    });

    it('should handle currency symbols', () => {
      const result = validateAmount('$1,234.56');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(1234.56);
    });

    it('should reject negative amounts', () => {
      const result = validateAmount('-50');
      expect(result.isValid).toBe(false);
    });

    it('should reject zero amounts', () => {
      const result = validateAmount('0');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Amount must be greater than 0');
    });

    it('should reject amounts that are too large', () => {
      const result = validateAmount('1000000');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Amount must be less than $1,000,000');
    });

    it('should reject invalid formats', () => {
      const result = validateAmount('abc');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid amount (e.g., 10.50)');
    });
  });

  describe('validatePIN', () => {
    it('should validate 4-digit PINs', () => {
      const result = validatePIN('1234');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('1234');
    });

    it('should validate 6-digit PINs', () => {
      const result = validatePIN('123456');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('123456');
    });

    it('should reject PINs that are too short', () => {
      const result = validatePIN('123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('PIN must be 4-6 digits');
    });

    it('should reject PINs that are too long', () => {
      const result = validatePIN('1234567');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('PIN must be 4-6 digits');
    });

    it('should reject non-numeric PINs', () => {
      const result = validatePIN('abcd');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('PIN must be 4-6 digits');
    });
  });

  describe('validateDescription', () => {
    it('should validate correct descriptions', () => {
      const result = validateDescription('Grocery shopping');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('Grocery shopping');
    });

    it('should reject empty descriptions', () => {
      const result = validateDescription('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Description is required');
    });

    it('should reject descriptions that are too short', () => {
      const result = validateDescription('Hi');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Description must be at least 3 characters');
    });

    it('should reject descriptions that are too long', () => {
      const longDesc = 'A'.repeat(250);
      const result = validateDescription(longDesc);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Description must be less than 200 characters');
    });
  });

  describe('validateDate', () => {
    it('should validate correct dates', () => {
      const result = validateDate('2024-01-15');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('2024-01-15');
    });

    it('should reject empty dates', () => {
      const result = validateDate('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Date is required');
    });

    it('should reject invalid dates', () => {
      const result = validateDate('invalid-date');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid date');
    });

    it('should reject dates too far in the past', () => {
      const oldDate = '2010-01-01';
      const result = validateDate(oldDate);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Date cannot be more than 10 years in the past');
    });

    it('should reject dates too far in the future', () => {
      const futureDate = '2040-01-01';
      const result = validateDate(futureDate);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Date cannot be more than 10 years in the future');
    });
  });

  describe('validateCategoryName', () => {
    const existingCategories = [
      { name: 'Housing' },
      { name: 'Transportation' },
    ];

    it('should validate new category names', () => {
      const result = validateCategoryName('Food', existingCategories);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('Food');
    });

    it('should reject duplicate category names (case insensitive)', () => {
      const result = validateCategoryName('housing', existingCategories);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('A category with this name already exists');
    });

    it('should reject empty category names', () => {
      const result = validateCategoryName('', existingCategories);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Category name is required');
    });

    it('should reject category names that are too short', () => {
      const result = validateCategoryName('A', existingCategories);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Category name must be at least 2 characters');
    });

    it('should reject category names that are too long', () => {
      const longName = 'A'.repeat(35);
      const result = validateCategoryName(longName, existingCategories);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Category name must be less than 30 characters');
    });
  });
});

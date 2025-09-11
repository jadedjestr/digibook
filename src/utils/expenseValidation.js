/**
 * Expense Validation Utilities for Dual Foreign Key Architecture
 *
 * This module provides validation functions to ensure data integrity
 * in the new dual foreign key system where expenses can be paid from
 * either accounts (checking/savings) or credit cards, but not both.
 */

import { logger } from './logger';

/**
 * Validates that an expense has exactly one payment source
 *
 * @param {Object} expense - The expense object to validate
 * @param {number|null} expense.accountId - Account ID for checking/savings payment
 * @param {number|null} expense.creditCardId - Credit card ID for credit card payment
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export const validatePaymentSource = expense => {
  const hasAccount = !!expense.accountId;
  const hasCreditCard = !!expense.creditCardId;

  // Constraint: Exactly one payment source required
  if (hasAccount && hasCreditCard) {
    const error = `Expense "${expense.name || 'Unknown'}" cannot have both accountId (${expense.accountId}) and creditCardId (${expense.creditCardId}). Must choose exactly one payment source.`;
    logger.error('Payment source validation failed:', error);
    throw new Error(error);
  }

  if (!hasAccount && !hasCreditCard) {
    const error = `Expense "${expense.name || 'Unknown'}" must have either accountId or creditCardId. No payment source specified.`;
    logger.error('Payment source validation failed:', error);
    throw new Error(error);
  }

  return true;
};

/**
 * Validates credit card payment specific requirements
 *
 * Credit card payments use the two-field system:
 * - accountId: funding source (checking/savings account)
 * - targetCreditCardId: target credit card to pay
 * - creditCardId: must be null (not used for credit card payments)
 *
 * @param {Object} expense - The expense object to validate
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export const validateCreditCardPayment = expense => {
  // Only validate if this is a credit card payment
  if (expense.category !== 'Credit Card Payment') {
    return true;
  }

  // Credit card payments must have funding source (accountId)
  if (!expense.accountId) {
    const error = `Credit card payment "${expense.name || 'Unknown'}" must have a funding account (accountId). This should be a checking or savings account.`;
    logger.error('Credit card payment validation failed:', error);
    throw new Error(error);
  }

  // Credit card payments must have target credit card (targetCreditCardId)
  if (!expense.targetCreditCardId) {
    const error = `Credit card payment "${expense.name || 'Unknown'}" must have a target credit card (targetCreditCardId). This is the card being paid.`;
    logger.error('Credit card payment validation failed:', error);
    throw new Error(error);
  }

  // Credit card payments cannot use creditCardId (that's for regular expenses paid with credit cards)
  if (expense.creditCardId) {
    const error = `Credit card payment "${expense.name || 'Unknown'}" cannot have creditCardId (${expense.creditCardId}). Use targetCreditCardId instead. creditCardId is for regular expenses paid with credit cards.`;
    logger.error('Credit card payment validation failed:', error);
    throw new Error(error);
  }

  return true;
};

/**
 * Validates that account and credit card IDs are valid numbers
 *
 * @param {Object} expense - The expense object to validate
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export const validatePaymentSourceIds = expense => {
  // Validate accountId if present
  if (expense.accountId !== null && expense.accountId !== undefined) {
    if (!Number.isInteger(expense.accountId) || expense.accountId <= 0) {
      const error = `Invalid accountId: ${expense.accountId}. Must be a positive integer.`;
      logger.error('Payment source ID validation failed:', error);
      throw new Error(error);
    }
  }

  // Validate creditCardId if present
  if (expense.creditCardId !== null && expense.creditCardId !== undefined) {
    if (!Number.isInteger(expense.creditCardId) || expense.creditCardId <= 0) {
      const error = `Invalid creditCardId: ${expense.creditCardId}. Must be a positive integer.`;
      logger.error('Payment source ID validation failed:', error);
      throw new Error(error);
    }
  }

  // Validate targetCreditCardId if present
  if (
    expense.targetCreditCardId !== null &&
    expense.targetCreditCardId !== undefined
  ) {
    if (
      !Number.isInteger(expense.targetCreditCardId) ||
      expense.targetCreditCardId <= 0
    ) {
      const error = `Invalid targetCreditCardId: ${expense.targetCreditCardId}. Must be a positive integer.`;
      logger.error('Payment source ID validation failed:', error);
      throw new Error(error);
    }
  }

  return true;
};

/**
 * Comprehensive expense validation that runs all validation checks
 *
 * @param {Object} expense - The expense object to validate
 * @returns {boolean} True if all validations pass
 * @throws {Error} If any validation fails
 */
export const validateExpense = expense => {
  try {
    // Run all validation checks
    validatePaymentSourceIds(expense);
    validatePaymentSource(expense);
    validateCreditCardPayment(expense);

    logger.debug(`Expense validation passed for: ${expense.name || 'Unknown'}`);
    return true;
  } catch (error) {
    logger.error('Comprehensive expense validation failed:', error.message);
    throw error;
  }
};

/**
 * Utility function to get payment source type from expense
 *
 * @param {Object} expense - The expense object
 * @returns {string} 'account', 'creditCard', or 'none'
 */
export const getPaymentSourceType = expense => {
  if (expense.accountId) {
    return 'account';
  } else if (expense.creditCardId) {
    return 'creditCard';
  }
  return 'none';
};

/**
 * Utility function to check if expense is a credit card payment
 *
 * @param {Object} expense - The expense object
 * @returns {boolean} True if this is a credit card payment
 */
export const isCreditCardPayment = expense => {
  return expense.category === 'Credit Card Payment';
};

/**
 * Utility function to sanitize expense data for database storage
 * Ensures null values are properly set for unused fields
 *
 * @param {Object} expense - The expense object to sanitize
 * @returns {Object} Sanitized expense object
 */
export const sanitizeExpenseData = expense => {
  const sanitized = { ...expense };

  // Ensure exactly one payment source is set, others are null
  if (sanitized.accountId) {
    sanitized.creditCardId = null;
  } else if (sanitized.creditCardId) {
    sanitized.accountId = null;
  }

  // For non-credit-card payments, ensure targetCreditCardId is null
  if (sanitized.category !== 'Credit Card Payment') {
    sanitized.targetCreditCardId = null;
  }

  // Convert empty strings to null for proper database storage
  if (sanitized.accountId === '') sanitized.accountId = null;
  if (sanitized.creditCardId === '') sanitized.creditCardId = null;
  if (sanitized.targetCreditCardId === '') sanitized.targetCreditCardId = null;

  return sanitized;
};

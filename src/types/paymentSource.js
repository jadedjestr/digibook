/**
 * Payment Source Type System for Dual Foreign Key Architecture
 *
 * This module defines the type system and factory functions for handling
 * payment sources in the new architecture where expenses can be paid from
 * either accounts (checking/savings) or credit cards.
 */

import { logger } from '../utils/logger';

/**
 * Payment source type constants
 */
export const PaymentSourceTypes = {
  ACCOUNT: 'account',
  CREDIT_CARD: 'creditCard',
};

/**
 * Factory functions for creating payment source objects
 * These provide a consistent interface for creating payment sources
 * regardless of whether they're accounts or credit cards.
 */
export const createPaymentSource = {
  /**
   * Create a payment source for an account (checking/savings)
   *
   * @param {number} accountId - The account ID
   * @returns {Object} Payment source object
   */
  account: accountId => {
    if (!accountId || !Number.isInteger(accountId) || accountId <= 0) {
      throw new Error(
        `Invalid accountId: ${accountId}. Must be a positive integer.`
      );
    }

    return {
      type: PaymentSourceTypes.ACCOUNT,
      accountId,
      creditCardId: null,
    };
  },

  /**
   * Create a payment source for a credit card
   *
   * @param {number} creditCardId - The credit card ID
   * @returns {Object} Payment source object
   */
  creditCard: creditCardId => {
    if (!creditCardId || !Number.isInteger(creditCardId) || creditCardId <= 0) {
      throw new Error(
        `Invalid creditCardId: ${creditCardId}. Must be a positive integer.`
      );
    }

    return {
      type: PaymentSourceTypes.CREDIT_CARD,
      accountId: null,
      creditCardId,
    };
  },

  /**
   * Create a payment source from an existing expense object
   * This is useful for converting existing expense data to the new format
   *
   * @param {Object} expense - The expense object
   * @returns {Object|null} Payment source object or null if no payment source
   */
  fromExpense: expense => {
    if (!expense) {
      return null;
    }

    if (expense.accountId) {
      return createPaymentSource.account(expense.accountId);
    } else if (expense.creditCardId) {
      return createPaymentSource.creditCard(expense.creditCardId);
    }

    logger.warn(`Expense "${expense.name || 'Unknown'}" has no payment source`);
    return null;
  },

  /**
   * Create an empty payment source (for forms)
   *
   * @returns {Object} Empty payment source object
   */
  empty: () => ({
    type: null,
    accountId: null,
    creditCardId: null,
  }),
};

/**
 * Utility functions for working with payment sources
 */
export const PaymentSourceUtils = {
  /**
   * Check if a payment source is valid
   *
   * @param {Object} paymentSource - The payment source to validate
   * @returns {boolean} True if valid
   */
  isValid: paymentSource => {
    if (!paymentSource) return false;

    const hasAccount = !!paymentSource.accountId;
    const hasCreditCard = !!paymentSource.creditCardId;

    // Must have exactly one payment source
    if (hasAccount && hasCreditCard) return false;
    if (!hasAccount && !hasCreditCard) return false;

    // Type must match the actual data
    if (hasAccount && paymentSource.type !== PaymentSourceTypes.ACCOUNT)
      return false;
    if (hasCreditCard && paymentSource.type !== PaymentSourceTypes.CREDIT_CARD)
      return false;

    return true;
  },

  /**
   * Check if a payment source is empty
   *
   * @param {Object} paymentSource - The payment source to check
   * @returns {boolean} True if empty
   */
  isEmpty: paymentSource => {
    return (
      !paymentSource ||
      (!paymentSource.accountId && !paymentSource.creditCardId)
    );
  },

  /**
   * Get the ID from a payment source (regardless of type)
   *
   * @param {Object} paymentSource - The payment source
   * @returns {number|null} The ID or null if empty
   */
  getId: paymentSource => {
    if (!paymentSource) return null;
    return paymentSource.accountId || paymentSource.creditCardId || null;
  },

  /**
   * Convert payment source to expense fields
   * This prepares the data for database storage
   *
   * @param {Object} paymentSource - The payment source
   * @returns {Object} Object with accountId and creditCardId fields
   */
  toExpenseFields: paymentSource => {
    if (!paymentSource) {
      return {
        accountId: null,
        creditCardId: null,
      };
    }

    return {
      accountId: paymentSource.accountId || null,
      creditCardId: paymentSource.creditCardId || null,
    };
  },

  /**
   * Get display name for a payment source
   *
   * @param {Object} paymentSource - The payment source
   * @param {Array} accounts - Array of account objects
   * @param {Array} creditCards - Array of credit card objects
   * @returns {string} Display name
   */
  getDisplayName: (paymentSource, accounts = [], creditCards = []) => {
    if (!paymentSource || PaymentSourceUtils.isEmpty(paymentSource)) {
      return 'No Payment Source';
    }

    if (paymentSource.accountId) {
      const account = accounts.find(acc => acc.id === paymentSource.accountId);
      return account ? account.name : `Account #${paymentSource.accountId}`;
    }

    if (paymentSource.creditCardId) {
      const creditCard = creditCards.find(
        card => card.id === paymentSource.creditCardId
      );
      return creditCard
        ? creditCard.name
        : `Credit Card #${paymentSource.creditCardId}`;
    }

    return 'Unknown Payment Source';
  },

  /**
   * Compare two payment sources for equality
   *
   * @param {Object} source1 - First payment source
   * @param {Object} source2 - Second payment source
   * @returns {boolean} True if they represent the same payment source
   */
  isEqual: (source1, source2) => {
    if (!source1 && !source2) return true;
    if (!source1 || !source2) return false;

    return (
      source1.accountId === source2.accountId &&
      source1.creditCardId === source2.creditCardId
    );
  },
};

/**
 * Type guard functions for payment sources
 */
export const PaymentSourceTypeGuards = {
  /**
   * Check if payment source is an account
   *
   * @param {Object} paymentSource - The payment source
   * @returns {boolean} True if it's an account payment source
   */
  isAccount: paymentSource => {
    return (
      paymentSource &&
      paymentSource.type === PaymentSourceTypes.ACCOUNT &&
      !!paymentSource.accountId
    );
  },

  /**
   * Check if payment source is a credit card
   *
   * @param {Object} paymentSource - The payment source
   * @returns {boolean} True if it's a credit card payment source
   */
  isCreditCard: paymentSource => {
    return (
      paymentSource &&
      paymentSource.type === PaymentSourceTypes.CREDIT_CARD &&
      !!paymentSource.creditCardId
    );
  },
};

/**
 * Constants for form validation and error messages
 */
export const PaymentSourceConstants = {
  ERROR_MESSAGES: {
    REQUIRED: 'Payment source is required',
    INVALID_TYPE: 'Invalid payment source type',
    MULTIPLE_SOURCES: 'Cannot select both account and credit card',
    NO_SOURCE: 'Must select either an account or credit card',
    CREDIT_CARD_PAYMENT_ACCOUNT_REQUIRED:
      'Credit card payments must be funded from a checking or savings account',
    INVALID_ACCOUNT_ID: 'Invalid account ID',
    INVALID_CREDIT_CARD_ID: 'Invalid credit card ID',
  },

  LABELS: {
    ACCOUNT: 'Account',
    CREDIT_CARD: 'Credit Card',
    PAYMENT_SOURCE: 'Payment Source',
    FUNDING_ACCOUNT: 'Pay FROM (Funding Account)',
    SELECT_PAYMENT_SOURCE: 'Select payment source',
  },
};

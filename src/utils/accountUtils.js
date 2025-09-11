/**
 * Utility functions for consistent account and credit card handling
 * across the AccountSelector component and related functionality
 */

/**
 * Creates a standardized account mapping with proper ID handling
 * @param {Array} accounts - Regular accounts array
 * @param {Array} creditCards - Credit cards array
 * @param {boolean} isCreditCardPayment - Whether this is for credit card payments
 * @returns {Array} Standardized account array with proper ID mapping
 */
export const createAccountMapping = (
  accounts = [],
  creditCards = [],
  isCreditCardPayment = false
) => {
  if (isCreditCardPayment) {
    // For credit card payments: only allow checking/savings accounts (funding source)
    return accounts.map(acc => ({ ...acc, type: 'account' }));
  }

  // For regular expenses: allow all accounts (checking, savings, credit cards)
  return [
    ...accounts.map(acc => ({ ...acc, type: 'account' })),
    ...creditCards.map(card => ({
      ...card,
      type: 'creditCard',
      currentBalance: card.balance || 0,
      name: card.name || 'Unknown Card',

      // FIXED: Keep original ID for proper database operations
      // Don't override the ID - let credit cards keep their real IDs
      originalId: card.id,
    })),
  ];
};

/**
 * Finds the selected account from the standardized account array
 * @param {Array} allAccounts - Standardized account array
 * @param {number|string} value - The account ID to find
 * @param {boolean} isCreditCardPayment - Whether this is for credit card payments
 * @returns {Object|undefined} The found account or undefined
 */
export const findSelectedAccount = (
  allAccounts,
  value,
  isCreditCardPayment = false
) => {
  if (!allAccounts || !Array.isArray(allAccounts)) {
    return undefined;
  }

  // Convert value to string for consistent comparison
  const valueStr = String(value);

  if (isCreditCardPayment) {
    // For credit card payments: only look for regular accounts (funding source)
    return allAccounts.find(
      account => account.type === 'account' && String(account.id) === valueStr
    );
  }

  // For regular expenses: find account by ID (works for both regular accounts and credit cards)
  return allAccounts.find(account => String(account.id) === valueStr);
};

/**
 * Gets the correct account ID to save to the database
 * @param {Object} account - The account object
 * @returns {number|string} The ID to save (account.id for both regular accounts and credit cards)
 */
export const getAccountIdToSave = account => {
  if (!account) {
    return null;
  }

  // FIXED: Since we no longer override credit card IDs, just use account.id for all types
  return account.id;
};

/**
 * Checks if an account is currently selected
 * @param {Object} account - The account object
 * @param {number|string} currentValue - The current selected value
 * @param {boolean} isCreditCardPayment - Whether this is for credit card payments
 * @returns {boolean} Whether the account is selected
 */
export const isAccountSelected = (
  account,
  currentValue,
  isCreditCardPayment = false
) => {
  if (!account || currentValue === null || currentValue === undefined) {
    return false;
  }

  // Convert both values to strings for consistent comparison
  const currentValueStr = String(currentValue);

  if (isCreditCardPayment) {
    // For credit card payments: only regular accounts can be selected
    return account.type === 'account' && String(account.id) === currentValueStr;
  }

  // FIXED: Use account.id for all account types (both regular accounts and credit cards)
  return String(account.id) === currentValueStr;
};

/**
 * Formats balance for display with error handling
 * @param {number|string} balance - The balance to format
 * @returns {string} Formatted currency string
 */
export const formatAccountBalance = balance => {
  const numBalance =
    typeof balance === 'number' ? balance : parseFloat(balance) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(numBalance);
};

/**
 * General currency formatter for all monetary values
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted currency string with thousands separators
 */
export const formatCurrency = amount => {
  const numAmount =
    typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

/**
 * Validates account data structure
 * @param {Object} account - The account object to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateAccount = account => {
  const errors = [];

  if (!account) {
    errors.push('Account is required');
    return { isValid: false, errors };
  }

  if (!account.id && account.id !== 0) {
    errors.push('Account ID is required');
  }

  if (!account.name || typeof account.name !== 'string') {
    errors.push('Account name is required and must be a string');
  }

  if (account.type === 'creditCard') {
    if (!account.originalId && account.originalId !== 0) {
      errors.push('Credit card originalId is required');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates credit card data structure
 * @param {Object} creditCard - The credit card object to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateCreditCard = creditCard => {
  const errors = [];

  if (!creditCard) {
    errors.push('Credit card is required');
    return { isValid: false, errors };
  }

  if (!creditCard.id && creditCard.id !== 0) {
    errors.push('Credit card ID is required');
  }

  if (!creditCard.name || typeof creditCard.name !== 'string') {
    errors.push('Credit card name is required and must be a string');
  }

  if (typeof creditCard.balance !== 'number') {
    errors.push('Credit card balance must be a number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

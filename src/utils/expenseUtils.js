/**
 * Expense Utility Functions
 *
 * Provides utility functions for working with expenses, particularly
 * for finding payment sources in the V4 dual foreign key format.
 */

/**
 * Finds the payment source (account or credit card) for an expense
 * Uses V4 dual foreign key format (accountId and creditCardId as separate fields)
 *
 * @param {Object} expense - The expense object
 * @param {number|null} expense.accountId - Account ID for checking/savings
 * @param {number|null} expense.creditCardId - Credit card ID for CC payment
 * @param {Array} accounts - Array of account objects
 * @param {Array} creditCards - Array of credit card objects
 * @returns {Object|null} The account or credit card object, or null if not found
 *
 * @example
 * const paymentSource = findPaymentSource(expense, accounts, creditCards);
 * if (paymentSource) {
 *   logger.debug(paymentSource.name); // Account or credit card name
 * }
 */
export const findPaymentSource = (expense, accounts, creditCards) => {
  if (!expense) return null;

  // Priority 1: Check creditCardId (V4 format)
  if (expense.creditCardId) {
    const creditCard = creditCards.find(
      card => card.id === expense.creditCardId,
    );
    return creditCard || null;
  }

  // Priority 2: Check accountId in accounts (V4 format)
  if (expense.accountId) {
    const account = accounts.find(acc => acc.id === expense.accountId);
    return account || null;
  }

  return null;
};

/**
 * Gets payment source information for display
 * Returns an object with type and display name
 *
 * @param {Object} expense - The expense object
 * @param {Array} accounts - Array of account objects
 * @param {Array} creditCards - Array of credit card objects
 * @returns {Object} Payment source info with type and name
 */
export const getPaymentSourceInfo = (expense, accounts, creditCards) => {
  const source = findPaymentSource(expense, accounts, creditCards);

  if (!source) {
    return {
      type: 'none',
      name: 'No Payment Source',
      source: null,
    };
  }

  // Determine if it's an account or credit card
  const isCreditCard = creditCards.some(card => card.id === source.id);

  return {
    type: isCreditCard ? 'creditCard' : 'account',
    name: source.name || 'Unknown',
    source,
  };
};

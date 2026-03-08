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

/**
 * Groups expenses by category for fixed-expense totals and table display.
 * Category is expense.category or 'Uncategorized'.
 *
 * @param {Array<Object>} expenses - Array of expense objects
 * @returns {Object.<string, Array<Object>>} Map of category name to expense array
 */
export const groupExpensesByCategory = expenses => {
  if (!expenses || !Array.isArray(expenses)) return {};
  const groups = {};
  expenses.forEach(expense => {
    const category = expense.category || 'Uncategorized';
    if (!groups[category]) groups[category] = [];
    groups[category].push(expense);
  });
  return groups;
};

/**
 * Computes aggregate totals for a list of fixed expenses.
 * Single source of truth for totalAmount, totalPaid, totalRemaining, totalExpenses.
 *
 * @param {Array<Object>} expenses - Array of expense objects with amount, paidAmount
 * @returns {{ totalAmount, totalPaid, totalRemaining, totalExpenses }}
 */
export const computeFixedExpenseTotals = expenses => {
  if (!expenses || !Array.isArray(expenses)) {
    return {
      totalAmount: 0,
      totalPaid: 0,
      totalRemaining: 0,
      totalExpenses: 0,
    };
  }
  const totalAmount = expenses.reduce(
    (sum, expense) => sum + (expense.amount ?? 0),
    0,
  );
  const totalPaid = expenses.reduce(
    (sum, expense) => sum + (expense.paidAmount || 0),
    0,
  );
  const totalRemaining = expenses.reduce((total, expense) => {
    const remaining = (expense.amount ?? 0) - (expense.paidAmount || 0);
    return total + (remaining > 0 ? remaining : 0);
  }, 0);
  return {
    totalAmount,
    totalPaid,
    totalRemaining,
    totalExpenses: expenses.length,
  };
};

/**
 * Computes per-category totals from a grouped expenses map (e.g. from groupExpensesByCategory).
 * Matches shape used by ExpenseTableHeader and FixedExpensesSummaryCard.
 *
 * @param {Object.<string, Array<Object>>} expensesByCategory - category name to expense array
 * @returns {Object.<string, { count, total, totalBudgeted, paid }>}
 */
export const computeCategoryTotals = expensesByCategory => {
  if (!expensesByCategory || typeof expensesByCategory !== 'object') return {};
  const totals = {};
  Object.entries(expensesByCategory).forEach(([category, categoryExpenses]) => {
    const total = categoryExpenses.reduce((sum, expense) => {
      const remaining = (expense.amount ?? 0) - (expense.paidAmount || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);
    const totalBudgeted = categoryExpenses.reduce(
      (sum, expense) => sum + (expense.amount ?? 0),
      0,
    );
    const paid = categoryExpenses.filter(
      e => (e.paidAmount || 0) >= (e.amount ?? 0) && (e.amount ?? 0) > 0,
    ).length;
    totals[category] = {
      count: categoryExpenses.length,
      total,
      totalBudgeted,
      paid,
    };
  });
  return totals;
};

/**
 * Credit Card Utility Functions
 *
 * Handles formatting and logic for credit card balances,
 * including support for credit balances (negative debt)
 */

import { DateUtils } from './dateUtils';

/**
 * Format credit card balance with proper handling of credit balances
 *
 * @param {number} balance - The credit card balance
 * @param {boolean} showSign - Whether to show +/- signs
 * @returns {Object} Formatted balance information
 */
export const formatCreditCardBalance = (balance, showSign = false) => {
  const absBalance = Math.abs(balance);
  const isCredit = balance < 0;
  const isZero = balance === 0;

  return {
    amount: absBalance,
    formattedAmount: `$${absBalance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    isCredit,
    isZero,
    displayText: (() => {
      if (isZero) return 'Paid Off';
      return isCredit
        ? `$${absBalance.toFixed(2)} Credit${showSign ? ' (+)' : ''}`
        : `$${absBalance.toFixed(2)} Debt${showSign ? ' (-)' : ''}`;
    })(),
    shortDisplayText: (() => {
      if (isZero) return 'Paid Off';
      return isCredit
        ? `+$${absBalance.toFixed(2)}`
        : `$${absBalance.toFixed(2)}`;
    })(),
    className: (() => {
      if (isZero) return 'text-green-400';
      return isCredit ? 'text-blue-400' : 'text-yellow-400';
    })(),
    bgClassName: (() => {
      if (isZero) return 'bg-green-500/20';
      return isCredit ? 'bg-blue-500/20' : 'bg-yellow-500/20';
    })(),
    statusText: (() => {
      if (isZero) return 'Paid Off';
      return isCredit ? 'Credit Balance' : 'Outstanding Debt';
    })(),
  };
};

/**
 * Calculate available credit based on balance and credit limit
 *
 * @param {number} balance - Current balance (positive = debt, negative = credit)
 * @param {number} creditLimit - Credit limit
 * @returns {Object} Available credit information
 */
export const calculateAvailableCredit = (balance, creditLimit) => {
  const availableCredit = creditLimit - Math.max(balance, 0);
  const utilizationPercent = (Math.max(balance, 0) / creditLimit) * 100;

  return {
    available: availableCredit,
    formattedAvailable: `$${availableCredit.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    utilization: utilizationPercent,
    formattedUtilization: `${utilizationPercent.toFixed(1)}%`,
    isOverLimit: balance > creditLimit,
    utilizationLevel: getUtilizationLevel(utilizationPercent),
  };
};

/**
 * Get utilization level classification
 *
 * @param {number} utilizationPercent - Utilization percentage
 * @returns {string} Utilization level
 */
const getUtilizationLevel = utilizationPercent => {
  if (utilizationPercent === 0) return 'none';
  if (utilizationPercent <= 10) return 'excellent';
  if (utilizationPercent <= 30) return 'good';
  if (utilizationPercent <= 50) return 'fair';
  if (utilizationPercent <= 90) return 'high';
  return 'critical';
};

/**
 * How much of a card's original balance has been paid off, for the payoff
 * progress bar. Unlike utilization (a risk signal - more is worse), more
 * progress here is always better, so there is no danger/warning tier -
 * callers should always render this as "success". Mirrors
 * loanUtils.js's getLoanPayoffProgress.
 *
 * @param {Object} card
 * @param {number} [card.originalBalance] - The balance when the card was added
 * @param {number} card.balance - Current balance
 * @returns {{paidAmount: number, percent: number, isPaidOff: boolean, hasData: boolean}}
 */
export const getOriginalCardProgress = card => {
  const balance = Math.max(Number(card?.balance) || 0, 0);
  const original = Number(card?.originalBalance) || 0;
  const isPaidOff = balance <= 0;

  if (original <= 0) {
    // No original balance on record (a legacy card) - progress can't be
    // computed, but the paid-off state still can be. Callers should treat
    // hasData: false as "hide the progress bar", not "0% progress".
    return {
      paidAmount: 0,
      percent: isPaidOff ? 100 : 0,
      isPaidOff,
      hasData: false,
    };
  }

  const paidAmount = Math.max(0, original - balance);
  const percent = Math.min(100, Math.max(0, (paidAmount / original) * 100));
  return { paidAmount, percent, isPaidOff, hasData: true };
};

/**
 * How much a card's balance would need to drop to reach a target
 * utilization percentage (30% by default, the commonly-cited threshold for
 * credit-score impact). Pure arithmetic against data already computed by
 * calculateAvailableCredit - returns 0 when already at or under the target.
 *
 * @param {Object} card
 * @param {number} card.balance
 * @param {number} card.creditLimit
 * @param {number} [targetPercent=30]
 * @returns {number}
 */
export const getPayToTargetUtilization = (card, targetPercent = 30) => {
  const balance = Number(card?.balance) || 0;
  const creditLimit = Number(card?.creditLimit) || 0;
  if (creditLimit <= 0) return 0;
  const targetBalance = (targetPercent / 100) * creditLimit;
  return Math.max(0, balance - targetBalance);
};

/**
 * A credit card's interest rate for display purposes right now - the
 * intro/promotional rate while one is active (through and including its
 * end date), otherwise the card's standard rate. Local copy of the same
 * logic database-clean.js uses to price a card's payment - duplicated
 * rather than imported because that one is module-private and this is a
 * display-only read, never a financial calculation.
 *
 * @param {Object} card
 * @returns {number}
 */
export const getEffectiveCardInterestRate = card => {
  if (
    card?.hasIntroApr &&
    card?.introAprEndDate &&
    DateUtils.today() <= card.introAprEndDate
  ) {
    return Number(card.introApr) || 0;
  }
  return Number(card?.interestRate) || 0;
};

/**
 * Single source of truth for default minimum payment amount.
 * Used when auto-creating credit card payment expenses and for payment suggestions
 * so the same rule applies everywhere.
 *
 * @param {Object} card - Credit card object
 * @param {number} [card.minimumPayment] - Stored minimum payment (optional)
 * @param {number} [card.balance] - Current balance (defaults to 0 if missing)
 * @returns {number} Amount to use as the default minimum payment for this card
 */
export const getDefaultMinimumPaymentAmount = card => {
  if (!card || typeof card !== 'object') {
    return 25;
  }
  const stored = card.minimumPayment;
  if (stored != null && Number(stored) > 0) {
    return Number(stored);
  }
  const balance = Number(card.balance) || 0;
  return balance > 0 ? Math.max(balance * 0.02, 25) : 25;
};

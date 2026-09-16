/**
 * Loan Utility Functions
 *
 * Formatting and display logic for loans. Deliberately not a reuse of
 * creditCardUtils.js - a loan's balance is never a "credit" the way an
 * overpaid card's can be, and its payment is calculated toward a target
 * payoff date rather than a stored minimum, so the display framing (and
 * the badge/warning logic built on top of it) is genuinely different.
 */

/**
 * Format a loan's remaining balance for display.
 *
 * @param {number} balance - Current remaining principal
 * @returns {Object} Formatted balance information
 */
export const formatLoanBalance = balance => {
  const amount = Math.max(Number(balance) || 0, 0);
  const isPaidOff = amount <= 0;

  return {
    amount,
    formattedAmount: `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    isPaidOff,
    displayText: isPaidOff ? 'Paid Off' : `$${amount.toFixed(2)} Remaining`,
    className: isPaidOff ? 'text-green-400' : 'text-yellow-400',
    statusText: isPaidOff ? 'Paid Off' : 'Remaining Balance',
  };
};

/**
 * How much of the original principal has been paid off, for the payoff
 * progress bar. Unlike credit-card utilization (a risk signal - more is
 * worse), more progress here is always better, so there is no
 * danger/warning tier - callers should always render this as "success".
 *
 * @param {Object} loan
 * @param {number} [loan.principalAmount] - Original loan amount
 * @param {number} loan.balance - Current remaining principal
 * @returns {{paidAmount: number, percent: number, isPaidOff: boolean}}
 */
export const getLoanPayoffProgress = loan => {
  const balance = Math.max(Number(loan?.balance) || 0, 0);
  const principal = Number(loan?.principalAmount) || 0;
  const isPaidOff = balance <= 0;

  if (principal <= 0) {
    // No original amount on record - progress can't be computed, but the
    // paid-off state still can be.
    return { paidAmount: 0, percent: isPaidOff ? 100 : 0, isPaidOff };
  }

  const paidAmount = Math.max(0, principal - balance);
  const percent = Math.min(100, Math.max(0, (paidAmount / principal) * 100));
  return { paidAmount, percent, isPaidOff };
};

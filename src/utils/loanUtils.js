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
 * @param {number} [loan.originalLoanAmount] - The amount actually borrowed
 * @param {number} loan.balance - Current remaining principal
 * @returns {{paidAmount: number, percent: number, isPaidOff: boolean}}
 */
export const getLoanPayoffProgress = loan => {
  const balance = Math.max(Number(loan?.balance) || 0, 0);
  const principal = Number(loan?.originalLoanAmount) || 0;
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

/**
 * Whole calendar months between two YYYY-MM-DD date strings. Local copy of
 * the same calculation database-clean.js uses to price a loan's payment -
 * duplicated rather than imported because that one is module-private and
 * this is a display-only comparison, never a financial calculation.
 */
const wholeMonthsBetween = (fromDate, toDate) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  const yearDiffInMonths = (to.getFullYear() - from.getFullYear()) * 12;
  const monthDiff = to.getMonth() - from.getMonth();
  let months = yearDiffInMonths + monthDiff;
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
};

/**
 * Compares the user's chosen target payoff date and the calculated payment
 * required to hit it against the loan's actual original contract terms -
 * the reconciliation between "what I'm aiming for" and "what I signed up
 * for". Purely informational: never alters the target-date-driven payment
 * calculation, which remains the single source of truth for what's billed.
 *
 * @param {Object} loan
 * @param {string} [loan.targetPayoffDate]
 * @param {string} [loan.originalMaturityDate]
 * @param {number} [loan.originalScheduledPayment]
 * @param {number} calculatedPayment - the live payment from
 *   calculateRequiredLoanPayment, for the $ comparison
 * @returns {{monthsAheadOfSchedule: number|null, paymentDelta: number|null}}
 *   monthsAheadOfSchedule > 0 means the target beats the original maturity
 *   date; paymentDelta < 0 means the calculated payment is less than the
 *   original scheduled payment.
 */
export const getOriginalScheduleComparison = (loan, calculatedPayment) => {
  const monthsAheadOfSchedule =
    loan?.targetPayoffDate && loan?.originalMaturityDate
      ? wholeMonthsBetween(loan.targetPayoffDate, loan.originalMaturityDate)
      : null;

  const paymentDelta =
    Number.isFinite(calculatedPayment) &&
    Number.isFinite(loan?.originalScheduledPayment)
      ? calculatedPayment - loan.originalScheduledPayment
      : null;

  return { monthsAheadOfSchedule, paymentDelta };
};

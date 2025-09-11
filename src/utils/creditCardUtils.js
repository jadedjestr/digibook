/**
 * Credit Card Utility Functions
 *
 * Handles formatting and logic for credit card balances,
 * including support for credit balances (negative debt)
 */

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
    displayText: isZero
      ? 'Paid Off'
      : isCredit
        ? `$${absBalance.toFixed(2)} Credit${showSign ? ' (+)' : ''}`
        : `$${absBalance.toFixed(2)} Debt${showSign ? ' (-)' : ''}`,
    shortDisplayText: isZero
      ? 'Paid Off'
      : isCredit
        ? `+$${absBalance.toFixed(2)}`
        : `$${absBalance.toFixed(2)}`,
    className: isZero
      ? 'text-green-400'
      : isCredit
        ? 'text-blue-400'
        : 'text-yellow-400',
    bgClassName: isZero
      ? 'bg-green-500/20'
      : isCredit
        ? 'bg-blue-500/20'
        : 'bg-yellow-500/20',
    statusText: isZero
      ? 'Paid Off'
      : isCredit
        ? 'Credit Balance'
        : 'Outstanding Debt',
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
 * Get minimum payment status information
 *
 * @param {number} balance - Current balance
 * @param {number} minimumPayment - Minimum payment amount
 * @param {number} paidAmount - Amount already paid
 * @returns {Object} Minimum payment status
 */
export const getMinimumPaymentStatus = (
  balance,
  minimumPayment,
  paidAmount = 0
) => {
  // No minimum payment needed if balance is zero or negative (credit)
  if (balance <= 0) {
    return {
      needed: false,
      amount: 0,
      remaining: 0,
      status: 'not_needed',
      statusText: 'No Payment Needed',
      className: 'text-green-400',
    };
  }

  const remaining = Math.max(minimumPayment - paidAmount, 0);
  const isComplete = paidAmount >= minimumPayment;

  return {
    needed: true,
    amount: minimumPayment,
    remaining,
    status: isComplete ? 'complete' : 'pending',
    statusText: isComplete
      ? 'Minimum Met'
      : `$${remaining.toFixed(2)} Remaining`,
    className: isComplete ? 'text-green-400' : 'text-yellow-400',
  };
};

/**
 * Calculate interest savings from overpayment
 *
 * @param {number} balance - Current balance
 * @param {number} payment - Payment amount
 * @param {number} interestRate - Annual interest rate (percentage)
 * @returns {Object} Interest savings information
 */
export const calculateInterestSavings = (balance, payment, interestRate) => {
  if (balance <= 0 || payment <= 0) {
    return {
      savings: 0,
      formattedSavings: '$0.00',
      monthsSaved: 0,
    };
  }

  const monthlyRate = interestRate / 100 / 12;
  const minimumPayment = Math.max(balance * 0.02, 25); // Assume 2% minimum

  // Calculate payoff time with minimum payment
  let minBalance = balance;
  let minMonths = 0;
  let minTotalInterest = 0;

  while (minBalance > 0.01 && minMonths < 600) {
    const interest = minBalance * monthlyRate;
    const principal = Math.min(minimumPayment - interest, minBalance);
    minTotalInterest += interest;
    minBalance -= principal;
    minMonths++;
  }

  // Calculate payoff time with actual payment
  let actualBalance = balance;
  let actualMonths = 0;
  let actualTotalInterest = 0;

  while (actualBalance > 0.01 && actualMonths < 600) {
    const interest = actualBalance * monthlyRate;
    const principal = Math.min(payment - interest, actualBalance);
    actualTotalInterest += interest;
    actualBalance -= principal;
    actualMonths++;
  }

  const interestSavings = minTotalInterest - actualTotalInterest;
  const monthsSaved = minMonths - actualMonths;

  return {
    savings: interestSavings,
    formattedSavings: `$${interestSavings.toFixed(2)}`,
    monthsSaved: Math.max(monthsSaved, 0),
    formattedMonthsSaved:
      monthsSaved > 0 ? `${monthsSaved} months` : 'No time saved',
  };
};

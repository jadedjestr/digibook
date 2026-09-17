import { parseMoneyInput } from './validation';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function civilDay(value) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value))
    throw new Error('Invalid loan date');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (
    year < 1900 ||
    year > 9999 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw new Error('Invalid loan date');
  return date.getTime() / 86400000;
}

export function validateInterestState(loan) {
  for (const [field, minimum] of [
    ['balance', 0],
    ['interestRate', 0],
    ['unpaidInterest', -0.00500001],
  ]) {
    const value = loan[field] ?? 0;
    if (!Number.isFinite(value) || value < minimum || value > 1e10)
      throw new Error(`Invalid loan ${field}`);
  }
  if (loan.interestAccruedThrough) civilDay(loan.interestAccruedThrough);
}

/**
 * Round-half-up to the cent, with a narrow floating-point tolerance so
 * representable noise (e.g. 0.1 + 0.2) doesn't flip a rounding decision
 * at a cent boundary. The one place every loan-interest dollar amount
 * gets rounded - interest itself is never rounded while it's accruing.
 */
export function roundMoney(amount) {
  // A fixed absolute tolerance, well above float noise from chained
  // arithmetic (typically ~1e-10 to 1e-13) and well below a hundredth of
  // a cent, so a value that's really AT a half-cent boundary rounds
  // predictably instead of falling the wrong way on representable noise
  // (e.g. 0.145 landing as 0.14499999999999).
  const TOLERANCE = 1e-9;
  const nudge = amount >= 0 ? TOLERANCE : -TOLERANCE;
  return Math.round((amount + nudge) * 100) / 100;
}

/**
 * Interest accrual and, when `payment` is given, payment allocation for a
 * loan with real-interest tracking on (loan.interestAccruedThrough is a
 * valid date). Pure - no DB access. Interest accrues over actual elapsed
 * civil calendar days (UTC civil-day ordinals) divided by a fixed 365,
 * regardless of leap years - a leap day inside the interval still counts
 * as one elapsed day, the denominator never changes to 366. Same-day
 * calls accrue no new interest.
 *
 * `unpaidInterest` itself is never rounded while it's just accruing -
 * only at the two moments that actually matter: showing a number to the
 * user (display), and turning a raw amount into real, cent-precision
 * cash (a payment). This is why `interestAfter` below is signed and NOT
 * clamped to zero - cent-precision cash allocated against an exact raw
 * interest amount rarely lands on it perfectly, and the sub-cent
 * remainder (credit or debit) carries forward into the next accrual
 * instead of being silently discarded.
 *
 * @param {{balance:number, interestRate:number, unpaidInterest:number,
 *   interestAccruedThrough:string}} loan
 * @param {string} asOfIso - today's date (display) or the payment date
 *   (posting)
 * @param {number} [payment] - cash amount being applied; omit for a
 *   display-only projection
 * @returns {{
 *   rawInterest: number,
 *   collectibleInterest: number,
 *   totalOwedToday: number,
 *   interestPaid?: number,
 *   principalPaid?: number,
 *   principalAfter?: number,
 *   interestAfter?: number,
 *   payoff?: number,
 * }}
 */
export function computeLoanInterest(loan, asOfIso, payment) {
  const daysElapsed = civilDay(asOfIso) - civilDay(loan.interestAccruedThrough);
  if (daysElapsed < 0)
    throw new Error('Payment date precedes the loan balance date');
  validateInterestState(loan);
  if (payment !== undefined) {
    const parsed = parseMoneyInput(payment);
    if (
      !parsed.ok ||
      payment < 0 ||
      Math.abs(roundMoney(payment) - payment) > 1e-8
    ) {
      throw new Error('Payment must be a finite cent-precision amount');
    }
  }
  const balance = Number(loan.balance || 0);
  const accruedSince =
    balance * (Number(loan.interestRate || 0) / 100 / 365) * daysElapsed;
  const rawInterest = Number(loan.unpaidInterest || 0) + accruedSince;
  const collectibleInterest = Math.max(0, roundMoney(rawInterest));

  if (payment === undefined) {
    return {
      rawInterest,
      collectibleInterest,
      totalOwedToday: roundMoney(balance + collectibleInterest),
    };
  }

  const payoff = roundMoney(balance + collectibleInterest);
  if (payment > payoff) {
    throw new Error(
      `Payment ${payment} exceeds payoff amount ${payoff} for loan ${loan.id}`,
    );
  }

  const interestPaid = Math.min(payment, collectibleInterest);
  const principalPaid = roundMoney(payment - interestPaid);
  const principalAfter = roundMoney(balance - principalPaid);
  let interestAfter = rawInterest - interestPaid;

  // Full payoff clears only the sub-cent residual - never real unpaid
  // interest just because principal reaches zero.
  if (principalAfter === 0 && payment === payoff) {
    interestAfter = 0;
  }

  return {
    rawInterest,
    collectibleInterest,
    totalOwedToday: payoff,
    interestPaid,
    principalPaid,
    principalAfter,
    interestAfter,
    payoff,
  };
}

/** Validate portable loan state before a replace-import clears any tables. */
export function validatePortableLoans(data) {
  if (data.version !== undefined && Number(data.version) > 12)
    throw new Error('Unsupported backup version');
  if (data.loans != null && !Array.isArray(data.loans))
    throw new Error('Invalid loans array');
  for (const loan of data.loans || []) {
    if (!loan.interestAccruedThrough) continue;
    validateInterestState(loan);
    if (
      !Number.isSafeInteger(loan.interestStateVersion ?? 0) ||
      (loan.interestStateVersion ?? 0) < 0
    )
      throw new Error('Invalid loan version');
    const receipt = loan.lastInterestOperation;
    if (!receipt) continue;

    // Old receipts are kept for history but never offered as actionable undo.
    if (receipt.version === undefined) continue;
    if (receipt.version !== 2 || !['active', 'undone'].includes(receipt.status))
      throw new Error('Unsupported loan receipt');
    for (const state of [receipt.before, receipt.after]) {
      if (!state || !state.interestAccruedThrough)
        throw new Error('Incomplete loan receipt');
      validateInterestState(state);
    }
    civilDay(receipt.effectiveDate);
    const calculated =
      receipt.cashAmount === 0
        ? {
            principalAfter: receipt.before.balance,
            interestAfter: receipt.before.unpaidInterest,
            interestPaid: 0,
            principalPaid: 0,
          }
        : computeLoanInterest(
            receipt.before,
            receipt.effectiveDate,
            receipt.cashAmount,
          );
    if (
      Math.abs(calculated.principalAfter - receipt.after.balance) > 1e-8 ||
      Math.abs(calculated.interestAfter - receipt.after.unpaidInterest) >
        1e-8 ||
      calculated.interestPaid !== receipt.interestPaid ||
      calculated.principalPaid !== receipt.principalPaid ||
      receipt.before.interestRate !== receipt.after.interestRate ||
      receipt.after.interestAccruedThrough !==
        (receipt.cashAmount === 0
          ? receipt.before.interestAccruedThrough
          : receipt.effectiveDate)
    )
      throw new Error('Inconsistent receipt calculation');

    for (const key of [
      'cashAmount',
      'interestPaid',
      'principalPaid',
      'previousExpensePaidAmount',
    ]) {
      if (
        !Number.isFinite(receipt[key]) ||
        receipt[key] < 0 ||
        Math.abs(roundMoney(receipt[key]) - receipt[key]) > 1e-8
      )
        throw new Error('Invalid receipt amount');
    }
    if (
      Math.abs(
        receipt.interestPaid + receipt.principalPaid - receipt.cashAmount,
      ) > 1e-8
    )
      throw new Error('Receipt allocations disagree');
    if (
      !Number.isSafeInteger(receipt.versionAfter) ||
      receipt.versionAfter < 1 ||
      typeof receipt.operationId !== 'string' ||
      !receipt.operationId ||
      typeof receipt.requestSignature !== 'string'
    )
      throw new Error('Invalid receipt identity');
    const expectedVersion =
      receipt.status === 'active'
        ? receipt.versionAfter
        : receipt.undoneVersion;
    if (loan.interestStateVersion !== expectedVersion)
      throw new Error('Receipt version disagrees with loan');
    const expectedState =
      receipt.status === 'active' ? receipt.after : receipt.before;
    if (
      [
        'balance',
        'interestRate',
        'unpaidInterest',
        'interestAccruedThrough',
      ].some(key => loan[key] !== expectedState[key])
    )
      throw new Error('Receipt state disagrees with loan');
    const account = (data.accounts || []).find(
      row => row.id === receipt.affectedAccountId,
    );
    const expense = (data.fixedExpenses || []).find(
      row => row.id === receipt.affectedExpenseId,
    );
    if (
      !account ||
      !expense ||
      !receipt.expenseAfter ||
      receipt.expenseAfter.id !== expense.id
    )
      throw new Error('Missing receipt references');
    if (receipt.cycle) {
      const cycle = receipt.cycle;
      if (
        !cycle.templateBefore ||
        !cycle.templateAfter ||
        !cycle.resolutionAfter ||
        !Array.isArray(cycle.existingExpenseIds)
      )
        throw new Error('Incomplete recurring receipt');
      if (
        !(data.recurringExpenseTemplates || []).some(
          row => row.id === cycle.templateBefore.id,
        ) ||
        !(data.recurringResolutionLog || []).some(
          row => row.id === cycle.resolutionAfter.id,
        )
      )
        throw new Error('Missing recurring receipt references');
      if (
        cycle.adjustmentAfter &&
        !(data.fixedExpenses || []).some(
          row => row.id === cycle.adjustmentAfter.id,
        )
      )
        throw new Error('Missing catch-up bill');
    }
  }
}

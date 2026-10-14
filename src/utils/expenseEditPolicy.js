/**
 * What a user may change on a bill from the Edit modal, and what the modal
 * should say about each field. One pure function so the modal, the priority
 * row and the one-offs list can never disagree about it.
 *
 * Every lock below exists because the value has an owner other than the bill,
 * or because changing it here breaks something the database layer cannot
 * catch on its own:
 *
 * - A card or loan payment's amount is re-priced from the card/loan whenever
 *   that card/loan changes, so a typed amount would be silently reverted. Its
 *   due date and funding account are written back to the card/loan and then
 *   fanned out to every payment bill for it, paid history included.
 * - A recurring bill is matched to its cycle by its exact due date (see
 *   `materializeCurrentCycle` and `computeCycleStates`). Move the date and the
 *   next materialization creates a second bill for the same cycle.
 * - The database accepts an amount at or below what is already paid. That
 *   leaves a bill that is neither owed nor paid, so the floor lives here.
 *
 * "Pay later" for a repeating bill is the Pay now flow's "after my next
 * paycheck" choice, which moves the unpaid part safely.
 */

const money = value => Number(value || 0);

/**
 * @param {Object} expense - a fixedExpenses row
 * @param {Object} [options]
 * @param {boolean} [options.isBalanceDue] - this row is a shortfall spun off
 *   from another bill's cycle (a fact from the resolution log, not derivable
 *   from the row itself)
 * @returns {{
 *   kindLabel: string,
 *   fields: {
 *     name: { locked: boolean, reason: string|null },
 *     amount: { locked: boolean, reason: string|null, mustExceed: number },
 *     dueDate: { locked: boolean, reason: string|null },
 *     paymentSource: { locked: boolean, reason: string|null },
 *   },
 *   removal: { action: 'delete'|'skipOrStop'|'none', reason: string|null },
 * }}
 */
export const getExpenseEditPolicy = (
  expense,
  { isBalanceDue = false } = {},
) => {
  const paid = money(expense.paidAmount);
  const isLoanBill = Boolean(expense.targetLoanId);
  const isCardBill = Boolean(expense.targetCreditCardId);
  const isDebtBill = isLoanBill || isCardBill;
  const isRecurring = Boolean(expense.recurringTemplateId);
  const owner = isLoanBill ? 'Loans' : 'Credit Cards';

  let kindLabel = 'One-off bill';
  if (isBalanceDue) kindLabel = 'Balance due';
  else if (isLoanBill) kindLabel = 'Loan payment';
  else if (isCardBill) kindLabel = 'Card payment';
  else if (isRecurring) kindLabel = 'Repeating bill';

  // A card bill is only re-priced while it is linked to its payment template;
  // a template-less legacy bill, and a Balance Due, are plain numbers. A loan
  // bill is re-priced either way.
  const amountLocked = isLoanBill || (isCardBill && isRecurring);

  let amountReason = null;
  if (amountLocked) {
    amountReason = isLoanBill
      ? 'Priced from your loan’s schedule. Change it on the Loans page.'
      : 'Priced by your card’s payment setting. Change it on the Credit Cards page.';
  }

  const dueDateLocked = isDebtBill || isRecurring;
  let dueDateReason = null;
  if (isDebtBill) {
    dueDateReason = `This is the due date on your ${isLoanBill ? 'loan' : 'card'}. Change it on the ${owner} page.`;
  } else if (isRecurring) {
    dueDateReason =
      'Repeating bills keep their date. To pay later, use Pay now and choose "after my next paycheck".';
  }

  const sourceLocked = isDebtBill || paid > 0;
  let sourceReason = null;
  if (isDebtBill) {
    sourceReason = `Payments for this ${isLoanBill ? 'loan' : 'card'} use one funding account. Change it on the ${owner} page.`;
  } else if (paid > 0) {
    sourceReason = 'A payment has already been made from this source.';
  }

  let removal = { action: 'delete', reason: null };
  if (paid > 0) {
    removal = {
      action: 'none',
      reason: 'A payment is already recorded, so this bill can’t be deleted.',
    };
  } else if (isBalanceDue) {
    removal = { action: 'delete', reason: null };
  } else if (isRecurring) {
    removal = { action: 'skipOrStop', reason: null };
  } else if (isDebtBill) {
    removal = {
      action: 'none',
      reason: `Manage this payment from the ${owner} page.`,
    };
  }

  return {
    kindLabel,
    fields: {
      name: { locked: false, reason: null },
      amount: {
        locked: amountLocked,
        reason: amountReason,
        mustExceed: Math.max(paid, 0),
      },
      dueDate: { locked: dueDateLocked, reason: dueDateReason },
      paymentSource: { locked: sourceLocked, reason: sourceReason },
    },
    removal,
  };
};

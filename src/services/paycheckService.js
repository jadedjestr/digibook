import { calculateNextPayDates } from '../constants/payFrequency';
import { DateUtils } from '../utils/dateUtils';

export class PaycheckService {
  constructor(paycheckSettings) {
    this.settings = paycheckSettings;
  }

  calculatePaycheckDates() {
    return calculateNextPayDates(
      this.settings?.lastPaycheckDate,
      this.settings?.frequency,
    );
  }

  /**
   * How much of an expense has been paid — independent of when it's due.
   *
   * This and getTimingBucket() are the two orthogonal facts that used to be
   * collapsed into one status string. A bill can genuinely be both "43%
   * paid" and "overdue" at once; the old single-value status could only ever
   * report one, so calculateSummaryTotals — which needs real dollar amounts,
   * not a display label — silently dropped every partially-paid expense
   * from every total. See calculateExpenseStatus() for how these two facts
   * recombine for display, and calculateSummaryTotals() for why the totals
   * now read these directly instead of going through that display value.
   */
  getPaymentProgress(expense) {
    const { amount, paidAmount = 0 } = expense;
    if (paidAmount >= amount) return 'Paid';
    if (paidAmount > 0) return 'Partial';
    return 'Unpaid';
  }

  /**
   * When an expense falls due, relative to today and the next two
   * paychecks — independent of whether any of it has been paid.
   *
   * Returns null only when the due date itself can't be parsed; every
   * comparison below is false for an Invalid Date, so a malformed date
   * would otherwise silently fall through every bucket rather than
   * signalling that it couldn't be classified.
   */
  getTimingBucket(expense, paycheckDates) {
    const { dueDate } = expense;
    const { nextPayDate, followingPayDate } = paycheckDates;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day for comparison

    const due = DateUtils.parseDate(dueDate);
    const nextPay = DateUtils.parseDate(nextPayDate);
    const followingPay = DateUtils.parseDate(followingPayDate);

    if (!due || Number.isNaN(due.getTime())) return null;

    if (due < today) return 'Overdue';
    if (due <= nextPay) return 'This Week';
    if (due <= followingPay) return 'Next Check';
    return 'Following Check';
  }

  /**
   * The single-value display status every existing badge reads.
   *
   * Deliberately reproduces the old priority order — Paid, then Overdue,
   * then Partially Paid, then the timing buckets — with exactly one
   * behaviour change: overdue now outranks "partially paid" instead of
   * being hidden behind it, so a bill that is both can finally show as
   * overdue. That was the actual defect; everything else here is an
   * unchanged simplification, not a source of truth — calculateSummaryTotals
   * no longer reads this at all, precisely so a future display tweak here
   * can never again silently change what a dollar total adds up to.
   *
   * @param {Object} expense
   * @param {Object} paycheckDates
   * @param {Set<string>} [resolvedExpenseIds] - optional; expense ids with
   *   a non-deleted recurringResolutionLog entry. A resolved recurring
   *   cycle can have paidAmount < amount (a partial payment that already
   *   advanced the template's cadence) without still being owed - without
   *   this short-circuit it would otherwise display as Overdue/Partially
   *   Paid forever. Omitted entirely, this function behaves exactly as it
   *   did before resolveCycle existed - every existing caller that hasn't
   *   been updated to pass this keeps working unchanged.
   */
  calculateExpenseStatus(expense, paycheckDates, resolvedExpenseIds) {
    if (resolvedExpenseIds?.has(expense.id)) return 'Resolved';

    const progress = this.getPaymentProgress(expense);
    if (progress === 'Paid') return 'Paid';

    const timing = this.getTimingBucket(expense, paycheckDates);
    if (timing === 'Overdue') return 'Overdue';
    if (progress === 'Partial') return 'Partially Paid';

    switch (timing) {
      case 'This Week':
        return 'Pay This Week';
      case 'Next Check':
        return 'Pay with Next Check';
      case 'Following Check':
        return 'Pay with Following Check';
      default:
        return 'Unknown';
    }
  }

  // Get status color for badges
  getStatusColor(status) {
    switch (status) {
      case 'Resolved':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'Paid':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'Partially Paid':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'Overdue':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'Pay This Week':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'Pay with Next Check':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Pay with Following Check':
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  }

  /**
   * Calculate summary totals for different payment categories.
   *
   * Reads getPaymentProgress()/getTimingBucket() directly rather than
   * switching on calculateExpenseStatus()'s display string. That string
   * collapses "partially paid" over whatever is still owed and when it's
   * due, so a bill that was 43% paid used to vanish from every bucket here
   * — not a wrong amount, an absent one, because 'Partially Paid'
   * was never one of the switch's cases. Money owed and when it's due are
   * independent facts; only reading them independently keeps that from
   * happening again.
   *
   * @param {Array} expenses
   * @param {Object} paycheckDates
   * @param {Set<string>} [resolvedExpenseIds] - optional; expense ids with
   *   a non-deleted recurringResolutionLog entry. A resolved recurring
   *   cycle can have paidAmount < amount (Skip is £0, a partial is the
   *   rest) without still being owed — its shortfall lives in the spun-off
   *   Balance Due expense, a different id that is NOT in this set and
   *   keeps counting. Without this, a skip double-counts the debt: the
   *   resolved original and its Balance Due both land in a bucket. Omitted
   *   entirely, this function behaves exactly as it did before
   *   resolveCycle existed — every existing caller that hasn't been
   *   updated to pass this keeps working unchanged.
   */
  calculateSummaryTotals(expenses, paycheckDates, resolvedExpenseIds) {
    const totals = {
      payThisWeekTotal: 0,
      payNextCheckTotal: 0,
      overdueTotal: 0,
    };

    expenses.forEach(expense => {
      if (this.getPaymentProgress(expense) === 'Paid') return;
      if (resolvedExpenseIds?.has(expense.id)) return;

      const remainingAmount = expense.amount - (expense.paidAmount || 0);
      if (remainingAmount <= 0) return;

      const timing = this.getTimingBucket(expense, paycheckDates);

      switch (timing) {
        case 'This Week':
          totals.payThisWeekTotal += remainingAmount;
          break;
        case 'Next Check':
          totals.payNextCheckTotal += remainingAmount;
          break;
        case 'Overdue':
          totals.overdueTotal += remainingAmount;
          break;

        // 'Following Check' and an unparseable due date are intentionally
        // excluded — the former doesn't need immediate attention, the
        // latter can't be placed in any bucket honestly.
      }
    });

    return totals;
  }
}

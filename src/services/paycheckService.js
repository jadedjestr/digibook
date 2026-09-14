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
   */
  calculateExpenseStatus(expense, paycheckDates) {
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
   * — not just be miscounted, entirely absent, because 'Partially Paid'
   * was never one of the switch's cases. Money owed and when it's due are
   * independent facts; only reading them independently keeps that from
   * happening again.
   */
  calculateSummaryTotals(expenses, paycheckDates) {
    const totals = {
      payThisWeekTotal: 0,
      payNextCheckTotal: 0,
      overdueTotal: 0,
    };

    expenses.forEach(expense => {
      if (this.getPaymentProgress(expense) === 'Paid') return;

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

  // Check if monthly reset should be prompted
  shouldPromptReset(expenses, paycheckDates) {
    if (!expenses.length) return false;

    const today = new Date();
    const nextPayDate = new Date(paycheckDates.nextPayDate);

    // Check if all expenses are paid or overdue.
    //
    // A side effect of fixing calculateExpenseStatus(): a bill that is both
    // overdue and partially paid used to report 'Partially Paid' here,
    // which is neither 'Paid' nor 'Overdue' — so a single lingering partial
    // payment could silently block this prompt forever, even once every
    // other bill in the period was settled or overdue. It now reports
    // 'Overdue' and counts toward this check, the same as a bill that was
    // never paid at all. That reads as the intended behaviour — a period
    // whose only remaining bill is overdue has run its course whether or
    // not part of it was paid — but it is a genuine behaviour change here,
    // not just a display fix, so it's called out on its own.
    const allPaidOrOverdue = expenses.every(expense => {
      const status = this.calculateExpenseStatus(expense, paycheckDates);
      return status === 'Paid' || status === 'Overdue';
    });

    // Check if next paycheck is in a new calendar month
    const nextPayMonth = nextPayDate.getMonth();
    const todayMonth = today.getMonth();
    const nextPayYear = nextPayDate.getFullYear();
    const todayYear = today.getFullYear();

    const isNewMonth =
      nextPayYear > todayYear ||
      (nextPayYear === todayYear && nextPayMonth > todayMonth);

    return allPaidOrOverdue && isNewMonth;
  }
}

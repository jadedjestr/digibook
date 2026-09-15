import { DateUtils } from './dateUtils';
import { PAY_CYCLE_NUDGE_CONFIG } from './payCycleNudgeConfig';

/**
 * Get month key YYYY-MM for a Date.
 */
export function getMonthKey(date) {
  if (!date || !(date instanceof Date)) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get the previous calendar month key for a given month Date.
 */
export function getLastMonthKey(currentMonth) {
  if (!currentMonth || !(currentMonth instanceof Date)) return null;
  const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  d.setMonth(d.getMonth() - 1);
  return getMonthKey(d);
}

/**
 * Filter expenses whose due date falls in the given month (first to last day).
 */
export function getExpensesInMonth(expenses, monthKey) {
  if (!expenses?.length || !monthKey) return [];
  const [y, m] = monthKey.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return expenses.filter(exp => {
    const parsed = DateUtils.parseDate(exp.dueDate);
    if (!parsed) return false;
    return parsed >= start && parsed <= end;
  });
}

/**
 * True if expense is unpaid or partially paid.
 */
export function isUnpaidOrPartial(expense) {
  if (!expense) return false;
  const paid = expense.paidAmount ?? 0;
  const amount = expense.amount ?? 0;
  return paid < amount;
}

/**
 * True when today is within config.daysNearEndOfMonth of the end of currentMonth,
 * and currentMonth is the same as today's month.
 */
export function isNearEndOfMonth(
  today,
  currentMonth,
  config = PAY_CYCLE_NUDGE_CONFIG,
) {
  if (
    !today ||
    !currentMonth ||
    !(today instanceof Date) ||
    !(currentMonth instanceof Date)
  )
    return false;
  const days = config?.daysNearEndOfMonth ?? 7;
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();
  const viewMonth = currentMonth.getMonth();
  const viewYear = currentMonth.getFullYear();
  if (todayMonth !== viewMonth || todayYear !== viewYear) return false;
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const daysFromEnd = Math.ceil((lastDay - today) / (1000 * 60 * 60 * 24));
  return daysFromEnd >= 0 && daysFromEnd <= days;
}

/**
 * Get the single nudge to show, or null. Priority: past_month -> catch_up.
 *
 * @param {Object} options
 * @param {Array} options.fixedExpenses - All fixed expenses
 * @param {Date} options.currentMonth - Viewed month
 * @param {Array} options.currentMonthExpenses - Expenses in viewed month
 * @param {Date} [options.today] - Default: new Date()
 * @param {Set|Object} [options.dismissed] - Set of dismissKeys to skip
 * @param {Object} [options.config] - Override PAY_CYCLE_NUDGE_CONFIG
 * @param {Array} [options.virtualGapCycles] - Virtual Ledger 'virtual'
 *   entries for last month, already shaped like an expense (dueDate,
 *   amount, paidAmount: 0). A cycle a template's own cadence implies but
 *   that never became a real row - e.g. a template whose startDate
 *   predates its first materialized cycle. Merged into last month's
 *   unpaid count so the past_month nudge catches gaps a real-row-only
 *   scan structurally cannot.
 * @returns {{ nudge: object|null }}
 */
export function getPayCycleNudge({
  fixedExpenses = [],
  currentMonth,
  currentMonthExpenses = [],
  today = new Date(),
  dismissed = new Set(),
  config = PAY_CYCLE_NUDGE_CONFIG,
  virtualGapCycles = [],
}) {
  const dismissedSet =
    dismissed instanceof Set ? dismissed : new Set(Object.keys(dismissed));
  const todayDate = today instanceof Date ? today : new Date(today);
  todayDate.setHours(0, 0, 0, 0);

  const todayKey = getMonthKey(todayDate);
  const currentMonthKey = currentMonth ? getMonthKey(currentMonth) : null;
  const lastMonthKey = currentMonth ? getLastMonthKey(currentMonth) : null;

  // 1. Past month: today is after last month; last month has unpaid; not dismissed
  if (lastMonthKey && todayKey && todayKey > lastMonthKey) {
    const pastMonthExpenses = getExpensesInMonth(fixedExpenses, lastMonthKey);
    const unpaid = [
      ...pastMonthExpenses.filter(isUnpaidOrPartial),
      ...(virtualGapCycles || []),
    ];
    const dismissKey = `past_month_${lastMonthKey}`;
    if (unpaid.length > 0 && !dismissedSet.has(dismissKey)) {
      const lastMonthDate = new Date(`${lastMonthKey}-01`);
      const lastMonthLabel = lastMonthDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      return {
        nudge: {
          type: 'past_month',
          payload: {
            lastMonthKey,
            lastMonthLabel,
            unpaidCount: unpaid.length,
            unpaidExpenses: unpaid,
          },
          dismissKey,
        },
      };
    }
  }

  // 2. Catch-up: current month, near end of month, unpaid in current month, not dismissed
  const isCatchUpMonth =
    currentMonthKey &&
    currentMonthKey === todayKey &&
    isNearEndOfMonth(todayDate, currentMonth, config);
  if (isCatchUpMonth) {
    const unpaidInCurrent = (currentMonthExpenses || []).filter(
      isUnpaidOrPartial,
    );
    const dismissKey = `catch_up_${currentMonthKey}`;
    if (unpaidInCurrent.length > 0 && !dismissedSet.has(dismissKey)) {
      return {
        nudge: {
          type: 'catch_up',
          payload: {
            unpaidInCurrentMonthCount: unpaidInCurrent.length,
            isNearEndOfMonth: true,
          },
          dismissKey,
        },
      };
    }
  }

  return { nudge: null };
}

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
 * Get the single nudge to show, or null.
 * Priority: past_month -> catch_up -> promo_ended.
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
 * @param {Array} [options.creditCards] - Credit cards, for the
 *   promo_ended nudge (a card whose intro APR ended during the current
 *   pay cycle).
 * @param {string|null} [options.lastCycleStart] - YYYY-MM-DD start of the
 *   current pay cycle (the most recent implied payday). Null (no pay
 *   anchor) disables the promo_ended nudge entirely.
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
  creditCards = [],
  lastCycleStart = null,
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

  // 3. Promo ended: a card's intro APR ended during the current pay cycle.
  //    "During" = endDate on/after the cycle's start anchor and strictly
  //    before today - on the end date itself the intro rate still applies
  //    (getEffectiveCardInterestRate uses today <= endDate), so the nudge
  //    fires the day after. One card at a time; each card+endDate pair has
  //    its own dismiss key, so a re-dated promo re-fires exactly once.
  if (lastCycleStart && Array.isArray(creditCards) && creditCards.length > 0) {
    const todayStr = DateUtils.formatDate(todayDate);
    const endedCards = creditCards.filter(
      card =>
        card?.hasIntroApr === true &&
        typeof card.introAprEndDate === 'string' &&
        card.introAprEndDate >= lastCycleStart &&
        card.introAprEndDate < todayStr,
    );
    for (const card of endedCards) {
      const dismissKey = `promo_ended_${card.id}_${card.introAprEndDate}`;
      if (!dismissedSet.has(dismissKey)) {
        return {
          nudge: {
            type: 'promo_ended',
            payload: {
              cardId: card.id,
              cardName: card.name,
              rateLabel: (card.interestRate ?? 0).toFixed(2),
              introAprEndDate: card.introAprEndDate,
            },
            dismissKey,
          },
        };
      }
    }
  }

  return { nudge: null };
}

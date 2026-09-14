import { DateUtils } from './dateUtils';

/**
 * A short, relative label for an expense's due date — "Due today",
 * "Overdue by 3 days", "Sep 16, 2026".
 *
 * This is display-only. It never decides which section of the priority list
 * an expense belongs in — that's `paycheckService.getTimingBucket()`, which
 * is relative to the pay cycle (before/after the next paycheck), not to a
 * fixed 7-day window the way this label is. A bill can read "Due in 4 days"
 * here while still bucketing as "Next Check" there, if payday lands sooner.
 * Don't "fix" that by making this function pay-cycle-aware — it would just
 * be a fourth divergent copy of logic `getTimingBucket` already owns.
 *
 * Three duplicate day-count implementations already exist elsewhere in this
 * codebase (`UpcomingRecurringWidget`, `CreditCardDebtTable`,
 * `pages/CreditCards.jsx`) — this is deliberately not a fourth reimplementation
 * of the same idea with slightly different rounding; it's the one this
 * project's redesign actually needs, built on `DateUtils`.
 */
export const formatRelativeDueDate = (
  dueDate,
  todayStr = DateUtils.today(),
) => {
  const days = DateUtils.daysBetween(todayStr, dueDate);

  // parseDate() returns an Invalid Date object (not null) for a malformed
  // string like 'not-a-date' — daysBetween then does arithmetic on it and
  // returns NaN, not null. Both must be checked explicitly, or a NaN slips
  // past every numeric comparison below and falls through to formatShortDate
  // producing the native, unstyled "Invalid Date" string by accident.
  if (days === null || Number.isNaN(days)) return 'Unknown date';

  if (days < 0) {
    const n = Math.abs(days);
    return `Overdue by ${n} day${n === 1 ? '' : 's'}`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 6) return `Due in ${days} days`;
  return DateUtils.formatShortDate(dueDate);
};

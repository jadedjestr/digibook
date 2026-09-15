import { calculateNextDueDate } from './recurrenceMath';

// Safety bound on how many cycles computeCycleStates will ever walk in one
// call, so a malformed template (e.g. a corrupted startDate/frequency that
// never reaches rangeEnd) can't spin the loop indefinitely. Comfortably
// above any real cadence over many years - a daily template over a decade
// is ~3650 cycles.
const MAX_CYCLES = 5000;

/**
 * Classify every cycle of a recurring template within [rangeStart,
 * rangeEnd] as one of three states, without creating or storing anything:
 *
 *  - 'resolved': a non-deleted recurringResolutionLog entry exists for
 *    this cycle (Pay Full / Partial / Skip already happened).
 *  - 'pending':  a real fixedExpenses row exists for this cycle, not yet
 *    resolved. There is at most one of these per template at any time -
 *    the current cycle's bill, which may be due later within the current
 *    pay period (a first occurrence materialized at creation) rather than
 *    strictly today.
 *  - 'virtual':  neither exists. Nothing is stored; the entry is computed
 *    live so a forecast (Calendar) or a gap check (the past_month nudge)
 *    can reason about a cycle that was never materialized.
 *
 * Pure and DB-free by design: callers load resolutionLogEntries /
 * realExpenses / estimatedAmount from Dexie first and pass them in here,
 * so this file stays independently unit-testable the same way
 * payCycleNudgeLogic.js is, and can be imported without opening a database
 * connection as a side effect.
 *
 * @param {Object} template - a recurringExpenseTemplates row. Needs at
 *   least startDate, frequency, intervalValue, intervalUnit, endDate.
 * @param {Object} options
 * @param {Array} [options.resolutionLogEntries] - this template's
 *   recurringResolutionLog rows (any range; narrowed internally).
 *   Soft-deleted (undone) entries are ignored.
 * @param {Array} [options.realExpenses] - fixedExpenses rows with
 *   recurringTemplateId === template.id. Soft-deleted rows are ignored.
 * @param {string} options.rangeStart - YYYY-MM-DD, inclusive
 * @param {string} options.rangeEnd - YYYY-MM-DD, inclusive
 * @param {number} [options.estimatedAmount] - precomputed cycle amount
 *   (e.g. via computeTemplateCycleAmount) used for any 'virtual' entry's
 *   displayed amount, and as a fallback if a resolved/pending entry is
 *   missing its own amount for some reason.
 * @returns {Array<{
 *   cycleDueDate: string,
 *   state: 'resolved'|'pending'|'virtual',
 *   expense: Object|null,
 *   logEntry: Object|null,
 *   estimatedAmount: number,
 * }>} ordered oldest to newest
 */
export function computeCycleStates(
  template,
  {
    resolutionLogEntries = [],
    realExpenses = [],
    rangeStart,
    rangeEnd,
    estimatedAmount,
  } = {},
) {
  if (
    !template?.startDate ||
    !template?.frequency ||
    !rangeStart ||
    !rangeEnd
  ) {
    return [];
  }

  const logByDate = new Map(
    resolutionLogEntries
      .filter(entry => !entry.deletedAt)
      .map(entry => [entry.cycleDueDate, entry]),
  );
  const expenseByDate = new Map(
    realExpenses
      .filter(expense => !expense.deletedAt)
      .map(expense => [expense.dueDate, expense]),
  );

  const results = [];
  let cursor = template.startDate;

  for (let i = 0; i < MAX_CYCLES; i += 1) {
    if (cursor > rangeEnd) break;
    if (template.endDate && cursor > template.endDate) break;

    if (cursor >= rangeStart) {
      const logEntry = logByDate.get(cursor) ?? null;
      const expense = expenseByDate.get(cursor) ?? null;

      // A resolved cycle takes priority even if a stale real row also
      // exists at this date - resolution is the authoritative fact.
      let state = 'virtual';
      if (logEntry) {
        state = 'resolved';
      } else if (expense) {
        state = 'pending';
      }

      results.push({
        cycleDueDate: cursor,
        state,
        expense,
        logEntry,
        estimatedAmount:
          state === 'virtual'
            ? estimatedAmount
            : (expense?.amount ?? logEntry?.committedAmount ?? estimatedAmount),
      });
    }

    let next;
    try {
      next = calculateNextDueDate(
        cursor,
        template.frequency,
        template.intervalValue || 1,
        template.intervalUnit || 'months',
      );
    } catch {
      break; // malformed cadence - stop rather than throw from a read path
    }
    if (!next || next <= cursor) break; // guard against a non-advancing step
    cursor = next;
  }

  return results;
}

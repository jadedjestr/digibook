import { advanceDueDateByFrequency } from '../constants/payFrequency';

import { getCategoryDisplay, NEUTRAL_RGB } from './categoryDisplay';

/**
 * The math behind "Where your bills go": bill totals by category for a month,
 * and what is left in the default account after each upcoming paycheck.
 *
 * Every bill is first reduced to three separate facts (toBillFacts), because
 * the two views need different ones and must never share a single number:
 *
 *  - totalCents: the best amount known for the bill. What was paid once it
 *    is paid; what was entered until then. The donut adds these up.
 *  - paidCents: how much of it has already gone out.
 *  - owedCents: what still has to be paid. Money already paid has left the
 *    balance, so only this may come off the forecast. Using totalCents there
 *    would subtract every paid bill a second time.
 *
 * All sums are in whole cents so totals can't pick up float artifacts.
 * Dates are YYYY-MM-DD strings, which compare correctly as strings.
 */

const toCents = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
};

/**
 * @param {Object} options
 * @param {Array} options.expenses - real fixedExpenses rows (not deleted)
 * @param {Array} [options.forecasts] - predicted cycles of recurring bills
 *   that have no row yet: { templateId, name, dueDate, amount, category,
 *   categoryId, accountId, creditCardId, isVariableAmount }
 * @param {Map} [options.resolvedByExpenseId] - expense id -> its
 *   recurringResolutionLog entry ({ paidAmount }). A resolved cycle is
 *   settled: what was paid is final, and any shortfall lives on in a
 *   separate Balance Due row (which is in `expenses` and counts on its own)
 *   or was forgiven. Either way the original owes nothing more.
 * @returns {Array} bill facts
 */
export const toBillFacts = ({
  expenses = [],
  forecasts = [],
  resolvedByExpenseId = new Map(),
}) => {
  const real = expenses.map(expense => {
    const resolution = resolvedByExpenseId.get(expense.id);
    const amountCents = toCents(expense.amount);
    const paidCents = resolution
      ? toCents(resolution.paidAmount)
      : toCents(expense.paidAmount);
    return {
      id: expense.id,
      name: expense.name,
      dueDate: expense.dueDate,
      category: expense.category,
      categoryId: expense.categoryId ?? null,
      accountId: expense.accountId ?? null,
      creditCardId: expense.creditCardId ?? null,
      isForecast: false,
      isVariableAmount: Boolean(expense.isVariableAmount),
      isResolved: Boolean(resolution),
      totalCents: resolution ? paidCents : Math.max(amountCents, paidCents),
      paidCents,
      owedCents: resolution ? 0 : Math.max(0, amountCents - paidCents),
    };
  });

  const predicted = forecasts.map(forecast => {
    const amountCents = toCents(forecast.amount);
    return {
      id: `forecast-${forecast.templateId}-${forecast.dueDate}`,
      name: forecast.name,
      dueDate: forecast.dueDate,
      category: forecast.category,
      categoryId: forecast.categoryId ?? null,
      accountId: forecast.accountId ?? null,
      creditCardId: forecast.creditCardId ?? null,
      isForecast: true,
      isVariableAmount: Boolean(forecast.isVariableAmount),
      isResolved: false,
      totalCents: amountCents,
      paidCents: 0,
      owedCents: amountCents,
    };
  });

  return [...real, ...predicted];
};

const UNCATEGORIZED = 'Uncategorized';

/**
 * Group bills by category for the donut.
 *
 * Grouping goes through getCategoryDisplay, the same lookup the bill rows'
 * chips use, so a bill sits under the category its chip shows. A bill with
 * no category at all is grouped as "Uncategorized".
 *
 * @param {Array} bills - bill facts, already narrowed to the month
 * @param {Array} categories - categories table rows
 * @returns {{ totalCents, paidCents, groups: Array }} groups largest first;
 *   a group whose bills add up to $0 (e.g. only a skipped bill) is dropped
 */
export const buildCategoryBreakdown = (bills, categories = []) => {
  const groups = new Map();

  bills.forEach(bill => {
    const display = getCategoryDisplay(bill, categories);
    const name = display.kind === 'none' ? UNCATEGORIZED : display.name;
    const key = name.trim().toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name,
        icon: display.icon,

        // Only a category the user actually colored gets its own color;
        // the rest get a fallback picked from the key, so the color stays
        // with the category rather than with its rank.
        rgb:
          display.kind === 'category' && display.rgb !== NEUTRAL_RGB
            ? display.rgb
            : null,
        totalCents: 0,
        paidCents: 0,
        bills: [],
      });
    }
    const group = groups.get(key);
    group.totalCents += bill.totalCents;
    group.paidCents += bill.paidCents;
    group.bills.push(bill);
  });

  const list = [...groups.values()]
    .filter(group => group.totalCents > 0)
    .map(group => ({
      ...group,

      // Paid can exceed the total only by rounding; never show negative.
      comingCents: Math.max(0, group.totalCents - group.paidCents),
      bills: [...group.bills].sort(
        (a, b) =>
          b.totalCents - a.totalCents || a.dueDate.localeCompare(b.dueDate),
      ),
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.key.localeCompare(b.key));

  return {
    totalCents: list.reduce((sum, group) => sum + group.totalCents, 0),
    paidCents: list.reduce((sum, group) => sum + group.paidCents, 0),
    groups: list,
  };
};

/**
 * The next `count` paydays, starting from the next one.
 * @returns {string[]} YYYY-MM-DD, ascending; empty without a next payday
 */
export const getUpcomingPayDates = (nextPayDate, frequency, count) => {
  if (!nextPayDate) return [];
  const dates = [nextPayDate];
  while (dates.length < count) {
    const next = advanceDueDateByFrequency(dates[dates.length - 1], frequency);
    if (!next || next <= dates[dates.length - 1]) break;
    dates.push(next);
  }
  return dates;
};

/**
 * Whether paying this bill takes money out of the default account. A bill
 * charged to a credit card doesn't (the card's own payment bill does that
 * later), nor does one paid from a different account. A bill with no
 * funding source set is assumed to come from the default account: assuming
 * otherwise would make the money left look larger than it is.
 */
const drawsOnAccount = (bill, accountId) => {
  if (bill.creditCardId) return false;
  if (!bill.accountId) return true;
  return bill.accountId === accountId;
};

/**
 * One row per pay period, following the pay schedule rather than calendar
 * months, with the money left in the default account carried from row to
 * row.
 *
 * Row 0 runs from now up to and including the next payday. Each later row
 * runs from the day after one payday through the next, and starts with the
 * paycheck that arrives on its first payday. A bill due on a payday is
 * counted before that day's paycheck - the same rule the "This Week" bucket
 * uses, and the safer of the two readings.
 *
 * Row 0 also carries every bill that is already overdue and still owed:
 * that money is still going to leave the account.
 *
 * A paycheck is added only for paydays after today. generateDueIncome
 * creates a pending payday row for every payday up to today, and the
 * starting balance already includes pending rows, so counting one of those
 * paydays here would add the same paycheck twice. (If income generation is
 * off, today's paycheck is left out until it is entered: low, not high.)
 *
 * @param {Object} options
 * @param {Array} options.bills - bill facts (real rows and forecasts)
 * @param {string[]} options.payDates - upcoming paydays, ascending
 * @param {string} options.today - YYYY-MM-DD
 * @param {number} options.startingBalance - default account balance plus
 *   its pending transactions, in dollars
 * @param {string|null} options.accountId - the default account's id
 * @param {Object|null} [options.paycheck] - { amount, accountId }, or null
 *   when no paycheck is set up
 * @returns {{ rows: Array, startingCents: number, paycheckCounts: boolean }}
 */
export const buildPaycheckForecast = ({
  bills,
  payDates,
  today,
  startingBalance,
  accountId,
  paycheck = null,
}) => {
  const paycheckCounts = Boolean(
    paycheck && paycheck.accountId && paycheck.accountId === accountId,
  );
  const paycheckCents = paycheckCounts ? toCents(paycheck.amount) : 0;

  const owed = bills.filter(bill => bill.owedCents > 0);
  const startingCents = toCents(startingBalance);
  let leftCents = startingCents;

  const rows = payDates.map((endDate, index) => {
    const startDate = index === 0 ? null : payDates[index - 1];
    const inWindow = owed.filter(bill =>
      startDate === null
        ? bill.dueDate <= endDate
        : bill.dueDate > startDate && bill.dueDate <= endDate,
    );

    const incomeCents =
      startDate !== null && startDate > today ? paycheckCents : 0;

    const billsCents = inWindow.reduce((sum, bill) => sum + bill.owedCents, 0);
    const fromAccount = inWindow.filter(bill =>
      drawsOnAccount(bill, accountId),
    );
    const fromAccountCents = fromAccount.reduce(
      (sum, bill) => sum + bill.owedCents,
      0,
    );
    const overdue =
      startDate === null ? inWindow.filter(bill => bill.dueDate < today) : [];

    leftCents = leftCents + incomeCents - fromAccountCents;

    return {
      startDate,
      endDate,
      incomeCents,
      billsCents,
      fromAccountCents,
      leftCents,
      overdueCount: overdue.length,

      // The part of fromAccountCents that is overdue, for a note explaining
      // why the money left dropped.
      overdueFromAccountCents: overdue
        .filter(bill => fromAccount.includes(bill))
        .reduce((sum, bill) => sum + bill.owedCents, 0),
      bills: [...inWindow].sort(
        (a, b) =>
          a.dueDate.localeCompare(b.dueDate) || b.owedCents - a.owedCents,
      ),
    };
  });

  return { rows, startingCents, paycheckCounts };
};

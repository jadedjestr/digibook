import { useEffect, useMemo, useState } from 'react';

import { dbHelpers } from '../db/database-clean';
import { getDefaultAccount, getProjectedBalance } from '../utils/accountUtils';
import {
  buildPaycheckForecast,
  getUpcomingPayDates,
  toBillFacts,
} from '../utils/categoryBreakdown';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';

// Pay periods forecast. Four weekly periods reach about a month ahead, the
// "this month and next" horizon the forecast is for.
const PAY_PERIODS = 4;

const monthEnd = month =>
  DateUtils.formatDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));

/**
 * Predicted cycles of recurring bills between two dates: the ones with no
 * real row yet (the app only creates a bill's row once it is due). The
 * same Virtual Ledger the calendar reads, but with the template's funding
 * and category id kept, which the forecast and grouping need.
 */
const useForecastBills = (rangeStart, rangeEnd, fixedExpenses) => {
  const [forecasts, setForecasts] = useState([]);

  useEffect(() => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      setForecasts([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const templates = await dbHelpers.getRecurringExpenseTemplates();
        const perTemplate = await Promise.all(
          templates.map(template =>
            dbHelpers.getVirtualLedger(template.id, rangeStart, rangeEnd),
          ),
        );
        if (cancelled) return;
        setForecasts(
          perTemplate
            .flat()
            .filter(entry => entry.state === 'virtual')
            .map(({ template, cycleDueDate, estimatedAmount }) => ({
              templateId: template.id,
              name: template.name,
              dueDate: cycleDueDate,
              amount: estimatedAmount ?? 0,
              category: template.category,
              categoryId: template.categoryId ?? null,
              accountId: template.accountId ?? null,
              creditCardId: template.creditCardId ?? null,
              isVariableAmount: Boolean(template.isVariableAmount),
            })),
        );
      } catch (error) {
        logger.warn('Could not forecast recurring bills', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, fixedExpenses]);

  return forecasts;
};

/**
 * The expected paycheck: what has actually been arriving lately when there
 * is enough history, else the user's own figure - the same order
 * generateDueIncome uses. Re-read when pending transactions change, since
 * confirming a paycheck changes that history.
 */
const useExpectedPaycheck = pendingTransactions => {
  const [paycheck, setPaycheck] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const source = await dbHelpers.getPrimaryIncomeSource();
        if (!source) {
          if (!cancelled) setPaycheck(null);
          return;
        }
        const learned = await dbHelpers.getLearnedIncomeAmount(source.id);
        const amount = learned ?? Math.abs(Number(source.expectedAmount) || 0);
        if (!cancelled) {
          setPaycheck(
            amount > 0 ? { amount, accountId: source.accountId } : null,
          );
        }
      } catch (error) {
        logger.warn('Could not read the expected paycheck', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingTransactions]);

  return paycheck;
};

/**
 * Every bill as facts (real rows plus predicted recurring cycles) and the
 * pay-period forecast built from them. Computed once per page so "After
 * This Week" and the "Where your bills go" rows read the same result and
 * can't disagree.
 *
 * Predictions run from today to whichever is later, the end of the viewed
 * month (for the donut) or the last forecast payday. Never before today: a
 * cycle before today that never got a row is a gap in the records, not a
 * bill that's coming.
 */
export const useBillForecast = ({
  currentMonth,
  fixedExpenses,
  resolvedByExpenseId,
  accounts,
  pendingTransactions,
  paycheckSettings,
  paycheckDates,
}) => {
  const today = DateUtils.today();
  const payDates = useMemo(
    () =>
      getUpcomingPayDates(
        paycheckDates?.nextPayDate,
        paycheckSettings?.frequency,
        PAY_PERIODS,
      ),
    [paycheckDates?.nextPayDate, paycheckSettings?.frequency],
  );

  const lastPayDate = payDates[payDates.length - 1] ?? '';
  const viewedMonthEnd = monthEnd(currentMonth);
  const forecastEnd =
    viewedMonthEnd > lastPayDate ? viewedMonthEnd : lastPayDate;
  const forecasts = useForecastBills(today, forecastEnd, fixedExpenses);
  const paycheck = useExpectedPaycheck(pendingTransactions);

  const bills = useMemo(
    () =>
      toBillFacts({ expenses: fixedExpenses, forecasts, resolvedByExpenseId }),
    [fixedExpenses, forecasts, resolvedByExpenseId],
  );

  const defaultAccount = getDefaultAccount(accounts);
  const forecast = useMemo(
    () =>
      buildPaycheckForecast({
        bills,
        payDates,
        today,
        startingBalance: getProjectedBalance(
          defaultAccount,
          pendingTransactions,
        ),
        accountId: defaultAccount?.id ?? null,
        paycheck,
      }),
    [bills, payDates, today, defaultAccount, pendingTransactions, paycheck],
  );

  return { bills, payDates, forecast, defaultAccount, paycheck };
};

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import AddExpensePanel from '../components/AddExpensePanel.jsx';
import Calendar from '../components/Calendar/Calendar.jsx';
import PayCycleNudgeBanner from '../components/Calendar/PayCycleNudgeBanner.jsx';
import PayCycleNudgeToast from '../components/Calendar/PayCycleNudgeToast.jsx';
import FixedExpensesHero from '../components/FixedExpensesHero.jsx';
import OneOffExpensesView from '../components/OneOffExpensesView.jsx';
import PayDateCountdownCard from '../components/PayDateCountdownCard.jsx';
import PriorityExpenseList from '../components/PriorityExpenseList.jsx';
import ProjectedBalanceCard from '../components/ProjectedBalanceCard.jsx';
import ResolveExpenseModal from '../components/ResolveExpenseModal.jsx';
import { dbHelpers } from '../db/database-clean';
import { useExpenseOperations } from '../hooks/useExpenseOperations';
import { usePaycheckCalculations } from '../hooks/usePaycheckCalculations';
import { usePayCycleNudge } from '../hooks/usePayCycleNudge';
import {
  useAccounts,
  useCreditCards,
  useFixedExpenses,
  useIsLoading,
  useIsPanelOpen,
  useLoans,
  usePaycheckSettings,
  usePendingTransactions,
  useReloadExpenses,
  useSetPanelOpen,
} from '../stores/useAppStore';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { notify, showConfirmation } from '../utils/notifications.jsx';
import { isUnpaidOrPartial } from '../utils/payCycleNudgeLogic';
import '../components/Calendar/calendar.css';

/** Set to true to show pay cycle nudge as toast instead of banner. */
const USE_NUDGE_TOAST = true;

const EMPTY_ID_SET = new Set();
const EMPTY_RESOLUTION_MAP = new Map();

// Kind of resolution a log entry represents: a full payment covers the
// committed amount; a forgiven shortfall is no longer owed at all;
// anything else (Skip, or a Partial that didn't cover it) spun off a
// Balance Due, whether deferred to the next paycheck or - for a log
// entry written before that choice existed - due the day it was
// resolved. shortfallOutcome is absent (not just falsy) on legacy rows,
// so this stays correct without any data migration.
const resolutionTypeOf = entry => {
  if (entry.paidAmount >= entry.committedAmount) return 'paid';
  if (entry.shortfallOutcome === 'forgiven') return 'forgiven';
  return entry.wasSkipped ? 'skipped' : 'partial';
};

const FixedExpenses = () => {
  const [payNowExpense, setPayNowExpense] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'oneoffs'
  const expensesTableRef = useRef(null);

  // Derived from recurringResolutionLog: which expense ids are an already-
  // resolved recurring cycle (stop showing as actionable - the cadence has
  // moved on, whether or not it was paid in full), which are a Balance
  // Due spun off from one (worth a badge wherever they show up), and - for
  // the calendar - what kind of resolution each resolved row was (paid in
  // full / skipped / partial), so its badge can read as settled instead of
  // still due. Refetched whenever fixedExpenses changes, since that's
  // already the signal a resolve/undo just happened.
  const [resolutionLinkage, setResolutionLinkage] = useState({
    resolvedExpenseIds: EMPTY_ID_SET,
    balanceDueExpenseIds: EMPTY_ID_SET,
    resolvedByExpenseId: EMPTY_RESOLUTION_MAP,
  });

  // The Virtual Ledger's 'virtual' cycles for the visible month, one
  // dbHelpers.getVirtualLedger call per active template. Calendar-only —
  // these are forecast entries, never real rows, so nothing else in the
  // page (summary totals, the priority list) should ever see them.
  const [virtualExpenses, setVirtualExpenses] = useState([]);

  // Use Zustand store for data
  const accounts = useAccounts();
  const creditCards = useCreditCards();
  const loans = useLoans();
  const fixedExpenses = useFixedExpenses();
  const paycheckSettings = usePaycheckSettings();
  const pendingTransactions = usePendingTransactions();
  const isLoading = useIsLoading();
  const reloadExpenses = useReloadExpenses();
  const isAddPanelOpen = useIsPanelOpen();
  const setAddPanelOpen = useSetPanelOpen();

  // Add useExpenseOperations hook (must be unconditional for rules-of-hooks)
  const { updateExpenseV4, deleteExpense, markAsPaid, resolveCycle } =
    useExpenseOperations();

  // Initialize paycheck service (memoized — only recalculates when paycheckSettings changes)
  const { paycheckService, paycheckDates } =
    usePaycheckCalculations(paycheckSettings);

  const formatMonthKey = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const getMonthRange = date => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start, end };
  };

  const isInRange = (dateString, start, end) => {
    const parsed = DateUtils.parseDate(dateString);
    if (!parsed) return false;
    return parsed >= start && parsed <= end;
  };

  const { currentMonthKey, currentMonthExpenses } = useMemo(() => {
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const months = [prevMonth, currentMonth, nextMonth];
    const cache = months.reduce((acc, monthDate) => {
      const key = formatMonthKey(monthDate);
      const { start, end } = getMonthRange(monthDate);
      acc[key] = fixedExpenses.filter(expense =>
        isInRange(expense.dueDate, start, end),
      );
      return acc;
    }, {});

    return {
      currentMonthKey: formatMonthKey(currentMonth),
      currentMonthExpenses: cache[formatMonthKey(currentMonth)] || [],
    };
  }, [currentMonth, fixedExpenses]);

  const { nudge, dismiss } = usePayCycleNudge({
    fixedExpenses,
    currentMonth,
    currentMonthExpenses,
    paycheckDates,
    paycheckService,
    creditCards,
    paycheckSettings,
  });

  const handleReviewPastMonth = useCallback(monthKey => {
    if (!monthKey) return;
    const [y, m] = monthKey.split('-').map(Number);
    setCurrentMonth(new Date(y, m - 1, 1));
  }, []);

  const handleMarkCurrentMonthPaid = useCallback(async () => {
    const unpaid = currentMonthExpenses.filter(isUnpaidOrPartial);
    if (unpaid.length === 0) return;
    const confirmed = await showConfirmation(
      `Mark ${unpaid.length} expense(s) as paid?`,
    );
    if (!confirmed) return;
    try {
      for (const exp of unpaid) {
        // A recurring-template expense must go through resolveCycle, not
        // markAsPaid - markAsPaid just sets paidAmount/status and would
        // silently leave the template's cadence stalled, never
        // materializing its next cycle. A plain one-off (including a
        // Balance Due) has no cadence to advance, so markAsPaid is
        // correct and unchanged for those.
        if (exp.recurringTemplateId) {
          await resolveCycle(exp.id, { paidAmount: exp.amount }, false);
        } else {
          await markAsPaid(exp.id);
        }
      }
      await reloadExpenses();
      notify.success(`Marked ${unpaid.length} expense(s) as paid`);
    } catch (err) {
      logger.error('Error marking expenses as paid', err);
      notify.error('Failed to mark some expenses as paid');
    }
  }, [currentMonthExpenses, markAsPaid, resolveCycle, reloadExpenses]);

  const handleReviewScroll = useCallback(() => {
    expensesTableRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handlePayNow = useCallback(expense => {
    setPayNowExpense(expense);
  }, []);

  // Deliberately the FULL fixedExpenses array, not currentMonthExpenses. This
  // feeds "what do I owe this week" and "balance after this week" — numbers
  // that must answer "right now", not "whichever month the calendar happens
  // to be showing". Before this fix, paging the calendar forward silently
  // recomputed both against that browsed month instead of today, which is
  // exactly the kind of quietly-wrong number this project has spent real
  // effort making trustworthy. The calendar itself keeps its own
  // currentMonthExpenses below, unaffected — it legitimately needs one
  // specific month to lay out its day grid; only the money side changes.
  // The resolved set comes from the same resolution log the priority list
  // reads: a skipped/short-paid cycle's row is no longer owed (its
  // shortfall lives in the spun-off Balance Due, a different id), so it
  // must not count here a second time.
  const summaryTotals = useMemo(
    () =>
      paycheckService.calculateSummaryTotals(
        fixedExpenses,
        paycheckDates,
        resolutionLinkage.resolvedExpenseIds,
      ),
    [
      paycheckService,
      fixedExpenses,
      paycheckDates,
      resolutionLinkage.resolvedExpenseIds,
    ],
  );

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await dbHelpers.materializeDueTemplates();
        if (!cancelled) {
          await reloadExpenses();
        }
      } catch (error) {
        logger.warn('Could not materialize due recurring templates', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentMonthKey, reloadExpenses]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const entries = await dbHelpers.getRecurringResolutionLogEntries();
        if (cancelled) return;

        const resolvedExpenseIds = new Set(entries.map(e => e.expenseId));
        const balanceDueExpenseIds = new Set(
          entries
            .filter(e => e.adjustmentExpenseId)
            .map(e => e.adjustmentExpenseId),
        );

        // Per-expense resolution kind for the calendar's badges: a resolved
        // cycle must render settled (and inert), not still due. Note the
        // Balance Due ids are deliberately NOT in this map - they are real,
        // actionable one-offs.
        const resolvedByExpenseId = new Map(
          entries.map(entry => [
            entry.expenseId,
            {
              type: resolutionTypeOf(entry),
              resolvedAt: entry.resolvedAt,
              paidAmount: entry.paidAmount,
              committedAmount: entry.committedAmount,
              deferredDueDate: entry.deferredDueDate ?? null,
              templatePausedOnForgive: Boolean(entry.templatePausedOnForgive),
            },
          ]),
        );
        setResolutionLinkage({
          resolvedExpenseIds,
          balanceDueExpenseIds,
          resolvedByExpenseId,
        });
      } catch (error) {
        logger.warn('Could not load resolution log linkage', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fixedExpenses]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { start, end } = getMonthRange(currentMonth);
        const rangeStart = DateUtils.formatDate(start);
        const rangeEnd = DateUtils.formatDate(end);

        const templates = await dbHelpers.getRecurringExpenseTemplates();
        const perTemplate = await Promise.all(
          templates.map(template =>
            dbHelpers.getVirtualLedger(template.id, rangeStart, rangeEnd),
          ),
        );
        if (cancelled) return;

        const virtual = perTemplate
          .flat()
          .filter(entry => entry.state === 'virtual')
          .map(entry => ({
            id: `virtual-${entry.template.id}-${entry.cycleDueDate}`,
            dueDate: entry.cycleDueDate,
            name: entry.template.name,
            category: entry.template.category,
            amount: entry.estimatedAmount ?? 0,
            paidAmount: 0,
            recurringTemplateId: entry.template.id,
            isVariableAmount: entry.template.isVariableAmount || false,
            isVirtual: true,
          }));
        setVirtualExpenses(virtual);
      } catch (error) {
        logger.warn('Could not compute virtual ledger for calendar', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentMonth, fixedExpenses]);

  // Re-hosted from the now-deleted ExpenseTableContainer, which rendered
  // AddExpensePanel itself. Same behaviour: reload on success, no local
  // "just added" highlight state — nothing in this redesign consumes it.
  const handleAddPanelDataChange = useCallback(async () => {
    await reloadExpenses();
  }, [reloadExpenses]);

  // Debug logging
  logger.debug('FixedExpenses - paycheckSettings:', paycheckSettings);
  logger.debug('FixedExpenses - paycheckDates:', paycheckDates);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='text-white/70'>Loading expenses...</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* View Switcher. flex-wrap + gap because this row now holds three
          items instead of the two it was built for — Add Expense used to
          live inside the deleted table's own header. Without wrap, three
          items squeezed onto one line at phone width forced "All Future
          One-Offs" to wrap its own text into three lines instead. */}
      <div className='flex flex-wrap items-center justify-between gap-2 pl-14 lg:pl-0'>
        <div className='flex items-center space-x-2'>
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'month'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'glass-button'
            }`}
          >
            Month View
          </button>
          <button
            onClick={() => setViewMode('oneoffs')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'oneoffs'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'glass-button'
            }`}
          >
            All Future One-Offs
          </button>
        </div>
        {/* Re-hosted here from the now-deleted ExpenseTableContainer, which
            rendered this button and AddExpensePanel itself. Matches the
            Add Account/Add Credit Card placement used elsewhere. */}
        <button
          onClick={() => setAddPanelOpen(true)}
          className='glass-button glass-button--primary flex items-center space-x-2'
        >
          <Plus size={20} />
          <span>Add Expense</span>
        </button>
      </div>

      {viewMode === 'month' ? (
        <>
          {/* Pay cycle nudge - above layout (or as toast when USE_NUDGE_TOAST) */}
          {USE_NUDGE_TOAST ? (
            <PayCycleNudgeToast
              nudge={nudge}
              onReviewPastMonth={handleReviewPastMonth}
              onDismiss={dismiss}
              onMarkCurrentMonthPaid={handleMarkCurrentMonthPaid}
              onReviewScroll={handleReviewScroll}
            />
          ) : (
            <PayCycleNudgeBanner
              nudge={nudge}
              onReviewPastMonth={handleReviewPastMonth}
              onDismiss={dismiss}
              onMarkCurrentMonthPaid={handleMarkCurrentMonthPaid}
              onReviewScroll={handleReviewScroll}
            />
          )}

          <div className='fixed-expenses-hero-section'>
            <FixedExpensesHero summaryTotals={summaryTotals} />
            <div className='fixed-expenses-metrics-row'>
              <PayDateCountdownCard
                nextPayDate={paycheckDates.nextPayDate}
                followingPayDate={paycheckDates.followingPayDate}
                daysUntilNextPay={paycheckDates.daysUntilNextPay}
                daysUntilFollowingPay={paycheckDates.daysUntilFollowingPay}
              />
              <ProjectedBalanceCard
                accounts={accounts}
                creditCards={creditCards}
                pendingTransactions={pendingTransactions}
                summaryTotals={summaryTotals}
                showAccountName={false}
              />
            </div>
          </div>

          {/* Calendar for seeing the shape of the month; priority list for
              acting on what's due. Calendar keeps its own month-scoped data
              (it needs one specific month to lay out a day grid) — the list
              reads the full fixedExpenses array, same as the hero above. */}
          <div className='fixed-expenses-month-layout'>
            <div className='fixed-expenses-calendar-column'>
              <Calendar
                currentMonth={currentMonth}
                monthExpenses={currentMonthExpenses}
                virtualExpenses={virtualExpenses}
                resolutionByExpenseId={resolutionLinkage.resolvedByExpenseId}
                paycheckService={paycheckService}
                paycheckDates={paycheckDates}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
                onToday={handleToday}
              />
            </div>

            <div
              className='fixed-expenses-priority-column'
              ref={expensesTableRef}
              data-testid='fixed-expenses-table-container'
            >
              <PriorityExpenseList
                expenses={fixedExpenses}
                paycheckService={paycheckService}
                paycheckDates={paycheckDates}
                accounts={accounts}
                creditCards={creditCards}
                onPayNow={handlePayNow}
                resolvedExpenseIds={resolutionLinkage.resolvedExpenseIds}
                balanceDueExpenseIds={resolutionLinkage.balanceDueExpenseIds}
              />

              <div className='fixed-expenses-new-cycle'>
                {paycheckSettings?.lastPaycheckDate && (
                  <p className='fixed-expenses-new-cycle-text'>
                    Last reset:{' '}
                    {DateUtils.formatShortDate(
                      paycheckSettings.lastPaycheckDate,
                    )}
                  </p>
                )}
                {paycheckDates.nextPayDate && (
                  <p className='fixed-expenses-new-cycle-text'>
                    Next paycheck:{' '}
                    {DateUtils.formatShortDate(paycheckDates.nextPayDate)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <AddExpensePanel
            isOpen={isAddPanelOpen}
            onClose={() => setAddPanelOpen(false)}
            accounts={accounts}
            creditCards={creditCards}
            loans={loans}
            onDataChange={handleAddPanelDataChange}
          />

          <ResolveExpenseModal
            expense={payNowExpense}
            isOpen={!!payNowExpense}
            onClose={() => setPayNowExpense(null)}
          />
        </>
      ) : (
        <OneOffExpensesView
          expenses={fixedExpenses}
          paycheckService={paycheckService}
          paycheckDates={paycheckDates}
          accounts={accounts}
          creditCards={creditCards}
          loans={loans}
          onMarkAsPaid={markAsPaid}
          onDelete={deleteExpense}
          onUpdateExpense={updateExpenseV4}
          onReloadExpenses={reloadExpenses}
          balanceDueExpenseIds={resolutionLinkage.balanceDueExpenseIds}
        />
      )}
    </div>
  );
};

export default FixedExpenses;

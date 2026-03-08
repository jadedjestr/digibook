import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Calendar from '../components/Calendar/Calendar.jsx';
import CalendarCycleButton from '../components/Calendar/CalendarCycleButton.jsx';
import PayCycleNudgeBanner from '../components/Calendar/PayCycleNudgeBanner.jsx';
import PayCycleNudgeToast from '../components/Calendar/PayCycleNudgeToast.jsx';
import UpcomingRecurringWidget from '../components/Calendar/UpcomingRecurringWidget.jsx';
import CategoryExpenseSummary from '../components/CategoryExpenseSummary.jsx';
import FixedExpensesSummaryCard from '../components/FixedExpensesTable/FixedExpensesSummaryCard.jsx';
import FixedExpensesTable from '../components/FixedExpensesTable.jsx';
import MarkAsPaidModal from '../components/MarkAsPaidModal.jsx';
import OneOffExpensesView from '../components/OneOffExpensesView.jsx';
import PayDateCountdownCard from '../components/PayDateCountdownCard.jsx';
import PaySummaryCard from '../components/PaySummaryCard.jsx';
import ProjectedBalanceCard from '../components/ProjectedBalanceCard.jsx';
import { DEFAULT_PAY_FREQUENCY } from '../constants/payFrequency';
import { dbHelpers } from '../db/database-clean';
import { useExpenseOperations } from '../hooks/useExpenseOperations';
import { usePaycheckCalculations } from '../hooks/usePaycheckCalculations';
import { usePayCycleNudge } from '../hooks/usePayCycleNudge';
import {
  useAccounts,
  useCategories,
  useCreditCards,
  useFixedExpenses,
  useIsLoading,
  usePaycheckSettings,
  useReloadExpenses,
  useReloadPaycheckSettings,
} from '../stores/useAppStore';
import { DateUtils } from '../utils/dateUtils';
import {
  groupExpensesByCategory,
  computeFixedExpenseTotals,
  computeCategoryTotals,
} from '../utils/expenseUtils';
import { logger } from '../utils/logger';
import { notify, showConfirmation } from '../utils/notifications.jsx';
import { isUnpaidOrPartial } from '../utils/payCycleNudgeLogic';
import '../components/Calendar/calendar.css';

/** Set to true to show pay cycle nudge as toast instead of banner. */
const USE_NUDGE_TOAST = true;

const addOneMonthToDate = dateString => {
  if (!dateString) return null;
  const date = DateUtils.parseDate(dateString);
  if (!date) return null;
  date.setMonth(date.getMonth() + 1);
  return DateUtils.formatDate(date);
};

const FixedExpenses = () => {
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const [payNowExpense, setPayNowExpense] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'oneoffs'
  const expensesTableRef = useRef(null);

  // Use Zustand store for data
  const accounts = useAccounts();
  const creditCards = useCreditCards();
  const fixedExpenses = useFixedExpenses();
  const paycheckSettings = usePaycheckSettings();
  const categories = useCategories();
  const isLoading = useIsLoading();
  const reloadPaycheckSettings = useReloadPaycheckSettings();
  const reloadExpenses = useReloadExpenses();

  // Add useExpenseOperations hook (must be unconditional for rules-of-hooks)
  const { updateExpenseV4, deleteExpense, markAsPaid } = useExpenseOperations();

  // Initialize paycheck service (memoized — only recalculates when paycheckSettings changes)
  const { paycheckService, paycheckDates } =
    usePaycheckCalculations(paycheckSettings);

  const handleResetCycle = useCallback(async () => {
    try {
      const updatePromises = fixedExpenses.map(expense => {
        let newDueDate = expense.dueDate;
        if (expense.dueDate) {
          newDueDate = addOneMonthToDate(expense.dueDate);
        }
        return updateExpenseV4(
          expense.id,
          { paidAmount: 0, status: 'pending', dueDate: newDueDate },
          false,
        );
      });
      await Promise.all(updatePromises);

      if (paycheckDates.nextPayDate) {
        await dbHelpers.updatePaycheckSettings({
          lastPaycheckDate: paycheckDates.nextPayDate,
          frequency: paycheckSettings?.frequency || DEFAULT_PAY_FREQUENCY,
        });
        await reloadPaycheckSettings();
      }

      await reloadExpenses();
      setShowResetPrompt(false);
      notify.success('New pay cycle started successfully');
    } catch (error) {
      logger.error('Error resetting cycle:', error);
      notify.error('Failed to reset cycle. Please try again.');
      setShowResetPrompt(false);
    }
  }, [
    fixedExpenses,
    updateExpenseV4,
    paycheckDates,
    paycheckSettings,
    reloadPaycheckSettings,
    reloadExpenses,
  ]);

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
        await markAsPaid(exp.id);
      }
      await reloadExpenses();
      notify.success(`Marked ${unpaid.length} expense(s) as paid`);
    } catch (err) {
      logger.error('Error marking expenses as paid', err);
      notify.error('Failed to mark some expenses as paid');
    }
  }, [currentMonthExpenses, markAsPaid, reloadExpenses]);

  const handleReviewScroll = useCallback(() => {
    expensesTableRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handlePayNow = useCallback(expense => {
    setPayNowExpense(expense);
  }, []);

  const handleMarkAsPaidConfirm = useCallback(
    async (newPaidAmount, status) => {
      if (!payNowExpense) return;
      try {
        await updateExpenseV4(
          payNowExpense.id,
          { paidAmount: newPaidAmount, status },
          false,
        );
        await reloadExpenses();
        notify.success('Payment updated');
      } catch (err) {
        logger.error('Error updating payment', err);
        notify.error('Failed to update payment');
      }
    },
    [payNowExpense, updateExpenseV4, reloadExpenses],
  );

  const summaryTotals = useMemo(
    () =>
      paycheckService.calculateSummaryTotals(
        currentMonthExpenses,
        paycheckDates,
      ),
    [paycheckService, currentMonthExpenses, paycheckDates],
  );

  const { fixedExpenseSummaryTotals, fixedExpenseSummaryCategoryRows } =
    useMemo(() => {
      const groups = groupExpensesByCategory(currentMonthExpenses);
      const totals = computeFixedExpenseTotals(currentMonthExpenses);
      const categoryTotals = computeCategoryTotals(groups);
      const rows = Object.keys(groups).map(categoryName => ({
        name: categoryName,
        count: categoryTotals[categoryName]?.count ?? 0,
        totalBudgeted: categoryTotals[categoryName]?.totalBudgeted ?? 0,
      }));
      return {
        fixedExpenseSummaryTotals: totals,
        fixedExpenseSummaryCategoryRows: rows,
      };
    }, [currentMonthExpenses]);

  const nextPayDisplay = useMemo(() => {
    if (!paycheckDates.nextPayDate) {
      return 'the next pay date';
    }
    return new Date(paycheckDates.nextPayDate).toLocaleDateString();
  }, [paycheckDates.nextPayDate]);

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
        const { preGenerateOccurrences, getActiveTemplates } = await import(
          '../services/recurringExpenseService'
        );
        const templates = await getActiveTemplates();

        for (const template of templates) {
          await preGenerateOccurrences(template.id, 2);
        }

        if (!cancelled) {
          await reloadExpenses();
        }
      } catch (error) {
        logger.warn(
          'Could not pre-generate recurring expenses for month',
          error,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentMonthKey, reloadExpenses]);

  // Handler for category click - scrolls to category in table
  const handleCategoryClick = categoryName => {
    // Scroll to category section in table
    const selector = `[data-category="${categoryName}"]`;
    const element = document.querySelector(selector);
    if (element) {
      // Bug 3 fix: Calculate offset before starting scroll
      // to avoid race condition.
      const offset = 100; // Adjust as needed for fixed headers
      const elementTop = element.getBoundingClientRect().top + window.scrollY;
      const targetPosition = elementTop - offset;

      // Use instant scroll to target position instead of nested smooth scrolls
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });
    }
  };

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
      {/* View Switcher */}
      <div className='flex items-center justify-between'>
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
      </div>

      {viewMode === 'month' ? (
        <>
          {/* Pay cycle nudge - above layout (or as toast when USE_NUDGE_TOAST) */}
          {USE_NUDGE_TOAST ? (
            <PayCycleNudgeToast
              nudge={nudge}
              onReviewPastMonth={handleReviewPastMonth}
              onStartReset={() => setShowResetPrompt(true)}
              onDismiss={dismiss}
              onMarkCurrentMonthPaid={handleMarkCurrentMonthPaid}
              onReviewScroll={handleReviewScroll}
            />
          ) : (
            <PayCycleNudgeBanner
              nudge={nudge}
              onReviewPastMonth={handleReviewPastMonth}
              onStartReset={() => setShowResetPrompt(true)}
              onDismiss={dismiss}
              onMarkCurrentMonthPaid={handleMarkCurrentMonthPaid}
              onReviewScroll={handleReviewScroll}
            />
          )}

          {/* Two-column: left panel (35%) + right (calendar) */}
          <div className='fixed-expenses-month-layout'>
            {/* Left panel: cards, expense dist, fixed card, upcoming, spacer, New Cycle */}
            <div className='fixed-expenses-left-panel'>
              <div className='fixed-expenses-left-panel-cards'>
                <PaySummaryCard
                  summaryTotals={summaryTotals}
                  paycheckDates={paycheckDates}
                />
                <PayDateCountdownCard
                  nextPayDate={paycheckDates.nextPayDate}
                  followingPayDate={paycheckDates.followingPayDate}
                  daysUntilNextPay={paycheckDates.daysUntilNextPay}
                  daysUntilFollowingPay={paycheckDates.daysUntilFollowingPay}
                />
                <ProjectedBalanceCard
                  accounts={accounts}
                  creditCards={creditCards}
                  summaryTotals={summaryTotals}
                />
              </div>
              <div className='fixed-expenses-left-panel-expense-dist'>
                <CategoryExpenseSummary
                  expenses={currentMonthExpenses}
                  categories={categories}
                  onCategoryClick={handleCategoryClick}
                  compact
                />
              </div>
              <div className='fixed-expenses-left-panel-fixed-card'>
                <FixedExpensesSummaryCard
                  totals={fixedExpenseSummaryTotals}
                  categoryRows={fixedExpenseSummaryCategoryRows}
                  onCategoryClick={handleCategoryClick}
                />
              </div>
              <div className='fixed-expenses-left-panel-upcoming'>
                <UpcomingRecurringWidget
                  monthExpenses={currentMonthExpenses}
                  alwaysExpanded
                  onPayNow={handlePayNow}
                />
              </div>
              <div className='fixed-expenses-left-panel-spacer' />
              <div className='fixed-expenses-left-panel-new-cycle'>
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
                <CalendarCycleButton
                  onReset={() => setShowResetPrompt(true)}
                  variant='ghost'
                />
              </div>
            </div>

            {/* Right column: calendar only */}
            <div className='fixed-expenses-right-column'>
              <Calendar
                currentMonth={currentMonth}
                monthExpenses={currentMonthExpenses}
                paycheckService={paycheckService}
                paycheckDates={paycheckDates}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
                onToday={handleToday}
              />
            </div>
          </div>

          {/* Full-width table below two-column layout */}
          <div
            ref={expensesTableRef}
            className='fixed-expenses-table-section'
            data-testid='fixed-expenses-table-container'
          >
            <FixedExpensesTable
              expenses={currentMonthExpenses}
              onCategoryClick={handleCategoryClick}
              headerVariant='minimal'
            />
          </div>

          <MarkAsPaidModal
            expense={payNowExpense}
            isOpen={!!payNowExpense}
            onClose={() => setPayNowExpense(null)}
            onConfirm={handleMarkAsPaidConfirm}
          />
        </>
      ) : (
        <OneOffExpensesView
          expenses={fixedExpenses}
          paycheckService={paycheckService}
          paycheckDates={paycheckDates}
          accounts={accounts}
          creditCards={creditCards}
          onMarkAsPaid={markAsPaid}
          onDelete={deleteExpense}
          onUpdateExpense={updateExpenseV4}
          onReloadExpenses={reloadExpenses}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetPrompt && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='glass-panel p-6 max-w-md mx-4'>
            <h3 className='text-lg font-semibold text-white mb-4'>
              Start New Pay Cycle
            </h3>
            <div className='text-white/70 mb-6 space-y-2'>
              <p>This will:</p>
              <ul className='list-disc list-inside space-y-1 ml-4'>
                <li>Mark all expenses as unpaid</li>
                <li>Advance all expense due dates by one month</li>
                <li>Update your last paycheck date to {nextPayDisplay}</li>
                <li>Reset the calendar to show the new pay cycle</li>
              </ul>
              <p className='text-sm text-white/60 mt-3'>
                Use this when you receive your paycheck and want to start
                planning payments for the new cycle.
              </p>
            </div>
            <div className='flex gap-3'>
              <button
                onClick={() => setShowResetPrompt(false)}
                className='flex-1 px-4 py-2 glass-button'
              >
                Cancel
              </button>
              <button
                onClick={handleResetCycle}
                className='flex-1 px-4 py-2 glass-button glass-button--danger'
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedExpenses;

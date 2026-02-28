import { useEffect, useMemo, useState } from 'react';

import Calendar from '../components/Calendar/Calendar.jsx';
import CategoryExpenseSummary from '../components/CategoryExpenseSummary.jsx';
import FixedExpensesTable from '../components/FixedExpensesTable.jsx';
import OneOffExpensesView from '../components/OneOffExpensesView.jsx';
import PayDateCountdownCard from '../components/PayDateCountdownCard.jsx';
import PaySummaryCard from '../components/PaySummaryCard.jsx';
import ProjectedBalanceCard from '../components/ProjectedBalanceCard.jsx';
import { dbHelpers } from '../db/database-clean';
import { useExpenseOperations } from '../hooks/useExpenseOperations';
import { PaycheckService } from '../services/paycheckService';
import { useAppStore } from '../stores/useAppStore';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications.jsx';

const FixedExpenses = () => {
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'oneoffs'

  // Use Zustand store for data
  const {
    accounts,
    creditCards,
    fixedExpenses,
    paycheckSettings,
    categories,
    isLoading,
    reloadPaycheckSettings,
    reloadExpenses,
  } = useAppStore();

  // Add useExpenseOperations hook (must be unconditional for rules-of-hooks)
  const { updateExpenseV4, deleteExpense, markAsPaid } = useExpenseOperations();

  // Helper function to add one month to a due date
  const addOneMonthToDate = dateString => {
    if (!dateString) return null;
    const date = DateUtils.parseDate(dateString);
    if (!date) return null;

    // Add one month
    date.setMonth(date.getMonth() + 1);

    // Handle edge cases where a day does not exist in the next month.
    // JavaScript automatically adjusts to the last day of the month
    // (e.g., Jan 31 -> Feb 28/29), which is the desired behavior.
    return DateUtils.formatDate(date);
  };

  // Initialize paycheck service
  const paycheckService = new PaycheckService(paycheckSettings);
  const paycheckDates = paycheckService.calculatePaycheckDates();
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

  const summaryTotals = paycheckService.calculateSummaryTotals(
    currentMonthExpenses,
    paycheckDates,
  );

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
          {/* Calendar View - At the very top */}
          <Calendar
            currentMonth={currentMonth}
            monthExpenses={currentMonthExpenses}
            paycheckService={paycheckService}
            paycheckDates={paycheckDates}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            onReset={() => setShowResetPrompt(true)}
          />

          {/* Summary Cards */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
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

          {/* Category Summary */}
          <CategoryExpenseSummary
            expenses={currentMonthExpenses}
            categories={categories}
            onCategoryClick={handleCategoryClick}
          />

          {/* Main Expenses Table */}
          <FixedExpensesTable
            expenses={currentMonthExpenses}
            onCategoryClick={handleCategoryClick}
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
                onClick={async () => {
                  try {
                    // Reset all expenses to unpaid and advance due dates by one
                    // month. Use Promise.all for parallel updates.
                    const updatePromises = fixedExpenses.map(expense => {
                      let newDueDate = expense.dueDate;

                      if (expense.dueDate) {
                        newDueDate = addOneMonthToDate(expense.dueDate);
                      }

                      // Don't show individual notifications
                      return updateExpenseV4(
                        expense.id,
                        {
                          paidAmount: 0,
                          status: 'pending',
                          dueDate: newDueDate,
                        },
                        false,
                      );
                    });

                    await Promise.all(updatePromises);

                    // Update last paycheck date to the current next paycheck
                    // date. This effectively moves the cycle forward.
                    if (paycheckDates.nextPayDate) {
                      await dbHelpers.updatePaycheckSettings({
                        lastPaycheckDate: paycheckDates.nextPayDate,
                        frequency: paycheckSettings?.frequency || 'biweekly',
                      });

                      // Reload the updated paycheck settings
                      await reloadPaycheckSettings();
                    }

                    // Reload expenses to ensure UI consistency
                    await reloadExpenses();

                    setShowResetPrompt(false);
                    notify.success('New pay cycle started successfully');
                  } catch (error) {
                    logger.error('Error resetting cycle:', error);
                    notify.error('Failed to reset cycle. Please try again.');
                    setShowResetPrompt(false);
                  }
                }}
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

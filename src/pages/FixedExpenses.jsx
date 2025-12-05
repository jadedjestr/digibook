import { useState } from 'react';

import Calendar from '../components/Calendar/Calendar';
import CategoryExpenseSummary from '../components/CategoryExpenseSummary';
import FixedExpensesTable from '../components/FixedExpensesTable';
import PayDateCountdownCard from '../components/PayDateCountdownCard';
import PaySummaryCard from '../components/PaySummaryCard';
import ProjectedBalanceCard from '../components/ProjectedBalanceCard';
import { dbHelpers } from '../db/database-clean';
import { useExpenseOperations } from '../hooks/useExpenseOperations';
import { PaycheckService } from '../services/paycheckService';
import { useAppStore } from '../stores/useAppStore';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

const FixedExpenses = () => {
  const [showResetPrompt, setShowResetPrompt] = useState(false);

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

  // Add useExpenseOperations hook
  const { updateExpenseV4 } = useExpenseOperations();

  // Helper function to add one month to a due date
  const addOneMonthToDate = dateString => {
    if (!dateString) return null;
    const date = DateUtils.parseDate(dateString);
    if (!date) return null;

    // Add one month
    date.setMonth(date.getMonth() + 1);

    // Handle edge case: if day doesn't exist in new month (e.g., Jan 31 -> Feb 31)
    // JavaScript automatically adjusts to the last day of the month
    // So Jan 31 -> Feb 28/29, which is the desired behavior
    return DateUtils.formatDate(date);
  };

  // Initialize paycheck service
  const paycheckService = new PaycheckService(paycheckSettings);
  const paycheckDates = paycheckService.calculatePaycheckDates();
  const summaryTotals = paycheckService.calculateSummaryTotals(
    fixedExpenses,
    paycheckDates
  );

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
      {/* Calendar View - At the very top */}
      <Calendar onReset={() => setShowResetPrompt(true)} />

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
        expenses={fixedExpenses}
        categories={categories}
      />

      {/* Main Expenses Table */}
      <FixedExpensesTable />

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
                <li>
                  Update your last paycheck date to{' '}
                  {paycheckDates.nextPayDate
                    ? new Date(paycheckDates.nextPayDate).toLocaleDateString()
                    : 'the next pay date'}
                </li>
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
                    // Reset all expenses to unpaid and advance due dates by one month
                    // Use Promise.all for parallel updates
                    const updatePromises = fixedExpenses.map(expense => {
                      const newDueDate = expense.dueDate
                        ? addOneMonthToDate(expense.dueDate)
                        : expense.dueDate;

                      return updateExpenseV4(
                        expense.id,
                        {
                          paidAmount: 0,
                          status: 'pending',
                          dueDate: newDueDate,
                        },
                        false // Don't show individual notifications
                      );
                    });

                    await Promise.all(updatePromises);

                    // Update last paycheck date to the current next paycheck date
                    // This effectively moves the cycle forward
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

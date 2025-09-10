import { useState, useEffect } from 'react';
import { Clock, Calendar, AlertCircle } from 'lucide-react';

import { recurringExpenseService } from '../../services/recurringExpenseService';
import { DateUtils } from '../../utils/dateUtils';

/**
 * Widget showing the next upcoming recurring expense
 * Displayed on the same line as the New Cycle button
 */
const UpcomingRecurringWidget = () => {
  console.log('UpcomingRecurringWidget: COMPONENT MOUNTING');

  const [nextRecurring, setNextRecurring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log(
    'UpcomingRecurringWidget: STATE INITIALIZED - loading:',
    loading,
    'error:',
    error
  );

  // Load the next upcoming recurring expense
  useEffect(() => {
    const loadNextRecurring = async () => {
      try {
        setLoading(true);
        console.log(
          'UpcomingRecurringWidget: Starting to load recurring expenses...'
        );

        // Debug: Test if service exists
        console.log(
          'UpcomingRecurringWidget: recurringExpenseService =',
          recurringExpenseService
        );

        const upcomingExpenses =
          await recurringExpenseService.getUpcomingRecurringExpenses();

        console.log(
          'UpcomingRecurringWidget: Got upcoming expenses:',
          upcomingExpenses
        );

        if (upcomingExpenses.length > 0) {
          // Sort by next due date and get the closest one
          const sortedExpenses = upcomingExpenses
            .filter(expense => expense.nextDueDate)
            .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));

          if (sortedExpenses.length > 0) {
            setNextRecurring(sortedExpenses[0]);
            console.log(
              'UpcomingRecurringWidget: Set next recurring:',
              sortedExpenses[0]
            );
          }
        } else {
          console.log('UpcomingRecurringWidget: No upcoming expenses found');
        }
      } catch (err) {
        console.error('UpcomingRecurringWidget: ERROR CAUGHT:', err);
        console.error('UpcomingRecurringWidget: Error stack:', err.stack);
        console.error('UpcomingRecurringWidget: Error name:', err.name);
        console.error('UpcomingRecurringWidget: Error message:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadNextRecurring();
  }, []);

  // Calculate days until next recurring expense
  const getDaysUntil = dateString => {
    const today = DateUtils.today();
    const days = DateUtils.daysBetween(today, dateString);
    return days;
  };

  // Format the time until display
  const formatTimeUntil = days => {
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `${days} days`;
    if (days <= 30) {
      const weeks = Math.floor(days / 7);
      return weeks === 1 ? '1 week' : `${weeks} weeks`;
    }
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month' : `${months} months`;
  };

  // Get urgency styling based on days until
  const getUrgencyClass = days => {
    if (days < 0) return 'upcoming-urgent'; // Overdue
    if (days <= 3) return 'upcoming-soon'; // Very soon
    if (days <= 7) return 'upcoming-week'; // This week
    return 'upcoming-normal'; // Normal
  };

  if (loading) {
    return (
      <div className='upcoming-recurring-widget upcoming-loading'>
        <Clock size={16} className='animate-spin' />
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className='upcoming-recurring-widget upcoming-error'>
        <AlertCircle size={16} />
        <span>Error loading</span>
      </div>
    );
  }

  if (!nextRecurring) {
    return (
      <div className='upcoming-recurring-widget upcoming-empty'>
        <Clock size={16} />
        <span>No recurring expenses</span>
      </div>
    );
  }

  const daysUntil = getDaysUntil(nextRecurring.nextDueDate);
  const urgencyClass = getUrgencyClass(daysUntil);
  const timeUntilText = formatTimeUntil(daysUntil);

  return (
    <div className={`upcoming-recurring-widget ${urgencyClass}`}>
      <div className='upcoming-icon'>
        <Clock size={16} />
      </div>

      <div className='upcoming-content'>
        <div className='upcoming-header'>
          <span className='upcoming-label'>Next Recurring:</span>
          <span className='upcoming-time'>{timeUntilText}</span>
        </div>

        <div className='upcoming-details'>
          <span className='upcoming-name'>{nextRecurring.name}</span>
          <span className='upcoming-amount'>
            ${nextRecurring.amount?.toLocaleString()}
            {nextRecurring.isVariableAmount && ' ~'}
          </span>
        </div>

        <div className='upcoming-date'>
          <Calendar size={12} />
          <span>{DateUtils.formatShortDate(nextRecurring.nextDueDate)}</span>
        </div>
      </div>
    </div>
  );
};

export default UpcomingRecurringWidget;

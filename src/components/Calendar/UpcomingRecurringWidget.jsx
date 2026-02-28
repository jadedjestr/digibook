import { Clock, Calendar, AlertCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { getUpcomingRecurringExpenses } from '../../services/recurringExpenseService';
import { useAppStore } from '../../stores/useAppStore';
import { DateUtils } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';

/**
 * Widget showing the next upcoming recurring expense
 * Displayed on the same line as the New Cycle button
 */
const UpcomingRecurringWidget = () => {
  const [nextRecurring, setNextRecurring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Watch for template refresh trigger from store
  const templatesLastUpdated = useAppStore(state => state.templatesLastUpdated);

  // Load the next upcoming recurring expense
  const loadNextRecurring = useCallback(async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors

      const upcomingExpenses = await getUpcomingRecurringExpenses();

      if (upcomingExpenses.length > 0) {
        // Sort by next due date and get the closest one
        const sortedExpenses = upcomingExpenses
          .filter(expense => {
            // Filter out expenses with invalid dates
            if (!expense.nextDueDate) return false;
            const date = DateUtils.parseDate(expense.nextDueDate);
            return date && !isNaN(date.getTime());
          })
          .sort((a, b) => {
            try {
              const dateA = DateUtils.parseDate(a.nextDueDate);
              const dateB = DateUtils.parseDate(b.nextDueDate);
              if (!dateA || !dateB) return 0;
              return dateA - dateB;
            } catch (err) {
              logger.error('Error sorting dates:', err);
              return 0;
            }
          });

        if (sortedExpenses.length > 0) {
          setNextRecurring(sortedExpenses[0]);
        } else {
          setNextRecurring(null);
        }
      } else {
        setNextRecurring(null);
      }
    } catch (err) {
      logger.error(
        'UpcomingRecurringWidget: Error loading recurring expenses:',
        err,
      );
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and when templates are updated
  useEffect(() => {
    loadNextRecurring();
  }, [loadNextRecurring, templatesLastUpdated]);

  // Calculate days until next recurring expense
  const getDaysUntil = dateString => {
    try {
      if (!dateString) return 999;
      const today = DateUtils.today();
      const days = DateUtils.daysBetween(today, dateString);

      // DateUtils.daysBetween can return null, so check for both null and NaN
      if (days === null || isNaN(days)) return 999;
      return days;
    } catch (error) {
      logger.error('Error calculating days until:', error);
      return 999;
    }
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
          <span>
            {nextRecurring.nextDueDate
              ? DateUtils.formatShortDate(nextRecurring.nextDueDate)
              : 'Invalid date'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default UpcomingRecurringWidget;

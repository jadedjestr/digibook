import { useState, useEffect } from 'react';
import { Clock, Calendar, AlertCircle } from 'lucide-react';
import PropTypes from 'prop-types';

import { recurringExpenseService } from '../../services/recurringExpenseService';
import { DateUtils } from '../../utils/dateUtils';

/**
 * Widget showing the next upcoming recurring expense
 * Displayed on the same line as the New Cycle button
 */
const UpcomingRecurringWidget = () => {
  const [nextRecurring, setNextRecurring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load the next upcoming recurring expense
  useEffect(() => {
    const loadNextRecurring = async () => {
      try {
        setLoading(true);
        const upcomingExpenses = await recurringExpenseService.getUpcomingRecurringExpenses();
        
        if (upcomingExpenses.length > 0) {
          // Sort by next due date and get the closest one
          const sortedExpenses = upcomingExpenses
            .filter(expense => expense.nextDueDate)
            .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
          
          if (sortedExpenses.length > 0) {
            setNextRecurring(sortedExpenses[0]);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadNextRecurring();
  }, []);

  // Calculate days until next recurring expense
  const getDaysUntil = (dateString) => {
    const today = DateUtils.today();
    const days = DateUtils.daysBetween(today, dateString);
    return days;
  };

  // Format the time until display
  const formatTimeUntil = (days) => {
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
  const getUrgencyClass = (days) => {
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
          <span className='upcoming-name'>
            {nextRecurring.name}
          </span>
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

UpcomingRecurringWidget.propTypes = {
  // No props needed - component manages its own state
};

export default UpcomingRecurringWidget;

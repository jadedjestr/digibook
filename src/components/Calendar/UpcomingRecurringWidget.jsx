import {
  ChevronDown,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useMemo } from 'react';

import { formatCurrency } from '../../utils/accountUtils';
import { DateUtils } from '../../utils/dateUtils';
import { isUnpaidOrPartial } from '../../utils/payCycleNudgeLogic';

/**
 * Widget showing upcoming payments for the current calendar month.
 * Displays up to 3 unpaid expenses, soonest first, with the next-to-pay item visually distinct.
 * When alwaysExpanded (e.g. in left panel), no collapse; optional onPayNow adds "Pay Now" per row.
 */
const UpcomingRecurringWidget = ({
  monthExpenses = [],
  alwaysExpanded = false,
  onPayNow,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const upcomingList = useMemo(() => {
    if (!Array.isArray(monthExpenses)) return [];
    return monthExpenses
      .filter(isUnpaidOrPartial)
      .sort((a, b) => {
        const dateA = DateUtils.parseDate(a.dueDate);
        const dateB = DateUtils.parseDate(b.dueDate);
        if (!dateA || !dateB) return 0;
        return dateA - dateB;
      })
      .slice(0, 3);
  }, [monthExpenses]);

  const getDaysUntil = dateString => {
    try {
      if (!dateString) return null;
      const days = DateUtils.daysBetween(DateUtils.today(), dateString);
      return days !== null && !isNaN(days) ? days : null;
    } catch {
      return null;
    }
  };

  const formatDueIn = days => {
    if (days === null) return null;
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `${days} days`;
    return null;
  };

  const handleToggleCollapse = () => setIsCollapsed(prev => !prev);

  const first = upcomingList[0];
  const summary =
    upcomingList.length === 0
      ? 'Nothing due this month'
      : (first &&
          `Next: ${first.name} — ${DateUtils.formatShortDate(first.dueDate)}`) ||
        '';

  const showBody = alwaysExpanded || !isCollapsed;

  return (
    <div className='upcoming-recurring-widget'>
      {!alwaysExpanded && (
        <button
          type='button'
          className='upcoming-widget-header'
          onClick={handleToggleCollapse}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed
              ? 'Expand upcoming payments'
              : 'Collapse upcoming payments'
          }
        >
          <span className='upcoming-label'>Upcoming payments</span>
          {isCollapsed && summary && (
            <span className='upcoming-collapsed-summary'>{summary}</span>
          )}
          <span className='upcoming-chevron'>
            {isCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </span>
        </button>
      )}
      {alwaysExpanded && (
        <div className='upcoming-widget-header upcoming-widget-header--label-only'>
          <span className='upcoming-label'>Upcoming payments</span>
        </div>
      )}

      {showBody && (
        <div className='upcoming-widget-body'>
          {upcomingList.length === 0 ? (
            <div className='upcoming-empty'>
              <span>Nothing due this month</span>
            </div>
          ) : (
            <ul
              className='upcoming-list'
              aria-label='Upcoming payments this month'
            >
              {upcomingList.map((expense, index) => {
                const daysUntil = getDaysUntil(expense.dueDate);
                const dueInText = index === 0 ? formatDueIn(daysUntil) : null;
                const isFirst = index === 0;

                return (
                  <li
                    key={expense.id}
                    className={
                      isFirst
                        ? 'upcoming-item upcoming-item-next'
                        : 'upcoming-item upcoming-item-secondary'
                    }
                  >
                    <div className='upcoming-item-main'>
                      {isFirst && (
                        <span className='upcoming-badge-next'>Next</span>
                      )}
                      <span className='upcoming-item-name'>{expense.name}</span>
                      <span className='upcoming-item-amount'>
                        {formatCurrency(expense.amount ?? 0)}
                      </span>
                      {typeof onPayNow === 'function' && (
                        <button
                          type='button'
                          className='upcoming-item-pay-now'
                          onClick={() => onPayNow(expense)}
                        >
                          Pay Now
                        </button>
                      )}
                    </div>
                    <div className='upcoming-item-meta'>
                      <span className='upcoming-item-date'>
                        <CalendarIcon size={12} aria-hidden />
                        {DateUtils.formatShortDate(expense.dueDate)}
                      </span>
                      {dueInText && (
                        <span className='upcoming-item-due-in'>
                          {dueInText}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

UpcomingRecurringWidget.propTypes = {
  monthExpenses: PropTypes.arrayOf(PropTypes.object),
  alwaysExpanded: PropTypes.bool,
  onPayNow: PropTypes.func,
};

UpcomingRecurringWidget.defaultProps = {
  monthExpenses: [],
  alwaysExpanded: false,
  onPayNow: undefined,
};

export default UpcomingRecurringWidget;

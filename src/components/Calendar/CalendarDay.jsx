import PropTypes from 'prop-types';
import { memo } from 'react';

import ExpenseBadge from './ExpenseBadge';

/**
 * Individual calendar day cell with expense badges and status indicators
 */
const CalendarDay = ({
  dayData,
  paycheckService,
  paycheckDates,
  onDaySelect,
  isSelected,
  isFocused,
  dayIndex,
  onFocusChange,
}) => {
  const {
    date,
    dateString,
    expenses,
    isToday,
    isCurrentMonth,
    isPaycheckDate,
    isNextPayDate,
    isFollowingPayDate,
  } = dayData;
  const dayNumber = date.getDate();

  // Limit to 3 visible expenses, show "+X more" if needed
  const visibleExpenses = expenses.slice(0, 3);
  const remainingCount = expenses.length - 3;

  return (
    <div
      className={`calendar-day ${isToday ? 'calendar-day--today' : ''} ${
        !isCurrentMonth ? 'calendar-day--other-month' : ''
      } ${isSelected ? 'calendar-day--selected' : ''} ${
        isFocused ? 'calendar-day--focused' : ''
      } ${isPaycheckDate ? 'calendar-day--paycheck' : ''} ${
        isNextPayDate ? 'calendar-day--next-paycheck' : ''
      } ${isFollowingPayDate ? 'calendar-day--following-paycheck' : ''}`}
      onClick={() => onDaySelect(dateString)}
      onFocus={() => onFocusChange(dayIndex)}
      role='gridcell'
      aria-label={`${date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })}, ${expenses.length} expense${expenses.length !== 1 ? 's' : ''}${
        isNextPayDate ? ', Next Paycheck Date' : ''
      }${isFollowingPayDate ? ', Following Paycheck Date' : ''}`}
      tabIndex={isFocused ? 0 : -1}
      data-day-index={dayIndex}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDaySelect(dateString);
        }
      }}
    >
      {/* Day number and paycheck indicator */}
      <div className='calendar-day-header'>
        <div className='calendar-day-number'>{dayNumber}</div>
        {isPaycheckDate && (
          <div
            className={`calendar-paycheck-indicator ${
              isNextPayDate
                ? 'calendar-paycheck-indicator--next'
                : 'calendar-paycheck-indicator--following'
            }`}
          >
            <svg
              width='12'
              height='12'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
            >
              <circle cx='12' cy='12' r='10' />
              <polyline points='12,6 12,12 16,14' />
            </svg>
          </div>
        )}
      </div>

      {/* Expense badges */}
      <div className='calendar-day-expenses'>
        {visibleExpenses.map((expense, _index) => (
          <ExpenseBadge
            key={expense.id}
            expense={expense}
            paycheckService={paycheckService}
            paycheckDates={paycheckDates}
          />
        ))}

        {/* Show "+X more" indicator if there are more expenses */}
        {remainingCount > 0 && (
          <div className='calendar-day-more'>+{remainingCount} more</div>
        )}
      </div>
    </div>
  );
};

CalendarDay.propTypes = {
  dayData: PropTypes.shape({
    date: PropTypes.instanceOf(Date).isRequired,
    dateString: PropTypes.string,
    expenses: PropTypes.arrayOf(PropTypes.object),
    isToday: PropTypes.bool,
    isCurrentMonth: PropTypes.bool,
    isPaycheckDate: PropTypes.bool,
    isNextPayDate: PropTypes.bool,
    isFollowingPayDate: PropTypes.bool,
  }).isRequired,
  paycheckService: PropTypes.object.isRequired,
  paycheckDates: PropTypes.shape({
    nextPayDate: PropTypes.string,
    followingPayDate: PropTypes.string,
  }).isRequired,
  onDaySelect: PropTypes.func.isRequired,
  isSelected: PropTypes.bool.isRequired,
  isFocused: PropTypes.bool.isRequired,
  dayIndex: PropTypes.number.isRequired,
  onFocusChange: PropTypes.func.isRequired,
};

export default memo(CalendarDay);

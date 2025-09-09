import { ChevronLeft, ChevronRight } from 'lucide-react';
import PropTypes from 'prop-types';

/**
 * Calendar Header with month navigation and status legend
 */
const CalendarHeader = ({
  currentMonth,
  onPreviousMonth,
  onNextMonth,
  onToday,
}) => {
  const monthYear = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className='calendar-header'>
      {/* Month Navigation */}
      <div className='calendar-navigation'>
        <button
          onClick={onPreviousMonth}
          className='calendar-nav-button glass-button glass-button--sm'
          aria-label='Previous month'
        >
          <ChevronLeft size={16} />
        </button>

        <h2 className='calendar-month-title'>{monthYear}</h2>

        <button
          onClick={onNextMonth}
          className='calendar-nav-button glass-button glass-button--sm'
          aria-label='Next month'
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={onToday}
          className='calendar-today-button glass-button glass-button--sm glass-button--primary'
          aria-label='Go to today'
        >
          Today
        </button>
      </div>

      {/* Status Legend */}
      <div className='calendar-legend'>
        <div className='legend-title'>Status Legend:</div>
        <div className='legend-items'>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--paid' />
            <span>Paid</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--partially-paid' />
            <span>Partially Paid</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--overdue' />
            <span>Overdue</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--pay-this-week' />
            <span>Pay This Week</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--pay-next-check' />
            <span>Pay with Next Check</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--pay-following-check' />
            <span>Pay with Following Check</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--recurring' />
            <span>Recurring Expense</span>
          </div>
        </div>

        {/* Paycheck Date Legend */}
        <div className='legend-items'>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--paycheck-next' />
            <span>Next Paycheck</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--paycheck-following' />
            <span>Following Paycheck</span>
          </div>
        </div>
      </div>
    </div>
  );
};

CalendarHeader.propTypes = {
  currentMonth: PropTypes.instanceOf(Date).isRequired,
  onPreviousMonth: PropTypes.func.isRequired,
  onNextMonth: PropTypes.func.isRequired,
  onToday: PropTypes.func.isRequired,
};

export default CalendarHeader;

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

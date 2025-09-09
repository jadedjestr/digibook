import React from 'react';
import { DateUtils } from '../../utils/dateUtils';

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
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
            <polyline points='15,18 9,12 15,6'></polyline>
          </svg>
        </button>

        <h2 className='calendar-month-title'>{monthYear}</h2>

        <button
          onClick={onNextMonth}
          className='calendar-nav-button glass-button glass-button--sm'
          aria-label='Next month'
        >
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
            <polyline points='9,18 15,12 9,6'></polyline>
          </svg>
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
            <div className='legend-badge legend-badge--paid'></div>
            <span>Paid</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--partially-paid'></div>
            <span>Partially Paid</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--overdue'></div>
            <span>Overdue</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--pay-this-week'></div>
            <span>Pay This Week</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--pay-next-check'></div>
            <span>Pay with Next Check</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--pay-following-check'></div>
            <span>Pay with Following Check</span>
          </div>
        </div>

        {/* Paycheck Date Legend */}
        <div className='legend-items'>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--paycheck-next'></div>
            <span>Next Paycheck</span>
          </div>
          <div className='legend-item'>
            <div className='legend-badge legend-badge--paycheck-following'></div>
            <span>Following Paycheck</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarHeader;

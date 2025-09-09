import React from 'react';

/**
 * Calendar Cycle Button - Integrated into calendar design
 * Clean, single-icon design that feels natural in the calendar context
 */
const CalendarCycleButton = ({ onReset }) => {
  return (
    <button
      onClick={onReset}
      className='calendar-cycle-button'
      aria-label='Start new pay cycle'
      title='Reset all expenses and start a new pay cycle'
    >
      <svg
        className='calendar-cycle-icon'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
      >
        <path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' />
        <path d='M21 3v5h-5' />
        <path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' />
        <path d='M3 21v-5h5' />
      </svg>
      New Cycle
    </button>
  );
};

export default CalendarCycleButton;

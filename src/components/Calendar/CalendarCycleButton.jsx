import PropTypes from 'prop-types';

/**
 * Calendar Cycle Button - Integrated into calendar design
 * variant="ghost" for de-emphasized use in left panel
 */
const CalendarCycleButton = ({ onReset, variant }) => {
  const className =
    variant === 'ghost'
      ? 'calendar-cycle-button calendar-cycle-button--ghost'
      : 'calendar-cycle-button';
  return (
    <button
      onClick={onReset}
      className={className}
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

CalendarCycleButton.propTypes = {
  onReset: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['default', 'ghost']),
};

CalendarCycleButton.defaultProps = {
  variant: 'default',
};

export default CalendarCycleButton;

import PropTypes from 'prop-types';
import { forwardRef } from 'react';

import CalendarDay from './CalendarDay';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Calendar Grid with 7-column layout and day cells
 */
const CalendarGrid = forwardRef(
  (
    {
      calendarData,
      paycheckService,
      paycheckDates,
      onDaySelect,
      selectedDay,
      focusedDayIndex,
      onFocusChange,
    },
    ref,
  ) => {
    return (
      <div className='calendar-grid-container'>
        {/* Week day headers */}
        <div className='calendar-weekdays'>
          {WEEK_DAYS.map(day => (
            <div key={day} className='calendar-weekday'>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className='calendar-grid' ref={ref}>
          {calendarData.map((dayData, index) => (
            <CalendarDay
              key={`${dayData.dateString}-${index}`}
              dayData={dayData}
              paycheckService={paycheckService}
              paycheckDates={paycheckDates}
              onDaySelect={onDaySelect}
              isSelected={selectedDay === dayData.dateString}
              isFocused={focusedDayIndex === index}
              dayIndex={index}
              onFocusChange={onFocusChange}
            />
          ))}
        </div>
      </div>
    );
  },
);

CalendarGrid.displayName = 'CalendarGrid';

CalendarGrid.propTypes = {
  calendarData: PropTypes.arrayOf(PropTypes.object).isRequired,
  paycheckService: PropTypes.object.isRequired,
  paycheckDates: PropTypes.shape({
    nextPayDate: PropTypes.string,
    followingPayDate: PropTypes.string,
  }).isRequired,
  onDaySelect: PropTypes.func.isRequired,
  selectedDay: PropTypes.string,
  focusedDayIndex: PropTypes.number,
  onFocusChange: PropTypes.func.isRequired,
};

export default CalendarGrid;

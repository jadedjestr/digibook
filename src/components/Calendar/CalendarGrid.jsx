import React, { forwardRef } from 'react';

import CalendarDay from './CalendarDay';

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
    ref
  ) => {
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className='calendar-grid-container'>
        {/* Week day headers */}
        <div className='calendar-weekdays'>
          {weekDays.map(day => (
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
              onSelect={() => onDaySelect(dayData.dateString)}
              isSelected={dayData.isSelected}
              isFocused={focusedDayIndex === index}
              dayIndex={index}
              onFocus={() => onFocusChange(index)}
            />
          ))}
        </div>
      </div>
    );
  }
);

CalendarGrid.displayName = 'CalendarGrid';

export default CalendarGrid;

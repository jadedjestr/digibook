import PropTypes from 'prop-types';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

import { DateUtils } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';

import CalendarCycleButton from './CalendarCycleButton';
import CalendarGrid from './CalendarGrid';
import CalendarHeader from './CalendarHeader';
import UpcomingRecurringWidget from './UpcomingRecurringWidget';
import './calendar.css';

/**
 * Main Calendar component for Fixed Expenses
 * Displays monthly view of expenses with status indicators
 * Integrates with PaycheckService for status calculations
 */
const Calendar = ({
  currentMonth,
  monthExpenses,
  paycheckService,
  paycheckDates,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onReset,
}) => {
  logger.debug('Calendar: COMPONENT MOUNTING');

  // Calendar state
  const [selectedDay, setSelectedDay] = useState(null);
  const [focusedDayIndex, setFocusedDayIndex] = useState(null);
  const calendarRef = useRef(null);

  // Generate calendar data
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of month, start from Sunday (include prev month days)
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // Last day of current month
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    // Calculate how many days we need to show the complete month
    // We need to go until we complete the week that contains the last day of the month
    const endDate = new Date(lastDay);
    const daysAfterLastDay = 6 - lastDay.getDay(); // Complete final week
    endDate.setDate(lastDay.getDate() + daysAfterLastDay);

    // Total days needed
    const totalDays =
      Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Generate days we need (usually 35 for 5 weeks, sometimes 42 for 6)
    const days = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dateString = DateUtils.formatDate(date);
      const dayExpenses = (monthExpenses || []).filter(
        expense => expense.dueDate === dateString,
      );

      // Paycheck date?
      const isNextPayDate = paycheckDates.nextPayDate === dateString;
      const isFollowingPayDate = paycheckDates.followingPayDate === dateString;
      const isPaycheckDate = isNextPayDate || isFollowingPayDate;

      days.push({
        date,
        dateString,
        expenses: dayExpenses,
        isToday: DateUtils.isToday(dateString),
        isCurrentMonth: date.getMonth() === month,
        isSelected: selectedDay === dateString,
        isPaycheckDate,
        isNextPayDate,
        isFollowingPayDate,
      });
    }

    return days;
  }, [currentMonth, monthExpenses, selectedDay, paycheckDates]);

  // Day selection handler
  const handleDaySelect = useCallback(
    dateString => {
      setSelectedDay(selectedDay === dateString ? null : dateString);
    },
    [selectedDay],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = e => {
      if (!calendarRef.current) return;

      // Only handle if Calendar is focused or event is from within it
      const isCalendarFocused =
        document.activeElement === calendarRef.current ||
        calendarRef.current.contains(document.activeElement);

      if ((e.key === ' ' || e.key === 'Enter') && !isCalendarFocused) {
        return;
      }

      const { key } = e;
      const currentIndex = focusedDayIndex !== null ? focusedDayIndex : 0;

      switch (key) {
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedDayIndex(Math.max(0, currentIndex - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setFocusedDayIndex(
            Math.min(calendarData.length - 1, currentIndex + 1),
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedDayIndex(Math.max(0, currentIndex - 7));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedDayIndex(
            Math.min(calendarData.length - 1, currentIndex + 7),
          );
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedDayIndex !== null) {
            const dayData = calendarData[focusedDayIndex];
            handleDaySelect(dayData.dateString);
          }
          break;
        case 'Home':
          e.preventDefault();
          setFocusedDayIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedDayIndex(calendarData.length - 1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedDayIndex, calendarData, handleDaySelect]);

  // Focus management
  useEffect(() => {
    if (focusedDayIndex !== null && calendarRef.current) {
      const dayElement = calendarRef.current.querySelector(
        `[data-day-index="${focusedDayIndex}"]`,
      );
      if (dayElement) {
        dayElement.focus();
      }
    }
  }, [focusedDayIndex]);

  return (
    <div className='calendar-section glass-entrance'>
      <div className='calendar-container'>
        <CalendarHeader
          currentMonth={currentMonth}
          onPreviousMonth={onPreviousMonth}
          onNextMonth={onNextMonth}
          onToday={onToday}
        />

        <CalendarGrid
          ref={calendarRef}
          calendarData={calendarData}
          paycheckService={paycheckService}
          paycheckDates={paycheckDates}
          onDaySelect={handleDaySelect}
          selectedDay={selectedDay}
          focusedDayIndex={focusedDayIndex}
          onFocusChange={setFocusedDayIndex}
        />

        {/* Calendar Actions - Upcoming Widget + New Cycle Button */}
        <div className='calendar-actions'>
          <UpcomingRecurringWidget />
          <CalendarCycleButton onReset={onReset} />
        </div>
      </div>
    </div>
  );
};

Calendar.propTypes = {
  currentMonth: PropTypes.instanceOf(Date).isRequired,
  monthExpenses: PropTypes.arrayOf(PropTypes.object),
  paycheckService: PropTypes.object.isRequired,
  paycheckDates: PropTypes.shape({
    nextPayDate: PropTypes.string,
    followingPayDate: PropTypes.string,
  }).isRequired,
  onPreviousMonth: PropTypes.func.isRequired,
  onNextMonth: PropTypes.func.isRequired,
  onToday: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
};

Calendar.defaultProps = {
  monthExpenses: [],
};

export default Calendar;

import PropTypes from 'prop-types';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

import { DateUtils } from '../../utils/dateUtils';

import CalendarGrid from './CalendarGrid';
import CalendarHeader from './CalendarHeader';
import './calendar.css';

// Module-level default so a missing prop doesn't create a new Map identity
// per render (which would invalidate the calendarData memo every time).
const EMPTY_RESOLUTION_MAP = new Map();

// Whether two plain objects hold the same values, one level deep. Used to
// tell that a day's expense is unchanged even though the calendar built a
// fresh copy of it, and that a nested `resolution` is the same too.
const sameFields = (a, b) => {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(key => {
    const x = a[key];
    const y = b[key];
    if (x === y) return true;
    const bothObjects =
      x && y && typeof x === 'object' && typeof y === 'object';
    if (!bothObjects || Array.isArray(x) || x instanceof Date) return false;
    const inner = Object.keys(x);
    return (
      inner.length === Object.keys(y).length && inner.every(k => x[k] === y[k])
    );
  });
};

// Whether a day would draw exactly what it drew before. Every field is
// compared, so a field added to a day later falls back to "changed" (an extra
// redraw) rather than "unchanged" (a stale cell).
const isSameDay = (before, after) => {
  const keys = Object.keys(after);
  if (keys.length !== Object.keys(before).length) return false;
  return keys.every(key => {
    if (key === 'date') return before.date.getTime() === after.date.getTime();
    if (key === 'expenses') {
      return (
        before.expenses.length === after.expenses.length &&
        after.expenses.every((expense, i) =>
          sameFields(before.expenses[i], expense),
        )
      );
    }
    return before[key] === after[key];
  });
};

/**
 * Main Calendar component for Fixed Expenses
 * Displays monthly view of expenses with status indicators
 * Integrates with PaycheckService for status calculations
 */
const Calendar = ({
  currentMonth,
  monthExpenses,
  virtualExpenses,
  resolutionByExpenseId = EMPTY_RESOLUTION_MAP,
  paycheckService,
  paycheckDates,
  onPreviousMonth,
  onNextMonth,
  onToday,
}) => {
  // Calendar state
  const [selectedDay, setSelectedDay] = useState(null);
  const [focusedDayIndex, setFocusedDayIndex] = useState(null);
  const calendarRef = useRef(null);

  // The days drawn last time, to hand back unchanged ones as the same object.
  const previousDays = useRef(new Map());

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
      DateUtils.daysBetween(
        DateUtils.formatDate(startDate),
        DateUtils.formatDate(endDate),
      ) + 1;

    // Generate days we need (usually 35 for 5 weeks, sometimes 42 for 6)
    const days = [];
    for (let i = 0; i < totalDays; i++) {
      // eslint-disable-next-line no-restricted-syntax -- copies a Date, not a day string
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dateString = DateUtils.formatDate(date);

      // Resolved cycles (Skip / short Partial / paid full) are flagged on
      // the object - same idiom as virtualExpenses' isVirtual - so the
      // badge can render them settled and inert without prop drilling.
      // Shallow copy: never mutate the store's expense objects.
      const dayExpenses = [
        ...(monthExpenses || [])
          .map(expense => {
            const resolution = resolutionByExpenseId.get(expense.id);
            return resolution ? { ...expense, resolution } : expense;
          })
          .filter(expense => expense.dueDate === dateString),
        ...(virtualExpenses || []).filter(
          expense => expense.dueDate === dateString,
        ),
      ];

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
        isPaycheckDate,
        isNextPayDate,
        isFollowingPayDate,
      });
    }

    // Editing one bill rebuilds every day, which would defeat the cell's
    // memo() and redraw all 35. Hand back the previous object for any day
    // that would draw the same, so only the days that changed redraw.
    const reused = days.map(day => {
      const before = previousDays.current.get(day.dateString);
      return before && isSameDay(before, day) ? before : day;
    });
    previousDays.current = new Map(reused.map(day => [day.dateString, day]));
    return reused;
  }, [
    currentMonth,
    monthExpenses,
    virtualExpenses,
    resolutionByExpenseId,
    paycheckDates,
  ]);

  // Day selection handler
  const handleDaySelect = useCallback(dateString => {
    setSelectedDay(prev => (prev === dateString ? null : dateString));
  }, []);

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
      </div>
    </div>
  );
};

Calendar.propTypes = {
  currentMonth: PropTypes.instanceOf(Date).isRequired,
  monthExpenses: PropTypes.arrayOf(PropTypes.object),
  virtualExpenses: PropTypes.arrayOf(PropTypes.object),
  resolutionByExpenseId: PropTypes.instanceOf(Map),
  paycheckService: PropTypes.object.isRequired,
  paycheckDates: PropTypes.shape({
    nextPayDate: PropTypes.string,
    followingPayDate: PropTypes.string,
  }).isRequired,
  onPreviousMonth: PropTypes.func.isRequired,
  onNextMonth: PropTypes.func.isRequired,
  onToday: PropTypes.func.isRequired,
};

Calendar.defaultProps = {
  monthExpenses: [],
  virtualExpenses: [],
};

export default Calendar;

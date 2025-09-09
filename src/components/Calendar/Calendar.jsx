import React, { useState, useMemo, useEffect, useRef } from 'react';

import { PaycheckService } from '../../services/paycheckService';
import { useAppStore } from '../../stores/useAppStore';
import { DateUtils } from '../../utils/dateUtils';

import CalendarCycleButton from './CalendarCycleButton';
import CalendarGrid from './CalendarGrid';
import CalendarHeader from './CalendarHeader';
import './calendar.css';

/**
 * Main Calendar component for Fixed Expenses
 * Displays monthly view of expenses with status indicators
 * Integrates with PaycheckService for status calculations
 */
const Calendar = ({ onReset }) => {
  // Get data from Zustand store
  const { fixedExpenses, paycheckSettings } = useAppStore();

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [focusedDayIndex, setFocusedDayIndex] = useState(null);
  const calendarRef = useRef(null);

  // Initialize PaycheckService
  const paycheckService = useMemo(() => {
    return new PaycheckService(paycheckSettings);
  }, [paycheckSettings]);

  // Calculate paycheck dates
  const paycheckDates = useMemo(() => {
    return paycheckService.calculatePaycheckDates();
  }, [paycheckService]);

  // Generate calendar data
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Get first day of month and calculate starting date (including previous month days)
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // Last day of current month
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    // Calculate how many days we need to show the complete month
    // We need to go until we complete the week that contains the last day of the month
    const endDate = new Date(lastDay);
    const daysAfterLastDay = 6 - lastDay.getDay(); // Days to complete the final week (Sunday = 0)
    endDate.setDate(lastDay.getDate() + daysAfterLastDay);

    // Calculate total days needed
    const totalDays =
      Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Generate only the days we need (usually 35 days for 5 weeks, sometimes 42 for 6 weeks)
    const days = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dateString = DateUtils.formatDate(date);
      const dayExpenses = fixedExpenses.filter(
        expense => expense.dueDate === dateString
      );

      // Check if this is a paycheck date
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
  }, [currentMonth, fixedExpenses, selectedDay]);

  // Navigation handlers
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDay(null);
  };

  // Day selection handler
  const handleDaySelect = dateString => {
    setSelectedDay(selectedDay === dateString ? null : dateString);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = e => {
      if (!calendarRef.current) return;

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
            Math.min(calendarData.length - 1, currentIndex + 1)
        );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedDayIndex(Math.max(0, currentIndex - 7));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedDayIndex(
            Math.min(calendarData.length - 1, currentIndex + 7)
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
        `[data-day-index="${focusedDayIndex}"]`
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
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
          onToday={goToToday}
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

        {/* Start Cycle Button - Bottom right of calendar */}
        <div className='calendar-actions'>
          <CalendarCycleButton onReset={onReset} />
        </div>
      </div>
    </div>
  );
};

export default Calendar;

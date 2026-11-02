import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { calculateNextPayDates } from '../../constants/payFrequency';
import { DateUtils } from '../../utils/dateUtils';
import { isNearEndOfMonth } from '../../utils/payCycleNudgeLogic';
import Calendar from '../Calendar/Calendar';

// The calendar's stylesheet needs the full Tailwind build, which tests skip.
vi.mock('../Calendar/calendar.css', () => ({}));

// The day the clocks go back is 25 hours long (1 Nov 2026, 5 Nov 2028), so
// ms / 86,400,000 over it comes out a fraction too big and Math.ceil turned
// that into a whole extra day. Pin a zone that has the change.
process.env.TZ = 'America/Los_Angeles';

const setNow = (...args) =>
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(...args) });

afterEach(() => {
  vi.useRealTimers();
});

describe('days across the clocks going back', () => {
  it('runs in a zone with the change, or this suite proves nothing', () => {
    const before = new Date(2026, 10, 1).getTime();
    const after = new Date(2026, 10, 2).getTime();
    expect(after - before).toBe(25 * 60 * 60 * 1000);
  });

  it('DateUtils.daysUntil counts whole days to a due date', () => {
    setNow(2026, 9, 28, 14, 0);
    expect(DateUtils.daysUntil('2026-11-05')).toBe(8);
    expect(DateUtils.daysUntil('2026-10-28')).toBe(0);
    expect(DateUtils.daysUntil('2026-10-25')).toBe(-3);
    expect(DateUtils.daysUntil('')).toBeNull();
    expect(DateUtils.daysUntil(undefined)).toBeNull();
  });

  it('counts the days to the next and following paycheck', () => {
    setNow(2026, 9, 28, 14, 0);
    expect(calculateNextPayDates('2026-10-22', 'monthly')).toMatchObject({
      nextPayDate: '2026-11-22',
      daysUntilNextPay: 25,
      followingPayDate: '2026-12-22',
      daysUntilFollowingPay: 55,
    });
  });

  it('measures the days left in the month from the first hour of the day', () => {
    const today = new Date(2028, 10, 2, 0, 30);
    const month = new Date(2028, 10, 1);
    expect(isNearEndOfMonth(today, month, { daysNearEndOfMonth: 28 })).toBe(
      true,
    );
    expect(isNearEndOfMonth(today, month, { daysNearEndOfMonth: 27 })).toBe(
      false,
    );
  });

  it('draws five weeks for a month that spans the change', () => {
    // Nov 2027 starts on a Monday, so its grid begins Sun 31 Oct, before the
    // change, and ends Sat 4 Dec: exactly 35 days. It drew 36.
    setNow(2027, 10, 10, 12, 0);
    render(
      <Calendar
        currentMonth={new Date(2027, 10, 1)}
        monthExpenses={[]}
        virtualExpenses={[]}
        paycheckDates={{}}
        onPreviousMonth={() => {}}
        onNextMonth={() => {}}
        onToday={() => {}}
      />,
    );
    expect(screen.getAllByRole('gridcell')).toHaveLength(35);
  });
});

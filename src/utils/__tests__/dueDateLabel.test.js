import { describe, test, expect } from 'vitest';

import { formatRelativeDueDate } from '../dueDateLabel';

const TODAY = '2026-09-13';

describe('formatRelativeDueDate', () => {
  test('due today', () => {
    expect(formatRelativeDueDate('2026-09-13', TODAY)).toBe('Due today');
  });

  test('due tomorrow', () => {
    expect(formatRelativeDueDate('2026-09-14', TODAY)).toBe('Due tomorrow');
  });

  test('due within the next 6 days uses a day count', () => {
    expect(formatRelativeDueDate('2026-09-15', TODAY)).toBe('Due in 2 days');
    expect(formatRelativeDueDate('2026-09-19', TODAY)).toBe('Due in 6 days');
  });

  test('due 7+ days out falls back to a short date, not a day count', () => {
    expect(formatRelativeDueDate('2026-09-20', TODAY)).toBe('Sep 20, 2026');
  });

  test('overdue by one day uses singular "day"', () => {
    expect(formatRelativeDueDate('2026-09-12', TODAY)).toBe('Overdue by 1 day');
  });

  test('overdue by multiple days uses plural "days"', () => {
    expect(formatRelativeDueDate('2026-09-01', TODAY)).toBe(
      'Overdue by 12 days',
    );
  });

  test('an unparseable date returns a fallback, not "Invalid Date"', () => {
    // parseDate() returns an Invalid Date object, not null, for this input —
    // daysBetween() then produces NaN, not null. Both must be caught, or
    // this silently prints the native "Invalid Date" string instead.
    expect(formatRelativeDueDate('not-a-date', TODAY)).toBe('Unknown date');
  });

  test('an empty due date returns the fallback', () => {
    expect(formatRelativeDueDate('', TODAY)).toBe('Unknown date');
  });

  test('defaults todayStr to the real current date when omitted', () => {
    // Not asserting a specific label — just that calling without the second
    // argument doesn't throw and returns a string.
    expect(typeof formatRelativeDueDate('2026-01-01')).toBe('string');
  });
});

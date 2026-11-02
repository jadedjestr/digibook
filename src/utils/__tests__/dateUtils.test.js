import { afterEach, describe, expect, it, vi } from 'vitest';

import { DateUtils } from '../dateUtils';

describe('DateUtils.formatFileTimestamp', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats the local date and time as YYYY-MM-DD_HH-mm', () => {
    expect(DateUtils.formatFileTimestamp(new Date(2026, 9, 14, 17, 42))).toBe(
      '2026-10-14_17-42',
    );
  });

  // 23:30 local is already the next day in UTC west of Greenwich; a UTC
  // based stamp would name this export the 15th.
  it('keeps a late-evening time on its local date', () => {
    expect(DateUtils.formatFileTimestamp(new Date(2026, 9, 14, 23, 30))).toBe(
      '2026-10-14_23-30',
    );
  });

  it('zero-pads every part', () => {
    expect(DateUtils.formatFileTimestamp(new Date(2026, 0, 5, 7, 3))).toBe(
      '2026-01-05_07-03',
    );
  });

  it('uses no colons, which Mac and Windows filenames reject', () => {
    expect(
      DateUtils.formatFileTimestamp(new Date(2026, 9, 14, 9, 5)),
    ).not.toMatch(/:/);
  });

  it('defaults to now', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 14, 8, 15) });
    expect(DateUtils.formatFileTimestamp()).toBe('2026-10-14_08-15');
  });
});

// Clocks go back on 2026-11-01 (US), so that day has 25 hours, and forward on
// 2026-03-08, so that day has 23. Neither may change a count of whole days.
describe('DateUtils.daysBetween', () => {
  it('counts whole days across the clocks going back', () => {
    expect(DateUtils.daysBetween('2026-10-16', '2026-11-02')).toBe(17);
    expect(DateUtils.daysBetween('2026-10-25', '2026-11-02')).toBe(8);
  });

  it('counts whole days across the clocks going forward', () => {
    expect(DateUtils.daysBetween('2026-03-01', '2026-03-10')).toBe(9);
  });

  it('is negative when the dates are the other way round', () => {
    expect(DateUtils.daysBetween('2026-11-02', '2026-10-16')).toBe(-17);
  });
});

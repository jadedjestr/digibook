import { describe, it, expect } from 'vitest';

import { DateUtils } from '../../utils/dateUtils';
import { getMostRecentImpliedPayDate } from '../payFrequency';

describe('getMostRecentImpliedPayDate', () => {
  it('returns null when lastPaycheckDate is missing', () => {
    expect(getMostRecentImpliedPayDate('', 'weekly', '2026-01-08')).toBeNull();
    expect(
      getMostRecentImpliedPayDate(null, 'weekly', '2026-01-08'),
    ).toBeNull();
  });

  it('returns null when referenceDate is missing', () => {
    expect(getMostRecentImpliedPayDate('2026-01-08', 'weekly', '')).toBeNull();
  });

  describe('weekly frequency (7-day interval)', () => {
    const payday = '2026-01-08'; // the anchor is itself already an implied payday

    // Within the first 7-day cycle (offsets 0, 2, 3) the anchor is still the
    // most recent implied payday - nothing to skip ahead to yet. This covers
    // the safe-zone/advance boundary at 2 vs 3 days past.
    it.each([0, 2, 3])(
      '%d days past: still resolves to the anchor payday itself',
      offset => {
        const referenceDate = DateUtils.addDays(payday, offset);
        expect(
          getMostRecentImpliedPayDate(payday, 'weekly', referenceDate),
        ).toBe(payday);
      },
    );

    // At 9 and 14 days past the original anchor, one or two more weekly
    // cycles have elapsed, so the function must walk forward past the stale
    // anchor rather than returning it - proving the multi-cycle walk works,
    // which is the whole reason this helper exists alongside
    // calculateNextPayDates.
    it('9 days past the anchor: walks forward one cycle to the more recent payday', () => {
      const referenceDate = DateUtils.addDays(payday, 9);
      expect(getMostRecentImpliedPayDate(payday, 'weekly', referenceDate)).toBe(
        DateUtils.addDays(payday, 7),
      );
    });

    it('14 days past the anchor: walks forward two full cycles', () => {
      const referenceDate = DateUtils.addDays(payday, 14);
      expect(getMostRecentImpliedPayDate(payday, 'weekly', referenceDate)).toBe(
        DateUtils.addDays(payday, 14),
      );
    });
  });

  describe('monthly frequency (calendar-month interval)', () => {
    const payday = '2026-01-15'; // mid-month anchor, clear of day-clamping edge cases

    // A calendar month is comfortably longer than 14 days, so all five
    // offsets stay inside the same cycle and should all resolve back to the
    // anchor payday.
    it.each([0, 2, 3, 9, 14])(
      '%d days past: still resolves to the anchor payday itself',
      offset => {
        const referenceDate = DateUtils.addDays(payday, offset);
        expect(
          getMostRecentImpliedPayDate(payday, 'monthly', referenceDate),
        ).toBe(payday);
      },
    );

    it('walks forward past a stale anchor once the next calendar month has arrived', () => {
      // Anchor is Jan 15; by Feb 20 the Feb 15 payday has already occurred.
      expect(getMostRecentImpliedPayDate(payday, 'monthly', '2026-02-20')).toBe(
        '2026-02-15',
      );
    });
  });

  it('defaults referenceDate to today when omitted', () => {
    const today = DateUtils.today();
    expect(getMostRecentImpliedPayDate(today, 'weekly')).toBe(today);
  });

  it('falls back to the default frequency for an unrecognized key', () => {
    expect(
      getMostRecentImpliedPayDate(
        '2026-01-08',
        'not-a-frequency',
        '2026-01-10',
      ),
    ).toBe(getMostRecentImpliedPayDate('2026-01-08', 'biweekly', '2026-01-10'));
  });
});

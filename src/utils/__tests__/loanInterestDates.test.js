import { describe, it, expect } from 'vitest';

import { civilDay, computeLoanInterest } from '../loanInterest';

const loan = { balance: 10000, interestRate: 6, unpaidInterest: 0 };

describe('loan civil dates', () => {
  it.each([
    ['2026-10-31', '2026-11-02', 2],
    ['2026-03-07', '2026-03-09', 2],
    ['2028-02-28', '2028-03-01', 2],
    ['2026-01-01', '2026-01-01', 0],
    ['2025-12-31', '2026-01-01', 1],
  ])('%s to %s counts calendar days', (from, to, days) => {
    expect(civilDay(to) - civilDay(from)).toBe(days);
    const result = computeLoanInterest(
      { ...loan, interestAccruedThrough: from },
      to,
    );
    expect(result.rawInterest).toBeCloseTo(((10000 * 0.06) / 365) * days, 10);
  });
  it.each(['2026-02-30', '2026-13-01', 'not a date', '2026-1-01'])(
    'rejects invalid date %s',
    date => {
      expect(() => civilDay(date)).toThrow();
    },
  );
  it('rejects backdated accrual rather than silently clamping it', () => {
    expect(() =>
      computeLoanInterest(
        { ...loan, interestAccruedThrough: '2026-02-02' },
        '2026-02-01',
        100,
      ),
    ).toThrow(/precedes/);
  });
});

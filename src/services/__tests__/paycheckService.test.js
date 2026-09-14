import { describe, test, expect } from 'vitest';

import { PaycheckService } from '../paycheckService';

/**
 * calculateExpenseStatus() and calculateSummaryTotals() had zero tests
 * before this file — part of why a partially-paid expense could silently
 * vanish from every rollup total without anyone noticing.
 *
 * The two things this project actually got wrong, pinned as regressions:
 *   1. an overdue-and-partially-paid expense reported 'Partially Paid',
 *      never 'Overdue', anywhere the status was read;
 *   2. calculateSummaryTotals() switched on that same collapsed status, so
 *      a partially-paid expense contributed to no bucket at all — not a
 *      wrong amount, an absent one.
 */

const service = new PaycheckService({
  lastPaycheckDate: '2026-09-01',
  frequency: 'bi-weekly',
});

// A fixed, deterministic pay-cycle window for every test below.
const paycheckDates = {
  nextPayDate: '2026-09-24',
  followingPayDate: '2026-10-08',
};

const expense = overrides => ({
  id: 'e1',
  amount: 100,
  paidAmount: 0,
  dueDate: '2026-09-20',
  ...overrides,
});

describe('getPaymentProgress', () => {
  test('fully paid', () => {
    expect(service.getPaymentProgress(expense({ paidAmount: 100 }))).toBe(
      'Paid',
    );
  });

  test('overpaid still counts as paid', () => {
    expect(service.getPaymentProgress(expense({ paidAmount: 120 }))).toBe(
      'Paid',
    );
  });

  test('partially paid', () => {
    expect(service.getPaymentProgress(expense({ paidAmount: 40 }))).toBe(
      'Partial',
    );
  });

  test('untouched', () => {
    expect(service.getPaymentProgress(expense({ paidAmount: 0 }))).toBe(
      'Unpaid',
    );
  });
});

describe('getTimingBucket', () => {
  test('before today is overdue', () => {
    expect(
      service.getTimingBucket(
        expense({ dueDate: '2026-09-01' }),
        paycheckDates,
      ),
    ).toBe('Overdue');
  });

  test('on or before the next paycheck is this week', () => {
    expect(
      service.getTimingBucket(
        expense({ dueDate: '2026-09-24' }),
        paycheckDates,
      ),
    ).toBe('This Week');
  });

  test('between the next and following paycheck is next check', () => {
    expect(
      service.getTimingBucket(
        expense({ dueDate: '2026-09-25' }),
        paycheckDates,
      ),
    ).toBe('Next Check');
    expect(
      service.getTimingBucket(
        expense({ dueDate: '2026-10-08' }),
        paycheckDates,
      ),
    ).toBe('Next Check');
  });

  test('after the following paycheck is following check', () => {
    expect(
      service.getTimingBucket(
        expense({ dueDate: '2026-10-09' }),
        paycheckDates,
      ),
    ).toBe('Following Check');
  });

  test('an unparseable due date returns null rather than misclassifying', () => {
    expect(
      service.getTimingBucket(
        expense({ dueDate: 'not-a-date' }),
        paycheckDates,
      ),
    ).toBeNull();
    expect(
      service.getTimingBucket(expense({ dueDate: '' }), paycheckDates),
    ).toBeNull();
  });
});

describe('calculateExpenseStatus — unchanged cases', () => {
  test('fully paid', () => {
    expect(
      service.calculateExpenseStatus(
        expense({ paidAmount: 100 }),
        paycheckDates,
      ),
    ).toBe('Paid');
  });

  test('unpaid and overdue', () => {
    expect(
      service.calculateExpenseStatus(
        expense({ dueDate: '2026-09-01' }),
        paycheckDates,
      ),
    ).toBe('Overdue');
  });

  test('unpaid, due before the next paycheck', () => {
    expect(
      service.calculateExpenseStatus(
        expense({ dueDate: '2026-09-24' }),
        paycheckDates,
      ),
    ).toBe('Pay This Week');
  });

  test('unpaid, due with the next check', () => {
    expect(
      service.calculateExpenseStatus(
        expense({ dueDate: '2026-09-25' }),
        paycheckDates,
      ),
    ).toBe('Pay with Next Check');
  });

  test('unpaid, due with the following check', () => {
    expect(
      service.calculateExpenseStatus(
        expense({ dueDate: '2026-10-09' }),
        paycheckDates,
      ),
    ).toBe('Pay with Following Check');
  });

  test('partially paid, not yet due — still shows as Partially Paid', () => {
    // The preserved simplification: a single badge can't say both "43%
    // paid" and "due in 4 days" at once, and this project isn't asking it
    // to. Only the money math is required to know both facts at once.
    expect(
      service.calculateExpenseStatus(
        expense({ paidAmount: 40, dueDate: '2026-09-24' }),
        paycheckDates,
      ),
    ).toBe('Partially Paid');
  });

  test('an unparseable due date on an otherwise-unpaid expense is Unknown', () => {
    expect(
      service.calculateExpenseStatus(
        expense({ dueDate: 'not-a-date' }),
        paycheckDates,
      ),
    ).toBe('Unknown');
  });
});

describe('calculateExpenseStatus — the actual fix', () => {
  test('overdue outranks partially paid', () => {
    const partiallyPaidAndOverdue = expense({
      paidAmount: 40,
      dueDate: '2026-09-01',
    });
    expect(
      service.calculateExpenseStatus(partiallyPaidAndOverdue, paycheckDates),
    ).toBe('Overdue');
  });
});

describe('calculateSummaryTotals — the actual fix', () => {
  test('a partially-paid expense contributes its remaining amount, not zero', () => {
    const totals = service.calculateSummaryTotals(
      [expense({ paidAmount: 40, dueDate: '2026-09-24' })], // due this week
      paycheckDates,
    );
    expect(totals.payThisWeekTotal).toBe(60);
  });

  test('a partially-paid, overdue expense lands in overdueTotal, not nowhere', () => {
    const totals = service.calculateSummaryTotals(
      [expense({ paidAmount: 40, dueDate: '2026-09-01' })],
      paycheckDates,
    );
    expect(totals.overdueTotal).toBe(60);
    expect(totals.payThisWeekTotal).toBe(0);
  });

  test('a fully-paid expense contributes to no bucket', () => {
    const totals = service.calculateSummaryTotals(
      [expense({ paidAmount: 100, dueDate: '2026-09-01' })],
      paycheckDates,
    );
    expect(totals).toEqual({
      payThisWeekTotal: 0,
      payNextCheckTotal: 0,
      overdueTotal: 0,
    });
  });

  test('following-check expenses are still excluded entirely, paid or not', () => {
    const totals = service.calculateSummaryTotals(
      [expense({ paidAmount: 40, dueDate: '2026-10-09' })],
      paycheckDates,
    );
    expect(totals).toEqual({
      payThisWeekTotal: 0,
      payNextCheckTotal: 0,
      overdueTotal: 0,
    });
  });

  test('mixed expenses land in their correct, independent buckets', () => {
    const totals = service.calculateSummaryTotals(
      [
        expense({ id: 'a', paidAmount: 0, dueDate: '2026-09-01' }), // overdue, unpaid
        expense({ id: 'b', paidAmount: 40, dueDate: '2026-09-20' }), // this week, partial — the reported bug
        expense({ id: 'c', paidAmount: 0, dueDate: '2026-09-25' }), // next check
        expense({ id: 'd', paidAmount: 100, dueDate: '2026-09-01' }), // paid, excluded
      ],
      paycheckDates,
    );
    expect(totals).toEqual({
      overdueTotal: 100,
      payThisWeekTotal: 60,
      payNextCheckTotal: 100,
    });
  });
});

describe('shouldPromptReset — the disclosed side effect', () => {
  // shouldPromptReset compares its dates against the real wall-clock date
  // (`new Date()` inside the function), not a fixed one — so "a date last
  // month" and "a date next month" are computed relative to whenever this
  // suite actually runs, rather than hardcoded against 2026.
  //
  // Day 15, deliberately, on every one of these — never day 1 or the last
  // day of a month. shouldPromptReset parses nextPayDate with the native
  // `new Date(string)` constructor rather than DateUtils.parseDate, and a
  // bare 'YYYY-MM-DD' string parses as UTC midnight: in a timezone behind
  // UTC that reads back as the previous day locally, which flips the month
  // for anything landing on day 1. That's a real, pre-existing bug in
  // shouldPromptReset, unrelated to the fix here — worth its own report,
  // not silently papered over — but this test's job is the status fix, so
  // it stays clear of that edge rather than tripping on it.
  const toISODate = d => d.toISOString().slice(0, 10);
  const now = new Date();
  const lastMonth = toISODate(
    new Date(now.getFullYear(), now.getMonth() - 1, 15),
  );
  const nextMonth = toISODate(
    new Date(now.getFullYear(), now.getMonth() + 1, 15),
  );
  const monthAfterNext = toISODate(
    new Date(now.getFullYear(), now.getMonth() + 2, 15),
  );

  test('a partially-paid, overdue expense now counts toward "settled", like a fully-unpaid overdue one does', () => {
    // Before this fix, a lingering partial payment on an overdue bill could
    // block this prompt indefinitely, since its status was neither 'Paid'
    // nor 'Overdue'. This pins the corrected — and disclosed — behaviour.
    const futurePaycheckDates = {
      nextPayDate: nextMonth,
      followingPayDate: monthAfterNext,
    };
    const result = service.shouldPromptReset(
      [expense({ paidAmount: 40, dueDate: lastMonth })],
      futurePaycheckDates,
    );
    expect(result).toBe(true);
  });
});

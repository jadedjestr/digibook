import { describe, it, expect } from 'vitest';

import {
  getLoanPayoffProgress,
  getOriginalScheduleComparison,
} from '../loanUtils';

describe('getLoanPayoffProgress', () => {
  it('computes percent paid off from originalLoanAmount and balance', () => {
    const progress = getLoanPayoffProgress({
      originalLoanAmount: 10000,
      balance: 7500,
    });
    expect(progress.paidAmount).toBe(2500);
    expect(progress.percent).toBe(25);
    expect(progress.isPaidOff).toBe(false);
  });

  it('reports 100% and paid-off when balance reaches 0', () => {
    const progress = getLoanPayoffProgress({
      originalLoanAmount: 10000,
      balance: 0,
    });
    expect(progress.percent).toBe(100);
    expect(progress.isPaidOff).toBe(true);
  });

  it('cannot compute progress without an original loan amount', () => {
    const progress = getLoanPayoffProgress({ balance: 5000 });
    expect(progress.paidAmount).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.isPaidOff).toBe(false);
  });
});

describe('getOriginalScheduleComparison', () => {
  it('reports months ahead of the original maturity date when the target is earlier', () => {
    const loan = {
      targetPayoffDate: '2029-06-01',
      originalMaturityDate: '2030-06-01', // 12 months later
    };
    const result = getOriginalScheduleComparison(loan, 200);
    expect(result.monthsAheadOfSchedule).toBe(12);
  });

  it('reports months behind (negative) when the target is later than the original maturity date', () => {
    const loan = {
      targetPayoffDate: '2031-06-01',
      originalMaturityDate: '2030-06-01', // target is 12 months later, i.e. behind
    };
    const result = getOriginalScheduleComparison(loan, 200);
    expect(result.monthsAheadOfSchedule).toBe(-12);
  });

  it('is null when either date is missing', () => {
    const result = getOriginalScheduleComparison(
      { targetPayoffDate: '2029-06-01' },
      200,
    );
    expect(result.monthsAheadOfSchedule).toBeNull();
  });

  it('computes a negative payment delta when the calculated payment is less than the original', () => {
    const result = getOriginalScheduleComparison(
      { originalScheduledPayment: 250 },
      200,
    );
    expect(result.paymentDelta).toBeCloseTo(-50, 6);
  });

  it('computes a positive payment delta when the calculated payment exceeds the original', () => {
    const result = getOriginalScheduleComparison(
      { originalScheduledPayment: 150 },
      200,
    );
    expect(result.paymentDelta).toBeCloseTo(50, 6);
  });

  it('is null when the calculated payment or original scheduled payment is unavailable', () => {
    const result = getOriginalScheduleComparison(
      { originalScheduledPayment: 150 },
      null,
    );
    expect(result.paymentDelta).toBeNull();
  });
});

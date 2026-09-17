import { describe, it, expect } from 'vitest';

import {
  getOriginalCardProgress,
  getPayToTargetUtilization,
  getEffectiveCardInterestRate,
} from '../creditCardUtils';

describe('getOriginalCardProgress', () => {
  it('reports no data for a legacy card with no originalBalance', () => {
    const result = getOriginalCardProgress({ balance: 500 });
    expect(result.hasData).toBe(false);
    expect(result.percent).toBe(0);
    expect(result.isPaidOff).toBe(false);
    expect(Number.isNaN(result.percent)).toBe(false);
  });

  it('reports paid-off even without originalBalance if the balance is 0', () => {
    const result = getOriginalCardProgress({ balance: 0 });
    expect(result.hasData).toBe(false);
    expect(result.isPaidOff).toBe(true);
    expect(result.percent).toBe(100);
  });

  it('computes progress for a normal card', () => {
    const result = getOriginalCardProgress({
      balance: 600,
      originalBalance: 1000,
    });
    expect(result.hasData).toBe(true);
    expect(result.paidAmount).toBe(400);
    expect(result.percent).toBe(40);
    expect(result.isPaidOff).toBe(false);
  });

  it('caps progress at 100% and reports paid off at balance 0', () => {
    const result = getOriginalCardProgress({
      balance: 0,
      originalBalance: 1000,
    });
    expect(result.hasData).toBe(true);
    expect(result.percent).toBe(100);
    expect(result.isPaidOff).toBe(true);
  });
});

describe('getPayToTargetUtilization', () => {
  it('returns 0 when already at or under the target', () => {
    expect(
      getPayToTargetUtilization({ balance: 1000, creditLimit: 5000 }, 30),
    ).toBe(0);
  });

  it('returns the dollar amount needed to reach the target when over it', () => {
    // 50% utilization on a $5000 limit -> $2500 balance; target 30% -> $1500
    expect(
      getPayToTargetUtilization({ balance: 2500, creditLimit: 5000 }, 30),
    ).toBe(1000);
  });

  it('returns 0 when creditLimit is missing or zero', () => {
    expect(getPayToTargetUtilization({ balance: 100, creditLimit: 0 })).toBe(0);
  });
});

describe('getEffectiveCardInterestRate', () => {
  it('returns the standard rate when hasIntroApr is not set', () => {
    expect(getEffectiveCardInterestRate({ interestRate: 20 })).toBe(20);
  });

  it('returns the standard rate when hasIntroApr is false', () => {
    expect(
      getEffectiveCardInterestRate({
        interestRate: 20,
        hasIntroApr: false,
        introApr: 0,
        introAprEndDate: '2099-01-01',
      }),
    ).toBe(20);
  });
});

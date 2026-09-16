import { describe, it, expect, vi } from 'vitest';

import { dbHelpers } from '../database-clean';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Independently re-simulates amortization (not the production code under
// test) to check the computed payment actually drains the balance to ~0
// over the term, rather than asserting a hand-computed literal that could
// itself be mistyped.
const simulateRemainingBalance = (balance, interestRate, months, payment) => {
  const monthlyRate = interestRate / 100 / 12;
  let remaining = balance;
  for (let i = 0; i < months; i++) {
    const interest = remaining * monthlyRate;
    remaining = remaining + interest - payment;
  }
  return remaining;
};

describe('dbHelpers.calculateRequiredLoanPayment', () => {
  it('computes a payment that fully amortizes the balance over the exact term', () => {
    const result = dbHelpers.calculateRequiredLoanPayment(
      10000,
      6,
      '2026-01-15',
      '2027-01-15', // exactly 12 months later
    );

    expect(result.success).toBe(true);
    const remaining = simulateRemainingBalance(10000, 6, 12, result.payment);
    expect(Math.abs(remaining)).toBeLessThan(0.01);
  });

  it('divides the balance evenly across months at 0% interest', () => {
    const result = dbHelpers.calculateRequiredLoanPayment(
      1200,
      0,
      '2026-01-01',
      '2027-01-01', // 12 months
    );

    expect(result.success).toBe(true);
    expect(result.payment).toBeCloseTo(100, 8);
  });

  it('rejects a target date in the same month as fromDate (less than one billing cycle away)', () => {
    const result = dbHelpers.calculateRequiredLoanPayment(
      5000,
      5,
      '2026-03-15',
      '2026-03-20',
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/at least one billing cycle away/i);
  });

  it('rejects a target date before fromDate', () => {
    const result = dbHelpers.calculateRequiredLoanPayment(
      5000,
      5,
      '2026-06-01',
      '2026-01-01',
    );

    expect(result.success).toBe(false);
  });

  it('rejects a target date exactly on fromDate', () => {
    const result = dbHelpers.calculateRequiredLoanPayment(
      5000,
      5,
      '2026-06-01',
      '2026-06-01',
    );

    expect(result.success).toBe(false);
  });

  it('a larger required payment for a sooner target date than a later one (same balance/rate)', () => {
    const sooner = dbHelpers.calculateRequiredLoanPayment(
      10000,
      6,
      '2026-01-01',
      '2026-07-01', // 6 months
    );
    const later = dbHelpers.calculateRequiredLoanPayment(
      10000,
      6,
      '2026-01-01',
      '2027-01-01', // 12 months
    );

    expect(sooner.success).toBe(true);
    expect(later.success).toBe(true);
    expect(sooner.payment).toBeGreaterThan(later.payment);
  });
});

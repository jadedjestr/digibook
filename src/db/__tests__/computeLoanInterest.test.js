import { describe, it, expect } from 'vitest';

import { dbHelpers } from '../database-clean';

// Hand-worked examples from the Loans Interest Tracking PRD, §8 "Minimum
// acceptance tests" - verifying the pure math, independent of any DB
// transaction. DB-level behavior (undo, retry, backup round-trip) is
// covered in undoLoanInterestOperation.test.js and paymentAtomicity.test.js.

describe('dbHelpers.computeLoanInterest', () => {
  describe('display projection (no payment)', () => {
    it('computes 30 days of accrued interest at 6% on $10,000', () => {
      const loan = {
        id: 'loan-1',
        balance: 10000,
        interestRate: 6,
        unpaidInterest: 0,
        interestAccruedThrough: '2026-01-01',
      };
      const result = dbHelpers.computeLoanInterest(loan, '2026-01-31');
      expect(result.collectibleInterest).toBeCloseTo(49.32, 2);
      expect(result.totalOwedToday).toBeCloseTo(10049.32, 2);
    });

    it('accrues nothing for a same-day projection', () => {
      const loan = {
        balance: 10000,
        interestRate: 6,
        unpaidInterest: 0,
        interestAccruedThrough: '2026-01-15',
      };
      const result = dbHelpers.computeLoanInterest(loan, '2026-01-15');
      expect(result.rawInterest).toBe(0);
      expect(result.collectibleInterest).toBe(0);
    });

    it('accrues nothing, ever, for a zero-rate loan', () => {
      const loan = {
        balance: 10000,
        interestRate: 0,
        unpaidInterest: 0,
        interestAccruedThrough: '2026-01-01',
      };
      const result = dbHelpers.computeLoanInterest(loan, '2026-06-01');
      expect(result.rawInterest).toBe(0);
      expect(result.collectibleInterest).toBe(0);
    });

    it('counts a leap day as one elapsed day, denominator stays 365', () => {
      const loan = {
        balance: 10000,
        interestRate: 6,
        unpaidInterest: 0,
        interestAccruedThrough: '2028-02-28', // 2028 is a leap year
      };

      // 2028-02-28 -> 2028-03-01 is 2 elapsed days (Feb 29 + Mar 1).
      const result = dbHelpers.computeLoanInterest(loan, '2028-03-01');
      const expected = 10000 * (6 / 100 / 365) * 2;
      expect(result.rawInterest).toBeCloseTo(expected, 6);
    });
  });

  describe('payment allocation', () => {
    it('$10,000 at 6%, 30 days, a $300 payment: $49.32 interest, $9,749.32 principal', () => {
      const loan = {
        id: 'loan-1',
        balance: 10000,
        interestRate: 6,
        unpaidInterest: 0,
        interestAccruedThrough: '2026-01-01',
      };
      const result = dbHelpers.computeLoanInterest(loan, '2026-01-31', 300);
      expect(result.interestPaid).toBeCloseTo(49.32, 2);
      expect(result.principalPaid).toBeCloseTo(250.68, 2);
      expect(result.principalAfter).toBeCloseTo(9749.32, 2);

      // The exact raw remainder (49.315068... - 49.32) carries forward,
      // not clamped to zero or rounded away.
      expect(result.interestAfter).toBeCloseTo(-0.0049, 4);
    });

    it('a $20 payment on the same loan leaves principal unchanged, ~$29.32 unpaid interest', () => {
      const loan = {
        id: 'loan-1',
        balance: 10000,
        interestRate: 6,
        unpaidInterest: 0,
        interestAccruedThrough: '2026-01-01',
      };
      const result = dbHelpers.computeLoanInterest(loan, '2026-01-31', 20);
      expect(result.principalPaid).toBe(0);
      expect(result.principalAfter).toBe(10000);
      expect(result.interestAfter).toBeCloseTo(29.32, 2);
    });

    it('raw interest of $0.006 allocates $0.01 and retains a -$0.004 credit (not a full payoff)', () => {
      const loan = {
        id: 'loan-1',
        balance: 1000,
        interestRate: 0,
        unpaidInterest: 0.006,
        interestAccruedThrough: '2026-01-01',
      };

      // Same-day: accruedSince = 0, rawInterest = 0.006 exactly.
      const result = dbHelpers.computeLoanInterest(loan, '2026-01-01', 100.01);
      expect(result.collectibleInterest).toBe(0.01);
      expect(result.interestPaid).toBe(0.01);
      expect(result.principalAfter).toBe(900);
      expect(result.interestAfter).toBeCloseTo(-0.004, 6);
    });

    it('raw interest of $0.004 allocates $0.00 and retains +$0.004 (not a full payoff)', () => {
      const loan = {
        id: 'loan-1',
        balance: 1000,
        interestRate: 0,
        unpaidInterest: 0.004,
        interestAccruedThrough: '2026-01-01',
      };
      const result = dbHelpers.computeLoanInterest(loan, '2026-01-01', 100);
      expect(result.collectibleInterest).toBe(0);
      expect(result.interestPaid).toBe(0);
      expect(result.principalAfter).toBe(900);
      expect(result.interestAfter).toBeCloseTo(0.004, 6);
    });

    it('final payoff clears only the sub-cent residual, never real unpaid interest', () => {
      const loan = {
        id: 'loan-1',
        balance: 100,
        interestRate: 0,
        unpaidInterest: 0.004,
        interestAccruedThrough: '2026-01-01',
      };
      const result = dbHelpers.computeLoanInterest(loan, '2026-01-01', 100);
      expect(result.principalAfter).toBe(0);
      expect(result.payoff).toBe(100);
      expect(result.interestAfter).toBe(0);
    });

    it('rejects a payment greater than the payoff amount', () => {
      const loan = {
        id: 'loan-1',
        balance: 100,
        interestRate: 6,
        unpaidInterest: 0,
        interestAccruedThrough: '2026-01-01',
      };
      expect(() =>
        dbHelpers.computeLoanInterest(loan, '2026-01-01', 1000),
      ).toThrow(/exceeds payoff amount/);
    });

    it('zero-rate, zero-interest, same-day payment remains valid: all cash reduces principal', () => {
      const loan = {
        id: 'loan-1',
        balance: 500,
        interestRate: 0,
        unpaidInterest: 0,
        interestAccruedThrough: '2026-01-01',
      };
      const result = dbHelpers.computeLoanInterest(loan, '2026-01-01', 500);
      expect(result.interestPaid).toBe(0);
      expect(result.principalPaid).toBe(500);
      expect(result.principalAfter).toBe(0);
      expect(result.interestAfter).toBe(0);
    });
  });
});

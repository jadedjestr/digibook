import { describe, it, expect, beforeEach, vi } from 'vitest';

import { db, dbHelpers } from '../database-clean';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('dbHelpers.addLoan (validation)', () => {
  beforeEach(async () => {
    await db.loans.clear();
  });

  it('rejects a missing name', async () => {
    await expect(
      dbHelpers.addLoan({
        balance: 10000,
        interestRate: 5,
        targetPayoffDate: '2030-01-01',
      }),
    ).rejects.toThrow(/name is required/);
    expect(await db.loans.count()).toBe(0);
  });

  it('rejects a blank name', async () => {
    await expect(
      dbHelpers.addLoan({
        name: '   ',
        balance: 10000,
        interestRate: 5,
        targetPayoffDate: '2030-01-01',
      }),
    ).rejects.toThrow(/name is required/);
  });

  it('rejects a non-finite balance', async () => {
    await expect(
      dbHelpers.addLoan({
        name: 'Car Loan',
        balance: Infinity,
        interestRate: 5,
        targetPayoffDate: '2030-01-01',
      }),
    ).rejects.toThrow(/finite number/);
    expect(await db.loans.count()).toBe(0);
  });

  it('rejects a non-finite interest rate', async () => {
    await expect(
      dbHelpers.addLoan({
        name: 'Car Loan',
        balance: 10000,
        interestRate: NaN,
        targetPayoffDate: '2030-01-01',
      }),
    ).rejects.toThrow(/interest rate must be a finite number/);
  });

  it('rejects a missing target payoff date', async () => {
    await expect(
      dbHelpers.addLoan({ name: 'Car Loan', balance: 10000, interestRate: 5 }),
    ).rejects.toThrow(/target payoff date is required/);
  });

  it('rejects an invalid target payoff date string', async () => {
    await expect(
      dbHelpers.addLoan({
        name: 'Car Loan',
        balance: 10000,
        interestRate: 5,
        targetPayoffDate: 'not-a-date',
      }),
    ).rejects.toThrow(/target payoff date is required/);
  });

  it('rejects a target payoff date that leaves no billing cycle (this is the input-time "impossible goal" guard)', async () => {
    await expect(
      dbHelpers.addLoan({
        name: 'Car Loan',
        balance: 10000,
        interestRate: 5,
        dueDate: '2026-03-01',
        targetPayoffDate: '2026-03-10', // same month as dueDate
      }),
    ).rejects.toThrow(/at least one billing cycle away/i);
    expect(await db.loans.count()).toBe(0);
  });

  it('accepts valid input', async () => {
    const id = await dbHelpers.addLoan({
      name: 'Car Loan',
      balance: 10000,
      interestRate: 5,
      dueDate: '2026-03-01',
      targetPayoffDate: '2030-03-01',
    });
    expect(id).toBeTruthy();
    expect(await db.loans.count()).toBe(1);
  });

  it('falls back to today for the billing-cycle check when dueDate is omitted', async () => {
    const id = await dbHelpers.addLoan({
      name: 'Personal Loan',
      balance: 5000,
      interestRate: 8,
      targetPayoffDate: '2030-01-01',
    });
    expect(id).toBeTruthy();
  });
});

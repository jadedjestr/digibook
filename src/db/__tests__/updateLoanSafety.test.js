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

describe('dbHelpers.updateLoan (concurrency check + amount sync)', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.loans.clear(),
      db.recurringExpenseTemplates.clear(),
      db.fixedExpenses.clear(),
    ]);

    await db.accounts.bulkPut([
      {
        id: '1',
        name: 'Checking',
        type: 'checking',
        currentBalance: 100,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await db.loans.bulkPut([
      {
        id: '1',
        name: 'Car Loan',
        balance: 10000,
        interestRate: 6,
        dueDate: '2026-02-15',
        targetPayoffDate: '2031-02-15',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  it('rejects a stale write and makes no changes', async () => {
    await expect(
      dbHelpers.updateLoan('1', { balance: 5000 }, '2020-01-01T00:00:00.000Z'),
    ).rejects.toThrow(/STALE_WRITE/);

    const [loan] = await db.loans.toArray();
    expect(loan.balance).toBe(10000);
    expect(loan.updatedAt).toBe(now);
  });

  it('succeeds when expectedUpdatedAt matches the current row', async () => {
    await dbHelpers.updateLoan('1', { balance: 9500 }, now);
    const [loan] = await db.loans.toArray();
    expect(loan.balance).toBe(9500);
  });

  it('still works when expectedUpdatedAt is omitted (back-compat)', async () => {
    await dbHelpers.updateLoan('1', { balance: 9500 });
    const [loan] = await db.loans.toArray();
    expect(loan.balance).toBe(9500);
  });

  it('recomputes a pending linked expense amount when balance changes', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Loan Payment',
        dueDate: '2026-02-15',
        amount: 180,
        accountId: '1',
        creditCardId: null,
        targetLoanId: '1',
        category: 'Loan Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.updateLoan('1', { balance: 20000 });

    const [expense] = await db.fixedExpenses.toArray();

    // Higher balance, same rate/target date -> a larger required payment.
    expect(expense.amount).toBeGreaterThan(180);
  });

  it('does not touch the amount of an already-paid linked expense', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Loan Payment',
        dueDate: '2026-02-15',
        amount: 180,
        accountId: '1',
        creditCardId: null,
        targetLoanId: '1',
        category: 'Loan Payment',
        paidAmount: 180,
        status: 'paid',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.updateLoan('1', { balance: 20000 });

    const [expense] = await db.fixedExpenses.toArray();
    expect(expense.amount).toBe(180);
  });

  it('sets a pending linked expense amount to 0 when balance drops to 0', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Loan Payment',
        dueDate: '2026-02-15',
        amount: 180,
        accountId: '1',
        creditCardId: null,
        targetLoanId: '1',
        category: 'Loan Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.updateLoan('1', { balance: 0 });

    const [expense] = await db.fixedExpenses.toArray();
    expect(expense.amount).toBe(0);
  });

  it('does not sync amount when only an unrelated field changes', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Loan Payment',
        dueDate: '2026-02-15',
        amount: 180,
        accountId: '1',
        creditCardId: null,
        targetLoanId: '1',
        category: 'Loan Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.updateLoan('1', { lender: 'New Bank Name' });

    const [expense] = await db.fixedExpenses.toArray();
    expect(expense.amount).toBe(180);
  });

  it('respects a template minimumPaymentOverride instead of the default calculation', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Loan Payment',
        baseAmount: 180,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-02-01',
        nextDueDate: '2026-02-15',
        category: 'Loan Payment',
        accountId: '1',
        targetLoanId: '1',
        isActive: true,
        isVariableAmount: true,
        minimumPaymentOverride: 500,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Loan Payment',
        dueDate: '2026-02-15',
        amount: 180,
        accountId: '1',
        creditCardId: null,
        targetLoanId: '1',
        category: 'Loan Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: 'tpl-1',
        createdAt: now,
      },
    ]);

    await dbHelpers.updateLoan('1', { balance: 20000 });

    const [expense] = await db.fixedExpenses.toArray();
    expect(expense.amount).toBe(500);
  });
});

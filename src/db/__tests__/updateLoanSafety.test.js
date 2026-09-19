import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PaycheckService } from '../../services/paycheckService';
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

  // Defensive safeguard for imported, legacy, or otherwise pre-existing
  // data: the normal UI flow cannot create a partially-paid loan bill
  // (auto-created loan payment templates are variable-amount, and
  // resolveCycle rejects partials on those), but the update path must
  // never corrupt one either.
  describe('partially-paid linked bill protection', () => {
    const PARTIAL_BILL = {
      id: 'exp-partial',
      name: 'Pay Loan',
      dueDate: '2026-03-05',
      amount: 200,
      accountId: '1',
      targetLoanId: '1',
      category: 'Loan Payment',
      paidAmount: 180,
      status: 'pending',
      recurringTemplateId: null,
      createdAt: now,
    };

    beforeEach(async () => {
      // Rate 0 and a 6-month window keep the recalculated payment
      // deterministic: 1000/6 ≈ 166.67 — clearly below the 180 already
      // recorded, which is exactly what the old filter would have written.
      await db.loans.bulkPut([
        {
          id: '1',
          name: 'Car Loan',
          balance: 10000,
          interestRate: 0,
          dueDate: '2026-03-05',
          targetPayoffDate: '2026-09-05',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);
      await db.fixedExpenses.bulkPut([
        PARTIAL_BILL,
        {
          id: 'exp-untouched',
          name: 'Pay Loan',
          dueDate: '2026-03-05',
          amount: 200,
          accountId: '1',
          targetLoanId: '1',
          category: 'Loan Payment',
          paidAmount: 0,
          status: 'pending',
          recurringTemplateId: null,
          createdAt: now,
        },
      ]);
    });

    it('keeps a partially-paid linked bill unchanged when a loan update would rewrite it below the recorded payment', async () => {
      await dbHelpers.updateLoan('1', { balance: 1000 });

      const expense = await db.fixedExpenses.get('exp-partial');
      expect(expense.amount).toBe(200);
      expect(expense.paidAmount).toBe(180);
      expect(expense.status).toBe('pending');

      // User-visible outcome: the bill is still classified as Partial —
      // owed and actionable — not hidden as "Paid".
      expect(new PaycheckService().getPaymentProgress(expense)).toBe('Partial');
    });

    it('still recalculates an untouched pending linked bill in the same update', async () => {
      await dbHelpers.updateLoan('1', { balance: 1000 });

      const expense = await db.fixedExpenses.get('exp-untouched');
      expect(expense.amount).toBeCloseTo(1000 / 6, 2);
      expect(expense.paidAmount).toBe(0);
    });
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

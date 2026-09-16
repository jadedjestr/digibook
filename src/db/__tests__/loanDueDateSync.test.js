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

describe('Loan Due Date Sync', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.loans.clear(),
      db.categories.clear(),
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

  it('syncs due date to linked expense when updateLoan is called with dueDate', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: '1',
        name: 'Pay Loan',
        dueDate: '2026-02-05',
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

    await dbHelpers.updateLoan('1', { dueDate: '2026-03-20' });

    const [loan] = await db.loans.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(loan.dueDate).toBe('2026-03-20');
    expect(expense.dueDate).toBe('2026-03-20');
  });

  it('does not sync when updateLoan is called without dueDate in updates', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: '1',
        name: 'Pay Loan',
        dueDate: '2026-02-05',
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

    await dbHelpers.updateLoan('1', { balance: 9500 });

    const [loan] = await db.loans.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(loan.balance).toBe(9500);
    expect(loan.dueDate).toBe('2026-02-15');
    expect(expense.dueDate).toBe('2026-02-05');
  });

  it('updates multiple linked expenses when loan due date changes', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: '1',
        name: 'Pay Loan - Primary',
        dueDate: '2026-02-05',
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
      {
        id: '2',
        name: 'Pay Loan - Extra',
        dueDate: '2026-02-10',
        amount: 50,
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

    await dbHelpers.updateLoan('1', { dueDate: '2026-03-25' });

    const [loan] = await db.loans.toArray();
    const expenses = await db.fixedExpenses.toArray();

    expect(loan.dueDate).toBe('2026-03-25');
    expect(expenses).toHaveLength(2);
    expect(expenses.find(e => e.id === '1').dueDate).toBe('2026-03-25');
    expect(expenses.find(e => e.id === '2').dueDate).toBe('2026-03-25');
  });
});

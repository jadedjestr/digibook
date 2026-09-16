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

describe('dbHelpers.deleteLoan (deactivates linked recurring templates)', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([db.loans.clear(), db.recurringExpenseTemplates.clear()]);

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
      {
        id: '2',
        name: 'Student Loan',
        balance: 20000,
        interestRate: 4.5,
        dueDate: '2026-02-20',
        targetPayoffDate: '2036-02-20',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  it('deactivates an active template linked via targetLoanId', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Loan Payment',
        baseAmount: 180,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-02-01',
        nextDueDate: '2026-02-01',
        category: 'Loan Payment',
        accountId: 'acc-1',
        targetLoanId: '1',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await dbHelpers.deleteLoan('1');

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    const loan = await db.loans.get('1');

    expect(template.isActive).toBe(false);
    expect(loan.deletedAt).toBeTruthy();
  });

  it('does not touch a template linked to a different loan', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-2',
        name: 'Other Loan Payment',
        baseAmount: 250,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-02-01',
        nextDueDate: '2026-02-01',
        category: 'Loan Payment',
        accountId: 'acc-1',
        targetLoanId: '2',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await dbHelpers.deleteLoan('1');

    const template = await db.recurringExpenseTemplates.get('tpl-2');
    expect(template.isActive).toBe(true);
    expect(template.updatedAt).toBe(now);
  });

  it('does not touch an already-inactive template linked to the deleted loan', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-3',
        name: 'Old Loan Payment',
        baseAmount: 180,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-02-01',
        nextDueDate: '2026-02-01',
        category: 'Loan Payment',
        accountId: 'acc-1',
        targetLoanId: '1',
        isActive: false,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await dbHelpers.deleteLoan('1');

    const template = await db.recurringExpenseTemplates.get('tpl-3');
    expect(template.isActive).toBe(false);
    expect(template.updatedAt).toBe(now);
  });
});

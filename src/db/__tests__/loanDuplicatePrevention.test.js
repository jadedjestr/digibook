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

describe('Duplicate loan-payment prevention', () => {
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
        id: 'acc-1',
        name: 'Checking',
        type: 'checking',
        currentBalance: 500,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await db.loans.bulkPut([
      {
        id: 'loan-1',
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

  describe('createExpenseForLoan (atomic check-and-create)', () => {
    it('creates only one template and one expense when called concurrently for the same loan', async () => {
      await Promise.all([
        dbHelpers.createExpenseForLoan('loan-1', 'acc-1'),
        dbHelpers.createExpenseForLoan('loan-1', 'acc-1'),
      ]);

      const templates = (await db.recurringExpenseTemplates.toArray()).filter(
        t => t.targetLoanId === 'loan-1' && t.isActive,
      );
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => e.targetLoanId === 'loan-1',
      );

      expect(templates).toHaveLength(1);
      expect(expenses).toHaveLength(1);
    });

    it('does not create a second template when one already exists', async () => {
      await dbHelpers.createExpenseForLoan('loan-1', 'acc-1');
      await dbHelpers.createExpenseForLoan('loan-1', 'acc-1');

      const templates = (await db.recurringExpenseTemplates.toArray()).filter(
        t => t.targetLoanId === 'loan-1' && t.isActive,
      );
      expect(templates).toHaveLength(1);
    });

    it('materializes the first bill immediately regardless of due date (the materialization path)', async () => {
      await dbHelpers.createExpenseForLoan('loan-1', 'acc-1');

      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => e.targetLoanId === 'loan-1',
      );
      expect(expenses).toHaveLength(1);
      expect(expenses[0].dueDate).toBe('2026-02-15');
      expect(expenses[0].status).toBe('pending');
    });
  });

  describe('cleanupDuplicateLoanExpenses (scoped key)', () => {
    it('does not flag same name+amount Loan Payment expenses on different due dates', async () => {
      await db.fixedExpenses.bulkPut([
        {
          id: 'exp-1',
          name: 'Loan Payment',
          dueDate: '2026-02-15',
          amount: 180,
          targetLoanId: 'loan-1',
          category: 'Loan Payment',
          paidAmount: 0,
          status: 'pending',
          createdAt: now,
        },
        {
          id: 'exp-2',
          name: 'Loan Payment',
          dueDate: '2026-03-15',
          amount: 180,
          targetLoanId: 'loan-1',
          category: 'Loan Payment',
          paidAmount: 0,
          status: 'pending',
          createdAt: now,
        },
      ]);

      const duplicates = await dbHelpers.cleanupDuplicateLoanExpenses();
      expect(duplicates).toHaveLength(0);
    });

    it('flags true duplicates sharing recurringTemplateId and dueDate', async () => {
      await db.fixedExpenses.bulkPut([
        {
          id: 'exp-1',
          name: 'Loan Payment',
          dueDate: '2026-02-15',
          amount: 180,
          targetLoanId: 'loan-1',
          category: 'Loan Payment',
          recurringTemplateId: 'tpl-1',
          paidAmount: 0,
          status: 'pending',
          createdAt: now,
        },
        {
          id: 'exp-2',
          name: 'Loan Payment',
          dueDate: '2026-02-15',
          amount: 180,
          targetLoanId: 'loan-1',
          category: 'Loan Payment',
          recurringTemplateId: 'tpl-1',
          paidAmount: 0,
          status: 'pending',
          createdAt: now,
        },
      ]);

      const duplicates = await dbHelpers.cleanupDuplicateLoanExpenses();
      expect(duplicates).toHaveLength(1);

      const remaining = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      expect(remaining).toHaveLength(1);
    });
  });

  describe('cleanupDuplicateLoanTemplates', () => {
    it('keeps the oldest active template per loan and deactivates the rest', async () => {
      await db.recurringExpenseTemplates.bulkPut([
        {
          id: 'tpl-old',
          name: 'Loan Payment',
          baseAmount: 180,
          frequency: 'monthly',
          intervalValue: 1,
          intervalUnit: 'months',
          startDate: '2026-01-01',
          nextDueDate: '2026-02-01',
          category: 'Loan Payment',
          accountId: 'acc-1',
          targetLoanId: 'loan-1',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: now,
          deletedAt: null,
        },
        {
          id: 'tpl-new',
          name: 'Loan Payment',
          baseAmount: 180,
          frequency: 'monthly',
          intervalValue: 1,
          intervalUnit: 'months',
          startDate: '2026-02-01',
          nextDueDate: '2026-02-01',
          category: 'Loan Payment',
          accountId: 'acc-1',
          targetLoanId: 'loan-1',
          isActive: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);

      const deactivated = await dbHelpers.cleanupDuplicateLoanTemplates();
      expect(deactivated).toHaveLength(1);
      expect(deactivated[0].id).toBe('tpl-new');

      const oldTemplate = await db.recurringExpenseTemplates.get('tpl-old');
      const newTemplate = await db.recurringExpenseTemplates.get('tpl-new');
      expect(oldTemplate.isActive).toBe(true);
      expect(newTemplate.isActive).toBe(false);
    });
  });
});

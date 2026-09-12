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

describe('Duplicate credit-card payment prevention', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
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

    await db.creditCards.bulkPut([
      {
        id: 'card-1',
        name: 'Card',
        balance: 500,
        creditLimit: 5000,
        interestRate: 19.99,
        dueDate: '2026-02-15',
        statementClosingDate: '2026-02-01',
        minimumPayment: 25,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  describe('createExpenseForCard (atomic check-and-create)', () => {
    it('creates only one template and one expense when called concurrently for the same card', async () => {
      await Promise.all([
        dbHelpers.createExpenseForCard('card-1', 'acc-1'),
        dbHelpers.createExpenseForCard('card-1', 'acc-1'),
      ]);

      const templates = (await db.recurringExpenseTemplates.toArray()).filter(
        t => t.targetCreditCardId === 'card-1' && t.isActive,
      );
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => e.targetCreditCardId === 'card-1',
      );

      expect(templates).toHaveLength(1);
      expect(expenses).toHaveLength(1);
    });

    it('does not create a second template when one already exists', async () => {
      await dbHelpers.createExpenseForCard('card-1', 'acc-1');
      await dbHelpers.createExpenseForCard('card-1', 'acc-1');

      const templates = (await db.recurringExpenseTemplates.toArray()).filter(
        t => t.targetCreditCardId === 'card-1' && t.isActive,
      );
      expect(templates).toHaveLength(1);
    });
  });

  describe('cleanupDuplicateCreditCardExpenses (scoped key)', () => {
    it('does not flag same name+amount expenses in different categories', async () => {
      await db.fixedExpenses.bulkPut([
        {
          id: 'exp-1',
          name: 'Rent',
          dueDate: '2026-02-01',
          amount: 100,
          accountId: 'acc-1',
          category: 'Housing',
          paidAmount: 0,
          status: 'pending',
          createdAt: now,
        },
        {
          id: 'exp-2',
          name: 'Rent',
          dueDate: '2026-03-01',
          amount: 100,
          accountId: 'acc-1',
          category: 'Housing',
          paidAmount: 0,
          status: 'pending',
          createdAt: now,
        },
      ]);

      const duplicates = await dbHelpers.cleanupDuplicateCreditCardExpenses();
      expect(duplicates).toHaveLength(0);

      const remaining = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      expect(remaining).toHaveLength(2);
    });

    it('does not flag same name+amount Credit Card Payment expenses on different due dates', async () => {
      await db.fixedExpenses.bulkPut([
        {
          id: 'exp-1',
          name: 'Card Payment',
          dueDate: '2026-02-15',
          amount: 25,
          targetCreditCardId: 'card-1',
          category: 'Credit Card Payment',
          paidAmount: 0,
          status: 'pending',
          createdAt: now,
        },
        {
          id: 'exp-2',
          name: 'Card Payment',
          dueDate: '2026-03-15',
          amount: 25,
          targetCreditCardId: 'card-1',
          category: 'Credit Card Payment',
          paidAmount: 0,
          status: 'pending',
          createdAt: now,
        },
      ]);

      const duplicates = await dbHelpers.cleanupDuplicateCreditCardExpenses();
      expect(duplicates).toHaveLength(0);
    });

    it('flags true duplicates sharing recurringTemplateId and dueDate', async () => {
      await db.fixedExpenses.bulkPut([
        {
          id: 'exp-1',
          name: 'Card Payment',
          dueDate: '2026-02-15',
          amount: 25,
          targetCreditCardId: 'card-1',
          category: 'Credit Card Payment',
          recurringTemplateId: 'tpl-1',
          paidAmount: 0,
          status: 'pending',
          createdAt: now,
        },
        {
          id: 'exp-2',
          name: 'Card Payment',
          dueDate: '2026-02-15',
          amount: 25,
          targetCreditCardId: 'card-1',
          category: 'Credit Card Payment',
          recurringTemplateId: 'tpl-1',
          paidAmount: 0,
          status: 'pending',
          createdAt: now,
        },
      ]);

      const duplicates = await dbHelpers.cleanupDuplicateCreditCardExpenses();
      expect(duplicates).toHaveLength(1);

      const remaining = (await db.fixedExpenses.toArray()).filter(
        e => !e.deletedAt,
      );
      expect(remaining).toHaveLength(1);
    });
  });

  describe('cleanupDuplicateCreditCardTemplates', () => {
    it('keeps the oldest active template per card and deactivates the rest', async () => {
      await db.recurringExpenseTemplates.bulkPut([
        {
          id: 'tpl-old',
          name: 'Card Payment',
          baseAmount: 25,
          frequency: 'monthly',
          intervalValue: 1,
          intervalUnit: 'months',
          startDate: '2026-01-01',
          nextDueDate: '2026-02-01',
          category: 'Credit Card Payment',
          accountId: 'acc-1',
          targetCreditCardId: 'card-1',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: now,
          deletedAt: null,
        },
        {
          id: 'tpl-new',
          name: 'Card Payment',
          baseAmount: 25,
          frequency: 'monthly',
          intervalValue: 1,
          intervalUnit: 'months',
          startDate: '2026-02-01',
          nextDueDate: '2026-02-01',
          category: 'Credit Card Payment',
          accountId: 'acc-1',
          targetCreditCardId: 'card-1',
          isActive: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);

      const deactivated = await dbHelpers.cleanupDuplicateCreditCardTemplates();
      expect(deactivated).toHaveLength(1);
      expect(deactivated[0].id).toBe('tpl-new');

      const oldTemplate = await db.recurringExpenseTemplates.get('tpl-old');
      const newTemplate = await db.recurringExpenseTemplates.get('tpl-new');
      expect(oldTemplate.isActive).toBe(true);
      expect(newTemplate.isActive).toBe(false);
    });

    it('does not touch templates for different cards', async () => {
      await db.creditCards.bulkPut([
        {
          id: 'card-2',
          name: 'Other Card',
          balance: 100,
          creditLimit: 1000,
          interestRate: 15,
          dueDate: '2026-02-20',
          statementClosingDate: '2026-02-05',
          minimumPayment: 25,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);
      await db.recurringExpenseTemplates.bulkPut([
        {
          id: 'tpl-1',
          name: 'Card Payment',
          baseAmount: 25,
          frequency: 'monthly',
          intervalValue: 1,
          intervalUnit: 'months',
          startDate: '2026-02-01',
          nextDueDate: '2026-02-01',
          category: 'Credit Card Payment',
          accountId: 'acc-1',
          targetCreditCardId: 'card-1',
          isActive: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
        {
          id: 'tpl-2',
          name: 'Other Card Payment',
          baseAmount: 25,
          frequency: 'monthly',
          intervalValue: 1,
          intervalUnit: 'months',
          startDate: '2026-02-01',
          nextDueDate: '2026-02-01',
          category: 'Credit Card Payment',
          accountId: 'acc-1',
          targetCreditCardId: 'card-2',
          isActive: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);

      const deactivated = await dbHelpers.cleanupDuplicateCreditCardTemplates();
      expect(deactivated).toHaveLength(0);
    });
  });
});

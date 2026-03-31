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

const sortById = items =>
  [...items].sort((a, b) =>
    String(a.id || '').localeCompare(String(b.id || '')),
  );

describe('dbHelpers.applyExpensePaymentChangeAtomic (atomic paidAmount)', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
      db.categories.clear(),
      db.paycheckSettings.clear(),
      db.userPreferences.clear(),
      db.recurringExpenseTemplates.clear(),
      db.pendingTransactions.clear(),
      db.fixedExpenses.clear(),
      db.monthlyExpenseHistory.clear(),
      db.auditLogs.clear(),
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

    await db.creditCards.bulkPut([
      {
        id: '1',
        name: 'Card',
        balance: 50,
        creditLimit: 1000,
        interestRate: 19.99,
        dueDate: '2026-02-15',
        statementClosingDate: '2026-02-01',
        minimumPayment: 25,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await db.categories.bulkPut([
      {
        id: '1',
        name: 'Housing',
        color: '#FF0000',
        icon: 'home',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: '2',
        name: 'Credit Card Payment',
        color: '#00FF00',
        icon: 'credit-card',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: '3',
        name: 'Dining',
        color: '#0000FF',
        icon: 'utensils',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  it('rolls back expense + balances if a mid-transaction balance write fails (credit card payment)', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: '1',
        name: 'Pay Card',
        dueDate: '2026-02-05',
        amount: 20,
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: '1',
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    const originalUpdate = db.creditCards.update.bind(db.creditCards);
    db.creditCards.update = async () => {
      throw new Error('Injected failure during creditCards.update');
    };

    try {
      await expect(
        dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: 20 }),
      ).rejects.toThrow(/Injected failure/i);
    } finally {
      db.creditCards.update = originalUpdate;
    }

    expect(sortById(await db.accounts.toArray())).toEqual([
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

    expect(sortById(await db.creditCards.toArray())).toEqual([
      {
        id: '1',
        name: 'Card',
        balance: 50,
        creditLimit: 1000,
        interestRate: 19.99,
        dueDate: '2026-02-15',
        statementClosingDate: '2026-02-01',
        minimumPayment: 25,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    expect(sortById(await db.fixedExpenses.toArray())).toEqual([
      {
        id: '1',
        name: 'Pay Card',
        dueDate: '2026-02-05',
        amount: 20,
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: '1',
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);
  });

  it('applies credit card payment atomically and derives status', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: '1',
        name: 'Pay Card',
        dueDate: '2026-02-05',
        amount: 20,
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: '1',
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: 20 });

    const [account] = await db.accounts.toArray();
    const [card] = await db.creditCards.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(account.currentBalance).toBe(80);
    expect(card.balance).toBe(30);
    expect(expense.paidAmount).toBe(20);
    expect(expense.status).toBe('paid');
  });

  it('reverses balances correctly when paidAmount decreases (credit card payment)', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: '1',
        name: 'Pay Card',
        dueDate: '2026-02-05',
        amount: 20,
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: '1',
        category: 'Credit Card Payment',
        paidAmount: 20,
        status: 'paid',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    // Bring balances to the "already paid" state.
    await db.accounts.update('1', { currentBalance: 80 });
    await db.creditCards.update('1', { balance: 30 });

    await dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: 5 });

    const [account] = await db.accounts.toArray();
    const [card] = await db.creditCards.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(account.currentBalance).toBe(95);
    expect(card.balance).toBe(45);
    expect(expense.paidAmount).toBe(5);
    expect(expense.status).toBe('pending');
  });

  it('updates only account balance for account-paid expenses', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: '1',
        name: 'Rent',
        dueDate: '2026-02-05',
        amount: 10,
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: 10 });

    const [account] = await db.accounts.toArray();
    const [card] = await db.creditCards.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(account.currentBalance).toBe(90);
    expect(card.balance).toBe(50);
    expect(expense.status).toBe('paid');
  });

  it('updates only credit card balance for credit-card-paid expenses (charges increase debt)', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: '1',
        name: 'Dinner',
        dueDate: '2026-02-05',
        amount: 10,
        accountId: null,
        creditCardId: '1',
        targetCreditCardId: null,
        category: 'Dining',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: 10 });

    const [account] = await db.accounts.toArray();
    const [card] = await db.creditCards.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(account.currentBalance).toBe(100);
    expect(card.balance).toBe(60);
    expect(expense.status).toBe('paid');
  });

  it('commits even if audit log write fails (best-effort)', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: '1',
        name: 'Rent',
        dueDate: '2026-02-05',
        amount: 10,
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    const originalAdd = db.auditLogs.add.bind(db.auditLogs);
    db.auditLogs.add = async () => {
      throw new Error('Injected audit log failure');
    };

    try {
      await dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: 10 });
    } finally {
      db.auditLogs.add = originalAdd;
    }

    const [account] = await db.accounts.toArray();
    const [expense] = await db.fixedExpenses.toArray();
    const logs = await db.auditLogs.toArray();

    expect(account.currentBalance).toBe(90);
    expect(expense.paidAmount).toBe(10);
    expect(expense.status).toBe('paid');
    expect(logs).toHaveLength(0);
  });

  describe('recurring template advance on full pay', () => {
    it('advances template nextDueDate when recurring expense is marked fully paid', async () => {
      await db.recurringExpenseTemplates.bulkPut([
        {
          id: '1',
          name: 'Citi Payment',
          baseAmount: 100,
          frequency: 'monthly',
          intervalValue: 1,
          startDate: '2026-01-01',
          lastGenerated: null,
          nextDueDate: '2026-02-05',
          category: 'Credit Card Payment',
          accountId: '1',
          notes: '',
          isActive: true,
          isVariableAmount: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await db.fixedExpenses.bulkPut([
        {
          id: '1',
          name: 'Citi Payment',
          dueDate: '2026-02-05',
          amount: 100,
          accountId: '1',
          creditCardId: null,
          targetCreditCardId: '1',
          category: 'Credit Card Payment',
          paidAmount: 0,
          status: 'pending',
          recurringTemplateId: '1',
          createdAt: now,
        },
      ]);

      const result = await dbHelpers.applyExpensePaymentChangeAtomic('1', {
        paidAmount: 100,
      });

      const [template] = await db.recurringExpenseTemplates.toArray();
      const [expense] = await db.fixedExpenses.toArray();

      expect(expense.paidAmount).toBe(100);
      expect(expense.status).toBe('paid');
      expect(template.nextDueDate).toBe('2026-03-05');
      expect(template.lastGenerated).toBe('2026-02-05');
      expect(result).toEqual({ templateIdAdvanced: '1' });
    });

    it('does not advance template when payment is partial', async () => {
      await db.recurringExpenseTemplates.bulkPut([
        {
          id: '1',
          name: 'Citi Payment',
          baseAmount: 100,
          frequency: 'monthly',
          intervalValue: 1,
          startDate: '2026-01-01',
          lastGenerated: null,
          nextDueDate: '2026-02-05',
          category: 'Credit Card Payment',
          accountId: '1',
          notes: '',
          isActive: true,
          isVariableAmount: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await db.fixedExpenses.bulkPut([
        {
          id: '1',
          name: 'Citi Payment',
          dueDate: '2026-02-05',
          amount: 100,
          accountId: '1',
          creditCardId: null,
          targetCreditCardId: '1',
          category: 'Credit Card Payment',
          paidAmount: 0,
          status: 'pending',
          recurringTemplateId: '1',
          createdAt: now,
        },
      ]);

      const result = await dbHelpers.applyExpensePaymentChangeAtomic('1', {
        paidAmount: 50,
      });

      const [template] = await db.recurringExpenseTemplates.toArray();

      expect(template.nextDueDate).toBe('2026-02-05');
      expect(result).toEqual({ templateIdAdvanced: null });
    });

    it('does not advance template when expense dueDate does not match template nextDueDate', async () => {
      await db.recurringExpenseTemplates.bulkPut([
        {
          id: '1',
          name: 'Citi Payment',
          baseAmount: 100,
          frequency: 'monthly',
          intervalValue: 1,
          startDate: '2026-01-01',
          lastGenerated: null,
          nextDueDate: '2026-02-05',
          category: 'Credit Card Payment',
          accountId: '1',
          notes: '',
          isActive: true,
          isVariableAmount: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await db.fixedExpenses.bulkPut([
        {
          id: '1',
          name: 'Citi Payment',
          dueDate: '2026-03-10',
          amount: 100,
          accountId: '1',
          creditCardId: null,
          targetCreditCardId: '1',
          category: 'Credit Card Payment',
          paidAmount: 0,
          status: 'pending',
          recurringTemplateId: '1',
          createdAt: now,
        },
      ]);

      const result = await dbHelpers.applyExpensePaymentChangeAtomic('1', {
        paidAmount: 100,
      });

      const [template] = await db.recurringExpenseTemplates.toArray();

      expect(template.nextDueDate).toBe('2026-02-05');
      expect(result).toEqual({ templateIdAdvanced: null });
    });
  });
});

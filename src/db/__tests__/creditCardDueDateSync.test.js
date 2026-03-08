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

describe('Credit Card Due Date Sync', () => {
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
        id: 1,
        name: 'Checking',
        type: 'checking',
        currentBalance: 100,
        isDefault: true,
        createdAt: now,
      },
    ]);

    await db.creditCards.bulkPut([
      {
        id: 1,
        name: 'Card',
        balance: 50,
        creditLimit: 1000,
        interestRate: 19.99,
        dueDate: '2026-02-15',
        statementClosingDate: '2026-02-01',
        minimumPayment: 25,
        createdAt: now,
      },
    ]);

    await db.categories.bulkPut([
      {
        id: 1,
        name: 'Housing',
        color: '#FF0000',
        icon: 'home',
        isDefault: true,
        createdAt: now,
      },
      {
        id: 2,
        name: 'Credit Card Payment',
        color: '#00FF00',
        icon: 'credit-card',
        isDefault: false,
        createdAt: now,
      },
      {
        id: 3,
        name: 'Dining',
        color: '#0000FF',
        icon: 'utensils',
        isDefault: false,
        createdAt: now,
      },
    ]);
  });

  it('syncs due date to linked expense when updateCreditCard is called with dueDate', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 1,
        name: 'Pay Card',
        dueDate: '2026-02-05',
        amount: 20,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: 1,
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.updateCreditCard(1, { dueDate: '2026-03-20' });

    const [card] = await db.creditCards.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(card.dueDate).toBe('2026-03-20');
    expect(expense.dueDate).toBe('2026-03-20');
  });

  it('syncs due date to credit card when updateFixedExpenseV4 is called for CC payment with dueDate', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 1,
        name: 'Pay Card',
        dueDate: '2026-02-05',
        amount: 20,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: 1,
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.updateFixedExpenseV4(1, { dueDate: '2026-04-10' });

    const [card] = await db.creditCards.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(card.dueDate).toBe('2026-04-10');
    expect(expense.dueDate).toBe('2026-04-10');
  });

  it('does not sync when updateCreditCard is called without dueDate in updates', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 1,
        name: 'Pay Card',
        dueDate: '2026-02-05',
        amount: 20,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: 1,
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.updateCreditCard(1, { balance: 75 });

    const [card] = await db.creditCards.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(card.balance).toBe(75);
    expect(card.dueDate).toBe('2026-02-15');
    expect(expense.dueDate).toBe('2026-02-05');
  });

  it('does not sync when updateFixedExpenseV4 is called for non-CC payment expense', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 1,
        name: 'Rent',
        dueDate: '2026-02-05',
        amount: 100,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.updateFixedExpenseV4(1, { dueDate: '2026-03-01' });

    const [card] = await db.creditCards.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(card.dueDate).toBe('2026-02-15');
    expect(expense.dueDate).toBe('2026-03-01');
  });

  it('updates multiple linked expenses when card due date changes', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 1,
        name: 'Pay Card - Primary',
        dueDate: '2026-02-05',
        amount: 20,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: 1,
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
      {
        id: 2,
        name: 'Pay Card - Extra',
        dueDate: '2026-02-10',
        amount: 10,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: 1,
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.updateCreditCard(1, { dueDate: '2026-03-25' });

    const [card] = await db.creditCards.toArray();
    const expenses = await db.fixedExpenses.toArray();

    expect(card.dueDate).toBe('2026-03-25');
    expect(expenses).toHaveLength(2);
    expect(expenses.find(e => e.id === 1).dueDate).toBe('2026-03-25');
    expect(expenses.find(e => e.id === 2).dueDate).toBe('2026-03-25');
  });
});

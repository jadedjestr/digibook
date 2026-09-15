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

  // Regression: sanitizeExpenseData was being run on the bare
  // {paidAmount, status} patch, where category is undefined - so its
  // "not a card payment, null the target" rule fired and unlinked every
  // paid card bill from the card it paid, making that payment
  // uncorrectable. The suite missed it because every assertion checked
  // what the payment CHANGED and none checked what it should have LEFT
  // ALONE.
  it('leaves fields the payment did not touch alone (credit card payment)', async () => {
    const original = {
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
    };
    await db.fixedExpenses.bulkPut([original]);

    await dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: 20 });

    const after = await db.fixedExpenses.get('1');

    // The two fields this call is allowed to change.
    expect(after.paidAmount).toBe(20);
    expect(after.status).toBe('paid');

    // Everything else must survive untouched.
    const volatile = ['paidAmount', 'status', 'updatedAt'];
    for (const key of Object.keys(original)) {
      if (volatile.includes(key)) continue;
      expect({ [key]: after[key] }).toEqual({ [key]: original[key] });
    }
  });

  it('keeps targetCreditCardId across repeated payment changes', async () => {
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

    // Pay, part-refund, then fully un-pay - the correction path a user
    // reaches for after overpaying. Each hop must stay linked to the card.
    for (const amount of [20, 10, 0]) {
      await dbHelpers.applyExpensePaymentChangeAtomic('1', {
        paidAmount: amount,
      });
      const row = await db.fixedExpenses.get('1');
      expect(row.targetCreditCardId).toBe('1');
      expect(row.category).toBe('Credit Card Payment');
    }

    // Balances are back where they started, with no drift.
    const [account] = await db.accounts.toArray();
    const [card] = await db.creditCards.toArray();
    expect(account.currentBalance).toBe(100);
    expect(card.balance).toBe(50);
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

  it('rejects paying a Credit Card Payment expense whose target card was deleted, with no balance movement', async () => {
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

    await db.creditCards.update('1', { deletedAt: now });

    await expect(
      dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: 20 }),
    ).rejects.toThrow(/Target credit card not found/i);

    const [account] = await db.accounts.toArray();
    const [card] = await db.creditCards.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(account.currentBalance).toBe(100);
    expect(card.balance).toBe(50);
    expect(expense.paidAmount).toBe(0);
    expect(expense.status).toBe('pending');
  });

  it('rejects paying an expense charged to a deleted credit card, with no balance movement', async () => {
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

    await db.creditCards.update('1', { deletedAt: now });

    await expect(
      dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: 10 }),
    ).rejects.toThrow(/Credit card not found/i);

    const [card] = await db.creditCards.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(card.balance).toBe(50);
    expect(expense.paidAmount).toBe(0);
    expect(expense.status).toBe('pending');
  });

  it('rejects a negative paidAmount, with no balance movement', async () => {
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

    await expect(
      dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: -10 }),
    ).rejects.toThrow(/cannot be negative/i);

    const [account] = await db.accounts.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(account.currentBalance).toBe(100);
    expect(expense.paidAmount).toBe(0);
    expect(expense.status).toBe('pending');
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

  // Recurring-template cadence advance moved to resolveCycle (see
  // resolveCycle.test.js) - applyExpensePaymentChangeAtomic no longer
  // touches recurringExpenseTemplates at all, for any expense.
  it('never touches recurringExpenseTemplates, even for a recurring-linked expense', async () => {
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

    await dbHelpers.applyExpensePaymentChangeAtomic('1', { paidAmount: 100 });

    const [template] = await db.recurringExpenseTemplates.toArray();
    const [expense] = await db.fixedExpenses.toArray();

    expect(expense.paidAmount).toBe(100);
    expect(expense.status).toBe('paid');
    expect(template.nextDueDate).toBe('2026-02-05'); // unchanged
    expect(template.lastGenerated).toBe(null); // unchanged
    expect(await db.fixedExpenses.count()).toBe(1); // no second row generated
  });
});

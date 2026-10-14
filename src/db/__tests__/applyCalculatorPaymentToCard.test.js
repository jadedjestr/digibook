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

describe('dbHelpers.applyCalculatorPaymentToCard', () => {
  const now = '2026-09-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.creditCards.clear(),
      db.recurringExpenseTemplates.clear(),
      db.fixedExpenses.clear(),
      db.auditLogs.clear(),
    ]);

    await db.creditCards.bulkPut([
      {
        id: 'card-1',
        name: 'Visa',
        balance: 1200,
        creditLimit: 5000,
        interestRate: 20,
        dueDate: '2026-09-14',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  it('rejects a non-finite or non-positive payment amount', async () => {
    await expect(
      dbHelpers.applyCalculatorPaymentToCard('card-1', 0),
    ).rejects.toThrow(/finite number greater than 0/);
    await expect(
      dbHelpers.applyCalculatorPaymentToCard('card-1', NaN),
    ).rejects.toThrow(/finite number greater than 0/);
  });

  it('works with no linked payment bill: the choice is kept on the card', async () => {
    // The amount used to live on the payment template, so a card without one
    // couldn't be given a custom payment. It lives on the card now.
    await dbHelpers.applyCalculatorPaymentToCard('card-1', 100);

    const card = await db.creditCards.get('card-1');
    expect(card.customPaymentAmount).toBe(100);
  });

  it('saves the amount on the card, not the template', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Visa Payment',
        baseAmount: 25,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-09-14',
        nextDueDate: '2026-09-14',
        category: 'Credit Card Payment',
        targetCreditCardId: 'card-1',
        accountId: 'acc-1',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await dbHelpers.applyCalculatorPaymentToCard('card-1', 150);

    const card = await db.creditCards.get('card-1');
    expect(card.customPaymentAmount).toBe(150);
    const [template] = await db.recurringExpenseTemplates.toArray();
    expect(template.minimumPaymentOverride ?? null).toBeNull();
  });

  it('updates the amount on a pending linked expense immediately', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Visa Payment',
        baseAmount: 25,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-09-14',
        nextDueDate: '2026-09-14',
        category: 'Credit Card Payment',
        targetCreditCardId: 'card-1',
        accountId: 'acc-1',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Visa Payment',
        dueDate: '2026-09-14',
        amount: 25,
        accountId: 'acc-1',
        targetCreditCardId: 'card-1',
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: 'tpl-1',
        createdAt: now,
      },
    ]);

    await dbHelpers.applyCalculatorPaymentToCard('card-1', 150);

    const [expense] = await db.fixedExpenses.toArray();
    expect(expense.amount).toBe(150);
  });

  it('does not touch an already-paid linked expense', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Visa Payment',
        baseAmount: 25,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-09-14',
        nextDueDate: '2026-09-14',
        category: 'Credit Card Payment',
        targetCreditCardId: 'card-1',
        accountId: 'acc-1',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Visa Payment',
        dueDate: '2026-09-14',
        amount: 25,
        accountId: 'acc-1',
        targetCreditCardId: 'card-1',
        category: 'Credit Card Payment',
        paidAmount: 25,
        status: 'paid',
        recurringTemplateId: 'tpl-1',
        createdAt: now,
      },
    ]);

    await dbHelpers.applyCalculatorPaymentToCard('card-1', 150);

    const [expense] = await db.fixedExpenses.toArray();
    expect(expense.amount).toBe(25);
  });

  it('does not overwrite a partially-paid expense; the custom payment still applies to future cycles', async () => {
    // A row with money already on it must not get its amount pulled below
    // paidAmount - that would invent a phantom "Paid" state.
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Visa Payment',
        baseAmount: 25,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-09-14',
        nextDueDate: '2026-09-14',
        category: 'Credit Card Payment',
        targetCreditCardId: 'card-1',
        accountId: 'acc-1',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-partial',
        name: 'Visa Payment',
        dueDate: '2026-09-14',
        amount: 100,
        accountId: 'acc-1',
        targetCreditCardId: 'card-1',
        category: 'Credit Card Payment',
        paidAmount: 40,
        status: 'pending',
        recurringTemplateId: 'tpl-1',
        createdAt: now,
      },
    ]);

    await dbHelpers.applyCalculatorPaymentToCard('card-1', 25);

    const expense = await db.fixedExpenses.get('exp-partial');
    expect(expense.amount).toBe(100);
    const card = await db.creditCards.get('card-1');
    expect(card.customPaymentAmount).toBe(25);
  });
});

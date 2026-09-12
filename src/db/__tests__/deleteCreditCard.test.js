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

describe('dbHelpers.deleteCreditCard (deactivates linked recurring templates)', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.creditCards.clear(),
      db.recurringExpenseTemplates.clear(),
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
      {
        id: '2',
        name: 'Other Card',
        balance: 100,
        creditLimit: 2000,
        interestRate: 15.99,
        dueDate: '2026-02-20',
        statementClosingDate: '2026-02-05',
        minimumPayment: 30,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  it('deactivates an active template linked via targetCreditCardId', async () => {
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
        creditCardId: null,
        targetCreditCardId: '1',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await dbHelpers.deleteCreditCard('1');

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    const card = await db.creditCards.get('1');

    expect(template.isActive).toBe(false);
    expect(card.deletedAt).toBeTruthy();
  });

  it('deactivates an active template linked via plain creditCardId', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-2',
        name: 'Subscription',
        baseAmount: 15,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-02-01',
        nextDueDate: '2026-02-01',
        category: 'Subscriptions',
        accountId: null,
        creditCardId: '1',
        targetCreditCardId: null,
        isActive: true,
        isVariableAmount: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await dbHelpers.deleteCreditCard('1');

    const template = await db.recurringExpenseTemplates.get('tpl-2');
    expect(template.isActive).toBe(false);
  });

  it('does not touch a template linked to a different card', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-3',
        name: 'Other Card Payment',
        baseAmount: 30,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-02-01',
        nextDueDate: '2026-02-01',
        category: 'Credit Card Payment',
        accountId: 'acc-1',
        creditCardId: null,
        targetCreditCardId: '2',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await dbHelpers.deleteCreditCard('1');

    const template = await db.recurringExpenseTemplates.get('tpl-3');
    expect(template.isActive).toBe(true);
    expect(template.updatedAt).toBe(now);
  });

  it('does not touch an already-inactive template linked to the deleted card', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-4',
        name: 'Old Card Payment',
        baseAmount: 25,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-02-01',
        nextDueDate: '2026-02-01',
        category: 'Credit Card Payment',
        accountId: 'acc-1',
        creditCardId: null,
        targetCreditCardId: '1',
        isActive: false,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await dbHelpers.deleteCreditCard('1');

    const template = await db.recurringExpenseTemplates.get('tpl-4');
    expect(template.isActive).toBe(false);
    expect(template.updatedAt).toBe(now);
  });
});

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

describe('dbHelpers.detectCreditCardExpenses / applyExpenseMappings', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([db.creditCards.clear(), db.fixedExpenses.clear()]);

    await db.creditCards.bulkPut([
      {
        id: 'cc-1',
        name: 'Chase Sapphire',
        balance: 100,
        creditLimit: 5000,
        interestRate: 19.99,
        dueDate: '2026-02-15',
        statementClosingDate: '2026-02-01',
        minimumPayment: 25,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: 'cc-2',
        name: 'Discover',
        balance: 50,
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

  it('exact name match yields confidence 100 and the exact-match suggestedAction', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Chase Sapphire',
        dueDate: '2026-02-10',
        amount: 50,
        accountId: 'acc-1',
        creditCardId: null,
        category: 'Subscriptions',
        paidAmount: 0,
        status: 'pending',
        createdAt: now,
      },
    ]);

    const mappings = await dbHelpers.detectCreditCardExpenses();

    expect(mappings).toEqual([
      {
        expenseId: 'exp-1',
        expenseName: 'Chase Sapphire',
        creditCardId: 'cc-1',
        creditCardName: 'Chase Sapphire',
        confidence: 100,
        suggestedAction: 'Exact name match',
      },
    ]);
  });

  it('name-contains match (not exact) yields confidence 85', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-2',
        name: 'Chase Sapphire Autopay',
        dueDate: '2026-02-10',
        amount: 50,
        accountId: 'acc-1',
        creditCardId: null,
        category: 'Subscriptions',
        paidAmount: 0,
        status: 'pending',
        createdAt: now,
      },
    ]);

    const [mapping] = await dbHelpers.detectCreditCardExpenses();

    expect(mapping).toMatchObject({
      creditCardId: 'cc-1',
      confidence: 85,
      suggestedAction: 'Name contains card name',
    });
  });

  it('description-only match yields confidence 60', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-3',
        name: 'Monthly Card Bill',
        description: 'Auto payment for Discover card',
        dueDate: '2026-02-10',
        amount: 30,
        accountId: 'acc-1',
        creditCardId: null,
        category: 'Subscriptions',
        paidAmount: 0,
        status: 'pending',
        createdAt: now,
      },
    ]);

    const [mapping] = await dbHelpers.detectCreditCardExpenses();

    expect(mapping).toMatchObject({
      creditCardId: 'cc-2',
      confidence: 60,
      suggestedAction: 'Description mentions card name',
    });
  });

  it('produces no mapping when nothing matches', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-4',
        name: 'Netflix',
        description: 'Streaming service',
        dueDate: '2026-02-10',
        amount: 15,
        accountId: 'acc-1',
        creditCardId: null,
        category: 'Subscriptions',
        paidAmount: 0,
        status: 'pending',
        createdAt: now,
      },
    ]);

    expect(await dbHelpers.detectCreditCardExpenses()).toEqual([]);
  });

  it('an expense matching two cards at different tiers produces exactly one mapping (higher confidence wins)', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-5',
        name: 'Chase Sapphire',
        description: 'Backup card is Discover',
        dueDate: '2026-02-10',
        amount: 50,
        accountId: 'acc-1',
        creditCardId: null,
        category: 'Subscriptions',
        paidAmount: 0,
        status: 'pending',
        createdAt: now,
      },
    ]);

    const mappings = await dbHelpers.detectCreditCardExpenses();
    const forExpense = mappings.filter(m => m.expenseId === 'exp-5');

    expect(forExpense).toHaveLength(1);
    expect(forExpense[0]).toMatchObject({
      creditCardId: 'cc-1',
      confidence: 100,
    });
  });

  it('a same-tier tie across two cards still produces exactly one mapping', async () => {
    await db.creditCards.bulkPut([
      {
        id: 'cc-3',
        name: 'Chase',
        balance: 0,
        creditLimit: 1000,
        interestRate: 10,
        dueDate: '2026-02-15',
        statementClosingDate: '2026-02-01',
        minimumPayment: 10,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-6',
        name: 'Chase Sapphire Payment',
        dueDate: '2026-02-10',
        amount: 50,
        accountId: 'acc-1',
        creditCardId: null,
        category: 'Subscriptions',
        paidAmount: 0,
        status: 'pending',
        createdAt: now,
      },
    ]);

    // "Chase Sapphire Payment" includes both "Chase" (cc-3) and
    // "Chase Sapphire" (cc-1) - both tier-85 matches.
    const mappings = await dbHelpers.detectCreditCardExpenses();

    expect(mappings.filter(m => m.expenseId === 'exp-6')).toHaveLength(1);
  });

  it('end-to-end: detect then apply links the expense to exactly one card, no silent overwrite', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Chase Sapphire',
        dueDate: '2026-02-10',
        amount: 50,
        accountId: 'acc-1',
        creditCardId: null,
        category: 'Subscriptions',
        paidAmount: 0,
        status: 'pending',
        createdAt: now,
      },
    ]);

    const mappings = await dbHelpers.detectCreditCardExpenses();
    const { appliedCount, results } =
      await dbHelpers.applyExpenseMappings(mappings);

    expect(appliedCount).toBe(1);
    expect(results).toEqual([
      {
        expenseId: 'exp-1',
        expenseName: 'Chase Sapphire',
        creditCardName: 'Chase Sapphire',
        success: true,
      },
    ]);

    const updated = await db.fixedExpenses.get('exp-1');
    expect(updated).toMatchObject({
      creditCardId: 'cc-1',
      accountId: null,
      isManuallyMapped: true,
      mappingConfidence: 100,
    });
  });
});

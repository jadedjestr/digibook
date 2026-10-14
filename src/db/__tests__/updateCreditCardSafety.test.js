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

describe('dbHelpers.updateCreditCard (concurrency check + amount sync)', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
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

    await db.creditCards.bulkPut([
      {
        id: '1',
        name: 'Card',
        balance: 1000,
        creditLimit: 5000,
        interestRate: 19.99,
        dueDate: '2026-02-15',
        statementClosingDate: '2026-02-01',
        minimumPayment: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  it('rejects a stale write and makes no changes', async () => {
    await expect(
      dbHelpers.updateCreditCard(
        '1',
        { balance: 500 },
        '2020-01-01T00:00:00.000Z',
      ),
    ).rejects.toThrow(/STALE_WRITE/);

    const [card] = await db.creditCards.toArray();
    expect(card.balance).toBe(1000);
    expect(card.updatedAt).toBe(now);
  });

  it('succeeds when expectedUpdatedAt matches the current row', async () => {
    await dbHelpers.updateCreditCard('1', { balance: 500 }, now);
    const [card] = await db.creditCards.toArray();
    expect(card.balance).toBe(500);
  });

  it('still works when expectedUpdatedAt is omitted (back-compat)', async () => {
    await dbHelpers.updateCreditCard('1', { balance: 500 });
    const [card] = await db.creditCards.toArray();
    expect(card.balance).toBe(500);
  });

  it('recomputes a pending linked expense amount when balance changes', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Card Payment',
        dueDate: '2026-02-15',
        amount: 25,
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

    // 2% of 3000 = 60, above the $25 floor.
    await dbHelpers.updateCreditCard('1', { balance: 3000 });

    const [expense] = await db.fixedExpenses.toArray();
    expect(expense.amount).toBe(60);
  });

  it('does not touch the amount of an already-paid linked expense', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Card Payment',
        dueDate: '2026-02-15',
        amount: 25,
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: '1',
        category: 'Credit Card Payment',
        paidAmount: 25,
        status: 'paid',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.updateCreditCard('1', { balance: 3000 });

    const [expense] = await db.fixedExpenses.toArray();
    expect(expense.amount).toBe(25);
  });

  it('sets a pending linked expense amount to 0 when balance drops to 0', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Card Payment',
        dueDate: '2026-02-15',
        amount: 25,
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

    await dbHelpers.updateCreditCard('1', { balance: 0 });

    const [expense] = await db.fixedExpenses.toArray();
    expect(expense.amount).toBe(0);
  });

  it('respects a template minimumPaymentOverride instead of the default calculation', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Card Payment',
        baseAmount: 25,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-02-01',
        nextDueDate: '2026-02-15',
        category: 'Credit Card Payment',
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: '1',
        isActive: true,
        isVariableAmount: true,
        minimumPaymentOverride: 99,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Card Payment',
        dueDate: '2026-02-15',
        amount: 25,
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: '1',
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: 'tpl-1',
        createdAt: now,
      },
    ]);

    await dbHelpers.updateCreditCard('1', { balance: 3000 });

    const [expense] = await db.fixedExpenses.toArray();
    expect(expense.amount).toBe(99);
  });

  describe('original terms and intro APR (Phase 1 field validation)', () => {
    it('rejects a non-positive originalBalance', async () => {
      await expect(
        dbHelpers.updateCreditCard('1', { originalBalance: 0 }),
      ).rejects.toThrow(/Original balance/);
    });

    it('accepts a valid originalBalance', async () => {
      await dbHelpers.updateCreditCard('1', { originalBalance: 2000 });
      const [card] = await db.creditCards.toArray();
      expect(card.originalBalance).toBe(2000);
    });

    it('rejects an invalid targetPayoffDate', async () => {
      await expect(
        dbHelpers.updateCreditCard('1', { targetPayoffDate: 'not-a-date' }),
      ).rejects.toThrow(/Target payoff date/);
    });

    it('rejects a targetPayoffDate too close to reach given the balance/rate', async () => {
      await expect(
        dbHelpers.updateCreditCard('1', { targetPayoffDate: '2026-02-16' }),
      ).rejects.toThrow(/at least one billing cycle away/);
    });

    it('rejects setting hasIntroApr: true without introApr/introAprEndDate', async () => {
      await expect(
        dbHelpers.updateCreditCard('1', { hasIntroApr: true }),
      ).rejects.toThrow(/Intro APR must be a finite number/);
    });

    it('accepts a fully-specified intro APR update', async () => {
      await dbHelpers.updateCreditCard('1', {
        hasIntroApr: true,
        introApr: 0,
        introAprEndDate: '2027-01-01',
      });
      const [card] = await db.creditCards.toArray();
      expect(card.hasIntroApr).toBe(true);
      expect(card.introApr).toBe(0);
    });

    it('rejects leaving a stray introApr when hasIntroApr is set false', async () => {
      await db.creditCards.update('1', {
        hasIntroApr: true,
        introApr: 5,
        introAprEndDate: '2027-01-01',
      });
      await expect(
        dbHelpers.updateCreditCard('1', {
          hasIntroApr: false,
          introApr: 5,
        }),
      ).rejects.toThrow(/must be empty when this card has no intro APR/);
    });
  });

  describe('amount sync trigger fields (Gap 1 fix)', () => {
    // The seeded card (beforeEach) has a targetPayoffDate so the amortized
    // pricing path is exercised, not the flat heuristic - a change in
    // interestRate/targetPayoffDate/dueDate/intro-APR only moves the
    // number under the amortized path.
    beforeEach(async () => {
      await db.creditCards.update('1', { targetPayoffDate: '2027-02-15' });
      await db.fixedExpenses.bulkPut([
        {
          id: 'exp-1',
          name: 'Card Payment',
          dueDate: '2026-02-15',
          amount: 25,
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

    it('recomputes a pending linked expense amount when interestRate changes alone', async () => {
      await dbHelpers.updateCreditCard('1', { interestRate: 30 });
      const expense = await db.fixedExpenses.get('exp-1');
      expect(expense.amount).not.toBe(25);
      expect(expense.amount).toBeGreaterThan(0);
    });

    it('recomputes a pending linked expense amount when targetPayoffDate changes alone', async () => {
      await dbHelpers.updateCreditCard('1', {
        targetPayoffDate: '2026-08-15',
      });
      const expense = await db.fixedExpenses.get('exp-1');
      expect(expense.amount).not.toBe(25);
      expect(expense.amount).toBeGreaterThan(0);
    });

    it('recomputes a pending linked expense amount when dueDate changes alone', async () => {
      await dbHelpers.updateCreditCard('1', { dueDate: '2026-06-15' });
      const expense = await db.fixedExpenses.get('exp-1');
      expect(expense.amount).not.toBe(25);
      expect(expense.amount).toBeGreaterThan(0);
    });

    it('recomputes a pending linked expense amount when intro APR fields change', async () => {
      await dbHelpers.updateCreditCard('1', {
        hasIntroApr: true,
        introApr: 0,
        introAprEndDate: '2099-01-01',
      });
      const expense = await db.fixedExpenses.get('exp-1');

      // 0% APR over 12 months is a flat balance/months split: 1000/12.
      expect(expense.amount).toBeCloseTo(1000 / 12, 1);
    });

    it('does not overwrite a partially-paid expense when interestRate changes', async () => {
      await db.fixedExpenses.update('exp-1', { amount: 100, paidAmount: 40 });
      await dbHelpers.updateCreditCard('1', { interestRate: 30 });
      const expense = await db.fixedExpenses.get('exp-1');
      expect(expense.amount).toBe(100);
    });

    it('respects a template minimumPaymentOverride when targetPayoffDate changes', async () => {
      await db.recurringExpenseTemplates.bulkPut([
        {
          id: 'tpl-1',
          name: 'Card Payment',
          baseAmount: 25,
          frequency: 'monthly',
          intervalValue: 1,
          intervalUnit: 'months',
          startDate: '2026-02-01',
          nextDueDate: '2026-02-15',
          category: 'Credit Card Payment',
          accountId: '1',
          creditCardId: null,
          targetCreditCardId: '1',
          isActive: true,
          isVariableAmount: true,
          minimumPaymentOverride: 77,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);
      await db.fixedExpenses.update('exp-1', {
        amount: 77,
        recurringTemplateId: 'tpl-1',
      });

      await dbHelpers.updateCreditCard('1', {
        targetPayoffDate: '2026-09-15',
      });

      const expense = await db.fixedExpenses.get('exp-1');
      expect(expense.amount).toBe(77);
      const [card] = await db.creditCards.toArray();
      expect(card.targetPayoffDate).toBe('2026-09-15');
    });
  });
});

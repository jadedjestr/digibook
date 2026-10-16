import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

// Which account pays a card: changing it, creating it, and the repair that
// runs when Credit Cards opens.
const now = '2026-10-01T00:00:00.000Z';
const stamp = { createdAt: now, updatedAt: now, deletedAt: null };

const checking = {
  id: 'checking',
  name: 'Checking',
  type: 'checking',
  currentBalance: 1000,
  isDefault: true,
  ...stamp,
};
const savings = {
  id: 'savings',
  name: 'Savings',
  type: 'savings',
  currentBalance: 2000,
  isDefault: false,
  ...stamp,
};
const closed = {
  id: 'closed',
  name: 'Old checking',
  type: 'checking',
  currentBalance: 0,
  isDefault: false,
  ...stamp,
  deletedAt: now,
};
const card = {
  id: 'visa',
  name: 'Visa',
  balance: 1800,
  creditLimit: 5000,
  interestRate: 20,
  dueDate: '2026-10-25',
  minimumPayment: 35,
  customPaymentAmount: 200,
  ...stamp,
};
const template = {
  id: 'tpl-visa',
  name: 'Visa Payment',
  baseAmount: 200,
  frequency: 'monthly',
  intervalValue: 1,
  intervalUnit: 'months',
  startDate: '2026-08-25',
  nextDueDate: '2026-10-25',
  category: 'Credit Card Payment',
  targetCreditCardId: 'visa',
  accountId: 'checking',
  isActive: true,
  isVariableAmount: true,
  ...stamp,
};
const cardBill = (id, overrides = {}) => ({
  id,
  name: 'Visa Payment',
  dueDate: '2026-10-25',
  amount: 200,
  paidAmount: 0,
  status: 'pending',
  category: 'Credit Card Payment',
  accountId: 'checking',
  creditCardId: null,
  targetCreditCardId: 'visa',
  recurringTemplateId: 'tpl-visa',
  ...stamp,
  ...overrides,
});

const accountOf = async id => (await db.fixedExpenses.get(id)).accountId;
const templateAccount = async () =>
  (await db.recurringExpenseTemplates.get('tpl-visa')).accountId;

describe('which account pays a card', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 10) });
    await Promise.all(
      [
        db.accounts,
        db.creditCards,
        db.fixedExpenses,
        db.recurringExpenseTemplates,
        db.recurringResolutionLog,
        db.auditLogs,
      ].map(table => table.clear()),
    );
    await db.accounts.bulkPut([checking, savings, closed]);
    await db.creditCards.put(card);
    await db.recurringExpenseTemplates.put(template);
    await db.fixedExpenses.bulkPut([
      cardBill('oct'),
      cardBill('sep', {
        dueDate: '2026-09-25',
        paidAmount: 200,
        status: 'paid',
      }),
      cardBill('half', { dueDate: '2026-08-25', paidAmount: 50 }),
      cardBill('balance-due', {
        recurringTemplateId: null,
        dueDate: '2026-10-16',
        amount: 30,
      }),
      cardBill('balance-due-paid', {
        recurringTemplateId: null,
        dueDate: '2026-09-16',
        amount: 30,
        paidAmount: 30,
        status: 'paid',
      }),
    ]);
    await db.recurringResolutionLog.put({
      id: 'log-sep',
      templateId: 'tpl-visa',
      expenseId: 'sep',
      cycleDueDate: '2026-09-25',
      resolvedAt: '2026-09-25T12:00:00.000Z',
      committedAmount: 200,
      paidAmount: 200,
      wasSkipped: false,
      ...stamp,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('changing it', () => {
    it('switches the schedule and bills with nothing paid', async () => {
      await dbHelpers.updateFundingAccountForCard('visa', 'savings');
      expect(await templateAccount()).toBe('savings');
      expect(await accountOf('oct')).toBe('savings');
      expect(await accountOf('balance-due')).toBe('savings');
    });

    it('leaves paid, half-paid and resolved bills on their account', async () => {
      await dbHelpers.updateFundingAccountForCard('visa', 'savings');
      expect(await accountOf('sep')).toBe('checking');
      expect(await accountOf('half')).toBe('checking');
      expect(await accountOf('balance-due-paid')).toBe('checking');
    });

    it('refuses an account that does not exist, changing nothing', async () => {
      await expect(
        dbHelpers.updateFundingAccountForCard('visa', NaN),
      ).rejects.toThrow('That account no longer exists. Pick another.');
      await expect(
        dbHelpers.updateFundingAccountForCard('visa', 'nope'),
      ).rejects.toThrow(/no longer exists/);
      expect(await templateAccount()).toBe('checking');
      expect(await accountOf('oct')).toBe('checking');
    });

    it('refuses a deleted account', async () => {
      await expect(
        dbHelpers.updateFundingAccountForCard('visa', 'closed'),
      ).rejects.toThrow(/no longer exists/);
      expect(await templateAccount()).toBe('checking');
    });
  });

  describe('creating it for a new card', () => {
    it('refuses an account that does not exist, creating nothing', async () => {
      await db.creditCards.put({ ...card, id: 'amex', name: 'Amex' });
      await expect(dbHelpers.createExpenseForCard('amex', NaN)).rejects.toThrow(
        /no longer exists/,
      );
      const amexTemplates = await db.recurringExpenseTemplates
        .filter(t => t.targetCreditCardId === 'amex')
        .count();
      expect(amexTemplates).toBe(0);
    });
  });

  describe('repair when Credit Cards opens', () => {
    it('moves a broken link to the default account and names the card', async () => {
      await db.recurringExpenseTemplates.update('tpl-visa', {
        accountId: NaN,
      });
      await db.fixedExpenses.update('oct', { accountId: NaN });

      const result = await dbHelpers.repairCreditCardPaymentFundingSource();

      expect(await templateAccount()).toBe('checking');
      expect(await accountOf('oct')).toBe('checking');
      expect(result.repairedCards).toEqual([
        { cardId: 'visa', cardName: 'Visa', accountName: 'Checking' },
      ]);
    });

    it('treats a deleted account as broken', async () => {
      await db.recurringExpenseTemplates.update('tpl-visa', {
        accountId: 'closed',
      });
      const result = await dbHelpers.repairCreditCardPaymentFundingSource();
      expect(await templateAccount()).toBe('checking');
      expect(result.repairedCards.map(c => c.cardName)).toEqual(['Visa']);
    });

    it('leaves valid links alone and reports nothing', async () => {
      await dbHelpers.updateFundingAccountForCard('visa', 'savings');
      const result = await dbHelpers.repairCreditCardPaymentFundingSource();
      expect(await templateAccount()).toBe('savings');
      expect(result.repairedCards).toEqual([]);
    });
  });
});

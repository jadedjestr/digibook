import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db, dbHelpers, foldCardOverridesIntoCards } from '../database-clean';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const now = '2026-09-01T00:00:00.000Z';

const baseCard = {
  id: 'card-1',
  name: 'Visa',
  balance: 1200,
  creditLimit: 5000,
  interestRate: 20,
  dueDate: '2026-09-14',
  minimumPayment: 25,
  targetPayoffDate: '2027-09-14',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const baseTemplate = {
  id: 'tpl-card',
  name: 'Visa Payment',
  baseAmount: 45,
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
};

const pendingRow = overrides => ({
  id: 'exp-1',
  name: 'Visa Payment',
  dueDate: '2026-09-14',
  amount: 25,
  accountId: 'acc-1',
  targetCreditCardId: 'card-1',
  category: 'Credit Card Payment',
  paidAmount: 0,
  status: 'pending',
  recurringTemplateId: 'tpl-card',
  createdAt: now,
  ...overrides,
});

describe('foldCardOverridesIntoCards', () => {
  const template = overrides => ({ ...baseTemplate, ...overrides });

  it('moves the override onto the card and clears it from the template', () => {
    const { cards, templates } = foldCardOverridesIntoCards(
      [baseCard],
      [template({ minimumPaymentOverride: 77 })],
    );
    expect(cards[0].customPaymentAmount).toBe(77);
    expect(templates[0].minimumPaymentOverride).toBeNull();
  });

  it('takes the oldest active template’s override when several carry one', () => {
    // De-duplication keeps the oldest template, so that is the one whose
    // value the user was actually living with.
    const { cards } = foldCardOverridesIntoCards(
      [baseCard],
      [
        template({
          id: 'newer',
          createdAt: '2026-09-05T00:00:00.000Z',
          minimumPaymentOverride: 200,
        }),
        template({ id: 'older', minimumPaymentOverride: 77 }),
      ],
    );
    expect(cards[0].customPaymentAmount).toBe(77);
  });

  it('uses an inactive template only when no active one has an override', () => {
    const fromInactive = foldCardOverridesIntoCards(
      [baseCard],
      [template({ isActive: false, minimumPaymentOverride: 55 })],
    );
    expect(fromInactive.cards[0].customPaymentAmount).toBe(55);

    const activeWins = foldCardOverridesIntoCards(
      [baseCard],
      [
        template({ id: 'a', isActive: false, minimumPaymentOverride: 55 }),
        template({ id: 'b', minimumPaymentOverride: 77 }),
      ],
    );
    expect(activeWins.cards[0].customPaymentAmount).toBe(77);
  });

  it('drops an override that is not a usable amount', () => {
    for (const bad of [0, -5, NaN, '50']) {
      const { cards, templates } = foldCardOverridesIntoCards(
        [baseCard],
        [template({ minimumPaymentOverride: bad })],
      );
      expect(cards[0].customPaymentAmount).toBeUndefined();
      expect(templates[0].minimumPaymentOverride).toBeNull();
    }
  });

  it('keeps a custom payment the card already has', () => {
    const { cards, templates } = foldCardOverridesIntoCards(
      [{ ...baseCard, customPaymentAmount: 40 }],
      [template({ minimumPaymentOverride: 77 })],
    );
    expect(cards[0].customPaymentAmount).toBe(40);
    expect(templates[0].minimumPaymentOverride).toBeNull();
  });

  it('leaves loan templates, deleted templates and unrelated cards alone', () => {
    const loanTemplate = template({
      id: 'loan-tpl',
      category: 'Loan Payment',
      targetCreditCardId: null,
      targetLoanId: 'loan-1',
      minimumPaymentOverride: 300,
    });
    const deleted = template({
      id: 'gone',
      deletedAt: now,
      minimumPaymentOverride: 9,
    });
    const otherCard = { ...baseCard, id: 'card-2' };
    const { cards, templates } = foldCardOverridesIntoCards(
      [baseCard, otherCard],
      [loanTemplate, deleted],
    );
    expect(templates[0]).toBe(loanTemplate);
    expect(templates[0].minimumPaymentOverride).toBe(300);
    expect(templates[1]).toBe(deleted);
    expect(cards[0]).toBe(baseCard);
    expect(cards[1]).toBe(otherCard);
  });

  it('returns the same rows when there is nothing to move', () => {
    const cards = [baseCard];
    const templates = [template()];
    const folded = foldCardOverridesIntoCards(cards, templates);
    expect(folded.cards[0]).toBe(cards[0]);
    expect(folded.templates[0]).toBe(templates[0]);
  });
});

describe('card payment plan (database)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 8, 1) });
    await Promise.all([
      db.accounts.clear(),
      db.categories.clear(),
      db.creditCards.clear(),
      db.recurringExpenseTemplates.clear(),
      db.recurringResolutionLog.clear(),
      db.fixedExpenses.clear(),
      db.paycheckSettings.clear(),
      db.auditLogs.clear(),
    ]);
    await db.creditCards.bulkPut([baseCard]);
    await db.recurringExpenseTemplates.bulkPut([baseTemplate]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setCardPaymentPlan', () => {
    it('stores a custom amount, and null restores the calculated payment', async () => {
      await dbHelpers.setCardPaymentPlan('card-1', 150);
      expect((await db.creditCards.get('card-1')).customPaymentAmount).toBe(
        150,
      );

      await dbHelpers.setCardPaymentPlan('card-1', null);
      expect(
        (await db.creditCards.get('card-1')).customPaymentAmount,
      ).toBeNull();
    });

    it('rejects an amount that is not a positive number', async () => {
      for (const bad of [0, -5, NaN, Infinity]) {
        await expect(
          dbHelpers.setCardPaymentPlan('card-1', bad),
        ).rejects.toThrow(/greater than 0/);
      }
      expect(
        (await db.creditCards.get('card-1')).customPaymentAmount,
      ).toBeUndefined();
    });

    it('refuses a write based on a stale copy of the card', async () => {
      await expect(
        dbHelpers.setCardPaymentPlan('card-1', 150, '2020-01-01T00:00:00.000Z'),
      ).rejects.toThrow(/STALE_WRITE/);
    });

    it('re-prices a pending bill but leaves a part-paid one alone', async () => {
      await db.fixedExpenses.bulkPut([
        pendingRow({ id: 'unpaid' }),
        pendingRow({ id: 'partial', amount: 100, paidAmount: 40 }),
      ]);

      await dbHelpers.setCardPaymentPlan('card-1', 60);

      expect((await db.fixedExpenses.get('unpaid')).amount).toBe(60);
      expect((await db.fixedExpenses.get('partial')).amount).toBe(100);
    });

    it('leaves the payment bill template untouched', async () => {
      await dbHelpers.setCardPaymentPlan('card-1', 150);
      const template = await db.recurringExpenseTemplates.get('tpl-card');
      expect(template).toEqual(baseTemplate);
    });
  });

  describe('a deferred Balance Due', () => {
    it('is not re-priced when the card changes', async () => {
      // A Balance Due inherits the origin bill's category and card link, so it
      // looks like a card payment bill, but it is a fixed leftover, not a price.
      await db.fixedExpenses.bulkPut([
        pendingRow({
          id: 'bd',
          name: 'Visa Payment (Balance Due)',
          amount: 40,
          recurringTemplateId: null,
          isAutoCreated: true,
        }),
        pendingRow({ id: 'regular' }),
      ]);
      await db.recurringResolutionLog.bulkPut([
        {
          id: 'log-1',
          templateId: 'tpl-card',
          expenseId: 'origin',
          adjustmentExpenseId: 'bd',
          cycleDueDate: '2026-08-14',
          resolvedAt: now,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);

      await dbHelpers.setCardPaymentPlan('card-1', 60);

      expect((await db.fixedExpenses.get('regular')).amount).toBe(60);
      expect((await db.fixedExpenses.get('bd')).amount).toBe(40);
    });
  });

  describe('getCardPaymentPlan', () => {
    it('describes the calculated payment', async () => {
      const plan = await dbHelpers.getCardPaymentPlan(baseCard, baseTemplate);
      expect(plan.mode).toBe('calculated');
      expect(plan.customAmount).toBeNull();
      expect(plan.billAmount).toBe(plan.calculatedAmount);
      expect(plan.billAmount).toBeGreaterThan(25);
      expect(plan.projectedPayoffDate).toBeNull();
      expect(plan.paysOffCard).toBe(false);
      expect(plan.belowIssuerMinimum).toBe(false);
    });

    it('describes a custom payment next to the calculated one', async () => {
      const plan = await dbHelpers.getCardPaymentPlan(
        { ...baseCard, customPaymentAmount: 99 },
        baseTemplate,
      );
      expect(plan.mode).toBe('custom');
      expect(plan.billAmount).toBe(99);
      expect(plan.customAmount).toBe(99);
      expect(plan.calculatedAmount).not.toBe(99);
      expect(plan.projectedPayoffDate).toBeTruthy();
    });

    it('says when a custom payment pays the card off, and what the bill will be', async () => {
      const plan = await dbHelpers.getCardPaymentPlan(
        { ...baseCard, balance: 120, customPaymentAmount: 500 },
        baseTemplate,
      );
      expect(plan.paysOffCard).toBe(true);
      expect(plan.billAmount).toBe(120);
    });

    it('flags a custom payment below the card’s own minimum', async () => {
      const below = await dbHelpers.getCardPaymentPlan(
        { ...baseCard, customPaymentAmount: 20 },
        baseTemplate,
      );
      const atMinimum = await dbHelpers.getCardPaymentPlan(
        { ...baseCard, customPaymentAmount: 25 },
        baseTemplate,
      );
      expect(below.belowIssuerMinimum).toBe(true);
      expect(atMinimum.belowIssuerMinimum).toBe(false);
    });

    it('flags a custom payment too small to ever pay the card off', async () => {
      // $1,200 at 20% costs $20 a month in interest.
      const tooSmall = await dbHelpers.getCardPaymentPlan(
        { ...baseCard, customPaymentAmount: 10 },
        baseTemplate,
      );
      const enough = await dbHelpers.getCardPaymentPlan(
        { ...baseCard, customPaymentAmount: 99 },
        baseTemplate,
      );
      expect(tooSmall.neverPaysOff).toBe(true);
      expect(tooSmall.projectedPayoffDate).toBeNull();
      expect(enough.neverPaysOff).toBe(false);
    });

    it('can preview an unsaved draft with no template', async () => {
      const plan = await dbHelpers.getCardPaymentPlan(
        { ...baseCard, customPaymentAmount: 99 },
        null,
      );
      expect(plan.billAmount).toBe(99);
      expect(plan.calculatedAmount).toBeGreaterThan(25);
    });
  });

  describe('restoring a backup', () => {
    const backup = cardOverrides => ({
      accounts: [
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
      ],
      categories: [],
      paycheckSettings: [],
      userPreferences: [],
      pendingTransactions: [],
      fixedExpenses: [],
      monthlyExpenseHistory: [],
      auditLogs: [],
      creditCards: [{ ...baseCard, ...cardOverrides.card }],
      recurringExpenseTemplates: [
        { ...baseTemplate, ...cardOverrides.template },
      ],
    });

    it('keeps a custom payment from a backup taken before it lived on the card', async () => {
      await dbHelpers.importData(
        backup({ template: { minimumPaymentOverride: 77 } }),
      );

      expect((await db.creditCards.get('card-1')).customPaymentAmount).toBe(77);
      expect(
        (await db.recurringExpenseTemplates.get('tpl-card'))
          .minimumPaymentOverride,
      ).toBeNull();
    });

    it('restores a backup that already has the custom payment on the card', async () => {
      await dbHelpers.importData(backup({ card: { customPaymentAmount: 50 } }));

      expect((await db.creditCards.get('card-1')).customPaymentAmount).toBe(50);
    });
  });
});

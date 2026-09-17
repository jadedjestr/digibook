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

// computeTemplateCycleAmount is module-private; exercised indirectly via
// getVirtualLedger's 'virtual' cycle estimate, mirroring the existing
// card-payment test in getVirtualLedger.test.js.
describe('computeTemplateCycleAmount (credit card branch)', () => {
  const now = '2026-09-01T00:00:00.000Z';

  const baseCard = {
    id: 'card-1',
    name: 'Visa',
    balance: 1200,
    creditLimit: 5000,
    interestRate: 20,
    dueDate: '2026-09-14',
    statementClosingDate: '2026-09-01',
    minimumPayment: null,
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
    isActive: true,
    isVariableAmount: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const estimate = async () => {
    const results = await dbHelpers.getVirtualLedger(
      'tpl-card',
      '2026-09-01',
      '2026-09-30',
    );
    return results[0].estimatedAmount;
  };

  beforeEach(async () => {
    // Pin "today" to 2026-09-01 so introAprEndDate boundary tests are
    // deterministic regardless of the real wall-clock date. Only Date is
    // faked - Dexie's internals keep using real timers.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 8, 1) });

    await Promise.all([
      db.creditCards.clear(),
      db.recurringExpenseTemplates.clear(),
      db.fixedExpenses.clear(),
      db.recurringResolutionLog.clear(),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the amortized payment when targetPayoffDate is set', async () => {
    await db.creditCards.bulkPut([
      { ...baseCard, targetPayoffDate: '2027-09-14' },
    ]);
    await db.recurringExpenseTemplates.bulkPut([baseTemplate]);

    const amount = await estimate();

    // Sanity: an amortized payment for $1200 @ 20% over 12 months is well
    // above the flat-heuristic $25 floor and below the full balance.
    expect(amount).toBeGreaterThan(25);
    expect(amount).toBeLessThan(1200);
  });

  it('falls back to the flat heuristic when targetPayoffDate is absent (legacy card)', async () => {
    await db.creditCards.bulkPut([{ ...baseCard }]);
    await db.recurringExpenseTemplates.bulkPut([baseTemplate]);

    const amount = await estimate();
    expect(amount).toBe(Math.max(1200 * 0.02, 25)); // 24
  });

  it('falls back to the heuristic when the card has no interestRate at all (imported/legacy)', async () => {
    // An undefined rate previously flowed NaN into the materialized bill
    // amount and crashed the card view's rate formatting.
    await db.creditCards.bulkPut([{ ...baseCard, interestRate: undefined }]);
    await db.recurringExpenseTemplates.bulkPut([baseTemplate]);

    const amount = await estimate();
    expect(Number.isFinite(amount)).toBe(true);
    expect(amount).toBe(Math.max(1200 * 0.02, 25));
  });

  it('falls back to the flat heuristic when targetPayoffDate is unreachable', async () => {
    await db.creditCards.bulkPut([
      { ...baseCard, targetPayoffDate: '2026-09-20' }, // < 1 month away
    ]);
    await db.recurringExpenseTemplates.bulkPut([baseTemplate]);

    const amount = await estimate();
    expect(amount).toBe(Math.max(1200 * 0.02, 25));
  });

  it('respects minimumPaymentOverride ahead of the amortized calculation', async () => {
    await db.creditCards.bulkPut([
      { ...baseCard, targetPayoffDate: '2027-09-14' },
    ]);
    await db.recurringExpenseTemplates.bulkPut([
      { ...baseTemplate, minimumPaymentOverride: 99 },
    ]);

    expect(await estimate()).toBe(99);
  });

  it('returns 0 once the balance is paid off', async () => {
    await db.creditCards.bulkPut([
      { ...baseCard, balance: 0, targetPayoffDate: '2027-09-14' },
    ]);
    await db.recurringExpenseTemplates.bulkPut([baseTemplate]);

    expect(await estimate()).toBe(0);
  });

  it('uses the intro rate through and including its end date', async () => {
    await db.creditCards.bulkPut([
      {
        ...baseCard,
        targetPayoffDate: '2027-09-14',
        hasIntroApr: true,
        introApr: 0,
        introAprEndDate: '2026-09-01', // exactly "today" (pinned in beforeEach)
      },
    ]);
    await db.recurringExpenseTemplates.bulkPut([baseTemplate]);

    // At 0% APR over 12 months, payment is a flat balance/months split.
    const amount = await estimate();
    expect(amount).toBeCloseTo(1200 / 12, 5);
  });

  it('uses the standard rate the day after the intro end date', async () => {
    await db.creditCards.bulkPut([
      {
        ...baseCard,
        targetPayoffDate: '2027-09-14',
        hasIntroApr: true,
        introApr: 0,
        introAprEndDate: '2020-01-01', // long expired
      },
    ]);
    await db.recurringExpenseTemplates.bulkPut([baseTemplate]);

    const amount = await estimate();

    // Not the 0%-APR flat-split amount - the standard 20% rate applies.
    expect(amount).not.toBeCloseTo(1200 / 12, 5);
  });

  it('a legacy card with hasIntroApr undefined uses the standard rate', async () => {
    await db.creditCards.bulkPut([
      { ...baseCard, targetPayoffDate: '2027-09-14' },
    ]);
    await db.recurringExpenseTemplates.bulkPut([baseTemplate]);

    const amount = await estimate();
    expect(amount).not.toBeCloseTo(1200 / 12, 5);
  });
});

describe('dbHelpers.getCardBehindPaceWarning', () => {
  const now = '2026-09-01T00:00:00.000Z';

  const card = {
    id: 'card-1',
    name: 'Visa',
    balance: 1200,
    creditLimit: 5000,
    interestRate: 20,
    dueDate: '2026-09-14',
    targetPayoffDate: '2027-09-14',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const template = {
    id: 'tpl-card',
    nextDueDate: '2026-09-14',
    minimumPaymentOverride: null,
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 8, 1) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a legacy card with no targetPayoffDate', async () => {
    expect(
      await dbHelpers.getCardBehindPaceWarning(
        { ...card, targetPayoffDate: undefined },
        { ...template, minimumPaymentOverride: 10 },
      ),
    ).toBeNull();
  });

  it('returns null when the target payoff date has become unreachable', async () => {
    expect(
      await dbHelpers.getCardBehindPaceWarning(
        { ...card, targetPayoffDate: '2026-09-20' },
        { ...template, minimumPaymentOverride: 10 },
      ),
    ).toBeNull();
  });

  it('returns null when no override is set', async () => {
    expect(await dbHelpers.getCardBehindPaceWarning(card, template)).toBeNull();
  });

  it('returns null when the override meets or exceeds the calculated minimum', async () => {
    expect(
      await dbHelpers.getCardBehindPaceWarning(card, {
        ...template,
        minimumPaymentOverride: 1000, // far above the amortized minimum
      }),
    ).toBeNull();
  });

  it('warns with a projected payoff date when the override falls short', async () => {
    const result = await dbHelpers.getCardBehindPaceWarning(card, {
      ...template,
      minimumPaymentOverride: 30, // below the amortized minimum for this card
    });
    expect(result.isBehindPace).toBe(true);
    expect(result.projectedPayoffDate).toBeTruthy();
  });
});

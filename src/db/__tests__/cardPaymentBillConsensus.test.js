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

/**
 * CONSENSUS TEST — the safety net for the card-payment pricing oracle.
 *
 * Three code paths answer "what should this card's payment bill be":
 *   A. computeTemplateCycleAmount (via getVirtualLedger's estimate) — what
 *      a materialized/virtual cycle costs,
 *   B. syncCreditCardAmountToExpenses — what the pending bill costs after
 *      the user edits the card,
 *   C. applyCalculatorPaymentToCard — what the pending bill costs after
 *      "Apply to my card".
 *
 * They have diverged twice in practice (heuristic vs amortized pricing,
 * paidAmount guard drift), so this file pins the invariant: for the same
 * card+template state, all three MUST produce the identical number. Any
 * future change that reintroduces divergence fails here.
 *
 * Note the oracle anchors amortization on template.nextDueDate (the
 * cadence position), so a manually shifted row date does NOT change the
 * priced amount — pinned explicitly below.
 */
describe('card payment bill pricing — three-path consensus', () => {
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
    accountId: 'acc-1',
    isActive: true,
    isVariableAmount: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const seedPendingRow = async (overrides = {}) => {
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
        recurringTemplateId: 'tpl-card',
        createdAt: now,
        ...overrides,
      },
    ]);
  };

  // Path A: the Virtual Ledger's estimate for the current cycle.
  const oracleEstimate = async () => {
    const results = await dbHelpers.getVirtualLedger(
      'tpl-card',
      '2026-09-01',
      '2026-09-30',
    );
    return results[0].estimatedAmount;
  };

  // Path B: edit the card (re-writing the same balance still triggers the
  // sync) and read back the pending row's amount.
  const syncedRowAmount = async () => {
    const card = await db.creditCards.get('card-1');
    await dbHelpers.updateCreditCard('card-1', { balance: card.balance });
    const expense = await db.fixedExpenses.get('exp-1');
    return expense.amount;
  };

  // Path C: apply a payment amount and read back the pending row's amount.
  const appliedRowAmount = async paymentAmount => {
    await dbHelpers.applyCalculatorPaymentToCard('card-1', paymentAmount);
    const expense = await db.fixedExpenses.get('exp-1');
    return expense.amount;
  };

  beforeEach(async () => {
    // Pin "today" to 2026-09-01 so amortization math is deterministic.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 8, 1) });

    await Promise.all([
      db.creditCards.clear(),
      db.recurringExpenseTemplates.clear(),
      db.fixedExpenses.clear(),
      db.auditLogs.clear(),
    ]);

    await db.creditCards.bulkPut([baseCard]);
    await db.recurringExpenseTemplates.bulkPut([baseTemplate]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('all three paths agree on the amortized bill amount (no override)', async () => {
    await db.creditCards.bulkPut([
      { ...baseCard, targetPayoffDate: '2027-09-14' },
    ]);

    // Read path A while the Sept cycle is still virtual (no real row yet),
    // then seed the row and check B and C against it.
    const pathA = await oracleEstimate();
    await seedPendingRow();
    const pathB = await syncedRowAmount();
    const pathC = await appliedRowAmount(pathA);

    expect(pathA).toBeGreaterThan(25); // sanity: amortized, not the $25 floor
    expect(pathB).toBe(pathA);
    expect(pathC).toBe(pathA);
  });

  it('all three paths agree when a minimumPaymentOverride is set', async () => {
    await db.creditCards.bulkPut([
      { ...baseCard, targetPayoffDate: '2027-09-14' },
    ]);
    await db.recurringExpenseTemplates.bulkPut([
      { ...baseTemplate, minimumPaymentOverride: 99 },
    ]);

    const pathA = await oracleEstimate();
    await seedPendingRow();
    const pathB = await syncedRowAmount();
    const pathC = await appliedRowAmount(pathA);

    expect(pathA).toBe(99);
    expect(pathB).toBe(99);
    expect(pathC).toBe(99);
  });

  it('a partially-paid row is untouched by BOTH the sync path and the apply path', async () => {
    await seedPendingRow({
      id: 'exp-partial',
      amount: 100,
      paidAmount: 40,
    });

    await dbHelpers.updateCreditCard('card-1', { balance: 900 });
    await dbHelpers.applyCalculatorPaymentToCard('card-1', 25);

    const expense = await db.fixedExpenses.get('exp-partial');
    expect(expense.amount).toBe(100); // neither path rewrote settled money
    const template = await db.recurringExpenseTemplates.get('tpl-card');
    expect(template.minimumPaymentOverride).toBe(25);
  });

  it('a manually shifted row due date does NOT change the priced amount', async () => {
    // Anchor ruling: the amortization anchor is template.nextDueDate (the
    // cadence position). A user dragging the bill's date expresses "pay
    // later", not "my payoff plan has fewer months" — and materialization
    // anchors the same way, so all paths stay equal regardless of drift.
    await db.creditCards.bulkPut([
      { ...baseCard, targetPayoffDate: '2027-09-14' },
    ]);

    const pathA = await oracleEstimate();
    await seedPendingRow({ dueDate: '2026-11-20' }); // shifted ~2 months
    const pathB = await syncedRowAmount();

    expect(pathB).toBe(pathA);
  });
});

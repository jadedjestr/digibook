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

describe('dbHelpers.getVirtualLedger', () => {
  const now = '2026-09-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.recurringExpenseTemplates.clear(),
      db.fixedExpenses.clear(),
      db.recurringResolutionLog.clear(),
    ]);
  });

  it('returns [] for a missing or soft-deleted template', async () => {
    expect(
      await dbHelpers.getVirtualLedger('nope', '2026-01-01', '2026-12-31'),
    ).toEqual([]);

    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-deleted',
        name: 'Gone',
        baseAmount: 10,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-01-14',
        category: 'Misc',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      },
    ]);
    expect(
      await dbHelpers.getVirtualLedger(
        'tpl-deleted',
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual([]);
  });

  it('classifies resolved, pending, and virtual cycles, enriched with the template', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Car Insurance',
        baseAmount: 89.5,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-07-14',
        category: 'Insurance',
        accountId: 'acc-1',
        isActive: true,
        isVariableAmount: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    // July cycle: resolved
    await db.recurringResolutionLog.bulkPut([
      {
        id: 'log-1',
        templateId: 'tpl-1',
        expenseId: 'exp-old',
        adjustmentExpenseId: null,
        cycleDueDate: '2026-07-14',
        resolvedAt: '2026-07-14T00:00:00.000Z',
        committedAmount: 89.5,
        paidAmount: 89.5,
        wasSkipped: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    // August cycle: pending real row, not yet resolved
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Car Insurance',
        dueDate: '2026-08-14',
        amount: 89.5,
        accountId: 'acc-1',
        category: 'Insurance',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: 'tpl-1',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    // September cycle: neither - virtual/forecast
    const results = await dbHelpers.getVirtualLedger(
      'tpl-1',
      '2026-07-01',
      '2026-09-30',
    );

    expect(results.map(r => [r.cycleDueDate, r.state])).toEqual([
      ['2026-07-14', 'resolved'],
      ['2026-08-14', 'pending'],
      ['2026-09-14', 'virtual'],
    ]);
    expect(results.every(r => r.template.id === 'tpl-1')).toBe(true);

    const virtualEntry = results.find(r => r.state === 'virtual');
    expect(virtualEntry.estimatedAmount).toBe(89.5);
  });

  it('estimates a virtual cycle amount via computeTemplateCycleAmount for a card-payment template', async () => {
    await db.creditCards.bulkPut([
      {
        id: 'card-1',
        name: 'Visa',
        balance: 500,
        creditLimit: 2000,
        interestRate: 19.99,
        dueDate: '2026-09-14',
        statementClosingDate: '2026-09-01',
        minimumPayment: 45,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-card',
        name: 'Visa Payment',
        baseAmount: 45,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-09-14',
        category: 'Credit Card Payment',
        targetCreditCardId: 'card-1',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    const results = await dbHelpers.getVirtualLedger(
      'tpl-card',
      '2026-09-01',
      '2026-09-30',
    );

    expect(results).toHaveLength(1);
    expect(results[0].state).toBe('virtual');
    expect(results[0].estimatedAmount).toBe(45); // minimumPayment, card balance > 0
  });
});

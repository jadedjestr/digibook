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

describe('dbHelpers.undoLastResolution', () => {
  const now = '2026-09-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
      db.recurringExpenseTemplates.clear(),
      db.fixedExpenses.clear(),
      db.auditLogs.clear(),
      db.recurringResolutionLog.clear(),
      db.monthlyExpenseHistory.clear(),
    ]);

    await db.accounts.bulkPut([
      {
        id: 'acc-1',
        name: 'Checking',
        type: 'checking',
        currentBalance: 1000,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Car Insurance',
        baseAmount: 89.5,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-07-14',
        lastGenerated: '2026-08-14',
        nextDueDate: '2026-09-14',
        category: 'Insurance',
        accountId: 'acc-1',
        isActive: true,
        isVariableAmount: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Car Insurance',
        dueDate: '2026-09-14',
        amount: 89.5,
        accountId: 'acc-1',
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Insurance',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: 'tpl-1',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  it('reverses a full-payment resolution: cadence, paidAmount, status, and balance all revert', async () => {
    await dbHelpers.resolveCycle('exp-1', { paidAmount: 89.5 });

    await dbHelpers.undoLastResolution('tpl-1');

    const expense = await db.fixedExpenses.get('exp-1');
    const template = await db.recurringExpenseTemplates.get('tpl-1');
    const account = await db.accounts.get('acc-1');
    const logEntries = await db.recurringResolutionLog
      .where('templateId')
      .equals('tpl-1')
      .toArray();

    expect(expense.paidAmount).toBe(0);
    expect(expense.status).toBe('pending');
    expect(template.nextDueDate).toBe('2026-09-14');
    expect(template.lastGenerated).toBe('2026-08-14');
    expect(account.currentBalance).toBe(1000);
    expect(logEntries[0].deletedAt).not.toBeNull(); // soft-deleted, not gone
  });

  it('deletes the Balance Due a partial resolution created', async () => {
    const { adjustmentExpenseId } = await dbHelpers.resolveCycle('exp-1', {
      paidAmount: 40,
    });
    expect(adjustmentExpenseId).toBeTruthy();

    await dbHelpers.undoLastResolution('tpl-1');

    const balanceDue = await db.fixedExpenses.get(adjustmentExpenseId);
    expect(balanceDue.deletedAt).not.toBeNull();

    const expense = await db.fixedExpenses.get('exp-1');
    expect(expense.paidAmount).toBe(0);
  });

  it('is blocked when the Balance Due it created already has a payment on it', async () => {
    const { adjustmentExpenseId } = await dbHelpers.resolveCycle('exp-1', {
      paidAmount: 40,
    });

    await dbHelpers.applyExpensePaymentChangeAtomic(adjustmentExpenseId, {
      paidAmount: 10,
    });

    await expect(dbHelpers.undoLastResolution('tpl-1')).rejects.toThrow(
      /already has a payment on it/i,
    );

    // Nothing should have moved.
    const expense = await db.fixedExpenses.get('exp-1');
    expect(expense.paidAmount).toBe(40);
    const logEntries = await db.recurringResolutionLog
      .where('templateId')
      .equals('tpl-1')
      .filter(e => !e.deletedAt)
      .toArray();
    expect(logEntries).toHaveLength(1);
  });

  it('is LIFO: undoing twice reverses the two most recent resolutions in order', async () => {
    // Resolve September (full pay).
    await dbHelpers.resolveCycle('exp-1', { paidAmount: 89.5 });

    // October's cycle is now real (simulate materializing it) and gets
    // resolved too.
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-2',
        name: 'Car Insurance',
        dueDate: '2026-10-14',
        amount: 89.5,
        accountId: 'acc-1',
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Insurance',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: 'tpl-1',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await dbHelpers.resolveCycle('exp-2', { paidAmount: 89.5 });

    let template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.nextDueDate).toBe('2026-11-14');

    // First undo reverses October's resolution.
    await dbHelpers.undoLastResolution('tpl-1');
    template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.nextDueDate).toBe('2026-10-14');
    const expense2 = await db.fixedExpenses.get('exp-2');
    expect(expense2.paidAmount).toBe(0);

    // Second undo reverses September's.
    await dbHelpers.undoLastResolution('tpl-1');
    template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.nextDueDate).toBe('2026-09-14');
    const expense1 = await db.fixedExpenses.get('exp-1');
    expect(expense1.paidAmount).toBe(0);

    // Nothing left to undo.
    await expect(dbHelpers.undoLastResolution('tpl-1')).rejects.toThrow(
      /nothing to undo/i,
    );
  });

  it('re-activates a template that the resolution deactivated (endDate reached)', async () => {
    await db.recurringExpenseTemplates.update('tpl-1', {
      endDate: '2026-09-20',
    });
    await dbHelpers.resolveCycle('exp-1', { paidAmount: 89.5 });

    let template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.isActive).toBe(false);

    await dbHelpers.undoLastResolution('tpl-1');

    template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.isActive).toBe(true);
    expect(template.nextDueDate).toBe('2026-09-14');
  });

  it('throws when there is nothing to undo for a template', async () => {
    await expect(dbHelpers.undoLastResolution('tpl-1')).rejects.toThrow(
      /nothing to undo/i,
    );
  });
});

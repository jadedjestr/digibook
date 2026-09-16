import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateNextOccurrence } from '../../services/recurringExpenseService';
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
 * "One Bill at a Time": a brand-new recurring template's first occurrence
 * is materialized immediately when it falls within the current pay period
 * (AddExpensePanel / createExpenseForCard pass `allowFuture: true`), so it
 * is actionable in the priority list and hero totals instead of existing
 * only as a virtual calendar forecast until its due date. Every other
 * caller keeps the default due-only behaviour.
 */
describe('dbHelpers.materializeCurrentCycle', () => {
  const now = '2026-09-15T00:00:00.000Z';

  beforeEach(async () => {
    // Pin "today" to 2026-09-15 so the future-dated template (due the 17th)
    // is deterministically ahead of the due-only default path. Only Date is
    // faked - Dexie's internals keep using real timers.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 8, 15) });

    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
      db.loans.clear(),
      db.categories.clear(),
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

    await db.categories.bulkPut([
      {
        id: 'cat-1',
        name: 'Subscriptions',
        color: '#7c3aed',
        icon: 'tv',
        isDefault: false,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Netflix',
        baseAmount: 15.99,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-09-17',
        lastGenerated: null,
        nextDueDate: '2026-09-17', // two days ahead of pinned "today"
        category: 'Subscriptions',
        accountId: 'acc-1',
        isActive: true,
        isVariableAmount: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('default call: a future-dated current cycle is NOT materialized', async () => {
    const id = await dbHelpers.materializeCurrentCycle('tpl-1');
    expect(id).toBeNull();
    expect(await db.fixedExpenses.count()).toBe(0);
  });

  it('allowFuture materializes the first occurrence ahead of its due date', async () => {
    const id = await dbHelpers.materializeCurrentCycle('tpl-1', {
      allowFuture: true,
    });
    expect(id).toBeTruthy();

    const expense = await db.fixedExpenses.get(id);
    expect(expense).toMatchObject({
      name: 'Netflix',
      dueDate: '2026-09-17',
      amount: 15.99,
      paidAmount: 0,
      status: 'pending',
      recurringTemplateId: 'tpl-1',
    });

    // The cadence is never advanced by materialization - resolveCycle owns it.
    const template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.nextDueDate).toBe('2026-09-17');
    expect(template.lastGenerated).toBeNull();
  });

  it('is idempotent: a second allowFuture call returns the same row, no duplicate', async () => {
    const first = await dbHelpers.materializeCurrentCycle('tpl-1', {
      allowFuture: true,
    });
    const second = await dbHelpers.materializeCurrentCycle('tpl-1', {
      allowFuture: true,
    });
    expect(second).toBe(first);
    expect(await db.fixedExpenses.count()).toBe(1);
  });

  it('the due-date sweep stays idempotent when the due date arrives after an early materialization', async () => {
    await dbHelpers.materializeCurrentCycle('tpl-1', { allowFuture: true });

    // Pin "today" forward to the due date; the sweep must find the existing
    // row (dueDate === nextDueDate), not create a second one.
    vi.setSystemTime(new Date(2026, 8, 17));
    const swept = await dbHelpers.materializeCurrentCycle('tpl-1');
    expect(swept).toBeTruthy();
    expect(await db.fixedExpenses.count()).toBe(1);
  });

  it('an expense resolved early advances the cadence, and the due-date sweep creates nothing extra', async () => {
    const id = await dbHelpers.materializeCurrentCycle('tpl-1', {
      allowFuture: true,
    });
    await dbHelpers.resolveCycle(id, { paidAmount: 15.99 });

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.nextDueDate).toBe('2026-10-17');

    // The sweep (default, due-only) must not re-create the resolved cycle.
    const swept = await dbHelpers.materializeCurrentCycle('tpl-1');
    expect(swept).toBeNull();
    expect(await db.fixedExpenses.count()).toBe(1);
  });

  it('still refuses a template whose end date has passed, even with allowFuture', async () => {
    await db.recurringExpenseTemplates.update('tpl-1', {
      endDate: '2026-09-10',
    });
    await expect(
      dbHelpers.materializeCurrentCycle('tpl-1', { allowFuture: true }),
    ).rejects.toThrow(/end date/i);
    expect(await db.fixedExpenses.count()).toBe(0);
  });

  it('still refuses (and deactivates) a template with a deleted linked card, even with allowFuture', async () => {
    await db.creditCards.bulkPut([
      {
        id: 'card-1',
        name: 'Visa',
        balance: 0,
        creditLimit: 1000,
        interestRate: 0,
        dueDate: '2026-10-01',
        statementClosingDate: '2026-09-20',
        minimumPayment: 25,
        createdAt: now,
        updatedAt: now,
        deletedAt: '2026-09-14T00:00:00.000Z',
      },
    ]);
    await db.recurringExpenseTemplates.update('tpl-1', {
      targetCreditCardId: 'card-1',
    });

    await expect(
      dbHelpers.materializeCurrentCycle('tpl-1', { allowFuture: true }),
    ).rejects.toThrow(/deleted/i);
    const template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.isActive).toBe(false);
    expect(await db.fixedExpenses.count()).toBe(0);
  });

  it('generateNextOccurrence passes allowFuture through to the db helper', async () => {
    const id = await generateNextOccurrence('tpl-1', { allowFuture: true });
    expect(id).toBeTruthy();
    const expense = await db.fixedExpenses.get(id);
    expect(expense.dueDate).toBe('2026-09-17');

    // Without the option the same call is a no-op for a future cycle: the
    // due-only bail fires before the existing-row check, so it returns null
    // (not a duplicate). No second row may appear either way.
    const again = await generateNextOccurrence('tpl-1');
    expect(again).toBeNull();
    expect(await db.fixedExpenses.count()).toBe(1);
  });

  it('still refuses (and deactivates) a template with a deleted linked loan, even with allowFuture', async () => {
    await db.loans.bulkPut([
      {
        id: 'loan-1',
        name: 'Car Loan',
        balance: 10000,
        interestRate: 6,
        dueDate: '2026-10-01',
        targetPayoffDate: '2031-10-01',
        createdAt: now,
        updatedAt: now,
        deletedAt: '2026-09-14T00:00:00.000Z',
      },
    ]);
    await db.recurringExpenseTemplates.update('tpl-1', {
      targetLoanId: 'loan-1',
    });

    await expect(
      dbHelpers.materializeCurrentCycle('tpl-1', { allowFuture: true }),
    ).rejects.toThrow(/loan.*deleted/i);
    const template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.isActive).toBe(false);
    expect(await db.fixedExpenses.count()).toBe(0);
  });

  describe('createExpenseForLoan (materialization path)', () => {
    beforeEach(async () => {
      await db.accounts.bulkPut([
        {
          id: 'acc-loan',
          name: 'Savings',
          type: 'savings',
          currentBalance: 2000,
          isDefault: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);
      await db.loans.bulkPut([
        {
          id: 'loan-1',
          name: 'Car Loan',
          balance: 10000,
          interestRate: 6,
          dueDate: '2026-12-01', // ahead of pinned "today" (2026-09-15)
          targetPayoffDate: '2031-12-01',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);
    });

    it('materializes the first bill immediately, unconditionally ahead of its due date', async () => {
      await dbHelpers.createExpenseForLoan('loan-1', 'acc-loan');

      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => e.targetLoanId === 'loan-1',
      );
      expect(expenses).toHaveLength(1);
      expect(expenses[0].dueDate).toBe('2026-12-01'); // months ahead of "today"
      expect(expenses[0].amount).toBeGreaterThan(0);
      expect(expenses[0].category).toBe('Loan Payment');
    });

    it('computes the amount via the dynamic payoff formula, not a static minimum', async () => {
      await dbHelpers.createExpenseForLoan('loan-1', 'acc-loan');

      const [expense] = (await db.fixedExpenses.toArray()).filter(
        e => e.targetLoanId === 'loan-1',
      );
      const expected = dbHelpers.calculateRequiredLoanPayment(
        10000,
        6,
        '2026-12-01',
        '2031-12-01',
      );
      expect(expected.success).toBe(true);
      expect(expense.amount).toBeCloseTo(expected.payment, 6);
    });

    it('a loan that is already paid off (balance 0) gets no payment template or bill', async () => {
      await db.loans.update('loan-1', { balance: 0 });
      await dbHelpers.createExpenseForLoan('loan-1', 'acc-loan');

      const templates = (await db.recurringExpenseTemplates.toArray()).filter(
        t => t.targetLoanId === 'loan-1',
      );
      const expenses = (await db.fixedExpenses.toArray()).filter(
        e => e.targetLoanId === 'loan-1',
      );
      expect(templates).toHaveLength(0);
      expect(expenses).toHaveLength(0);
    });

    it('an existing template materializes a $0 bill once the loan is paid down to 0 (ongoing, not first-cycle)', async () => {
      // A loan mid-life: it already has an active template (created back
      // when balance was positive), and has since been paid down to 0.
      await db.loans.update('loan-1', { balance: 0 });
      await db.recurringExpenseTemplates.bulkPut([
        {
          id: 'tpl-loan-1',
          name: 'Car Loan Payment',
          baseAmount: 180,
          frequency: 'monthly',
          intervalValue: 1,
          intervalUnit: 'months',
          startDate: '2026-08-01',
          lastGenerated: '2026-08-01',
          nextDueDate: '2026-09-01', // due, since pinned "today" is 09-15
          category: 'Loan Payment',
          accountId: 'acc-loan',
          targetLoanId: 'loan-1',
          isActive: true,
          isVariableAmount: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);

      const id = await dbHelpers.materializeCurrentCycle('tpl-loan-1');
      expect(id).toBeTruthy();
      const expense = await db.fixedExpenses.get(id);
      expect(expense.amount).toBe(0);
    });
  });
});

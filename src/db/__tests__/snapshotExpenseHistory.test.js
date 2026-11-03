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

const now = '2026-02-01T00:00:00.000Z';

describe('dbHelpers.snapshotExpensesForMonth', () => {
  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
      db.categories.clear(),
      db.paycheckSettings.clear(),
      db.userPreferences.clear(),
      db.recurringExpenseTemplates.clear(),
      db.pendingTransactions.clear(),
      db.fixedExpenses.clear(),
      db.monthlyExpenseHistory.clear(),
      db.auditLogs.clear(),
    ]);

    await db.accounts.bulkPut([
      {
        id: 1,
        name: 'Checking',
        type: 'checking',
        currentBalance: 100,
        isDefault: true,
        createdAt: now,
      },
    ]);

    await db.categories.bulkPut([
      {
        id: 1,
        name: 'Housing',
        color: '#FF0000',
        icon: 'home',
        isDefault: true,
        createdAt: now,
      },
    ]);
  });

  it('writes one record per paid expense with correct shape', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 1,
        name: 'Rent',
        dueDate: '2026-02-05',
        amount: 1000,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 1000,
        status: 'paid',
        recurringTemplateId: null,
        createdAt: now,
      },
      {
        id: 2,
        name: 'Utilities',
        dueDate: '2026-02-10',
        amount: 150,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 75,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
      {
        id: 3,
        name: 'Overpaid',
        dueDate: '2026-02-15',
        amount: 100,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 120,
        status: 'paid',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.snapshotExpensesForMonth();

    const history = await db.monthlyExpenseHistory.toArray();
    expect(history).toHaveLength(3);

    const byExpenseId = Object.fromEntries(history.map(r => [r.expenseId, r]));
    expect(byExpenseId[1]).toMatchObject({
      expenseId: 1,
      month: 2,
      year: 2026,
      budgetAmount: 1000,
      actualAmount: 1000,
      overpaymentAmount: 0,
    });
    expect(byExpenseId[1].createdAt).toBeDefined();

    expect(byExpenseId[2]).toMatchObject({
      expenseId: 2,
      month: 2,
      year: 2026,
      budgetAmount: 150,
      actualAmount: 75,
      overpaymentAmount: 0,
    });
    expect(byExpenseId[2].createdAt).toBeDefined();

    expect(byExpenseId[3]).toMatchObject({
      expenseId: 3,
      month: 2,
      year: 2026,
      budgetAmount: 100,
      actualAmount: 120,
      overpaymentAmount: 20,
    });
  });

  it('does not snapshot expenses with paidAmount === 0', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 1,
        name: 'Rent',
        dueDate: '2026-02-05',
        amount: 1000,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.snapshotExpensesForMonth();

    const history = await db.monthlyExpenseHistory.toArray();
    expect(history).toHaveLength(0);
  });

  it('skips expenses with null or invalid dueDate without throwing', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 1,
        name: 'Rent',
        dueDate: null,
        amount: 1000,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 500,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
      {
        id: 2,
        name: 'Other',
        dueDate: 'not-a-date',
        amount: 50,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 50,
        status: 'paid',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await expect(dbHelpers.snapshotExpensesForMonth()).resolves.not.toThrow();

    const history = await db.monthlyExpenseHistory.toArray();
    expect(history).toHaveLength(0);
  });

  it('upserts when snapshot is run twice for same expense and month', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 1,
        name: 'Rent',
        dueDate: '2026-02-05',
        amount: 1000,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 1000,
        status: 'paid',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    await dbHelpers.snapshotExpensesForMonth();
    await dbHelpers.snapshotExpensesForMonth();

    const history = await db.monthlyExpenseHistory.toArray();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      expenseId: 1,
      month: 2,
      year: 2026,
      actualAmount: 1000,
    });
  });

  it('does not throw when snapshot fails', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 1,
        name: 'Rent',
        dueDate: '2026-02-05',
        amount: 1000,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 1000,
        status: 'paid',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    const originalBulkPut = db.monthlyExpenseHistory.bulkPut.bind(
      db.monthlyExpenseHistory,
    );
    db.monthlyExpenseHistory.bulkPut = async () => {
      throw new Error('Injected failure');
    };

    await expect(dbHelpers.snapshotExpensesForMonth()).resolves.not.toThrow();

    db.monthlyExpenseHistory.bulkPut = originalBulkPut;
  });

  // Only rows that differ are written, so a payment costs one row however
  // many bills were paid before (it used to rewrite every paid bill's row).
  describe('writes only what changed', () => {
    const bill = (id, paidAmount, overrides = {}) => ({
      id,
      name: `Bill ${id}`,
      dueDate: '2026-02-05',
      amount: 100,
      accountId: 1,
      creditCardId: null,
      targetCreditCardId: null,
      category: 'Housing',
      paidAmount,
      status: 'paid',
      recurringTemplateId: null,
      createdAt: now,
      ...overrides,
    });
    const rowsWrittenBy = async run => {
      const spy = vi.spyOn(db.monthlyExpenseHistory, 'bulkPut');
      await run();
      const written = spy.mock.calls.flatMap(([rows]) => rows);
      spy.mockRestore();
      return written;
    };

    it('writes nothing when every row is already correct', async () => {
      await db.fixedExpenses.bulkPut([bill(1, 100), bill(2, 100)]);
      await dbHelpers.snapshotExpensesForMonth();

      const written = await rowsWrittenBy(() =>
        dbHelpers.snapshotExpensesForMonth(),
      );
      expect(written).toEqual([]);
    });

    it('leaves a correct row exactly as it was', async () => {
      await db.fixedExpenses.bulkPut([bill(1, 100)]);
      await dbHelpers.snapshotExpensesForMonth();
      const [before] = await db.monthlyExpenseHistory.toArray();

      await dbHelpers.snapshotExpensesForMonth();

      const [after] = await db.monthlyExpenseHistory.toArray();
      expect(after).toEqual(before);
    });

    it('writes just the bill that was newly paid', async () => {
      await db.fixedExpenses.bulkPut([bill(1, 100), bill(2, 100), bill(3, 0)]);
      await dbHelpers.snapshotExpensesForMonth();

      await db.fixedExpenses.update(3, { paidAmount: 100 });
      const written = await rowsWrittenBy(() =>
        dbHelpers.snapshotExpensesForMonth(),
      );

      expect(written.map(r => r.expenseId)).toEqual([3]);
    });

    // The snapshot has always repaired every row on each run; that stays.
    it('still repairs a row that is out of date', async () => {
      await db.fixedExpenses.bulkPut([bill(1, 100), bill(2, 100)]);
      await dbHelpers.snapshotExpensesForMonth();
      await db.fixedExpenses.update(2, { paidAmount: 130 }); // changed elsewhere

      const written = await rowsWrittenBy(() =>
        dbHelpers.snapshotExpensesForMonth(),
      );

      expect(written.map(r => r.expenseId)).toEqual([2]);
      const row = await db.monthlyExpenseHistory
        .where('expenseId')
        .equals(2)
        .first();
      expect(row).toMatchObject({ actualAmount: 130, overpaymentAmount: 30 });
    });

    it('still repairs a row whose budget was edited after it was paid', async () => {
      await db.fixedExpenses.bulkPut([bill(1, 100), bill(2, 100)]);
      await dbHelpers.snapshotExpensesForMonth();
      await db.fixedExpenses.update(2, { amount: 120 }); // paid 100 of 120

      const written = await rowsWrittenBy(() =>
        dbHelpers.snapshotExpensesForMonth(),
      );

      expect(written.map(r => r.expenseId)).toEqual([2]);
      const row = await db.monthlyExpenseHistory
        .where('expenseId')
        .equals(2)
        .first();
      expect(row).toMatchObject({ budgetAmount: 120, actualAmount: 100 });
    });

    it('still writes a row that is missing', async () => {
      await db.fixedExpenses.bulkPut([bill(1, 100), bill(2, 100)]);
      await dbHelpers.snapshotExpensesForMonth();
      await db.monthlyExpenseHistory.where('expenseId').equals(1).delete();

      const written = await rowsWrittenBy(() =>
        dbHelpers.snapshotExpensesForMonth(),
      );

      expect(written.map(r => r.expenseId)).toEqual([1]);
      expect(await db.monthlyExpenseHistory.count()).toBe(2);
    });

    it('brings back a row that was marked deleted', async () => {
      await db.fixedExpenses.bulkPut([bill(1, 100)]);
      await dbHelpers.snapshotExpensesForMonth();
      await db.monthlyExpenseHistory
        .where('expenseId')
        .equals(1)
        .modify({ deletedAt: now });

      await dbHelpers.snapshotExpensesForMonth();

      const [row] = await db.monthlyExpenseHistory.toArray();
      expect(row.deletedAt).toBeNull();
    });
  });
});

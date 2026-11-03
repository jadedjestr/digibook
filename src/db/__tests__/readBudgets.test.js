import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { countStoreReads } from '../../test/perfCounters';
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

// How much of the database the app's repeated work reads. Counted at the
// object store, so it holds however the code asks (toArray, filter, where,
// get). A "scan" walks a table; a "get" reads one row by key. The point is the
// SHAPE: what stays flat as data grows, and what grows with it.

const now = '2026-09-01T00:00:00.000Z';
const stamp = { createdAt: now, updatedAt: now, deletedAt: null };
const setToday = (y, m, d) =>
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(y, m - 1, d) });

const clearAll = () =>
  Promise.all(
    [
      db.accounts,
      db.creditCards,
      db.fixedExpenses,
      db.recurringExpenseTemplates,
      db.recurringResolutionLog,
      db.monthlyExpenseHistory,
      db.cardPayments,
      db.auditLogs,
      db.pendingTransactions,
    ].map(table => table.clear()),
  );

afterEach(() => {
  vi.useRealTimers();
});

describe('Insights load', () => {
  const seedBills = async count => {
    await clearAll();
    await db.fixedExpenses.bulkPut(
      Array.from({ length: count }, (_, i) => ({
        id: `e${i}`,
        name: `bill ${i}`,
        dueDate: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
        amount: 10,
        paidAmount: i % 2 ? 10 : 0,
        category: `cat ${i % 5}`,
        ...stamp,
      })),
    );
  };

  // The three calls the Insights page makes together.
  const loadInsights = () =>
    Promise.all([
      dbHelpers.getBudgetVsActualSummary(),
      dbHelpers.getOverpaymentByCategory(),
      dbHelpers.getMonthlyExpenseHistory(12),
    ]);

  it('makes the same reads on 200 bills as on 5', async () => {
    await seedBills(5);
    const small = await countStoreReads(loadInsights);
    await seedBills(200);
    const large = await countStoreReads(loadInsights);

    expect(large.stores).toEqual(small.stores);
  });

  // KNOWN INEFFICIENCY, measured 2026-11-02: the bills table is scanned four
  // times, once by each of three helpers and twice inside the summary (once to
  // pick the month, once to total it). Pinned as a ceiling so it cannot grow.
  it('scans the bills table at most four times and the history once', async () => {
    await seedBills(20);
    const { stores } = await countStoreReads(loadInsights);

    expect(stores.fixedExpenses.scans).toBeLessThanOrEqual(4);
    expect(stores.monthlyExpenseHistory.scans).toBe(1);
    expect(Object.keys(stores).sort()).toEqual([
      'fixedExpenses',
      'monthlyExpenseHistory',
    ]);
  });

  // The behaviour we want: one read of the bills table, shared. Passes while
  // it is four; fails the day it is fixed, so remove `.fails` then.
  it.fails('scans the bills table once', async () => {
    await seedBills(20);
    const { stores } = await countStoreReads(loadInsights);
    expect(stores.fixedExpenses.scans).toBe(1);
  });
});

describe('the balance due roll-over', () => {
  // `n` cards each with a skipped, deferred September bill: n balance dues.
  const seedBalanceDues = async n => {
    setToday(2026, 9, 20);
    await clearAll();
    await db.accounts.put({
      id: 'checking',
      name: 'Checking',
      type: 'checking',
      currentBalance: 99999,
      isDefault: true,
      ...stamp,
    });
    for (let i = 0; i < n; i++) {
      await db.creditCards.put({
        id: `c${i}`,
        name: `Card${i}`,
        balance: 2000,
        creditLimit: 5000,
        interestRate: 20,
        dueDate: '2026-09-25',
        minimumPayment: 35,
        customPaymentAmount: 200,
        ...stamp,
      });
      await db.recurringExpenseTemplates.put({
        id: `t${i}`,
        name: `Card${i} Payment`,
        baseAmount: 200,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-08-25',
        nextDueDate: '2026-09-25',
        category: 'Credit Card Payment',
        targetCreditCardId: `c${i}`,
        accountId: 'checking',
        isActive: true,
        isVariableAmount: true,
        ...stamp,
      });
      await db.fixedExpenses.put({
        id: `b${i}`,
        name: `Card${i} Payment`,
        dueDate: '2026-09-25',
        amount: 200,
        paidAmount: 0,
        status: 'pending',
        category: 'Credit Card Payment',
        accountId: 'checking',
        creditCardId: null,
        targetCreditCardId: `c${i}`,
        recurringTemplateId: `t${i}`,
        ...stamp,
      });
      await dbHelpers.resolveCycle(`b${i}`, {
        paidAmount: 0,
        shortfallOutcome: 'deferred',
      });
    }
    setToday(2026, 10, 1);
  };
  const roll = () => dbHelpers.rollOverBalanceDues('2026-10-01');

  describe('on app load with nothing left to roll', () => {
    // This is the cost every app load pays once history exists.
    it('reads the log once, never scans the bills table, and reads one row per past entry', async () => {
      for (const entries of [3, 12]) {
        await seedBalanceDues(entries);
        await roll(); // roll them all, so the next run has nothing to do
        const { stores } = await countStoreReads(roll);

        expect(stores.recurringResolutionLog.scans).toBe(1);
        expect(stores.fixedExpenses.scans).toBe(0);
        expect(stores.fixedExpenses.gets).toBe(entries);
        expect(Object.keys(stores).sort()).toEqual([
          'fixedExpenses',
          'recurringResolutionLog',
        ]);
      }
    });
  });

  describe('when balance dues do roll', () => {
    // KNOWN INEFFICIENCY, measured 2026-11-02: each balance due costs four
    // scans of the whole bills table, so the work is (balance dues) x (bills).
    // Usually there are none or a few, so it is pinned, not hidden.
    it('scans the bills table at most four times per balance due', async () => {
      for (const dues of [1, 4]) {
        await seedBalanceDues(dues);
        const { stores } = await countStoreReads(roll);
        expect(stores.fixedExpenses.scans).toBeLessThanOrEqual(4 * dues);
      }
    });

    // The behaviour we want: scanning the bills table a fixed number of times
    // however many balance dues roll. Fails the day it is fixed; remove `.fails`.
    it.fails(
      'does not rescan the bills table for each balance due',
      async () => {
        await seedBalanceDues(1);
        const one = (await countStoreReads(roll)).stores.fixedExpenses.scans;
        await seedBalanceDues(6);
        const six = (await countStoreReads(roll)).stores.fixedExpenses.scans;

        expect(six).toBeLessThanOrEqual(one);
      },
    );
  });
});

describe('paying a bill', () => {
  // `paidBills` already-paid bills sit in the history; then one more is paid.
  const seedHistoryAndPay = async paidBills => {
    setToday(2026, 11, 2);
    await clearAll();
    await db.accounts.put({
      id: 'checking',
      name: 'Checking',
      type: 'checking',
      currentBalance: 99999,
      isDefault: true,
      ...stamp,
    });
    await db.recurringExpenseTemplates.put({
      id: 'tpl',
      name: 'Rent',
      baseAmount: 100,
      frequency: 'monthly',
      intervalValue: 1,
      intervalUnit: 'months',
      startDate: '2026-01-05',
      nextDueDate: '2026-11-05',
      category: 'Housing',
      accountId: 'checking',
      isActive: true,
      ...stamp,
    });
    await db.fixedExpenses.bulkPut([
      {
        id: 'due',
        name: 'Rent',
        dueDate: '2026-11-05',
        amount: 100,
        paidAmount: 0,
        status: 'pending',
        category: 'Housing',
        accountId: 'checking',
        recurringTemplateId: 'tpl',
        ...stamp,
      },
      ...Array.from({ length: paidBills }, (_, i) => ({
        id: `old${i}`,
        name: `Old ${i}`,
        dueDate: `2025-${String((i % 12) + 1).padStart(2, '0')}-10`,
        amount: 10,
        paidAmount: 10,
        status: 'paid',
        category: 'Housing',
        accountId: 'checking',
        ...stamp,
      })),
    ]);
  };
  const historyWritesWhenPaying = async () => {
    const puts = vi.spyOn(db.monthlyExpenseHistory, 'put');
    await dbHelpers.resolveCycle('due', { paidAmount: 100 });
    const count = puts.mock.calls.length;
    puts.mockRestore();
    return count;
  };

  // KNOWN INEFFICIENCY, measured 2026-11-02 in the browser: after every
  // payment the app rewrites a history row for EVERY paid bill it has ever
  // had (snapshotExpensesForMonth). That cost ~1 ms per paid bill: 0.2 s to
  // pay at one year of data, 1.9 s at ten, 29.5 s at 30,000 bills, and 86% of
  // it disappeared when the step was removed. Pinned as "one row per paid
  // bill, plus this one" so it cannot get worse. When it is fixed this test
  // fails too: delete it, and remove `.fails` from the test below.
  it('writes one history row per paid bill, plus the one just paid', async () => {
    await seedHistoryAndPay(40);
    expect(await historyWritesWhenPaying()).toBe(41);
  });

  // The behaviour we want: paying one bill writes one history row, however
  // many bills were paid before. Fails the day it is fixed; remove `.fails`.
  it.fails('writes one history row when one bill is paid', async () => {
    await seedHistoryAndPay(40);
    expect(await historyWritesWhenPaying()).toBe(1);
  });
});

describe('creating the due bills on app load', () => {
  const seedTemplates = async count => {
    setToday(2026, 10, 1);
    await clearAll();
    for (let i = 0; i < count; i++) {
      await db.creditCards.put({
        id: `c${i}`,
        name: `Card${i}`,
        balance: 100,
        creditLimit: 500,
        interestRate: 10,
        minimumPayment: 25,
        ...stamp,
      });
      await db.recurringExpenseTemplates.put({
        id: `t${i}`,
        name: `Card${i} Payment`,
        baseAmount: 25,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-10-25',
        nextDueDate: '2026-10-25', // not due until the 25th
        category: 'Credit Card Payment',
        targetCreditCardId: `c${i}`,
        isActive: true,
        isVariableAmount: true,
        ...stamp,
      });
    }
  };

  beforeEach(() => {
    vi.useRealTimers();
  });

  it('with nothing due: scans the templates once, never the bills, and reads two rows per template', async () => {
    for (const templates of [1, 10]) {
      await seedTemplates(templates);
      const { stores } = await countStoreReads(() =>
        dbHelpers.materializeDueTemplates(),
      );

      expect(stores.recurringExpenseTemplates.scans).toBe(1);
      expect(stores.recurringExpenseTemplates.gets).toBe(templates);
      expect(stores.creditCards.gets).toBe(templates);
      expect(stores.fixedExpenses).toBeUndefined();
    }
  });
});

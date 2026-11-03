import { describe, it, expect, beforeEach, vi } from 'vitest';

import { db, dbHelpers } from '../database-clean';

// A due date is a calendar day. Read as an instant it is midnight UTC, which
// is the evening before in the Americas, so a bill due on the 1st was counted
// in the month before. Pin a zone west of Greenwich so this fails anywhere.
process.env.TZ = 'America/Los_Angeles';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const now = '2026-11-02T00:00:00.000Z';
const bill = (id, dueDate, amount, paidAmount = 0) => ({
  id,
  name: id,
  dueDate,
  amount,
  paidAmount,
  status: 'pending',
  category: 'Housing',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
});

describe('Insights month totals', () => {
  beforeEach(async () => {
    await Promise.all([
      db.fixedExpenses.clear(),
      db.monthlyExpenseHistory.clear(),
    ]);
  });

  it('runs in a zone west of UTC, or this suite proves nothing', () => {
    expect(new Date('2026-11-01').getMonth()).toBe(9);
  });

  it('counts a bill due on the 1st in its own month', async () => {
    await db.fixedExpenses.bulkPut([
      bill('rent', '2026-11-01', 1500, 1500),
      bill('power', '2026-11-12', 100),
      bill('water', '2026-11-20', 50),
    ]);

    expect(await dbHelpers.getCurrentCycleMonth()).toEqual({
      month: 11,
      year: 2026,
    });
    expect(await dbHelpers.getBudgetVsActualSummary()).toMatchObject({
      totalBudget: 1650,
      totalActual: 1500,
    });
  });

  it('keeps a bill due on the last day in its own month', async () => {
    await db.fixedExpenses.bulkPut([
      bill('rent', '2026-11-01', 1500),
      bill('phone', '2026-11-30', 80),
      bill('old', '2026-10-31', 999),
    ]);

    expect(await dbHelpers.getBudgetVsActualSummary()).toMatchObject({
      totalBudget: 1580,
    });
  });

  it('puts the 1st in the right month of the history', async () => {
    await db.fixedExpenses.bulkPut([
      bill('rent', '2026-11-01', 1500, 1500),
      bill('power', '2026-11-12', 100),
      bill('water', '2026-11-20', 50),
    ]);

    const history = await dbHelpers.getMonthlyExpenseHistory(2);
    const nov = history.find(h => h.month === 11 && h.year === 2026);
    expect(nov).toMatchObject({
      budgetAmount: 1650,
      actualAmount: 1500,
      expenseCount: 3,
    });
  });

  it('decides the current month by calendar day, not instant', async () => {
    // Two bills on the 1st of December outnumber one in November. Read as
    // instants they were November's, so November would have won.
    await db.fixedExpenses.bulkPut([
      bill('a', '2026-12-01', 10),
      bill('b', '2026-12-01', 10),
      bill('c', '2026-11-15', 10),
    ]);

    expect(await dbHelpers.getCurrentCycleMonth()).toEqual({
      month: 12,
      year: 2026,
    });
  });

  it('leaves a bill with no due date out instead of failing the totals', async () => {
    await db.fixedExpenses.bulkPut([
      bill('rent', '2026-11-01', 1500),
      { ...bill('loose', '2026-11-05', 40), dueDate: undefined },
    ]);

    expect(await dbHelpers.getBudgetVsActualSummary()).toMatchObject({
      totalBudget: 1500,
    });
  });

  it('counts a due date that carries a time on the day it is written', async () => {
    await db.fixedExpenses.bulkPut([
      bill('rent', '2026-11-01T00:00:00.000Z', 1500),
      bill('power', '2026-11-12', 100),
    ]);

    expect(await dbHelpers.getBudgetVsActualSummary()).toMatchObject({
      totalBudget: 1600,
    });
  });
});

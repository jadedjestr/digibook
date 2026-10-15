import { describe, expect, it } from 'vitest';

import {
  buildCategoryBreakdown,
  buildPaycheckForecast,
  getUpcomingPayDates,
  toBillFacts,
} from '../categoryBreakdown';

const categories = [
  { id: 'c-home', name: 'Housing', icon: '🏠', color: '#3B82F6' },
  { id: 'c-util', name: 'Utilities', icon: '💡', color: '#F59E0B' },
];

const expense = overrides => ({
  id: 'e1',
  name: 'Bill',
  dueDate: '2026-10-20',
  amount: 100,
  paidAmount: 0,
  category: 'Utilities',
  categoryId: 'c-util',
  accountId: 'acct-main',
  creditCardId: null,
  ...overrides,
});

const facts = (expenses, extra = {}) => toBillFacts({ expenses, ...extra });

describe('toBillFacts', () => {
  it('counts an unpaid bill at its entered amount, all of it still owed', () => {
    const [bill] = facts([expense({ amount: 90 })]);
    expect(bill).toMatchObject({
      totalCents: 9000,
      paidCents: 0,
      owedCents: 9000,
    });
  });

  it('counts a paid bill at what was actually paid, nothing owed', () => {
    const [bill] = facts([expense({ amount: 90, paidAmount: 112.4 })]);
    expect(bill).toMatchObject({
      totalCents: 11240,
      paidCents: 11240,
      owedCents: 0,
    });
  });

  it('keeps the full amount for a partly paid bill, but owes only the rest', () => {
    const [bill] = facts([expense({ amount: 200, paidAmount: 50 })]);
    expect(bill).toMatchObject({
      totalCents: 20000,
      paidCents: 5000,
      owedCents: 15000,
    });
  });

  it('treats a resolved cycle as settled at what was paid', () => {
    const resolvedByExpenseId = new Map([['e1', { paidAmount: 0 }]]);
    const [skipped] = facts([expense({ amount: 80 })], {
      resolvedByExpenseId,
    });
    expect(skipped).toMatchObject({
      totalCents: 0,
      paidCents: 0,
      owedCents: 0,
      isResolved: true,
    });
  });

  it('does not let a resolved cycle owe its shortfall a second time', () => {
    // A partial payment of 30 on an 80 bill: the 50 shortfall moved into a
    // Balance Due row, which is its own expense and counts on its own.
    const resolvedByExpenseId = new Map([['e1', { paidAmount: 30 }]]);
    const bills = facts(
      [
        expense({ id: 'e1', amount: 80, paidAmount: 30 }),
        expense({ id: 'due', name: 'Balance Due', amount: 50 }),
      ],
      { resolvedByExpenseId },
    );
    const owed = bills.reduce((sum, bill) => sum + bill.owedCents, 0);
    expect(owed).toBe(5000);
  });

  it('adds forecasts as fully owed, unpaid bills', () => {
    const [bill] = toBillFacts({
      forecasts: [
        {
          templateId: 't1',
          name: 'Rent',
          dueDate: '2026-11-01',
          amount: 1450,
          category: 'Housing',
        },
      ],
    });
    expect(bill).toMatchObject({
      id: 'forecast-t1-2026-11-01',
      isForecast: true,
      totalCents: 145000,
      owedCents: 145000,
    });
  });

  it('sums cents without float artifacts', () => {
    const bills = facts([
      expense({ id: 'a', amount: 0.1 }),
      expense({ id: 'b', amount: 0.2 }),
    ]);
    const { totalCents } = buildCategoryBreakdown(bills, categories);
    expect(totalCents).toBe(30);
  });
});

describe('buildCategoryBreakdown', () => {
  it('groups by category, largest first, with paid and still-coming', () => {
    const bills = facts([
      expense({
        id: 'rent',
        amount: 1450,
        paidAmount: 1450,
        category: 'Housing',
        categoryId: 'c-home',
      }),
      expense({ id: 'elec', amount: 110 }),
      expense({ id: 'water', amount: 100, paidAmount: 100 }),
    ]);
    const { totalCents, groups } = buildCategoryBreakdown(bills, categories);

    expect(totalCents).toBe(166000);
    expect(groups.map(g => g.name)).toEqual(['Housing', 'Utilities']);
    expect(groups[1]).toMatchObject({
      totalCents: 21000,
      paidCents: 10000,
      comingCents: 11000,
    });
    expect(groups[1].bills.map(b => b.id)).toEqual(['elec', 'water']);
  });

  it('puts bills with no category under Uncategorized', () => {
    const bills = facts([expense({ category: '', categoryId: null })]);
    const { groups } = buildCategoryBreakdown(bills, categories);
    expect(groups[0]).toMatchObject({ name: 'Uncategorized', rgb: null });
  });

  it('gives card and loan payment bills their own groups', () => {
    const bills = facts([
      expense({ id: 'a', category: 'Credit Card Payment', categoryId: null }),
      expense({ id: 'b', category: 'Loan Payment', categoryId: null }),
    ]);
    const names = buildCategoryBreakdown(bills, categories).groups.map(
      g => g.name,
    );
    expect(names.sort()).toEqual(['Card payment', 'Loan payment']);
  });

  it('groups a name match with an id match for the same category', () => {
    const bills = facts([
      expense({ id: 'a', categoryId: 'c-util' }),
      expense({ id: 'b', categoryId: null, category: ' utilities ' }),
    ]);
    const { groups } = buildCategoryBreakdown(bills, categories);
    expect(groups).toHaveLength(1);
    expect(groups[0].bills).toHaveLength(2);
  });

  it('uses the category color only when the user set one', () => {
    const bills = facts([
      expense({ id: 'a' }),
      expense({ id: 'b', category: 'Credit Card Payment', categoryId: null }),
    ]);
    const { groups } = buildCategoryBreakdown(bills, categories);
    expect(groups.find(g => g.name === 'Utilities').rgb).toBe('245, 158, 11');
    expect(groups.find(g => g.name === 'Card payment').rgb).toBeNull();
  });

  it('drops a category whose only bill was skipped', () => {
    const bills = facts([expense({ id: 'e1' })], {
      resolvedByExpenseId: new Map([['e1', { paidAmount: 0 }]]),
    });
    expect(buildCategoryBreakdown(bills, categories).groups).toEqual([]);
  });
});

describe('getUpcomingPayDates', () => {
  it('walks weekly paydays across a month boundary', () => {
    expect(getUpcomingPayDates('2026-10-16', 'weekly', 4)).toEqual([
      '2026-10-16',
      '2026-10-23',
      '2026-10-30',
      '2026-11-06',
    ]);
  });

  it('returns nothing without a next payday', () => {
    expect(getUpcomingPayDates(null, 'weekly', 4)).toEqual([]);
  });
});

describe('buildPaycheckForecast', () => {
  const payDates = ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06'];
  const base = {
    payDates,
    today: '2026-10-14',
    startingBalance: 480,
    accountId: 'acct-main',
    paycheck: { amount: 1100, accountId: 'acct-main' },
  };

  it('carries money left from paycheck to paycheck', () => {
    const bills = facts([
      expense({ id: 'a', dueDate: '2026-10-15', amount: 135 }),
      expense({ id: 'b', dueDate: '2026-10-20', amount: 420 }),
    ]);
    const { rows } = buildPaycheckForecast({ ...base, bills });

    expect(rows.map(r => r.leftCents)).toEqual([
      34500, // 480 - 135
      102500, // + 1100 - 420
      212500, // + 1100
      322500, // + 1100
    ]);
    expect(rows[0].incomeCents).toBe(0);
    expect(rows[1].incomeCents).toBe(110000);
  });

  it('counts a bill due on payday before that paycheck', () => {
    const bills = facts([expense({ dueDate: '2026-10-16', amount: 50 })]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[0].billsCents).toBe(5000);
    expect(rows[1].billsCents).toBe(0);
  });

  it('includes next-month bills once the pay period reaches them', () => {
    const bills = toBillFacts({
      forecasts: [
        {
          templateId: 'rent',
          name: 'Rent',
          dueDate: '2026-11-01',
          amount: 1450,
          category: 'Housing',
          accountId: 'acct-main',
        },
      ],
    });
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[3].billsCents).toBe(145000);
    expect(rows[3].bills[0].isForecast).toBe(true);
  });

  it('puts overdue bills still owed into the first row', () => {
    const bills = facts([expense({ dueDate: '2026-10-01', amount: 75 })]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[0]).toMatchObject({ billsCents: 7500, overdueCount: 1 });
  });

  it('reports how much of the first row is overdue and from the account', () => {
    // Matches the test data the card was checked with: Checking $480,
    // Internet $60 overdue, Electric $110 due before payday.
    const bills = facts([
      expense({ id: 'internet', dueDate: '2026-10-10', amount: 60 }),
      expense({ id: 'elec', dueDate: '2026-10-15', amount: 110 }),
    ]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[0]).toMatchObject({
      leftCents: 31000,
      overdueFromAccountCents: 6000,
    });
  });

  it('leaves an overdue card charge out of the overdue amount', () => {
    const bills = facts([
      expense({
        dueDate: '2026-10-10',
        amount: 60,
        accountId: null,
        creditCardId: 'card-1',
      }),
    ]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[0]).toMatchObject({
      overdueCount: 1,
      overdueFromAccountCents: 0,
      leftCents: 48000,
    });
  });

  it('reports no overdue amount on later rows', () => {
    const bills = facts([expense({ dueDate: '2026-10-10', amount: 60 })]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows.slice(1).every(r => r.overdueFromAccountCents === 0)).toBe(
      true,
    );
  });

  it('subtracts only what is still owed on a partly paid bill', () => {
    const bills = facts([
      expense({ dueDate: '2026-10-15', amount: 200, paidAmount: 50 }),
    ]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[0].leftCents).toBe(48000 - 15000);
  });

  it('never subtracts a paid bill', () => {
    const bills = facts([
      expense({ dueDate: '2026-10-15', amount: 90, paidAmount: 112 }),
    ]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[0]).toMatchObject({ billsCents: 0, leftCents: 48000 });
    expect(rows[0].bills).toEqual([]);
  });

  it('shows a card-charged bill but does not take it from the account', () => {
    const bills = facts([
      expense({
        dueDate: '2026-10-15',
        amount: 60,
        accountId: null,
        creditCardId: 'card-1',
      }),
    ]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[0]).toMatchObject({
      billsCents: 6000,
      fromAccountCents: 0,
      leftCents: 48000,
    });
  });

  it('does not take a bill paid from another account', () => {
    const bills = facts([
      expense({ dueDate: '2026-10-15', amount: 60, accountId: 'acct-savings' }),
    ]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[0].leftCents).toBe(48000);
  });

  it('assumes a bill with no funding source comes from the default account', () => {
    const bills = facts([
      expense({ dueDate: '2026-10-15', amount: 60, accountId: null }),
    ]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[0].leftCents).toBe(42000);
  });

  it('never adds a paycheck for a payday that is today or earlier', () => {
    // generateDueIncome has already made today's paycheck a pending row,
    // which is in the starting balance; adding it on the row would count it
    // twice.
    const { rows } = buildPaycheckForecast({
      ...base,
      today: '2026-10-16',
      payDates: ['2026-10-16', '2026-10-23', '2026-10-30'],
      bills: [],
    });
    expect(rows.map(r => r.incomeCents)).toEqual([0, 0, 110000]);
  });

  it('leaves paychecks out when they land in a different account', () => {
    const { rows, paycheckCounts } = buildPaycheckForecast({
      ...base,
      paycheck: { ...base.paycheck, accountId: 'acct-other' },
      bills: [],
    });
    expect(paycheckCounts).toBe(false);
    expect(rows.every(r => r.incomeCents === 0)).toBe(true);
  });

  it('works with no paycheck set up', () => {
    const bills = facts([expense({ dueDate: '2026-10-20', amount: 100 })]);
    const { rows, paycheckCounts } = buildPaycheckForecast({
      ...base,
      paycheck: null,
      bills,
    });
    expect(paycheckCounts).toBe(false);
    expect(rows[1]).toMatchObject({ billsCents: 10000, leftCents: 38000 });
  });

  it('goes negative rather than stopping at zero', () => {
    const bills = facts([expense({ dueDate: '2026-10-15', amount: 600 })]);
    const { rows } = buildPaycheckForecast({ ...base, bills });
    expect(rows[0].leftCents).toBe(-12000);
  });

  it('leaves the bill facts it was given unchanged', () => {
    const bills = facts([expense({ dueDate: '2026-10-15', amount: 60 })]);
    const before = JSON.stringify(bills);
    buildPaycheckForecast({ ...base, bills });
    expect(JSON.stringify(bills)).toBe(before);
  });
});

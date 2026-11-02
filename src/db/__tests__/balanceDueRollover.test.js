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

// A card's or loan's unpaid Balance Due stays separate while it's still the
// month its bill was due; from the 1st of a later month it is added to that
// month's bill. The card uses a custom $200 payment, due the 25th.
const now = '2026-09-01T00:00:00.000Z';
const stamp = { createdAt: now, updatedAt: now, deletedAt: null };

const setToday = (y, m, d) =>
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(y, m - 1, d) });

const card = {
  id: 'visa',
  name: 'Visa',
  balance: 2000,
  creditLimit: 5000,
  interestRate: 20,
  dueDate: '2026-09-25',
  minimumPayment: 35,
  customPaymentAmount: 200,
  ...stamp,
};
const template = {
  id: 'tpl-visa',
  name: 'Visa Payment',
  baseAmount: 200,
  frequency: 'monthly',
  intervalValue: 1,
  intervalUnit: 'months',
  startDate: '2026-08-25',
  nextDueDate: '2026-09-25',
  category: 'Credit Card Payment',
  targetCreditCardId: 'visa',
  accountId: 'checking',
  isActive: true,
  isVariableAmount: true,
  ...stamp,
};
const sepBill = {
  id: 'bill-sep',
  name: 'Visa Payment',
  dueDate: '2026-09-25',
  amount: 200,
  paidAmount: 0,
  status: 'pending',
  category: 'Credit Card Payment',
  accountId: 'checking',
  creditCardId: null,
  targetCreditCardId: 'visa',
  recurringTemplateId: 'tpl-visa',
  ...stamp,
};

const balanceDue = async () =>
  db.fixedExpenses.filter(e => e.name === 'Visa Payment (Balance Due)').first();
const billDue = date =>
  db.fixedExpenses
    .filter(
      e =>
        !e.deletedAt &&
        e.recurringTemplateId === 'tpl-visa' &&
        e.dueDate === date,
    )
    .first();

// Skip September's bill and choose "pay it later": a $200 Balance Due.
const skipSeptember = () =>
  dbHelpers.resolveCycle('bill-sep', {
    paidAmount: 0,
    shortfallOutcome: 'deferred',
  });

describe('Balance Due roll-over', () => {
  beforeEach(async () => {
    setToday(2026, 9, 20);
    await Promise.all(
      [
        db.accounts,
        db.creditCards,
        db.loans,
        db.fixedExpenses,
        db.recurringExpenseTemplates,
        db.recurringResolutionLog,
        db.pendingTransactions,
        db.cardPayments,
        db.auditLogs,
        db.paycheckSettings,
      ].map(table => table.clear()),
    );
    await db.accounts.put({
      id: 'checking',
      name: 'Checking',
      type: 'checking',
      currentBalance: 5000,
      isDefault: true,
      ...stamp,
    });
    await db.creditCards.put(card);
    await db.recurringExpenseTemplates.put(template);
    await db.fixedExpenses.put(sepBill);
    await skipSeptember();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays a separate bill while it is still September', async () => {
    setToday(2026, 9, 30);
    expect(await dbHelpers.rollOverBalanceDues('2026-09-30')).toBe(0);
    expect(await balanceDue()).toMatchObject({
      amount: 200,
      status: 'pending',
    });
  });

  it('does not roll into another bill in the same month', async () => {
    await db.fixedExpenses.put({
      ...sepBill,
      id: 'bill-sep-2',
      dueDate: '2026-09-30',
    });
    setToday(2026, 9, 28);
    expect(await dbHelpers.rollOverBalanceDues('2026-09-28')).toBe(0);
    expect((await db.fixedExpenses.get('bill-sep-2')).amount).toBe(200);
  });

  it('on Oct 1 it is added to October’s bill and closed', async () => {
    setToday(2026, 10, 1);
    expect(await dbHelpers.rollOverBalanceDues('2026-10-01')).toBe(1);

    expect(await billDue('2026-10-25')).toMatchObject({
      amount: 400,
      paidAmount: 0,
    });
    expect(await balanceDue()).toMatchObject({
      amount: 0,
      status: 'paid',
      rolledCents: 20000,
      rolledFromMonth: '2026-09',
    });
  });

  it('only the unpaid part rolls', async () => {
    const due = await balanceDue();
    await dbHelpers.applyExpensePaymentChangeAtomic(due.id, { paidAmount: 30 });
    setToday(2026, 10, 1);
    await dbHelpers.rollOverBalanceDues('2026-10-01');

    expect((await billDue('2026-10-25')).amount).toBe(370);
    expect(await balanceDue()).toMatchObject({
      amount: 30,
      paidAmount: 30,
      status: 'paid',
    });
  });

  it('nothing rolls if it was paid in time', async () => {
    const due = await balanceDue();
    await dbHelpers.applyExpensePaymentChangeAtomic(due.id, {
      paidAmount: 200,
    });
    setToday(2026, 10, 1);
    expect(await dbHelpers.rollOverBalanceDues('2026-10-01')).toBe(0);
  });

  it('running it again changes nothing', async () => {
    setToday(2026, 10, 1);
    await dbHelpers.rollOverBalanceDues('2026-10-01');
    expect(await dbHelpers.rollOverBalanceDues('2026-10-01')).toBe(0);
    expect((await billDue('2026-10-25')).amount).toBe(400);
  });

  it('two runs at once make one October bill, not two', async () => {
    setToday(2026, 10, 1);
    await Promise.all([
      dbHelpers.rollOverBalanceDues('2026-10-01'),
      dbHelpers.rollOverBalanceDues('2026-10-01'),
    ]);
    const octBills = await db.fixedExpenses
      .filter(e => !e.deletedAt && e.dueDate === '2026-10-25')
      .toArray();
    expect(octBills).toHaveLength(1);
    expect(octBills[0].amount).toBe(400);
  });

  it('stays separate if October’s bill is already settled', async () => {
    setToday(2026, 10, 1);
    await dbHelpers.materializeCurrentCycle('tpl-visa', { allowFuture: true });
    const oct = await billDue('2026-10-25');
    await dbHelpers.resolveCycle(oct.id, { paidAmount: 200 });
    expect(await dbHelpers.rollOverBalanceDues('2026-10-01')).toBe(0);
    expect((await balanceDue()).amount).toBe(200);
  });

  it('editing the card keeps the rolled amount on the bill', async () => {
    setToday(2026, 10, 1);
    await dbHelpers.rollOverBalanceDues('2026-10-01');
    const { updatedAt } = await db.creditCards.get('visa');
    await dbHelpers.updateCreditCard(
      'visa',
      { customPaymentAmount: 300 },
      updatedAt,
    );
    expect((await billDue('2026-10-25')).amount).toBe(500);
  });

  it('undoing September’s payment puts everything back', async () => {
    setToday(2026, 10, 1);
    await dbHelpers.rollOverBalanceDues('2026-10-01');
    await dbHelpers.undoLastResolution('tpl-visa');

    expect((await billDue('2026-10-25')).amount).toBe(200);
    expect((await balanceDue()).deletedAt).toBeTruthy();
    expect(await db.fixedExpenses.get('bill-sep')).toMatchObject({
      paidAmount: 0,
      status: 'pending',
    });
  });

  it('refuses that undo once the bill it rolled into is paid', async () => {
    setToday(2026, 10, 1);
    await dbHelpers.rollOverBalanceDues('2026-10-01');
    const oct = await billDue('2026-10-25');
    await db.fixedExpenses.update(oct.id, { status: 'paid' });
    await expect(dbHelpers.undoLastResolution('tpl-visa')).rejects.toThrow(
      /added to a later bill that has been paid/,
    );
    expect((await balanceDue()).deletedAt).toBeNull();
  });

  it('lists what rolled into each bill, for its note', async () => {
    setToday(2026, 10, 1);
    await dbHelpers.rollOverBalanceDues('2026-10-01');
    const oct = await billDue('2026-10-25');
    const rolled = await dbHelpers.getRolledBalanceDues();
    expect(rolled.get(oct.id)).toEqual([
      { cents: 20000, fromMonth: '2026-09' },
    ]);
  });

  it('does not roll a Balance Due that is not a card or loan bill', async () => {
    await db.fixedExpenses.put({
      id: 'rent-bd',
      name: 'Rent (Balance Due)',
      dueDate: '2026-09-28',
      amount: 300,
      paidAmount: 0,
      status: 'pending',
      category: 'Housing',
      accountId: 'checking',
      ...stamp,
    });
    await db.recurringResolutionLog.put({
      id: 'log-rent',
      templateId: 'tpl-rent',
      expenseId: 'rent-sep',
      adjustmentExpenseId: 'rent-bd',
      cycleDueDate: '2026-09-01',
      resolvedAt: now,
      ...stamp,
    });
    setToday(2026, 10, 1);
    await dbHelpers.rollOverBalanceDues('2026-10-01');
    expect((await db.fixedExpenses.get('rent-bd')).amount).toBe(300);
  });

  it('works for a loan too', async () => {
    await db.loans.put({
      id: 'car',
      name: 'Car Loan',
      lender: 'Bank',
      balance: 12000,
      interestRate: 6,
      dueDate: '2026-09-25',
      targetPayoffDate: '2028-10-25',
      originalLoanAmount: 20000,
      originalTermMonths: 60,
      originalScheduledPayment: 350,
      originalMaturityDate: '2029-01-25',
      customPaymentAmount: 500,
      interestAccruedThrough: null,
      ...stamp,
    });
    await db.recurringExpenseTemplates.put({
      ...template,
      id: 'tpl-car',
      name: 'Car Payment',
      baseAmount: 500,
      category: 'Loan Payment',
      targetCreditCardId: null,
      targetLoanId: 'car',
    });
    await db.fixedExpenses.put({
      ...sepBill,
      id: 'car-sep',
      name: 'Car Payment',
      amount: 500,
      category: 'Loan Payment',
      targetCreditCardId: null,
      targetLoanId: 'car',
      recurringTemplateId: 'tpl-car',
    });
    await dbHelpers.resolveCycle('car-sep', {
      paidAmount: 0,
      shortfallOutcome: 'deferred',
    });
    setToday(2026, 10, 1);
    await dbHelpers.rollOverBalanceDues('2026-10-01');
    const octLoan = await db.fixedExpenses
      .filter(
        e =>
          !e.deletedAt &&
          e.recurringTemplateId === 'tpl-car' &&
          e.dueDate === '2026-10-25',
      )
      .first();
    expect(octLoan.amount).toBe(1000);

    // Changing the loan's payment keeps the rolled amount too.
    await dbHelpers.setLoanPaymentPlan(
      'car',
      600,
      (await db.loans.get('car')).updatedAt,
    );
    expect((await db.fixedExpenses.get(octLoan.id)).amount).toBe(1100);
  });
});

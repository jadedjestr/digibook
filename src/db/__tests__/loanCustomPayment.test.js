import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { db, dbHelpers, foldLoanOverridesIntoLoans } from '../database-clean';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// A custom monthly payment for loans, the twin of cards' customPaymentAmount.
const now = '2026-10-01T00:00:00.000Z';
const stamp = { createdAt: now, updatedAt: now, deletedAt: null };

const loan = {
  id: 'car',
  name: 'Car Loan',
  lender: 'Bank',
  balance: 12000,
  interestRate: 6,
  dueDate: '2026-10-25',
  targetPayoffDate: '2028-10-25',
  originalLoanAmount: 20000,
  originalTermMonths: 60,
  originalScheduledPayment: 350,
  originalMaturityDate: '2029-01-25',
  interestAccruedThrough: null,
  ...stamp,
};
const template = {
  id: 'tpl-car',
  name: 'Car Loan Payment',
  baseAmount: 500,
  frequency: 'monthly',
  intervalValue: 1,
  intervalUnit: 'months',
  startDate: '2026-09-25',
  nextDueDate: '2026-10-25',
  category: 'Loan Payment',
  targetLoanId: 'car',
  accountId: 'checking',
  isActive: true,
  isVariableAmount: true,
  ...stamp,
};
const bill = (id, overrides = {}) => ({
  id,
  name: 'Car Loan Payment',
  dueDate: '2026-10-25',
  amount: 500,
  paidAmount: 0,
  status: 'pending',
  category: 'Loan Payment',
  accountId: 'checking',
  creditCardId: null,
  targetLoanId: 'car',
  recurringTemplateId: 'tpl-car',
  ...stamp,
  ...overrides,
});

const calculated = () =>
  dbHelpers.calculateRequiredLoanPayment(12000, 6, '2026-10-25', '2028-10-25')
    .payment;
const novEstimate = async () =>
  (await dbHelpers.getVirtualLedger('tpl-car', '2026-11-01', '2026-11-30'))[0]
    .estimatedAmount;
const updatedAt = async () => (await db.loans.get('car')).updatedAt;

describe('custom loan payment', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 10) });
    await Promise.all(
      [
        db.loans,
        db.accounts,
        db.fixedExpenses,
        db.recurringExpenseTemplates,
        db.recurringResolutionLog,
        db.auditLogs,
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
    await db.loans.put(loan);
    await db.recurringExpenseTemplates.put(template);
    await db.fixedExpenses.bulkPut([
      bill('oct'),
      bill('sep', { dueDate: '2026-09-25', paidAmount: 500, status: 'paid' }),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('setting it updates this month’s unpaid bill now, and nothing paid', async () => {
    await dbHelpers.setLoanPaymentPlan('car', 650, await updatedAt());

    expect((await db.fixedExpenses.get('oct')).amount).toBe(650);
    expect((await db.fixedExpenses.get('sep')).amount).toBe(500);
    expect((await db.loans.get('car')).customPaymentAmount).toBe(650);
  });

  it('leaves the payment template exactly as it was', async () => {
    const before = await db.recurringExpenseTemplates.get('tpl-car');
    await dbHelpers.setLoanPaymentPlan('car', 650, await updatedAt());
    expect(await db.recurringExpenseTemplates.get('tpl-car')).toEqual(before);
  });

  it('prices future cycles the same way the bill was repriced', async () => {
    await dbHelpers.setLoanPaymentPlan('car', 650, await updatedAt());
    expect(await novEstimate()).toBe(
      (await db.fixedExpenses.get('oct')).amount,
    );
  });

  it('switching back restores the calculated payment', async () => {
    await dbHelpers.setLoanPaymentPlan('car', 650, await updatedAt());
    await dbHelpers.setLoanPaymentPlan('car', null, await updatedAt());
    expect((await db.fixedExpenses.get('oct')).amount).toBe(calculated());
    expect(await novEstimate()).toBe(calculated());
  });

  it('never asks for more than is left on the loan', async () => {
    await db.loans.update('car', { balance: 180 });
    await dbHelpers.setLoanPaymentPlan('car', 500, await updatedAt());
    expect((await db.fixedExpenses.get('oct')).amount).toBe(180);
  });

  it('on a tracked loan the last payment includes the interest owed', async () => {
    await db.loans.update('car', {
      balance: 180,
      unpaidInterest: 2,
      interestAccruedThrough: '2026-10-01',
      interestStateVersion: 1,
    });
    await dbHelpers.setLoanPaymentPlan('car', 500, await updatedAt());
    const amount = (await db.fixedExpenses.get('oct')).amount;
    const { totalOwedToday } = dbHelpers.computeLoanInterest(
      await db.loans.get('car'),
      '2026-10-25',
    );
    expect(amount).toBe(totalOwedToday);
    expect(amount).toBeGreaterThan(182);
  });

  it('on a tracked loan leaves the interest state and undo receipt alone', async () => {
    const receipt = { version: 2, status: 'active', operationId: 'op-1' };
    await db.loans.update('car', {
      unpaidInterest: 0,
      interestAccruedThrough: '2026-10-01',
      interestStateVersion: 3,
      lastInterestOperation: receipt,
    });
    await dbHelpers.setLoanPaymentPlan('car', 650, await updatedAt());
    expect(await db.loans.get('car')).toMatchObject({
      interestStateVersion: 3,
      lastInterestOperation: receipt,
    });
  });

  it('rejects a zero, negative or unreadable amount and changes nothing', async () => {
    for (const bad of [0, -5, NaN]) {
      await expect(
        dbHelpers.setLoanPaymentPlan('car', bad, await updatedAt()),
      ).rejects.toThrow(/greater than 0/);
    }
    expect((await db.fixedExpenses.get('oct')).amount).toBe(500);
    expect((await db.loans.get('car')).customPaymentAmount).toBeUndefined();
  });

  it('no longer reads a payment template’s old override', async () => {
    await db.recurringExpenseTemplates.update('tpl-car', {
      minimumPaymentOverride: 999,
    });
    expect(await novEstimate()).toBe(calculated());
  });

  it('a new loan with a custom payment gets that payment as its first bill', async () => {
    const {
      id: _id,
      interestAccruedThrough: _untracked,
      createdAt: _c,
      updatedAt: _u,
      deletedAt: _d,
      ...fields
    } = loan;
    const id = await dbHelpers.addLoan({
      ...fields,
      name: 'Boat',
      customPaymentAmount: 425,
    });
    await dbHelpers.createExpenseForLoan(id, 'checking');
    const first = await db.fixedExpenses
      .filter(e => e.targetLoanId === id)
      .first();
    expect(first.amount).toBe(425);
  });

  it('a new loan with a zero custom payment is rejected', async () => {
    const {
      id: _id,
      interestAccruedThrough: _untracked,
      createdAt: _c,
      updatedAt: _u,
      deletedAt: _d,
      ...fields
    } = loan;
    await expect(
      dbHelpers.addLoan({ ...fields, name: 'Boat', customPaymentAmount: 0 }),
    ).rejects.toThrow(/greater than 0/);
    expect(await db.loans.filter(l => l.name === 'Boat').count()).toBe(0);
  });

  describe('getLoanPaymentPlan', () => {
    it('flags a payment below the lender’s required payment', async () => {
      const plan = await dbHelpers.getLoanPaymentPlan({
        ...loan,
        customPaymentAmount: 300,
      });
      expect(plan).toMatchObject({
        mode: 'custom',
        billAmount: 300,
        belowLenderPayment: true,
        lenderPayment: 350,
        belowMonthlyInterest: false,
      });
      expect(plan.projectedPayoffDate).toBeTruthy();
    });

    it('flags a payment that does not cover the monthly interest', async () => {
      const plan = await dbHelpers.getLoanPaymentPlan({
        ...loan,
        customPaymentAmount: 50,
      });
      expect(plan.monthlyInterest).toBe(60);
      expect(plan.belowMonthlyInterest).toBe(true);
      expect(plan.projectedPayoffDate).toBeNull();
    });

    it('reports the calculated amount alongside the custom one', async () => {
      const plan = await dbHelpers.getLoanPaymentPlan({
        ...loan,
        customPaymentAmount: 650,
      });
      expect(plan.calculatedAmount).toBe(calculated());
      expect(plan.belowLenderPayment).toBe(false);
    });
  });

  describe('moving old template overrides onto loans', () => {
    it('copies an override onto its loan and leaves the template alone', () => {
      const templates = [{ ...template, minimumPaymentOverride: 450 }];
      const [moved] = foldLoanOverridesIntoLoans([loan], templates);
      expect(moved.customPaymentAmount).toBe(450);
      expect(templates[0].minimumPaymentOverride).toBe(450);
    });

    it('keeps a custom amount the loan already has', () => {
      const [kept] = foldLoanOverridesIntoLoans(
        [{ ...loan, customPaymentAmount: 600 }],
        [{ ...template, minimumPaymentOverride: 450 }],
      );
      expect(kept.customPaymentAmount).toBe(600);
    });

    it('restoring an older backup moves its overrides too', async () => {
      const data = await dbHelpers.exportData();
      data.version = 14;
      data.recurringExpenseTemplates = data.recurringExpenseTemplates.map(t =>
        t.id === 'tpl-car' ? { ...t, minimumPaymentOverride: 450 } : t,
      );
      await dbHelpers.importData(data);
      expect((await db.loans.get('car')).customPaymentAmount).toBe(450);
    });
  });
});

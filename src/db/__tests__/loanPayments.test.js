import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { computeLoanInterest } from '../../utils/loanInterest';
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

// "Pay extra" on loans: the card rules, plus interest first on loans that
// track interest. The loan uses a custom $500 payment so bills are exact.
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
  customPaymentAmount: 500,
  interestAccruedThrough: null,
  ...stamp,
};
const tracking = {
  unpaidInterest: 20,
  interestAccruedThrough: '2026-10-01',
  interestStateVersion: 4,
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
const octBill = {
  id: 'bill-oct',
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
};

const pay = (amount, extra = {}) =>
  dbHelpers.recordCardPayment({
    loanId: 'car',
    accountId: 'checking',
    amount,
    paymentDate: '2026-10-10',
    cleared: true,
    ...extra,
  });
const loanNow = () => db.loans.get('car');
const checkingNow = async () =>
  (await db.accounts.get('checking')).currentBalance;
const billAmount = async () => (await db.fixedExpenses.get('bill-oct')).amount;
const track = () => db.loans.update('car', tracking);

describe('extra loan payments', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 10) });
    await Promise.all(
      [
        db.accounts,
        db.loans,
        db.creditCards,
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
    await db.loans.put(loan);
    await db.recurringExpenseTemplates.put(template);
    await db.fixedExpenses.put(octBill);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('a loan without interest tracking', () => {
    it('cleared: account and principal move once; the bill shrinks', async () => {
      await pay(200);
      expect(await checkingNow()).toBe(4800);
      expect((await loanNow()).balance).toBe(11800);
      expect(await billAmount()).toBe(300);
    });

    it('sent: nothing moves until it clears', async () => {
      const id = await pay(200, { cleared: false });
      expect((await loanNow()).balance).toBe(12000);
      expect(await billAmount()).toBe(300);
      await dbHelpers.clearCardPayment(id);
      expect((await loanNow()).balance).toBe(11800);
      expect(await checkingNow()).toBe(4800);
    });

    it('undo restores the account, the loan and the bill', async () => {
      const id = await pay(600);
      await dbHelpers.undoCardPayment(id);
      expect(await checkingNow()).toBe(5000);
      expect((await loanNow()).balance).toBe(12000);
      expect(await db.fixedExpenses.get('bill-oct')).toMatchObject({
        amount: 500,
        status: 'pending',
      });
    });

    it('blocks more than the loan owes', async () => {
      await expect(pay(12000.01)).rejects.toThrow(/more than Car Loan owes/);
      expect((await loanNow()).balance).toBe(12000);
    });
  });

  describe('an interest-tracked loan', () => {
    beforeEach(track);

    it('pays interest first, then principal', async () => {
      const before = await loanNow();
      const expected = computeLoanInterest(before, '2026-10-10', 200);
      await pay(200);
      expect(await loanNow()).toMatchObject({
        balance: expected.principalAfter,
        unpaidInterest: expected.interestAfter,
        interestAccruedThrough: '2026-10-10',
        interestStateVersion: 5,
      });
      expect(expected.interestPaid).toBeGreaterThan(20);
      expect(await checkingNow()).toBe(4800);
    });

    it('a sent payment posts its interest split when it clears', async () => {
      const id = await pay(200, { cleared: false });
      expect((await loanNow()).interestStateVersion).toBe(4);
      await dbHelpers.clearCardPayment(id);
      expect((await loanNow()).interestStateVersion).toBe(5);
      expect((await db.cardPayments.get(id)).loanAfter).toBeTruthy();
    });

    it('blocks more than the payoff amount, interest included', async () => {
      const { totalOwedToday } = computeLoanInterest(
        await loanNow(),
        '2026-10-10',
      );
      await expect(pay(totalOwedToday + 0.01)).rejects.toThrow(/owes/);
      await expect(pay(totalOwedToday)).resolves.toBeTruthy();
    });

    it('undo puts the loan back exactly', async () => {
      const before = await loanNow();
      const id = await pay(200);
      await dbHelpers.undoCardPayment(id);
      expect(await loanNow()).toMatchObject({
        balance: before.balance,
        unpaidInterest: before.unpaidInterest,
        interestAccruedThrough: before.interestAccruedThrough,
      });
      expect(await checkingNow()).toBe(5000);
    });

    it('undo is refused once something newer posted to the loan', async () => {
      const first = await pay(100);
      await pay(100);
      await expect(dbHelpers.undoCardPayment(first)).rejects.toThrow(
        /newer activity on this loan/,
      );
      expect((await db.cardPayments.get(first)).deletedAt).toBeNull();
    });

    it('an older payment receipt can no longer be undone, with a plain reason', async () => {
      const current = await loanNow();
      await db.loans.update('car', {
        lastInterestOperation: {
          version: 2,
          status: 'active',
          operationId: 'op-older',
          versionAfter: current.interestStateVersion,
          after: {
            balance: current.balance,
            unpaidInterest: current.unpaidInterest,
            interestAccruedThrough: current.interestAccruedThrough,
            interestRate: current.interestRate,
          },
        },
      });
      await pay(100);
      await expect(
        dbHelpers.undoLastLoanInterestOperation('car', 'op-older'),
      ).rejects.toThrow(/newer activity on this loan/);
    });

    it('a bill it covered reopens cleanly when the payment is deleted', async () => {
      const id = await pay(500, { cleared: false });
      expect(await db.fixedExpenses.get('bill-oct')).toMatchObject({
        amount: 0,
        status: 'paid',
      });
      await dbHelpers.deleteCardPayment(id);
      expect(await db.fixedExpenses.get('bill-oct')).toMatchObject({
        amount: 500,
        status: 'pending',
      });
      expect(
        (await db.recurringExpenseTemplates.get('tpl-car')).nextDueDate,
      ).toBe('2026-10-25');
    });
  });

  it('changing the custom payment keeps the extra payment’s reduction', async () => {
    await pay(200);
    await dbHelpers.setLoanPaymentPlan('car', 650, (await loanNow()).updatedAt);
    expect(await billAmount()).toBe(450);
  });

  it('shows in the loan’s payment history', async () => {
    await pay(200, { cleared: false });
    const history = await dbHelpers.getCardPaymentHistory('car', 'loan');
    expect(history.map(h => [h.kind, h.status, h.amount])).toEqual([
      ['extra', 'sent', 200],
    ]);
  });

  it('is labelled as a loan payment on Pending Transactions', async () => {
    await pay(200, { cleared: false });
    const [pending] = await db.pendingTransactions.toArray();
    expect(pending).toMatchObject({
      category: 'Loan Payment',
      description: 'Car Loan payment (extra)',
      amount: -200,
    });
  });

  describe('import checks', () => {
    it('rejects a loan payment pointing at a missing loan', async () => {
      await pay(200);
      const data = await dbHelpers.exportData();
      data.cardPayments[0].loanId = 'missing';
      const result = await dbHelpers.validateImportData(data);
      expect(result.errors.join(' ')).toMatch(/invalid loanId/);
    });

    it('rejects a payment naming both a card and a loan', async () => {
      await pay(200);
      const data = await dbHelpers.exportData();
      data.cardPayments[0].creditCardId = 'visa';
      const result = await dbHelpers.validateImportData(data);
      expect(result.errors.join(' ')).toMatch(/both creditCardId and loanId/);
    });
  });
});

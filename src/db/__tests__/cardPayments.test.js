import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getProjectedBalance } from '../../utils/accountUtils';
import {
  buildPaycheckForecast,
  toBillFacts,
} from '../../utils/categoryBreakdown';
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

// Extra credit-card payments ("Pay extra"). The card uses a custom $200
// monthly payment so every bill amount is exact; its bill is due the 25th.
const now = '2026-10-01T00:00:00.000Z';
const stamp = { createdAt: now, updatedAt: now, deletedAt: null };

const checking = {
  id: 'checking',
  name: 'Checking',
  type: 'checking',
  currentBalance: 1000,
  isDefault: true,
  ...stamp,
};
const savings = {
  id: 'savings',
  name: 'Savings',
  type: 'savings',
  currentBalance: 2000,
  isDefault: false,
  ...stamp,
};
const card = {
  id: 'visa',
  name: 'Visa',
  balance: 2700,
  creditLimit: 5000,
  interestRate: 20,
  dueDate: '2026-10-25',
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
  startDate: '2026-09-25',
  nextDueDate: '2026-10-25',
  category: 'Credit Card Payment',
  targetCreditCardId: 'visa',
  accountId: 'checking',
  isActive: true,
  isVariableAmount: true,
  isAutoCreated: true,
  ...stamp,
};
const octBill = {
  id: 'bill-oct',
  name: 'Visa Payment',
  dueDate: '2026-10-25',
  amount: 200,
  paidAmount: 0,
  status: 'pending',
  category: 'Credit Card Payment',
  accountId: 'checking',
  creditCardId: null,
  targetCreditCardId: 'visa',
  recurringTemplateId: 'tpl-visa',
  isAutoCreated: true,
  ...stamp,
};

const setToday = (y, m, d) =>
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(y, m - 1, d) });

const balances = async () => ({
  checking: (await db.accounts.get('checking')).currentBalance,
  savings: (await db.accounts.get('savings')).currentBalance,
  card: (await db.creditCards.get('visa')).balance,
});
const bill = id => db.fixedExpenses.get(id);
const liveLog = () =>
  db.recurringResolutionLog.filter(e => !e.deletedAt).toArray();
const livePending = () =>
  db.pendingTransactions.filter(t => !t.deletedAt).toArray();

const pay = (amount, extra = {}) =>
  dbHelpers.recordCardPayment({
    creditCardId: 'visa',
    accountId: 'checking',
    amount,
    paymentDate: '2026-10-10',
    cleared: true,
    ...extra,
  });

// Pay the Oct 25 bill in full the normal way (moves $200 from Checking).
const payOctBillNormally = () =>
  dbHelpers.resolveCycle('bill-oct', { paidAmount: 200 });

describe('extra credit card payments', () => {
  beforeEach(async () => {
    setToday(2026, 10, 10);
    await Promise.all(
      [
        db.accounts,
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
    await db.accounts.bulkPut([checking, savings]);
    await db.creditCards.put(card);
    await db.recurringExpenseTemplates.put(template);
    await db.fixedExpenses.put(octBill);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recording', () => {
    it('cleared: moves both balances once and shrinks the bill', async () => {
      await pay(150);

      expect(await balances()).toEqual({
        checking: 850,
        savings: 2000,
        card: 2550,
      });
      const after = await bill('bill-oct');
      expect(after).toMatchObject({
        amount: 50,
        paidAmount: 0,
        status: 'pending',
        dueDate: '2026-10-25',
        accountId: 'checking',
        targetCreditCardId: 'visa',
      });
      expect(await livePending()).toEqual([]);
      expect(await liveLog()).toEqual([]);
      expect(
        (await db.recurringExpenseTemplates.get('tpl-visa')).nextDueDate,
      ).toBe('2026-10-25');
    });

    it('can come from Savings', async () => {
      await pay(100, { accountId: 'savings' });
      expect(await balances()).toEqual({
        checking: 1000,
        savings: 1900,
        card: 2600,
      });
    });

    it('sent: holds the money as pending, moves nothing, still shrinks the bill', async () => {
      const id = await pay(150, { cleared: false });

      expect(await balances()).toEqual({
        checking: 1000,
        savings: 2000,
        card: 2700,
      });
      const [pending] = await livePending();
      expect(pending).toMatchObject({
        accountId: 'checking',
        amount: -150,
        cardPaymentId: id,
      });
      expect((await bill('bill-oct')).amount).toBe(50);
      expect(await db.cardPayments.get(id)).toMatchObject({
        status: 'sent',
        appliedExpenseId: 'bill-oct',
        appliedCents: 15000,
      });
    });

    it('covers the bill when the payment is at least what is owed', async () => {
      await pay(400);

      expect(await balances()).toMatchObject({ checking: 600, card: 2300 });
      expect(await bill('bill-oct')).toMatchObject({
        amount: 0,
        status: 'paid',
      });
      const [entry] = await liveLog();
      expect(entry).toMatchObject({
        expenseId: 'bill-oct',
        coveredByCardPayments: true,
        wasSkipped: false,
        paidAmount: 0,
      });

      // The schedule moves on, like any settled bill.
      expect(
        (await db.recurringExpenseTemplates.get('tpl-visa')).nextDueDate,
      ).toBe('2026-11-25');
    });

    it('blocks a payment larger than the card owes', async () => {
      await expect(pay(2700.01)).rejects.toThrow(/more than Visa owes/);
      expect(await balances()).toMatchObject({ checking: 1000, card: 2700 });
      expect((await bill('bill-oct')).amount).toBe(200);
    });

    it('counts payments on their way toward what the card owes', async () => {
      await pay(2000, { cleared: false });
      await expect(pay(800)).rejects.toThrow(/after payments on their way/);
      await expect(pay(700)).resolves.toBeTruthy();
    });

    it('rejects a zero amount', async () => {
      await expect(pay(0)).rejects.toThrow(/greater than \$0/);
    });
  });

  describe('which bill shrinks', () => {
    it('Oct 20 with the Oct 25 bill already paid: balance only', async () => {
      await payOctBillNormally();
      setToday(2026, 10, 20);
      const id = await pay(150, { paymentDate: '2026-10-20' });

      expect(await balances()).toMatchObject({ checking: 650, card: 2350 });
      expect(await db.cardPayments.get(id)).toMatchObject({
        appliedExpenseId: null,
        appliedCents: 0,
      });

      // No November bill was created early.
      expect(
        await db.fixedExpenses.where('dueDate').equals('2026-11-25').count(),
      ).toBe(0);
    });

    it('Oct 28 with the Oct 25 bill already paid: balance only', async () => {
      await payOctBillNormally();
      setToday(2026, 10, 28);
      const id = await pay(150, { paymentDate: '2026-10-28' });
      expect((await db.cardPayments.get(id)).appliedExpenseId).toBeNull();
    });

    it('Nov 1: creates the Nov 25 bill and shrinks it', async () => {
      await payOctBillNormally();
      setToday(2026, 11, 1);
      const id = await pay(150, { paymentDate: '2026-11-01' });

      const payment = await db.cardPayments.get(id);
      const novBill = await bill(payment.appliedExpenseId);
      expect(novBill).toMatchObject({ dueDate: '2026-11-25', amount: 50 });
    });

    it('Oct 28 with the Oct 25 bill still unpaid (overdue): it shrinks', async () => {
      setToday(2026, 10, 28);
      await pay(150, { paymentDate: '2026-10-28' });
      expect((await bill('bill-oct')).amount).toBe(50);
    });

    it('a second payment in the month takes only what is left', async () => {
      await pay(150);
      const second = await pay(100);
      expect(await db.cardPayments.get(second)).toMatchObject({
        appliedCents: 5000,
      });
      expect(await bill('bill-oct')).toMatchObject({
        amount: 0,
        status: 'paid',
      });
      expect(await balances()).toMatchObject({ card: 2450 });
    });
  });

  describe('clearing', () => {
    it('from the card: moves both balances once and retires the pending row', async () => {
      const id = await pay(150, { cleared: false });
      await dbHelpers.clearCardPayment(id);

      expect(await balances()).toMatchObject({ checking: 850, card: 2550 });
      expect(await livePending()).toEqual([]);
      const [row] = await db.pendingTransactions.toArray();
      expect(row.completedAt).toBeTruthy();
      expect((await bill('bill-oct')).amount).toBe(50);
      await expect(dbHelpers.clearCardPayment(id)).rejects.toThrow(
        /already cleared/,
      );
      expect(await balances()).toMatchObject({ checking: 850, card: 2550 });
    });

    it('from Pending Transactions: the card balance moves too', async () => {
      const id = await pay(150, { cleared: false });
      const [pending] = await livePending();
      await dbHelpers.completePendingTransaction(pending.id);

      expect(await balances()).toMatchObject({ checking: 850, card: 2550 });
      expect((await db.cardPayments.get(id)).status).toBe('cleared');
    });
  });

  describe('fixing mistakes', () => {
    it('editing a sent payment re-applies it from scratch', async () => {
      const id = await pay(150, { cleared: false });
      await dbHelpers.updateCardPayment(id, {
        amount: 100,
        accountId: 'savings',
      });

      expect((await bill('bill-oct')).amount).toBe(100);
      const [pending] = await livePending();
      expect(pending).toMatchObject({ amount: -100, accountId: 'savings' });
      expect(await balances()).toEqual({
        checking: 1000,
        savings: 2000,
        card: 2700,
      });
    });

    it('editing from Pending Transactions goes through the payment', async () => {
      const id = await pay(150, { cleared: false });
      const [pending] = await livePending();
      await dbHelpers.updatePendingTransaction(pending.id, { amount: -120 });
      expect((await db.cardPayments.get(id)).amount).toBe(120);
      expect((await bill('bill-oct')).amount).toBe(80);
    });

    it('deleting a sent payment gives the bill back exactly', async () => {
      const id = await pay(150, { cleared: false });
      await dbHelpers.deleteCardPayment(id);

      expect(await bill('bill-oct')).toMatchObject({
        amount: 200,
        paidAmount: 0,
        status: 'pending',
      });
      expect(await livePending()).toEqual([]);
      expect(await dbHelpers.getCardPayments('visa')).toEqual([]);
    });

    it('deleting a sent payment that covered the bill reopens it', async () => {
      const id = await pay(400, { cleared: false });
      const [pending] = await livePending();
      await dbHelpers.deletePendingTransaction(pending.id);

      expect(await bill('bill-oct')).toMatchObject({
        amount: 200,
        status: 'pending',
      });
      expect(await liveLog()).toEqual([]);
      expect(
        (await db.recurringExpenseTemplates.get('tpl-visa')).nextDueDate,
      ).toBe('2026-10-25');
      expect((await db.cardPayments.get(id)).deletedAt).toBeTruthy();
    });

    it('undoing a cleared payment restores balances and the bill', async () => {
      const id = await pay(400);
      await dbHelpers.undoCardPayment(id);

      expect(await balances()).toEqual({
        checking: 1000,
        savings: 2000,
        card: 2700,
      });
      expect(await bill('bill-oct')).toMatchObject({
        amount: 200,
        status: 'pending',
      });
      expect(await liveLog()).toEqual([]);
    });

    it('refuses to undo once the shrunk bill was paid another way', async () => {
      const id = await pay(150);
      await dbHelpers.resolveCycle('bill-oct', { paidAmount: 50 });
      const before = await balances();

      await expect(dbHelpers.undoCardPayment(id)).rejects.toThrow(
        /Undo that first/,
      );
      expect(await balances()).toEqual(before);
      expect((await db.cardPayments.get(id)).deletedAt).toBeNull();
    });

    it('a cleared payment cannot be edited or deleted, only undone', async () => {
      const id = await pay(150);
      await expect(
        dbHelpers.updateCardPayment(id, { amount: 100 }),
      ).rejects.toThrow(/only be undone/);
      await expect(dbHelpers.deleteCardPayment(id)).rejects.toThrow(
        /only be undone/,
      );
    });
  });

  describe('the bill afterward', () => {
    it('editing the card keeps the reduction', async () => {
      await pay(150);
      const { updatedAt } = await db.creditCards.get('visa');
      await dbHelpers.updateCreditCard(
        'visa',
        { customPaymentAmount: 300 },
        updatedAt,
      );
      expect((await bill('bill-oct')).amount).toBe(150);
    });

    it('next month a custom card goes back to its usual amount', async () => {
      await pay(400);
      const [nov] = await dbHelpers.getVirtualLedger(
        'tpl-visa',
        '2026-11-01',
        '2026-11-30',
      );
      expect(nov).toMatchObject({ state: 'virtual', estimatedAmount: 200 });
    });
  });

  it('a sent payment is not double counted in the paycheck forecast', async () => {
    await pay(150, { cleared: false });
    const accounts = await db.accounts.toArray();
    const pending = await livePending();
    const expenses = await db.fixedExpenses.filter(e => !e.deletedAt).toArray();
    const { rows } = buildPaycheckForecast({
      bills: toBillFacts({ expenses }),
      payDates: ['2026-10-30'],
      today: '2026-10-10',
      startingBalance: getProjectedBalance(
        accounts.find(a => a.id === 'checking'),
        pending,
      ),
      accountId: 'checking',
    });

    // $1,000 - $150 on its way - the $50 left on the bill.
    expect(rows[0].leftCents).toBe(80000);
  });

  describe('history', () => {
    it('lists extra payments and monthly bills, newest first', async () => {
      await payOctBillNormally();
      setToday(2026, 11, 1);
      await pay(150, { paymentDate: '2026-11-01', cleared: false });

      const history = await dbHelpers.getCardPaymentHistory('visa');
      expect(history.map(h => [h.kind, h.status, h.amount])).toEqual([
        ['extra', 'sent', 150],
        ['bill', 'paid', 200],
      ]);
    });

    it('marks a bill covered by extra payments', async () => {
      await pay(400);
      const history = await dbHelpers.getCardPaymentHistory('visa');
      expect(history.find(h => h.kind === 'bill').status).toBe('covered');
    });
  });

  describe('export and import', () => {
    it('round-trips payments and their pending links', async () => {
      const id = await pay(150, { cleared: false });
      const data = await dbHelpers.exportData();
      expect(data.cardPayments).toHaveLength(1);

      await db.cardPayments.clear();
      await db.pendingTransactions.clear();
      await dbHelpers.importData(data);

      expect(await db.cardPayments.get(id)).toMatchObject({ status: 'sent' });
      const [pending] = await livePending();
      expect(pending.cardPaymentId).toBe(id);
    });

    it('rejects a payment pointing at a card that is not in the file', async () => {
      await pay(150, { cleared: false });
      const data = await dbHelpers.exportData();
      data.cardPayments[0].creditCardId = 'missing';
      const result = await dbHelpers.validateImportData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/cardPayments\[0\]/);
    });
  });
});

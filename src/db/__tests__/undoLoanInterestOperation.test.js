import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DateUtils } from '../../utils/dateUtils';
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

// interestAccruedThrough === today means zero elapsed days, so every
// scenario below accrues purely from `unpaidInterest` - deterministic,
// no dependency on wall-clock date drift between test runs.
const TODAY = DateUtils.today();

describe('Loan interest tracking: undo and correction', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
      db.loans.clear(),
      db.categories.clear(),
      db.recurringExpenseTemplates.clear(),
      db.recurringResolutionLog.clear(),
      db.pendingTransactions.clear(),
      db.fixedExpenses.clear(),
      db.monthlyExpenseHistory.clear(),
      db.auditLogs.clear(),
    ]);

    await db.accounts.bulkPut([
      {
        id: 'acct-1',
        name: 'Checking',
        type: 'checking',
        currentBalance: 1000,
        isDefault: true,
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
        dueDate: '2026-02-15',
        targetPayoffDate: '2031-02-15',
        unpaidInterest: 49.32,
        interestAccruedThrough: TODAY,
        interestStateVersion: 0,
        lastInterestOperation: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  async function addOneOffLoanBill(id, amount) {
    await db.fixedExpenses.bulkPut([
      {
        id,
        name: 'Pay Loan',
        dueDate: '2026-02-15',
        amount,
        accountId: 'acct-1',
        creditCardId: null,
        targetLoanId: 'loan-1',
        category: 'Loan Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);
  }

  it('posts a tracked-loan payment: interest first, then principal, and writes a receipt', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });

    const loan = await db.loans.get('loan-1');
    const account = await db.accounts.get('acct-1');

    expect(loan.unpaidInterest).toBeCloseTo(0, 6); // collectible interest paid in full, no residual
    expect(loan.balance).toBeCloseTo(9749.32, 2);
    expect(account.currentBalance).toBe(700); // 1000 - 300
    expect(loan.interestStateVersion).toBe(1);
    expect(loan.lastInterestOperation).toMatchObject({
      operationId: expect.any(String),
      affectedExpenseId: 'bill-1',
      status: 'active',
      cashAmount: 300,
    });
  });

  it('rejects a negative paidAmount edit against a tracked loan directly', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });

    await expect(
      dbHelpers.applyExpensePaymentChangeAtomic('bill-1', { paidAmount: 100 }),
    ).rejects.toThrow(/Correct latest payment|Undo/);
  });

  it('undo restores principal, unpaid interest and accrual date, and refunds once', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });

    const receipt = await dbHelpers.getUndoableLoanOperation('loan-1');
    expect(receipt).toBeTruthy();

    await dbHelpers.undoLastLoanInterestOperation(
      'loan-1',
      receipt.operationId,
    );

    const loan = await db.loans.get('loan-1');
    const account = await db.accounts.get('acct-1');
    const bill = await db.fixedExpenses.get('bill-1');

    expect(loan.balance).toBe(10000);
    expect(loan.unpaidInterest).toBeCloseTo(49.32, 2);
    expect(loan.interestAccruedThrough).toBe(TODAY);
    expect(account.currentBalance).toBe(1000);
    expect(bill.paidAmount).toBe(0);
    expect(bill.status).toBe('pending');
    expect(loan.lastInterestOperation.status).toBe('undone');

    // Retrying the same undo does not refund a second time.
    await expect(
      dbHelpers.undoLastLoanInterestOperation('loan-1', receipt.operationId),
    ).resolves.toMatchObject({ undone: true });
    const accountAfterRetry = await db.accounts.get('acct-1');
    expect(accountAfterRetry.currentBalance).toBe(1000);
  });

  it('blocks undo after a later payment on the same loan', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });
    const firstReceipt = await dbHelpers.getUndoableLoanOperation('loan-1');

    await addOneOffLoanBill('bill-2', 100);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-2', {
      paidAmount: 100,
    });

    await expect(
      dbHelpers.undoLastLoanInterestOperation(
        'loan-1',
        firstReceipt.operationId,
      ),
    ).rejects.toThrow(/Operation ID does not match/);
  });

  it('blocks undo after a direct correction clears the receipt', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });
    const receipt = await dbHelpers.getUndoableLoanOperation('loan-1');
    expect(receipt).toBeTruthy();

    await dbHelpers.updateLoan('loan-1', {
      balance: 9700,
      unpaidInterest: 0,
      interestRate: 6,
      interestAccruedThrough: TODAY,
    });

    const stillUndoable = await dbHelpers.getUndoableLoanOperation('loan-1');
    expect(stillUndoable).toBeNull();

    const loan = await db.loans.get('loan-1');
    expect(loan.interestStateVersion).toBe(2); // 1 from payment, 1 from correction
  });

  it('correctLatestLoanPayment produces the same final state as paying the corrected amount from scratch', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });

    await dbHelpers.correctLatestLoanPayment('loan-1', 'bill-1', 500);

    const corrected = await db.loans.get('loan-1');
    const correctedAccount = await db.accounts.get('acct-1');
    const correctedBill = await db.fixedExpenses.get('bill-1');

    // Compare against paying $500 from scratch on an identical fresh loan.
    await db.loans.update('loan-1', {
      balance: 10000,
      unpaidInterest: 49.32,
      interestAccruedThrough: TODAY,
      interestStateVersion: 0,
      lastInterestOperation: null,
    });
    await db.accounts.update('acct-1', { currentBalance: 1000 });
    await db.fixedExpenses.update('bill-1', {
      paidAmount: 0,
      status: 'pending',
    });

    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 500,
    });
    const freshLoan = await db.loans.get('loan-1');
    const freshAccount = await db.accounts.get('acct-1');

    expect(corrected.balance).toBeCloseTo(freshLoan.balance, 6);
    expect(corrected.unpaidInterest).toBeCloseTo(freshLoan.unpaidInterest, 6);
    expect(correctedAccount.currentBalance).toBe(freshAccount.currentBalance);
    expect(correctedBill.paidAmount).toBe(500);
  });

  it('refuses correctLatestLoanPayment once a newer payment supersedes the receipt', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });
    await addOneOffLoanBill('bill-2', 100);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-2', {
      paidAmount: 100,
    });

    await expect(
      dbHelpers.correctLatestLoanPayment('loan-1', 'bill-1', 500),
    ).rejects.toThrow(/not the most recent payment/);
  });

  it('leaves an untracked loan payment exactly as before (no receipt, negative deltas still allowed)', async () => {
    await db.loans.update('loan-1', {
      interestAccruedThrough: null,
      unpaidInterest: 0,
    });
    await addOneOffLoanBill('bill-1', 180);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 180,
    });

    let loan = await db.loans.get('loan-1');
    expect(loan.balance).toBe(9820); // flat subtraction, no interest split
    expect(loan.lastInterestOperation).toBeNull();

    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 50,
    });
    loan = await db.loans.get('loan-1');
    expect(loan.balance).toBe(9950); // reversed via the flat path, unchanged behavior
  });
});

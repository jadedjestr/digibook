import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  dataManager,
  validateImportedDataV4,
} from '../../services/dataManager';
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

  it('preserves cumulative paid total when correcting a second payment', async () => {
    await addOneOffLoanBill('bill-1', 500);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 100,
    });
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });

    // Correction UI initializes from latest cashAmount (200), not cumulative 300.
    await dbHelpers.correctLatestLoanPayment('loan-1', 'bill-1', 150);
    expect((await db.accounts.get('acct-1')).currentBalance).toBe(750);
    expect((await db.fixedExpenses.get('bill-1')).paidAmount).toBe(250);
  });
  it('retains original date when correcting the next day', async () => {
    const todaySpy = vi.spyOn(DateUtils, 'today').mockReturnValue('2026-02-01');
    try {
      await db.loans.update('loan-1', { interestAccruedThrough: '2026-02-01' });
      await addOneOffLoanBill('bill-1', 300);
      await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
        paidAmount: 300,
      });
      todaySpy.mockReturnValue('2026-02-02');
      await dbHelpers.correctLatestLoanPayment('loan-1', 'bill-1', 200);
      expect((await db.loans.get('loan-1')).balance).toBeCloseTo(9849.32, 2);
      expect((await db.loans.get('loan-1')).interestAccruedThrough).toBe(
        '2026-02-01',
      );
    } finally {
      todaySpy.mockRestore();
    }
  });
  it('rejects a stale undo after a second payment on the same bill', async () => {
    await addOneOffLoanBill('bill-1', 500);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 100,
    });
    const original = await dbHelpers.getUndoableLoanOperation('loan-1');
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });
    await expect(
      dbHelpers.undoLastLoanInterestOperation('loan-1', original.operationId),
    ).rejects.toThrow();
  });
  it('missing account aborts undo instead of restoring only the loan', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });
    await db.accounts.delete('acct-1');
    const receipt = await dbHelpers.getUndoableLoanOperation('loan-1');
    await expect(
      dbHelpers.undoLastLoanInterestOperation('loan-1', receipt.operationId),
    ).rejects.toThrow(/Funding account/);
  });
  it('loan-card undo restores recurring cadence and resolution', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await db.recurringExpenseTemplates.put({
      id: 'tpl-1',
      name: 'Loan',
      baseAmount: 300,
      frequency: 'monthly',
      intervalValue: 1,
      intervalUnit: 'months',
      startDate: '2026-08-14',
      lastGenerated: '2026-08-14',
      nextDueDate: '2026-09-14',
      category: 'Loan Payment',
      accountId: 'acct-1',
      targetLoanId: 'loan-1',
      isActive: true,
      isVariableAmount: true,
    });
    await db.fixedExpenses.update('bill-1', {
      recurringTemplateId: 'tpl-1',
      dueDate: '2026-09-14',
    });
    await dbHelpers.resolveCycle('bill-1', { paidAmount: 300 });
    await dbHelpers.undoLastLoanInterestOperation(
      'loan-1',
      (await dbHelpers.getUndoableLoanOperation('loan-1')).operationId,
    );
    expect((await db.recurringExpenseTemplates.get('tpl-1')).nextDueDate).toBe(
      '2026-09-14',
    );
    expect(
      await db.recurringResolutionLog.filter(x => !x.deletedAt).count(),
    ).toBe(0);
  });
  it('keeps earlier payments when a correction is subsequently undone or set to zero', async () => {
    await addOneOffLoanBill('bill-1', 500);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 100,
    });
    const afterFirst = await db.loans.get('loan-1');
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });
    await dbHelpers.correctLatestLoanPayment('loan-1', 'bill-1', 150);
    const receipt = await dbHelpers.getUndoableLoanOperation('loan-1');
    await dbHelpers.undoLastLoanInterestOperation(
      'loan-1',
      receipt.operationId,
    );
    expect((await db.fixedExpenses.get('bill-1')).paidAmount).toBe(100);
    expect((await db.accounts.get('acct-1')).currentBalance).toBe(900);
    expect((await db.loans.get('loan-1')).balance).toBe(afterFirst.balance);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 200,
    });
    await dbHelpers.correctLatestLoanPayment('loan-1', 'bill-1', 0);
    expect((await db.fixedExpenses.get('bill-1')).paidAmount).toBe(100);
    expect((await db.accounts.get('acct-1')).currentBalance).toBe(900);
  });

  it('deduplicates payment/correction retries and rejects changed or stale requests', async () => {
    await addOneOffLoanBill('bill-1', 500);
    const options = {
      loanRequest: { operationId: 'request-1', expectedVersion: 0 },
    };
    await dbHelpers.applyExpensePaymentChangeAtomic(
      'bill-1',
      { paidAmount: 300 },
      options,
    );
    await dbHelpers.applyExpensePaymentChangeAtomic(
      'bill-1',
      { paidAmount: 300 },
      options,
    );
    expect((await db.accounts.get('acct-1')).currentBalance).toBe(700);
    await expect(
      dbHelpers.applyExpensePaymentChangeAtomic(
        'bill-1',
        { paidAmount: 301 },
        options,
      ),
    ).rejects.toThrow(/changed/);
    const receipt = await dbHelpers.getUndoableLoanOperation('loan-1');
    const correction = {
      operationId: receipt.operationId,
      expectedVersion: 1,
      requestId: 'correction-1',
    };
    await dbHelpers.correctLatestLoanPayment(
      'loan-1',
      'bill-1',
      200,
      correction,
    );
    await dbHelpers.correctLatestLoanPayment(
      'loan-1',
      'bill-1',
      200,
      correction,
    );
    expect((await db.accounts.get('acct-1')).currentBalance).toBe(800);
    await expect(
      dbHelpers.applyExpensePaymentChangeAtomic(
        'bill-1',
        { paidAmount: 300 },
        options,
      ),
    ).rejects.toThrow(/STALE_WRITE/);
  });

  it('rolls back all undo writes if the final loan write fails', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });
    const receipt = await dbHelpers.getUndoableLoanOperation('loan-1');
    const before = await Promise.all([
      db.accounts.toArray(),
      db.loans.toArray(),
      db.fixedExpenses.toArray(),
    ]);
    const failure = vi
      .spyOn(db.loans, 'update')
      .mockRejectedValueOnce(new Error('injected failure'));
    try {
      await expect(
        dbHelpers.undoLastLoanInterestOperation('loan-1', receipt.operationId),
      ).rejects.toThrow('injected failure');
    } finally {
      failure.mockRestore();
    }
    expect(
      await Promise.all([
        db.accounts.toArray(),
        db.loans.toArray(),
        db.fixedExpenses.toArray(),
      ]),
    ).toEqual(before);
  });

  it('preserves raw fractional interest and undo eligibility on a metadata edit', async () => {
    await db.loans.update('loan-1', { unpaidInterest: 0.006 });
    await addOneOffLoanBill('bill-1', 100);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 100,
    });
    const before = await db.loans.get('loan-1');
    expect(before.unpaidInterest).toBeCloseTo(-0.004, 10);
    await dbHelpers.updateLoan('loan-1', { name: 'Renamed loan' });
    const after = await db.loans.get('loan-1');
    expect(after.unpaidInterest).toBe(before.unpaidInterest);
    expect(after.lastInterestOperation).toEqual(before.lastInterestOperation);
    await expect(
      dbHelpers.updateLoan('loan-1', { interestRate: 7 }),
    ).rejects.toThrow(/as-of date together/);
  });

  it('keeps legacy receipts readable but never offers them as safe undo', async () => {
    await db.loans.update('loan-1', {
      lastInterestOperation: { operationId: 'old-bill', status: 'active' },
    });
    expect(await dbHelpers.getUndoableLoanOperation('loan-1')).toBeNull();
    await expect(
      dbHelpers.undoLastLoanInterestOperation('loan-1', 'old-bill'),
    ).rejects.toThrow(/older payment/);
  });

  it('round trips raw interest/receipts and rejects corruption before clearing data', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });
    const saved = JSON.parse(JSON.stringify(await dbHelpers.exportData()));
    await dbHelpers.importData(saved);
    expect(await db.loans.get('loan-1')).toEqual(saved.loans[0]);
    const broken = JSON.parse(JSON.stringify(saved));
    broken.loans[0].lastInterestOperation.cashAmount = 1000;
    await expect(dbHelpers.importData(broken)).rejects.toThrow();
    expect(await db.loans.get('loan-1')).toEqual(saved.loans[0]);
    await dbHelpers.undoLastLoanInterestOperation(
      'loan-1',
      saved.loans[0].lastInterestOperation.operationId,
    );
    const undone = await dbHelpers.exportData();
    await dbHelpers.importData(undone);
    expect((await db.loans.get('loan-1')).lastInterestOperation.status).toBe(
      'undone',
    );
  });

  async function seedRecurring() {
    await addOneOffLoanBill('bill-1', 300);
    await db.recurringExpenseTemplates.put({
      id: 'tpl-1',
      name: 'Loan',
      baseAmount: 300,
      frequency: 'monthly',
      intervalValue: 1,
      intervalUnit: 'months',
      startDate: '2026-08-14',
      lastGenerated: '2026-08-14',
      nextDueDate: '2026-09-14',
      category: 'Loan Payment',
      accountId: 'acct-1',
      targetLoanId: 'loan-1',
      isActive: true,
      isVariableAmount: true,
    });
    await db.fixedExpenses.update('bill-1', {
      recurringTemplateId: 'tpl-1',
      dueDate: '2026-09-14',
    });
    await dbHelpers.resolveCycle('bill-1', { paidAmount: 300 });
  }

  it('corrects a resolved cycle atomically and checks dependent catch-up edits', async () => {
    await seedRecurring();
    await expect(
      dbHelpers.correctLatestLoanPayment('loan-1', 'bill-1', 200),
    ).rejects.toThrow(/reminder/);
    expect((await db.accounts.get('acct-1')).currentBalance).toBe(700);
    await dbHelpers.correctLatestLoanPayment('loan-1', 'bill-1', 200, {
      shortfallOutcome: 'deferred',
    });
    const receipt = await dbHelpers.getUndoableLoanOperation('loan-1');
    expect(receipt.cycle.adjustmentAfter.amount).toBe(100);
    expect(
      await db.recurringResolutionLog.filter(row => !row.deletedAt).count(),
    ).toBe(1);
    expect((await db.accounts.get('acct-1')).currentBalance).toBe(800);
    await db.fixedExpenses.update(receipt.cycle.adjustmentAfter.id, {
      amount: 99,
    });
    await expect(
      dbHelpers.undoLastLoanInterestOperation('loan-1', receipt.operationId),
    ).rejects.toThrow(/catch-up/);
    await db.fixedExpenses.update(receipt.cycle.adjustmentAfter.id, {
      amount: 100,
    });
    await dbHelpers.undoLastLoanInterestOperation(
      'loan-1',
      receipt.operationId,
    );
    expect((await db.accounts.get('acct-1')).currentBalance).toBe(1000);
    expect((await db.recurringExpenseTemplates.get('tpl-1')).nextDueDate).toBe(
      '2026-09-14',
    );
    expect(
      (await db.fixedExpenses.get(receipt.cycle.adjustmentAfter.id)).deletedAt,
    ).toBeTruthy();
  });

  it('zero correction reopens the recurring cycle without creating a skip', async () => {
    await seedRecurring();
    await dbHelpers.correctLatestLoanPayment('loan-1', 'bill-1', 0);
    expect((await db.recurringExpenseTemplates.get('tpl-1')).nextDueDate).toBe(
      '2026-09-14',
    );
    expect(
      await db.recurringResolutionLog.filter(row => !row.deletedAt).count(),
    ).toBe(0);
    expect((await db.fixedExpenses.get('bill-1')).paidAmount).toBe(0);
  });

  it('skip produces a receipt and can be undone without posting interest', async () => {
    await seedRecurring();
    let receipt = await dbHelpers.getUndoableLoanOperation('loan-1');
    await dbHelpers.undoLastLoanInterestOperation(
      'loan-1',
      receipt.operationId,
    );
    await dbHelpers.resolveCycle('bill-1', {
      paidAmount: 0,
      shortfallOutcome: 'forgiven',
    });
    receipt = await dbHelpers.getUndoableLoanOperation('loan-1');
    expect(receipt.cashAmount).toBe(0);
    expect(receipt.before).toEqual(receipt.after);
    await dbHelpers.undoLastResolution('tpl-1');
    expect((await db.recurringExpenseTemplates.get('tpl-1')).nextDueDate).toBe(
      '2026-09-14',
    );
  });

  it('restores through both the JSON import and actual backup-manager entry points', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });
    const snapshot = JSON.parse(JSON.stringify(await dbHelpers.exportData()));
    await dataManager._applyValidatedImport(
      validateImportedDataV4(snapshot),
      'json',
    );
    expect((await db.loans.get('loan-1')).lastInterestOperation).toEqual(
      snapshot.loans[0].lastInterestOperation,
    );
    const id = await dataManager.backupManager.createBackup('loan-safety-test');
    const receipt = await dbHelpers.getUndoableLoanOperation('loan-1');
    await dbHelpers.undoLastLoanInterestOperation(
      'loan-1',
      receipt.operationId,
    );
    await dataManager.backupManager.restoreBackup(id);
    expect((await db.loans.get('loan-1')).lastInterestOperation).toEqual(
      snapshot.loans[0].lastInterestOperation,
    );
    expect((await db.accounts.get('acct-1')).currentBalance).toBe(700);
  });
  it('blocks generic reassignments of tracked payment cash', async () => {
    await addOneOffLoanBill('bill-1', 300);
    await dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
      paidAmount: 300,
    });
    await expect(
      dbHelpers.updateFixedExpenseV4('bill-1', {
        targetLoanId: null,
        category: 'Other',
      }),
    ).rejects.toThrow(/cannot be reassigned/);
    expect((await db.fixedExpenses.get('bill-1')).targetLoanId).toBe('loan-1');
  });
  it('a missing required account update rolls back forward payment', async () => {
    await addOneOffLoanBill('bill-1', 300);
    const failure = vi.spyOn(db.accounts, 'update').mockResolvedValueOnce(0);
    try {
      await expect(
        dbHelpers.applyExpensePaymentChangeAtomic('bill-1', {
          paidAmount: 300,
        }),
      ).rejects.toThrow(/required financial record/);
    } finally {
      failure.mockRestore();
    }
    expect((await db.fixedExpenses.get('bill-1')).paidAmount).toBe(0);
    expect((await db.loans.get('loan-1')).balance).toBe(10000);
    expect((await db.accounts.get('acct-1')).currentBalance).toBe(1000);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { calculateNextPayDates } from '../../constants/payFrequency';
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

describe('dbHelpers.resolveCycle', () => {
  const now = '2026-09-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
      db.loans.clear(),
      db.categories.clear(),
      db.recurringExpenseTemplates.clear(),
      db.fixedExpenses.clear(),
      db.auditLogs.clear(),
      db.recurringResolutionLog.clear(),
      db.monthlyExpenseHistory.clear(),
      db.paycheckSettings.clear(),
    ]);

    await db.accounts.bulkPut([
      {
        id: 'acc-1',
        name: 'Checking',
        type: 'checking',
        currentBalance: 1000,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await db.creditCards.bulkPut([
      {
        id: 'card-1',
        name: 'Visa',
        balance: 500,
        creditLimit: 2000,
        interestRate: 19.99,
        dueDate: '2026-09-14',
        statementClosingDate: '2026-09-01',
        minimumPayment: 45,
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
        dueDate: '2026-09-14',
        targetPayoffDate: '2031-09-14',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  async function seedFixedTemplate({ isVariableAmount = false } = {}) {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-1',
        name: 'Car Insurance',
        baseAmount: 89.5,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-07-14',
        lastGenerated: '2026-08-14',
        nextDueDate: '2026-09-14',
        category: 'Insurance',
        accountId: 'acc-1',
        isActive: true,
        isVariableAmount,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-1',
        name: 'Car Insurance',
        dueDate: '2026-09-14',
        amount: 89.5,
        accountId: 'acc-1',
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Insurance',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: 'tpl-1',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  }

  async function seedCardPaymentTemplate() {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-card',
        name: 'Visa Payment',
        baseAmount: 45,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-08-14',
        lastGenerated: '2026-08-14',
        nextDueDate: '2026-09-14',
        category: 'Credit Card Payment',
        accountId: 'acc-1',
        targetCreditCardId: 'card-1',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-card',
        name: 'Visa Payment',
        dueDate: '2026-09-14',
        amount: 45,
        accountId: 'acc-1',
        creditCardId: null,
        targetCreditCardId: 'card-1',
        category: 'Credit Card Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: 'tpl-card',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  }

  async function seedLoanPaymentTemplate() {
    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-loan',
        name: 'Car Loan Payment',
        baseAmount: 193.33,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-08-14',
        lastGenerated: '2026-08-14',
        nextDueDate: '2026-09-14',
        category: 'Loan Payment',
        accountId: 'acc-1',
        targetLoanId: 'loan-1',
        isActive: true,
        isVariableAmount: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-loan',
        name: 'Car Loan Payment',
        dueDate: '2026-09-14',
        amount: 193.33,
        accountId: 'acc-1',
        creditCardId: null,
        targetLoanId: 'loan-1',
        category: 'Loan Payment',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: 'tpl-loan',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  }

  it('Pay Full: advances cadence, no Balance Due, debits the account, logs resolved', async () => {
    await seedFixedTemplate();

    const result = await dbHelpers.resolveCycle('exp-1', { paidAmount: 89.5 });

    const expense = await db.fixedExpenses.get('exp-1');
    const template = await db.recurringExpenseTemplates.get('tpl-1');
    const account = await db.accounts.get('acc-1');
    const logEntries = await db.recurringResolutionLog.toArray();

    expect(expense.paidAmount).toBe(89.5);
    expect(expense.status).toBe('paid');
    expect(template.nextDueDate).toBe('2026-10-14');
    expect(template.lastGenerated).toBe('2026-09-14');
    expect(account.currentBalance).toBe(1000 - 89.5);
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0]).toMatchObject({
      templateId: 'tpl-1',
      expenseId: 'exp-1',
      committedAmount: 89.5,
      paidAmount: 89.5,
      wasSkipped: false,
      adjustmentExpenseId: null,
    });
    expect(result.adjustmentExpenseId).toBeNull();

    // No Balance Due for a full payment.
    expect(await db.fixedExpenses.count()).toBe(1);
  });

  it('Partial: advances cadence AND spins off a Balance Due for the shortfall', async () => {
    await seedFixedTemplate();

    const result = await dbHelpers.resolveCycle('exp-1', {
      paidAmount: 40,
      shortfallOutcome: 'deferred',
    });

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    const allExpenses = await db.fixedExpenses.toArray();
    const balanceDue = allExpenses.find(
      e => e.id === result.adjustmentExpenseId,
    );

    expect(template.nextDueDate).toBe('2026-10-14'); // advanced despite partial
    expect(balanceDue).toBeTruthy();
    expect(balanceDue.amount).toBeCloseTo(49.5);

    // No paycheckSettings seeded in this test - deferred falls back to
    // the app's local-time convention (DateUtils.today()), not UTC;
    // toISOString() flips to the next day after 5pm PDT, making this
    // time-of-day flaky.
    expect(balanceDue.dueDate).toBe(DateUtils.today());
    expect(balanceDue.recurringTemplateId).toBeNull();
    expect(balanceDue.status).toBe('pending');

    const logEntries = await db.recurringResolutionLog.toArray();
    expect(logEntries[0].wasSkipped).toBe(false);
    expect(logEntries[0].adjustmentExpenseId).toBe(balanceDue.id);
    expect(logEntries[0].shortfallOutcome).toBe('deferred');
    expect(logEntries[0].deferredDueDate).toBe(DateUtils.today());
  });

  it('Skip (paidAmount 0): advances cadence and the Balance Due is for the FULL committed amount', async () => {
    await seedFixedTemplate();

    const result = await dbHelpers.resolveCycle('exp-1', {
      paidAmount: 0,
      shortfallOutcome: 'deferred',
    });

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    const balanceDue = await db.fixedExpenses.get(result.adjustmentExpenseId);

    expect(template.nextDueDate).toBe('2026-10-14');
    expect(balanceDue.amount).toBe(89.5);
    const logEntries = await db.recurringResolutionLog.toArray();
    expect(logEntries[0].wasSkipped).toBe(true);
  });

  it('Skip with shortfallOutcome "forgiven" creates no Balance Due', async () => {
    await seedFixedTemplate();

    const result = await dbHelpers.resolveCycle('exp-1', {
      paidAmount: 0,
      shortfallOutcome: 'forgiven',
    });

    expect(result.adjustmentExpenseId).toBeNull();

    // Just the original row - no Balance Due was ever created.
    expect(await db.fixedExpenses.count()).toBe(1);

    const logEntries = await db.recurringResolutionLog.toArray();
    expect(logEntries[0].shortfallOutcome).toBe('forgiven');
    expect(logEntries[0].adjustmentExpenseId).toBeNull();
    expect(logEntries[0].deferredDueDate).toBeNull();
    expect(logEntries[0].templatePausedOnForgive).toBe(false);

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.isActive).toBe(true);
    expect(template.nextDueDate).toBe('2026-10-14'); // cadence still advances
  });

  it('a deferred shortfall with paycheckSettings seeded computes dueDate from calculateNextPayDates, not today', async () => {
    await seedFixedTemplate();

    // A lastPaycheckDate far enough in the past that "the next payday on
    // or after today" lands after today no matter when this suite
    // actually runs - calculateNextPayDates rolls forward from real
    // wall-clock "today" internally, so the expected value is computed
    // the exact same way here rather than hardcoded, to avoid a test
    // that silently goes flaky as time passes.
    await db.paycheckSettings.bulkPut([
      {
        id: 'ps-1',
        lastPaycheckDate: '2020-01-03', // a Friday, arbitrary anchor
        frequency: 'biweekly',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
    const expectedNextPayDate = calculateNextPayDates(
      '2020-01-03',
      'biweekly',
    ).nextPayDate;

    const result = await dbHelpers.resolveCycle('exp-1', {
      paidAmount: 0,
      shortfallOutcome: 'deferred',
    });
    const balanceDue = await db.fixedExpenses.get(result.adjustmentExpenseId);

    expect(balanceDue.dueDate).toBe(expectedNextPayDate);

    const logEntries = await db.recurringResolutionLog.toArray();
    expect(logEntries[0].deferredDueDate).toBe(expectedNextPayDate);
  });

  it('missing shortfallOutcome on a real shortfall throws, and commits nothing', async () => {
    await seedFixedTemplate();

    await expect(
      dbHelpers.resolveCycle('exp-1', { paidAmount: 40 }),
    ).rejects.toThrow(/shortfallOutcome .* is required/i);

    const expense = await db.fixedExpenses.get('exp-1');
    expect(expense.paidAmount).toBe(0);
    expect(await db.recurringResolutionLog.count()).toBe(0);
    expect(await db.fixedExpenses.count()).toBe(1); // no Balance Due either
  });

  it('shortfallOutcome supplied when there is no shortfall throws', async () => {
    await seedFixedTemplate();

    await expect(
      dbHelpers.resolveCycle('exp-1', {
        paidAmount: 89.5,
        shortfallOutcome: 'deferred',
      }),
    ).rejects.toThrow(/must not be provided when there is no shortfall/i);
  });

  it('pauseTemplateOnForgive: true pauses the template atomically alongside forgiving', async () => {
    await seedFixedTemplate();

    await dbHelpers.resolveCycle('exp-1', {
      paidAmount: 0,
      shortfallOutcome: 'forgiven',
      pauseTemplateOnForgive: true,
    });

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.isActive).toBe(false);

    // Cadence still advances even though the template is now paused - a
    // future resume should pick up from the correct next cycle.
    expect(template.nextDueDate).toBe('2026-10-14');

    const logEntries = await db.recurringResolutionLog.toArray();
    expect(logEntries[0].templatePausedOnForgive).toBe(true);
  });

  it('pauseTemplateOnForgive: false leaves the template active', async () => {
    await seedFixedTemplate();

    await dbHelpers.resolveCycle('exp-1', {
      paidAmount: 0,
      shortfallOutcome: 'forgiven',
      pauseTemplateOnForgive: false,
    });

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.isActive).toBe(true);
  });

  it('pauseTemplateOnForgive is only legal alongside shortfallOutcome "forgiven"', async () => {
    await seedFixedTemplate();

    await expect(
      dbHelpers.resolveCycle('exp-1', {
        paidAmount: 40,
        shortfallOutcome: 'deferred',
        pauseTemplateOnForgive: true,
      }),
    ).rejects.toThrow(/only valid alongside shortfallOutcome: "forgiven"/i);
  });

  it('a skipped credit-card payment spins off a Balance Due that inherits category + targetCreditCardId, so paying it later still reduces the card balance', async () => {
    await seedCardPaymentTemplate();

    const result = await dbHelpers.resolveCycle('exp-card', {
      paidAmount: 0,
      shortfallOutcome: 'deferred',
    });
    const balanceDue = await db.fixedExpenses.get(result.adjustmentExpenseId);

    expect(balanceDue.category).toBe('Credit Card Payment');
    expect(balanceDue.targetCreditCardId).toBe('card-1');
    expect(balanceDue.accountId).toBe('acc-1');
    expect(balanceDue.amount).toBe(45);

    // Prove it end to end: paying this Balance Due off later must reduce
    // the card's tracked balance, via the ordinary
    // applyExpensePaymentChangeAtomic path (Balance Due is just a normal
    // one-off expense - no special handling required).
    await dbHelpers.applyExpensePaymentChangeAtomic(balanceDue.id, {
      paidAmount: 45,
    });
    const card = await db.creditCards.get('card-1');
    expect(card.balance).toBe(500 - 45);
  });

  it('Pay Full on a loan payment reduces the loan balance and advances cadence', async () => {
    await seedLoanPaymentTemplate();

    await dbHelpers.resolveCycle('exp-loan', { paidAmount: 193.33 });

    const expense = await db.fixedExpenses.get('exp-loan');
    const template = await db.recurringExpenseTemplates.get('tpl-loan');
    const account = await db.accounts.get('acc-1');
    const loan = await db.loans.get('loan-1');

    expect(expense.paidAmount).toBe(193.33);
    expect(expense.status).toBe('paid');
    expect(template.nextDueDate).toBe('2026-10-14');
    expect(account.currentBalance).toBe(1000 - 193.33);
    expect(loan.balance).toBeCloseTo(10000 - 193.33);
  });

  it('a skipped loan payment spins off a Balance Due that inherits category + targetLoanId, so paying it later still reduces the loan balance', async () => {
    await seedLoanPaymentTemplate();

    const result = await dbHelpers.resolveCycle('exp-loan', {
      paidAmount: 0,
      shortfallOutcome: 'deferred',
    });
    const balanceDue = await db.fixedExpenses.get(result.adjustmentExpenseId);

    expect(balanceDue.category).toBe('Loan Payment');
    expect(balanceDue.targetLoanId).toBe('loan-1');
    expect(balanceDue.accountId).toBe('acc-1');
    expect(balanceDue.amount).toBe(193.33);

    // Prove it end to end: paying this Balance Due off later must reduce
    // the loan's tracked balance, via the ordinary
    // applyExpensePaymentChangeAtomic path.
    await dbHelpers.applyExpensePaymentChangeAtomic(balanceDue.id, {
      paidAmount: 193.33,
    });
    const loan = await db.loans.get('loan-1');
    expect(loan.balance).toBeCloseTo(10000 - 193.33);
  });

  it('forgiving a loan payment shortfall creates no Balance Due and leaves the loan balance untouched', async () => {
    await seedLoanPaymentTemplate();

    const result = await dbHelpers.resolveCycle('exp-loan', {
      paidAmount: 0,
      shortfallOutcome: 'forgiven',
    });

    expect(result.adjustmentExpenseId).toBeNull();
    const loan = await db.loans.get('loan-1');
    expect(loan.balance).toBe(10000); // untouched - nothing was paid
  });

  it('rejects a partial amount on a variable-amount template - only Full (paidAmount === amount) or Skip (0) are legal', async () => {
    await seedCardPaymentTemplate();

    await expect(
      dbHelpers.resolveCycle('exp-card', { paidAmount: 20 }),
    ).rejects.toThrow(/Partial payment is not available/i);

    // Nothing should have moved.
    const expense = await db.fixedExpenses.get('exp-card');
    expect(expense.paidAmount).toBe(0);
    expect(await db.recurringResolutionLog.count()).toBe(0);
  });

  it('rejects paidAmount greater than the committed amount', async () => {
    await seedFixedTemplate();
    await expect(
      dbHelpers.resolveCycle('exp-1', { paidAmount: 200 }),
    ).rejects.toThrow(/cannot exceed the committed amount/i);
  });

  it('rejects an expense with no recurringTemplateId', async () => {
    await db.fixedExpenses.bulkPut([
      {
        id: 'exp-oneoff',
        name: 'One-off',
        dueDate: '2026-09-14',
        amount: 20,
        accountId: 'acc-1',
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Dining',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await expect(
      dbHelpers.resolveCycle('exp-oneoff', { paidAmount: 20 }),
    ).rejects.toThrow(/requires a recurring-template expense/i);
  });

  it('the resolution log write is a hard write: a failure there rolls back the whole transaction', async () => {
    await seedFixedTemplate();

    const originalAdd = db.recurringResolutionLog.add.bind(
      db.recurringResolutionLog,
    );
    db.recurringResolutionLog.add = vi
      .fn()
      .mockRejectedValue(new Error('simulated log write failure'));

    try {
      await expect(
        dbHelpers.resolveCycle('exp-1', { paidAmount: 89.5 }),
      ).rejects.toThrow(/simulated log write failure/i);
    } finally {
      db.recurringResolutionLog.add = originalAdd;
    }

    // Nothing should have been committed - not the paidAmount, not the
    // balance debit, not the cadence advance.
    const expense = await db.fixedExpenses.get('exp-1');
    const template = await db.recurringExpenseTemplates.get('tpl-1');
    const account = await db.accounts.get('acc-1');

    expect(expense.paidAmount).toBe(0);
    expect(expense.status).toBe('pending');
    expect(template.nextDueDate).toBe('2026-09-14');
    expect(account.currentBalance).toBe(1000);
    expect(await db.recurringResolutionLog.count()).toBe(0);
  });

  it('deactivates the template when the next cycle would exceed endDate', async () => {
    await seedFixedTemplate();
    await db.recurringExpenseTemplates.update('tpl-1', {
      endDate: '2026-09-20',
    });

    await dbHelpers.resolveCycle('exp-1', { paidAmount: 89.5 });

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.isActive).toBe(false);
    expect(template.nextDueDate).toBeNull();
  });
});

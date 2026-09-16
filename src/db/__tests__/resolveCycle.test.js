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

describe('dbHelpers.resolveCycle', () => {
  const now = '2026-09-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
      db.categories.clear(),
      db.recurringExpenseTemplates.clear(),
      db.fixedExpenses.clear(),
      db.auditLogs.clear(),
      db.recurringResolutionLog.clear(),
      db.monthlyExpenseHistory.clear(),
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

    const result = await dbHelpers.resolveCycle('exp-1', { paidAmount: 40 });

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    const allExpenses = await db.fixedExpenses.toArray();
    const balanceDue = allExpenses.find(
      e => e.id === result.adjustmentExpenseId,
    );

    expect(template.nextDueDate).toBe('2026-10-14'); // advanced despite partial
    expect(balanceDue).toBeTruthy();
    expect(balanceDue.amount).toBeCloseTo(49.5);

    // Use the app's local-time convention (DateUtils.today()), not UTC -
    // toISOString() flips to the next day after 5pm PDT, making this
    // time-of-day flaky.
    expect(balanceDue.dueDate).toBe(DateUtils.today()); // due today
    expect(balanceDue.recurringTemplateId).toBeNull();
    expect(balanceDue.status).toBe('pending');

    const logEntries = await db.recurringResolutionLog.toArray();
    expect(logEntries[0].wasSkipped).toBe(false);
    expect(logEntries[0].adjustmentExpenseId).toBe(balanceDue.id);
  });

  it('Skip (paidAmount 0): advances cadence and the Balance Due is for the FULL committed amount', async () => {
    await seedFixedTemplate();

    const result = await dbHelpers.resolveCycle('exp-1', { paidAmount: 0 });

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    const balanceDue = await db.fixedExpenses.get(result.adjustmentExpenseId);

    expect(template.nextDueDate).toBe('2026-10-14');
    expect(balanceDue.amount).toBe(89.5);
    const logEntries = await db.recurringResolutionLog.toArray();
    expect(logEntries[0].wasSkipped).toBe(true);
  });

  it('a skipped credit-card payment spins off a Balance Due that inherits category + targetCreditCardId, so paying it later still reduces the card balance', async () => {
    await seedCardPaymentTemplate();

    const result = await dbHelpers.resolveCycle('exp-card', { paidAmount: 0 });
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

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

describe('addRecurringExpenseTemplate - nextDueDate', () => {
  const baseTemplate = {
    name: 'Test Template',
    baseAmount: 100,
    frequency: 'monthly',
    intervalValue: 1,
    intervalUnit: 'months',
    startDate: '2025-02-16',
    category: 'Housing',
  };

  beforeEach(async () => {
    await db.recurringExpenseTemplates.clear();
  });

  it('uses caller nextDueDate when valid and equal to startDate', async () => {
    const id = await dbHelpers.addRecurringExpenseTemplate({
      ...baseTemplate,
      nextDueDate: '2025-02-16',
    });
    const template = await db.recurringExpenseTemplates.get(id);
    expect(template.nextDueDate).toBe('2025-02-16');
  });

  it('uses caller nextDueDate when valid and after startDate', async () => {
    const id = await dbHelpers.addRecurringExpenseTemplate({
      ...baseTemplate,
      nextDueDate: '2025-04-01',
    });
    const template = await db.recurringExpenseTemplates.get(id);
    expect(template.nextDueDate).toBe('2025-04-01');
  });

  it('falls back to computed nextDueDate when caller omits nextDueDate', async () => {
    const id = await dbHelpers.addRecurringExpenseTemplate(baseTemplate);
    const template = await db.recurringExpenseTemplates.get(id);
    const expected = dbHelpers.calculateNextDueDate(
      baseTemplate.startDate,
      baseTemplate.frequency,
      baseTemplate.intervalValue,
      baseTemplate.intervalUnit,
    );
    expect(template.nextDueDate).toBe(expected);
    expect(DateUtils.parseDate(template.nextDueDate).getMonth()).toBe(
      DateUtils.parseDate(baseTemplate.startDate).getMonth() + 1,
    );
  });

  it('falls back to computed when caller nextDueDate is before startDate', async () => {
    const id = await dbHelpers.addRecurringExpenseTemplate({
      ...baseTemplate,
      nextDueDate: '2025-01-01',
    });
    const template = await db.recurringExpenseTemplates.get(id);
    const expected = dbHelpers.calculateNextDueDate(
      baseTemplate.startDate,
      baseTemplate.frequency,
      baseTemplate.intervalValue,
      baseTemplate.intervalUnit,
    );
    expect(template.nextDueDate).toBe(expected);
  });

  it('falls back to computed when caller nextDueDate is invalid string', async () => {
    const id = await dbHelpers.addRecurringExpenseTemplate({
      ...baseTemplate,
      nextDueDate: 'not-a-date',
    });
    const template = await db.recurringExpenseTemplates.get(id);
    const expected = dbHelpers.calculateNextDueDate(
      baseTemplate.startDate,
      baseTemplate.frequency,
      baseTemplate.intervalValue,
      baseTemplate.intervalUnit,
    );
    expect(template.nextDueDate).toBe(expected);
  });
});

describe('materializeCurrentCycle - deleted credit card self-heal', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.recurringExpenseTemplates.clear(),
      db.creditCards.clear(),
      db.fixedExpenses.clear(),
    ]);
  });

  const baseTemplate = {
    name: 'Card Payment',
    baseAmount: 25,
    frequency: 'monthly',
    intervalValue: 1,
    intervalUnit: 'months',
    startDate: '2026-02-01',
    nextDueDate: '2026-02-01',
    category: 'Credit Card Payment',
    accountId: 'acc-1',
    creditCardId: null,
    targetCreditCardId: 'card-1',
    isActive: true,
    isVariableAmount: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  it('deactivates and refuses to generate when the linked card was soft-deleted', async () => {
    await db.creditCards.bulkPut([
      {
        id: 'card-1',
        name: 'Card',
        balance: 50,
        creditLimit: 1000,
        interestRate: 19.99,
        dueDate: '2026-02-15',
        statementClosingDate: '2026-02-01',
        minimumPayment: 25,
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      },
    ]);
    await db.recurringExpenseTemplates.bulkPut([
      { id: 'tpl-1', ...baseTemplate },
    ]);

    await expect(dbHelpers.materializeCurrentCycle('tpl-1')).rejects.toThrow(
      /Linked credit card has been deleted/i,
    );

    const template = await db.recurringExpenseTemplates.get('tpl-1');
    expect(template.isActive).toBe(false);
    expect(await db.fixedExpenses.count()).toBe(0);
  });

  it('deactivates and refuses to generate when the linked card no longer exists', async () => {
    await db.recurringExpenseTemplates.bulkPut([
      { id: 'tpl-2', ...baseTemplate },
    ]);

    await expect(dbHelpers.materializeCurrentCycle('tpl-2')).rejects.toThrow(
      /Linked credit card has been deleted/i,
    );

    const template = await db.recurringExpenseTemplates.get('tpl-2');
    expect(template.isActive).toBe(false);
    expect(await db.fixedExpenses.count()).toBe(0);
  });
});

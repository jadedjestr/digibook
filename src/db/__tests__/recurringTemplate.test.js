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

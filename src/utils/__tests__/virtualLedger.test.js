import { describe, it, expect } from 'vitest';

import { computeCycleStates } from '../virtualLedger';

const baseTemplate = {
  id: 'tmpl-1',
  startDate: '2026-07-14',
  frequency: 'monthly',
  intervalValue: 1,
  intervalUnit: 'months',
};

describe('computeCycleStates', () => {
  it('returns every cycle as virtual when nothing has been generated or resolved', () => {
    const result = computeCycleStates(baseTemplate, {
      rangeStart: '2026-07-01',
      rangeEnd: '2026-10-31',
      estimatedAmount: 89.5,
    });

    const dates = result.map(r => r.cycleDueDate);
    expect(dates).toEqual([
      '2026-07-14',
      '2026-08-14',
      '2026-09-14',
      '2026-10-14',
    ]);
    expect(result.every(r => r.state === 'virtual')).toBe(true);
    expect(result.every(r => r.estimatedAmount === 89.5)).toBe(true);
    expect(result.every(r => r.expense === null && r.logEntry === null)).toBe(
      true,
    );
  });

  it('classifies a real, unresolved row as pending', () => {
    const realExpenses = [
      { id: 'exp-1', dueDate: '2026-09-14', amount: 89.5, deletedAt: null },
    ];
    const result = computeCycleStates(baseTemplate, {
      realExpenses,
      rangeStart: '2026-09-01',
      rangeEnd: '2026-09-30',
      estimatedAmount: 89.5,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cycleDueDate: '2026-09-14',
      state: 'pending',
      estimatedAmount: 89.5,
    });
    expect(result[0].expense).toBe(realExpenses[0]);
  });

  it('classifies a real row at a FUTURE due date as pending, not virtual', () => {
    // A first occurrence materialized at creation (within the current pay
    // period) exists as a real row before its due date. It must read as
    // 'pending' - actionable, shown in the priority list - while later
    // cycles remain 'virtual' forecasts. This is the calendar/priority-list
    // consistency invariant.
    const newTemplate = { ...baseTemplate, startDate: '2026-09-17' };
    const realExpenses = [
      { id: 'exp-1', dueDate: '2026-09-17', amount: 15.99, deletedAt: null },
    ];
    const result = computeCycleStates(newTemplate, {
      realExpenses,
      rangeStart: '2026-09-01',
      rangeEnd: '2026-10-31',
      estimatedAmount: 15.99,
    });

    const first = result.find(r => r.cycleDueDate === '2026-09-17');
    const second = result.find(r => r.cycleDueDate === '2026-10-17');
    expect(first.state).toBe('pending');
    expect(first.expense).toBe(realExpenses[0]);
    expect(second.state).toBe('virtual');
    expect(second.expense).toBeNull();
  });

  it('classifies a cycle with a resolution log entry as resolved, even at the same date as a real row', () => {
    const realExpenses = [
      { id: 'exp-1', dueDate: '2026-09-14', amount: 89.5, deletedAt: null },
    ];
    const resolutionLogEntries = [
      {
        id: 'log-1',
        cycleDueDate: '2026-09-14',
        committedAmount: 89.5,
        paidAmount: 40,
        deletedAt: null,
      },
    ];
    const result = computeCycleStates(baseTemplate, {
      realExpenses,
      resolutionLogEntries,
      rangeStart: '2026-09-01',
      rangeEnd: '2026-09-30',
      estimatedAmount: 95,
    });

    expect(result).toHaveLength(1);
    expect(result[0].state).toBe('resolved');
    expect(result[0].logEntry).toBe(resolutionLogEntries[0]);

    // resolved/pending entries prefer their own amount over the estimate
    expect(result[0].estimatedAmount).toBe(89.5);
  });

  it('ignores a soft-deleted (undone) resolution log entry', () => {
    const resolutionLogEntries = [
      {
        id: 'log-1',
        cycleDueDate: '2026-09-14',
        committedAmount: 89.5,
        deletedAt: '2026-09-15T00:00:00.000Z',
      },
    ];
    const result = computeCycleStates(baseTemplate, {
      resolutionLogEntries,
      rangeStart: '2026-09-01',
      rangeEnd: '2026-09-30',
      estimatedAmount: 89.5,
    });

    expect(result[0].state).toBe('virtual');
    expect(result[0].logEntry).toBeNull();
  });

  it('passes a caller-supplied estimate through to variable-amount virtual entries', () => {
    const variableTemplate = {
      ...baseTemplate,
      isVariableAmount: true,
      targetCreditCardId: 'card-1',
    };
    const result = computeCycleStates(variableTemplate, {
      rangeStart: '2026-10-01',
      rangeEnd: '2026-10-31',
      estimatedAmount: 45.2,
    });

    expect(result[0].state).toBe('virtual');
    expect(result[0].estimatedAmount).toBe(45.2);
  });

  it('stops generating cycles past the template end date', () => {
    const result = computeCycleStates(
      { ...baseTemplate, endDate: '2026-08-31' },
      { rangeStart: '2026-07-01', rangeEnd: '2026-12-31', estimatedAmount: 1 },
    );

    expect(result.map(r => r.cycleDueDate)).toEqual([
      '2026-07-14',
      '2026-08-14',
    ]);
  });

  it('returns an empty array when required range/template fields are missing', () => {
    expect(
      computeCycleStates(null, {
        rangeStart: '2026-01-01',
        rangeEnd: '2026-01-31',
      }),
    ).toEqual([]);
    expect(
      computeCycleStates(baseTemplate, { rangeStart: '2026-01-01' }),
    ).toEqual([]);
    expect(
      computeCycleStates(baseTemplate, { rangeEnd: '2026-01-31' }),
    ).toEqual([]);
  });
});

import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { db } from '../../db/database-clean';
import { usePayCycleNudge } from '../usePayCycleNudge';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function TestHarness({ options, onResult }) {
  const result = usePayCycleNudge(options);
  onResult(result);
  return null;
}

describe('usePayCycleNudge - virtual gap detection', () => {
  const now = '2026-01-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.recurringExpenseTemplates.clear(),
      db.fixedExpenses.clear(),
      db.recurringResolutionLog.clear(),
    ]);
  });

  it('surfaces a past_month nudge for a template cycle that never became a real row', async () => {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Two months back, day 14 - with a monthly cadence this implies a cycle
    // last month that has neither a fixedExpenses row nor a
    // recurringResolutionLog entry, i.e. exactly the gap the Virtual Ledger
    // exists to catch.
    const templateStart = new Date(
      today.getFullYear(),
      today.getMonth() - 2,
      14,
    );

    await db.recurringExpenseTemplates.bulkPut([
      {
        id: 'tpl-gap',
        name: 'Storage Unit',
        baseAmount: 75,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: fmt(templateStart),
        nextDueDate: fmt(templateStart),
        category: 'Housing',
        accountId: 'acc-1',
        isActive: true,
        isVariableAmount: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    let latest;
    render(
      <TestHarness
        options={{
          fixedExpenses: [],
          currentMonth,
          currentMonthExpenses: [],
          paycheckDates: {},
          paycheckService: null,
        }}
        onResult={r => {
          latest = r;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest.nudge).not.toBeNull();
    });

    expect(latest.nudge.type).toBe('past_month');
    expect(latest.nudge.payload.unpaidCount).toBeGreaterThanOrEqual(1);
    expect(
      latest.nudge.payload.unpaidExpenses.some(
        e => e.recurringTemplateId === 'tpl-gap' && e.isVirtual,
      ),
    ).toBe(true);
  });

  it('reports no nudge when there is no gap and nothing else unpaid', async () => {
    let latest;
    render(
      <TestHarness
        options={{
          fixedExpenses: [],
          currentMonth: new Date(),
          currentMonthExpenses: [],
          paycheckDates: {},
          paycheckService: null,
        }}
        onResult={r => {
          latest = r;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest).toBeDefined();
    });

    expect(latest.nudge).toBeNull();
  });
});

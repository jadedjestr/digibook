import { describe, it, expect } from 'vitest';

import {
  getPayCycleNudge,
  getMonthKey,
  getLastMonthKey,
  getExpensesInMonth,
  isUnpaidOrPartial,
  isNearEndOfMonth,
} from '../payCycleNudgeLogic';

describe('payCycleNudgeLogic', () => {
  describe('getMonthKey', () => {
    it('returns YYYY-MM for a date', () => {
      expect(getMonthKey(new Date(2025, 0, 15))).toBe('2025-01');
      expect(getMonthKey(new Date(2025, 11, 1))).toBe('2025-12');
    });
    it('returns null for invalid input', () => {
      expect(getMonthKey(null)).toBe(null);
    });
  });

  describe('getLastMonthKey', () => {
    it('returns previous calendar month key', () => {
      expect(getLastMonthKey(new Date(2025, 2, 1))).toBe('2025-02');
      expect(getLastMonthKey(new Date(2025, 0, 1))).toBe('2024-12');
    });
  });

  describe('getExpensesInMonth', () => {
    it('filters expenses by due date in month', () => {
      const expenses = [
        { id: 1, dueDate: '2025-02-10', amount: 100 },
        { id: 2, dueDate: '2025-03-01', amount: 50 },
        { id: 3, dueDate: '2025-02-28', amount: 75 },
      ];
      expect(getExpensesInMonth(expenses, '2025-02')).toHaveLength(2);
      expect(getExpensesInMonth(expenses, '2025-03')).toHaveLength(1);
      expect(getExpensesInMonth(expenses, '2025-01')).toHaveLength(0);
    });
    it('returns empty array for empty or invalid input', () => {
      expect(getExpensesInMonth([], '2025-02')).toEqual([]);
      expect(getExpensesInMonth([{ dueDate: '2025-02-01' }], '')).toEqual([]);
    });
  });

  describe('isUnpaidOrPartial', () => {
    it('returns true when paidAmount < amount', () => {
      expect(isUnpaidOrPartial({ amount: 100, paidAmount: 0 })).toBe(true);
      expect(isUnpaidOrPartial({ amount: 100, paidAmount: 50 })).toBe(true);
    });
    it('returns false when fully paid or no expense', () => {
      expect(isUnpaidOrPartial({ amount: 100, paidAmount: 100 })).toBe(false);
      expect(isUnpaidOrPartial(null)).toBe(false);
      expect(isUnpaidOrPartial({ amount: 100 })).toBe(true); // paidAmount undefined -> 0
    });
  });

  describe('isNearEndOfMonth', () => {
    it('returns true when today is within config days of end of month and same month', () => {
      const today = new Date(2025, 2, 25); // March 25
      const currentMonth = new Date(2025, 2, 1); // March
      expect(
        isNearEndOfMonth(today, currentMonth, { daysNearEndOfMonth: 7 }),
      ).toBe(true);
    });
    it('returns false when viewed month is not current month', () => {
      const today = new Date(2025, 2, 25);
      const currentMonth = new Date(2025, 1, 1); // February
      expect(
        isNearEndOfMonth(today, currentMonth, { daysNearEndOfMonth: 7 }),
      ).toBe(false);
    });
  });

  describe('getPayCycleNudge', () => {
    it('returns null when no expenses', () => {
      const result = getPayCycleNudge({
        fixedExpenses: [],
        currentMonth: new Date(2025, 2, 1),
        currentMonthExpenses: [],
        paycheckDates: {},
        paycheckService: null,
        today: new Date(2025, 2, 15),
      });
      expect(result.nudge).toBeNull();
    });

    it('returns past_month nudge when today is March and last month has unpaid expenses', () => {
      const today = new Date(2025, 2, 15); // March 15
      const currentMonth = new Date(2025, 2, 1); // March
      const fixedExpenses = [
        { id: 1, dueDate: '2025-02-10', amount: 100, paidAmount: 0 },
      ];
      const result = getPayCycleNudge({
        fixedExpenses,
        currentMonth,
        currentMonthExpenses: [],
        paycheckDates: {},
        paycheckService: null,
        today,
      });
      expect(result.nudge).not.toBeNull();
      expect(result.nudge.type).toBe('past_month');
      expect(result.nudge.payload.lastMonthKey).toBe('2025-02');
      expect(result.nudge.payload.unpaidCount).toBe(1);
      expect(result.nudge.dismissKey).toBe('past_month_2025-02');
    });

    it('does not return past_month when last month expenses are all paid', () => {
      const today = new Date(2025, 2, 15);
      const currentMonth = new Date(2025, 2, 1);
      const fixedExpenses = [
        { id: 1, dueDate: '2025-02-10', amount: 100, paidAmount: 100 },
      ];
      const result = getPayCycleNudge({
        fixedExpenses,
        currentMonth,
        currentMonthExpenses: [],
        paycheckDates: {},
        paycheckService: null,
        today,
      });
      expect(result.nudge).toBeNull();
    });

    it('merges virtualGapCycles into last month unpaid count even with no real rows', () => {
      const today = new Date(2025, 2, 15); // March 15
      const currentMonth = new Date(2025, 2, 1); // March
      const virtualGapCycles = [
        {
          id: 'virtual-1-2025-02-10',
          dueDate: '2025-02-10',
          amount: 45,
          paidAmount: 0,
          isVirtual: true,
        },
      ];
      const result = getPayCycleNudge({
        fixedExpenses: [],
        currentMonth,
        currentMonthExpenses: [],
        paycheckDates: {},
        paycheckService: null,
        today,
        virtualGapCycles,
      });
      expect(result.nudge).not.toBeNull();
      expect(result.nudge.type).toBe('past_month');
      expect(result.nudge.payload.unpaidCount).toBe(1);
      expect(result.nudge.payload.unpaidExpenses).toEqual(virtualGapCycles);
    });

    it('adds virtualGapCycles on top of real unpaid expenses for the count', () => {
      const today = new Date(2025, 2, 15);
      const currentMonth = new Date(2025, 2, 1);
      const fixedExpenses = [
        { id: 1, dueDate: '2025-02-10', amount: 100, paidAmount: 0 },
      ];
      const virtualGapCycles = [
        {
          id: 'virtual-1-2025-02-24',
          dueDate: '2025-02-24',
          amount: 45,
          paidAmount: 0,
        },
      ];
      const result = getPayCycleNudge({
        fixedExpenses,
        currentMonth,
        currentMonthExpenses: [],
        paycheckDates: {},
        paycheckService: null,
        today,
        virtualGapCycles,
      });
      expect(result.nudge.payload.unpaidCount).toBe(2);
    });

    it('returns catch_up nudge when current month, near end of month, and unpaid in currentMonthExpenses', () => {
      const today = new Date(2025, 2, 25); // March 25 - near end
      const currentMonth = new Date(2025, 2, 1);
      const currentMonthExpenses = [
        { id: 1, dueDate: '2025-03-10', amount: 100, paidAmount: 0 },
      ];
      const result = getPayCycleNudge({
        fixedExpenses: [],
        currentMonth,
        currentMonthExpenses,
        paycheckDates: {},
        paycheckService: null,
        today,
        config: { daysNearEndOfMonth: 7 },
      });
      expect(result.nudge).not.toBeNull();
      expect(result.nudge.type).toBe('catch_up');
      expect(result.nudge.payload.unpaidInCurrentMonthCount).toBe(1);
      expect(result.nudge.dismissKey).toBe('catch_up_2025-03');
    });

    it('prioritizes past_month over catch_up when both qualify', () => {
      const today = new Date(2025, 2, 25); // March 25
      const currentMonth = new Date(2025, 2, 1);
      const fixedExpenses = [
        { id: 1, dueDate: '2025-02-10', amount: 100, paidAmount: 0 },
      ];
      const currentMonthExpenses = [
        { id: 2, dueDate: '2025-03-15', amount: 50, paidAmount: 0 },
      ];
      const result = getPayCycleNudge({
        fixedExpenses,
        currentMonth,
        currentMonthExpenses,
        paycheckDates: {},
        paycheckService: null,
        today,
        config: { daysNearEndOfMonth: 7 },
      });
      expect(result.nudge.type).toBe('past_month');
    });

    it('returns null when nudge type is dismissed', () => {
      const today = new Date(2025, 2, 15);
      const currentMonth = new Date(2025, 2, 1);
      const fixedExpenses = [
        { id: 1, dueDate: '2025-02-10', amount: 100, paidAmount: 0 },
      ];
      const result = getPayCycleNudge({
        fixedExpenses,
        currentMonth,
        currentMonthExpenses: [],
        paycheckDates: {},
        paycheckService: null,
        today,
        dismissed: new Set(['past_month_2025-02']),
      });
      expect(result.nudge).toBeNull();
    });
  });

  describe('getPayCycleNudge — promo_ended', () => {
    // Fixed "today": 2025-02-15. Cycle anchor: 2025-02-01. A card whose
    // intro APR ended 2025-02-10 is five days into expiry - squarely
    // "ended during the current pay cycle".
    const endedCard = {
      id: 'card-1',
      name: 'Visa',
      hasIntroApr: true,
      introApr: 0,
      interestRate: 24.99,
      introAprEndDate: '2025-02-10',
    };
    const opts = overrides => ({
      currentMonth: new Date(2025, 1, 15),
      today: new Date(2025, 1, 15),
      lastCycleStart: '2025-02-01',
      creditCards: [endedCard],
      ...overrides,
    });

    it('fires when the intro rate ended during the current pay cycle', () => {
      const { nudge } = getPayCycleNudge(opts());
      expect(nudge?.type).toBe('promo_ended');
      expect(nudge.payload.cardName).toBe('Visa');
      expect(nudge.payload.rateLabel).toBe('24.99');
      expect(nudge.dismissKey).toBe('promo_ended_card-1_2025-02-10');
    });

    it('does not fire while the intro rate is still active (end date today or future)', () => {
      // On the end date itself the intro rate still applies - the nudge
      // fires the day after, matching getEffectiveCardInterestRate.
      expect(
        getPayCycleNudge(
          opts({
            creditCards: [{ ...endedCard, introAprEndDate: '2025-02-15' }],
          }),
        ).nudge,
      ).toBeNull();
      expect(
        getPayCycleNudge(
          opts({
            creditCards: [{ ...endedCard, introAprEndDate: '2025-03-01' }],
          }),
        ).nudge,
      ).toBeNull();
    });

    it('does not fire when the promo ended before the current cycle', () => {
      expect(
        getPayCycleNudge(
          opts({
            creditCards: [{ ...endedCard, introAprEndDate: '2025-01-31' }],
          }),
        ).nudge,
      ).toBeNull();
    });

    it('does not fire without a pay-cycle anchor (no paycheck settings)', () => {
      expect(getPayCycleNudge(opts({ lastCycleStart: null })).nudge).toBeNull();
    });

    it('does not fire when that card+endDate pair is dismissed', () => {
      const { nudge } = getPayCycleNudge(
        opts({ dismissed: new Set(['promo_ended_card-1_2025-02-10']) }),
      );
      expect(nudge).toBeNull();
    });

    it('moves to the next ended card when the first is dismissed', () => {
      const { nudge } = getPayCycleNudge(
        opts({
          creditCards: [
            endedCard,
            {
              ...endedCard,
              id: 'card-2',
              name: 'Amex',
              introAprEndDate: '2025-02-12',
            },
          ],
          dismissed: new Set(['promo_ended_card-1_2025-02-10']),
        }),
      );
      expect(nudge?.type).toBe('promo_ended');
      expect(nudge.payload.cardName).toBe('Amex');
      expect(nudge.dismissKey).toBe('promo_ended_card-2_2025-02-12');
    });

    it('ignores cards without an intro APR', () => {
      expect(
        getPayCycleNudge(
          opts({ creditCards: [{ ...endedCard, hasIntroApr: false }] }),
        ).nudge,
      ).toBeNull();
    });

    it('past_month outranks promo_ended', () => {
      const { nudge } = getPayCycleNudge(
        opts({
          fixedExpenses: [
            { id: 1, dueDate: '2025-01-10', amount: 100, paidAmount: 0 },
          ],
        }),
      );
      expect(nudge?.type).toBe('past_month');
    });
  });

  describe('getPayCycleNudge — resolvedExpenseIds (no nags about resolved cycles)', () => {
    const resolvedExpense = {
      id: 7,
      dueDate: '2025-01-10',
      amount: 100,
      paidAmount: 0, // unpaid on its face — but resolved in the log
    };

    it('a resolved expense no longer counts toward the past_month nudge', () => {
      const result = getPayCycleNudge({
        fixedExpenses: [resolvedExpense],
        currentMonth: new Date(2025, 1, 15),
        today: new Date(2025, 1, 15),
        resolvedExpenseIds: new Set(['7']),
      });
      expect(result.nudge).toBeNull();
    });

    it('without the resolved set, the same expense still counts (back-compat)', () => {
      const result = getPayCycleNudge({
        fixedExpenses: [resolvedExpense],
        currentMonth: new Date(2025, 1, 15),
        today: new Date(2025, 1, 15),
      });
      expect(result.nudge?.type).toBe('past_month');
      expect(result.nudge.payload.unpaidCount).toBe(1);
    });

    it('a resolved expense no longer counts toward the catch_up nudge', () => {
      const result = getPayCycleNudge({
        fixedExpenses: [resolvedExpense],
        currentMonthExpenses: [resolvedExpense],
        currentMonth: new Date(2025, 1, 15),
        today: new Date(2025, 1, 20), // near end of month
        resolvedExpenseIds: new Set(['7']),
      });
      expect(result.nudge).toBeNull();
    });
  });
});

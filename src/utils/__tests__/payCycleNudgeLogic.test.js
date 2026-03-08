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
        config: { daysNearEndOfMonth: 7, pastMonthScope: 'last_only' },
      });
      expect(result.nudge).not.toBeNull();
      expect(result.nudge.type).toBe('catch_up');
      expect(result.nudge.payload.unpaidInCurrentMonthCount).toBe(1);
      expect(result.nudge.dismissKey).toBe('catch_up_2025-03');
    });

    it('returns reset nudge when shouldPromptReset is true', () => {
      const currentMonth = new Date(2025, 2, 1);
      const currentMonthExpenses = [
        { id: 1, dueDate: '2025-03-10', amount: 100, paidAmount: 100 },
      ];
      const paycheckService = {
        shouldPromptReset: () => true,
      };
      const result = getPayCycleNudge({
        fixedExpenses: [],
        currentMonth,
        currentMonthExpenses,
        paycheckDates: { nextPayDate: '2025-04-04' },
        paycheckService,
        today: new Date(2025, 2, 20),
      });
      expect(result.nudge).not.toBeNull();
      expect(result.nudge.type).toBe('reset');
      expect(result.nudge.payload.nextPayDisplay).toBeDefined();
      expect(result.nudge.dismissKey).toContain('reset_');
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
        config: { daysNearEndOfMonth: 7, pastMonthScope: 'last_only' },
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

    it('skips reset when paycheckDates.nextPayDate is missing', () => {
      const currentMonth = new Date(2025, 2, 1);
      const paycheckService = { shouldPromptReset: () => true };
      const result = getPayCycleNudge({
        fixedExpenses: [],
        currentMonth,
        currentMonthExpenses: [
          { id: 1, dueDate: '2025-03-01', amount: 100, paidAmount: 100 },
        ],
        paycheckDates: {},
        paycheckService,
        today: new Date(2025, 2, 20),
      });
      expect(result.nudge).toBeNull();
    });
  });
});

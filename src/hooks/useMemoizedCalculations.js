import { useMemo, useCallback } from 'react';

import { usePerformanceTimer } from './usePerformanceMonitor';

/**
 * Custom hook for memoized calculations to optimize expensive operations
 * Provides cached results for complex calculations that don't change often
 */
export const useMemoizedCalculations = (
  expenses,
  accounts,
  creditCards,
  paycheckSettings
) => {
  const { start, end } = usePerformanceTimer();

  // Memoize expense grouping by category
  const expensesByCategory = useMemo(() => {
    start();
    const groups = {};

    expenses.forEach(expense => {
      const category = expense.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(expense);
    });

    const result = groups;
    end('expensesByCategory');
    return result;
  }, [expenses, start, end]);

  // Memoize total calculations
  const totals = useMemo(() => {
    start();

    const totalAmount = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );
    const totalPaid = expenses.reduce(
      (sum, expense) => sum + (expense.paidAmount || 0),
      0
    );
    // Fix: Calculate remaining per expense, not as total difference
    // This prevents overpayments on one card from reducing remaining on other cards
    const totalRemaining = expenses.reduce((total, expense) => {
      const remaining = expense.amount - (expense.paidAmount || 0);
      return total + (remaining > 0 ? remaining : 0);
    }, 0);

    const result = {
      totalAmount,
      totalPaid,
      totalRemaining,
      totalExpenses: expenses.length,
    };

    end('totals');
    return result;
  }, [expenses, start, end]);

  // Memoize category totals
  const categoryTotals = useMemo(() => {
    start();

    const totals = {};
    Object.entries(expensesByCategory).forEach(
      ([category, categoryExpenses]) => {
        const categoryTotal = categoryExpenses.reduce((sum, expense) => {
          const remaining = expense.amount - (expense.paidAmount || 0);
          return sum + (remaining > 0 ? remaining : 0);
        }, 0);

        totals[category] = {
          count: categoryExpenses.length,
          total: categoryTotal,
          paid: categoryExpenses.filter(e => e.status === 'paid').length,
        };
      }
    );

    const result = totals;
    end('categoryTotals');
    return result;
  }, [expensesByCategory, start, end]);

  // Memoize account totals
  const accountTotals = useMemo(() => {
    start();

    const accountTotal = accounts.reduce(
      (sum, account) => sum + (account.currentBalance || 0),
      0
    );
    const creditCardTotal = creditCards.reduce(
      (sum, card) => sum + (card.balance || 0),
      0
    );
    const netWorth = accountTotal - creditCardTotal;

    const result = {
      accountTotal,
      creditCardTotal,
      netWorth,
      totalAccounts: accounts.length,
      totalCreditCards: creditCards.length,
    };

    end('accountTotals');
    return result;
  }, [accounts, creditCards, start, end]);

  // Memoize expense status calculations
  const expenseStatuses = useMemo(() => {
    start();

    const statuses = expenses.map(expense => {
      const remaining = expense.amount - (expense.paidAmount || 0);
      const isOverdue =
        expense.dueDate && new Date(expense.dueDate) < new Date();
      const isPaid = expense.status === 'paid' || remaining <= 0;

      return {
        id: expense.id,
        isPaid,
        isOverdue,
        remaining,
        percentage:
          expense.amount > 0
            ? ((expense.paidAmount || 0) / expense.amount) * 100
            : 0,
      };
    });

    const result = statuses;
    end('expenseStatuses');
    return result;
  }, [expenses, start, end]);

  // Memoize filtered expenses (for search/filter functionality)
  const getFilteredExpenses = useCallback(
    (filters = {}) => {
      start();

      let filtered = expenses;

      if (filters.category) {
        filtered = filtered.filter(
          expense => (expense.category || 'Uncategorized') === filters.category
        );
      }

      if (filters.status) {
        filtered = filtered.filter(expense => {
          const remaining = expense.amount - (expense.paidAmount || 0);
          switch (filters.status) {
            case 'paid':
              return expense.status === 'paid' || remaining <= 0;
            case 'unpaid':
              return expense.status !== 'paid' && remaining > 0;
            case 'overdue':
              return (
                expense.dueDate &&
                new Date(expense.dueDate) < new Date() &&
                remaining > 0
              );
            default:
              return true;
          }
        });
      }

      if (filters.accountId) {
        filtered = filtered.filter(
          expense => expense.accountId === filters.accountId
        );
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(
          expense =>
            expense.name.toLowerCase().includes(searchLower) ||
            (expense.category || '').toLowerCase().includes(searchLower)
        );
      }

      const result = filtered;
      end('getFilteredExpenses');
      return result;
    },
    [expenses, start, end]
  );

  // Memoize sorted expenses
  const getSortedExpenses = useCallback(
    (expensesList, sortBy = 'dueDate') => {
      start();

      const sorted = [...expensesList].sort((a, b) => {
        switch (sortBy) {
          case 'dueDate':
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
          case 'name':
            return a.name.localeCompare(b.name);
          case 'amount':
            return b.amount - a.amount;
          case 'remaining':
            const remainingA = a.amount - (a.paidAmount || 0);
            const remainingB = b.amount - (b.paidAmount || 0);
            return remainingB - remainingA;
          default:
            return 0;
        }
      });

      const result = sorted;
      end('getSortedExpenses');
      return result;
    },
    [start, end]
  );

  return {
    expensesByCategory,
    totals,
    categoryTotals,
    accountTotals,
    expenseStatuses,
    getFilteredExpenses,
    getSortedExpenses,
  };
};

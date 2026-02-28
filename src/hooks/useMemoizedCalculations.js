import { useMemo, useCallback } from 'react';

/**
 * Custom hook for memoized calculations to optimize expensive operations
 * Provides cached results for complex calculations that don't change often
 */
export const useMemoizedCalculations = (
  expenses,
  accounts,
  creditCards,
  paycheckSettings, // eslint-disable-line no-unused-vars
) => {
  // Memoize expense grouping by category
  const expensesByCategory = useMemo(() => {
    const groups = {};

    expenses.forEach(expense => {
      const category = expense.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(expense);
    });

    return groups;
  }, [expenses]);

  // Memoize total calculations
  const totals = useMemo(() => {
    const totalAmount = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const totalPaid = expenses.reduce(
      (sum, expense) => sum + (expense.paidAmount || 0),
      0,
    );

    // Fix: Calculate remaining per expense, not as total difference
    // This prevents overpayments on one card from reducing remaining
    // on other cards
    const totalRemaining = expenses.reduce((total, expense) => {
      const remaining = expense.amount - (expense.paidAmount || 0);
      return total + (remaining > 0 ? remaining : 0);
    }, 0);

    return {
      totalAmount,
      totalPaid,
      totalRemaining,
      totalExpenses: expenses.length,
    };
  }, [expenses]);

  // Memoize category totals
  const categoryTotals = useMemo(() => {
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
          paid: categoryExpenses.filter(
            e => (e.paidAmount || 0) >= e.amount && e.amount > 0,
          ).length,
        };
      },
    );

    return totals;
  }, [expensesByCategory]);

  // Memoize account totals
  const accountTotals = useMemo(() => {
    const accountTotal = accounts.reduce(
      (sum, account) => sum + (account.currentBalance || 0),
      0,
    );
    const creditCardTotal = creditCards.reduce(
      (sum, card) => sum + (card.balance || 0),
      0,
    );
    const netWorth = accountTotal - creditCardTotal;

    return {
      accountTotal,
      creditCardTotal,
      netWorth,
      totalAccounts: accounts.length,
      totalCreditCards: creditCards.length,
    };
  }, [accounts, creditCards]);

  // Memoize expense status calculations
  const expenseStatuses = useMemo(() => {
    return expenses.map(expense => {
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
            : 0, // eslint-disable-line operator-linebreak
      };
    });
  }, [expenses]);

  // Memoize filtered expenses (for search/filter functionality)
  const getFilteredExpenses = useCallback(
    (filters = {}) => {
      let filtered = expenses;

      if (filters.category) {
        filtered = filtered.filter(
          expense => (expense.category || 'Uncategorized') === filters.category,
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
          expense => expense.accountId === filters.accountId,
        );
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(
          expense =>
            expense.name.toLowerCase().includes(searchLower) ||
            (expense.category || '').toLowerCase().includes(searchLower),
        );
      }

      if (filters.expenseType) {
        switch (filters.expenseType) {
          case 'recurring':
            filtered = filtered.filter(
              expense =>
                expense.recurringTemplateId !== null &&
                expense.recurringTemplateId !== undefined,
            );
            break;
          case 'oneoff':
            filtered = filtered.filter(
              expense =>
                expense.recurringTemplateId === null ||
                expense.recurringTemplateId === undefined,
            );
            break;
          case 'all':
          default:
            // No filter
            break;
        }
      }

      return filtered;
    },
    [expenses],
  );

  // Memoize sorted expenses
  const getSortedExpenses = useCallback((expensesList, sortBy = 'dueDate') => {
    if (sortBy === 'dueDate') {
      // Schwartzian transform: pre-compute timestamps O(N), then sort on numbers
      return expensesList
        .map(e => ({
          e,
          key: e.dueDate ? new Date(e.dueDate).getTime() : Infinity,
        }))
        .sort((a, b) => a.key - b.key)
        .map(({ e }) => e);
    }

    return [...expensesList].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'amount':
          return b.amount - a.amount;
        case 'remaining': {
          const remainingA = a.amount - (a.paidAmount || 0);
          const remainingB = b.amount - (b.paidAmount || 0);
          return remainingB - remainingA;
        }
        default:
          return 0;
      }
    });
  }, []);

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

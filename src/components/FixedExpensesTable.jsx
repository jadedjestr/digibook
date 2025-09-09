import React from 'react';

import ExpenseTableContainer from './FixedExpensesTable/ExpenseTableContainer';

/**
 * FixedExpensesTable - Main component for displaying and managing fixed expenses
 * This is now a wrapper around the refactored ExpenseTableContainer
 *
 * The original 1,142-line component has been broken down into:
 * - ExpenseTableContainer: Main state management and coordination
 * - ExpenseTableHeader: Header with controls and summary
 * - ExpenseCategoryGroup: Individual category display
 * - ExpenseTableBody: Desktop table view
 * - ExpenseMobileView: Mobile card view
 *
 * Note: ExpenseTableContainer now uses Zustand store directly, so no props needed
 */
const FixedExpensesTable = () => {
  return <ExpenseTableContainer />;
};

export default FixedExpensesTable;

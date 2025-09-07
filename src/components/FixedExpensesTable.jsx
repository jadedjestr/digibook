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
 */
const FixedExpensesTable = ({
  expenses,
  accounts,
  creditCards = [],
  paycheckSettings,
  onDataChange,
  onAccountChange,
  isPanelOpen,
  setIsPanelOpen,
}) => {
  return (
    <ExpenseTableContainer
      expenses={expenses}
      accounts={accounts}
      creditCards={creditCards}
      paycheckSettings={paycheckSettings}
      onDataChange={onDataChange}
      onAccountChange={onAccountChange}
      isPanelOpen={isPanelOpen}
      setIsPanelOpen={setIsPanelOpen}
    />
  );
};

export default FixedExpensesTable;
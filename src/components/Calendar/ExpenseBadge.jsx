import PropTypes from 'prop-types';
import { useState } from 'react';

import QuickActions from './QuickActions';

/**
 * Individual expense badge with PaycheckService status integration
 */
const ExpenseBadge = ({ expense, paycheckService, paycheckDates }) => {
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Calculate status using PaycheckService
  const status = paycheckService.calculateExpenseStatus(expense, paycheckDates);
  const statusColor = paycheckService.getStatusColor(status);

  // Format expense display text
  const formatExpenseText = expense => {
    const { name, amount, paidAmount } = expense;
    const remainingAmount = amount - (paidAmount || 0);

    // Truncate long names
    const displayName = name.length > 12 ? `${name.substring(0, 12)}...` : name;

    // Show payment status
    if (paidAmount > 0 && paidAmount < amount) {
      return `${displayName} $${amount.toLocaleString()} ($${paidAmount.toLocaleString()} paid)`;
    }

    return `${displayName} $${amount.toLocaleString()}`;
  };

  // Get status class for styling
  const getStatusClass = status => {
    switch (status) {
      case 'Paid':
        return 'expense-badge--paid';
      case 'Partially Paid':
        return 'expense-badge--partially-paid';
      case 'Overdue':
        return 'expense-badge--overdue';
      case 'Pay This Week':
        return 'expense-badge--pay-this-week';
      case 'Pay with Next Check':
        return 'expense-badge--pay-next-check';
      case 'Pay with Following Check':
        return 'expense-badge--pay-following-check';
      default:
        return 'expense-badge--unknown';
    }
  };

  const expenseText = formatExpenseText(expense);
  const statusClass = getStatusClass(status);
  const remainingAmount = expense.amount - (expense.paidAmount || 0);
  
  // Check if this is a recurring expense
  const isRecurring = expense.recurringTemplateId !== null && expense.recurringTemplateId !== undefined;
  const recurringClass = isRecurring ? 'expense-badge--recurring' : '';

  return (
    <>
      <div
        className={`expense-badge ${statusClass} ${recurringClass}`.trim()}
        title={`${expense.name} - $${expense.amount.toLocaleString()}\nStatus: ${status}\nRemaining: $${remainingAmount.toLocaleString()}${isRecurring ? '\n🔄 Recurring Expense' : ''}`}
        role='button'
        tabIndex={0}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setShowQuickActions(true);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setShowQuickActions(true);
          }
        }}
      >
        {expenseText}
      </div>

      {showQuickActions && (
        <QuickActions
          selectedExpense={expense}
          onClose={() => setShowQuickActions(false)}
        />
      )}
    </>
  );
};

export default ExpenseBadge;

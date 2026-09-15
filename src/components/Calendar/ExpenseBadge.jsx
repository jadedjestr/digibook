import PropTypes from 'prop-types';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import ResolveExpenseModal from '../ResolveExpenseModal';

/**
 * Individual expense badge with PaycheckService status integration
 */
const ExpenseBadge = ({ expense, paycheckService, paycheckDates }) => {
  const [showResolveModal, setShowResolveModal] = useState(false);

  // A Virtual Ledger forecast entry - not a real row, nothing to resolve
  // yet. Skip status math entirely; it's not "due" in any actionable sense.
  const isVirtual = expense.isVirtual === true;

  // Calculate status using PaycheckService
  const status = isVirtual
    ? null
    : paycheckService.calculateExpenseStatus(expense, paycheckDates);

  // Format expense display text (returns name and amount for separate elements)
  const formatExpenseText = expense => {
    const { name, amount, paidAmount } = expense;

    // Truncate long names
    const displayName = name.length > 15 ? `${name.substring(0, 15)}...` : name;

    if (isVirtual) {
      // Estimated, not committed - the Virtual Ledger's estimatedAmount for
      // a variable-amount template is a guess, and for a fixed-amount
      // template it's the same number that'll materialize anyway. Either
      // way, "~" signals this isn't a real bill yet.
      return { displayName, amountText: `~$${amount.toLocaleString()}` };
    }

    // Amount text; include paid status when partially paid
    let amountText = `$${amount.toLocaleString()}`;
    if (paidAmount > 0 && paidAmount < amount) {
      amountText = `$${amount.toLocaleString()} ($${paidAmount.toLocaleString()} paid)`;
    }

    return { displayName, amountText };
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

  const { displayName, amountText } = formatExpenseText(expense);
  const statusClass = isVirtual
    ? 'expense-badge--virtual'
    : getStatusClass(status);
  const remainingAmount = expense.amount - (expense.paidAmount || 0);

  // Check if this is a recurring expense
  const isRecurring =
    expense.recurringTemplateId !== null &&
    expense.recurringTemplateId !== undefined;
  const recurringClass = isRecurring ? 'expense-badge--recurring' : '';
  const oneOffClass = !isRecurring ? 'expense-badge--oneoff' : '';

  const title = isVirtual
    ? `${expense.name} - ~$${expense.amount.toLocaleString()}\nForecast: not due yet${expense.isVariableAmount ? ' (estimated - amount varies)' : ''}`
    : `${expense.name} - $${expense.amount.toLocaleString()}\nStatus: ${status}\nRemaining: $${remainingAmount.toLocaleString()}${isRecurring ? '\n🔄 Recurring Expense' : '\n📅 One-time Expense'}`;

  // Virtual entries are a forecast, not a real row - nothing exists yet to
  // resolve, so the badge isn't interactive.
  const handleActivate = isVirtual
    ? undefined
    : e => {
        e.preventDefault();
        e.stopPropagation();
        setShowResolveModal(true);
      };

  return (
    <>
      <div
        className={`expense-badge ${statusClass} ${recurringClass} ${oneOffClass}`.trim()}
        title={title}
        role={isVirtual ? undefined : 'button'}
        tabIndex={isVirtual ? undefined : 0}
        onClick={handleActivate}
        onKeyDown={
          isVirtual
            ? undefined
            : e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowResolveModal(true);
                }
              }
        }
      >
        {!isRecurring && (
          <span
            className='expense-badge-oneoff-indicator'
            title='One-time expense'
          >
            📅
          </span>
        )}
        <span className='expense-badge-name'>{displayName}</span>
        <span className='expense-badge-amount'>{amountText}</span>
      </div>

      {showResolveModal &&
        createPortal(
          <ResolveExpenseModal
            expense={expense}
            isOpen={showResolveModal}
            onClose={() => setShowResolveModal(false)}
          />,
          document.body,
        )}
    </>
  );
};

ExpenseBadge.propTypes = {
  expense: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string.isRequired,
    amount: PropTypes.number.isRequired,
    paidAmount: PropTypes.number,
    recurringTemplateId: PropTypes.number,
    isVariableAmount: PropTypes.bool,
    isVirtual: PropTypes.bool,
  }).isRequired,
  paycheckService: PropTypes.shape({
    calculateExpenseStatus: PropTypes.func.isRequired,
    getStatusColor: PropTypes.func.isRequired,
  }).isRequired,
  paycheckDates: PropTypes.object.isRequired,
};

export default ExpenseBadge;

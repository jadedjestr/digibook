import PropTypes from 'prop-types';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import { DateUtils } from '../../utils/dateUtils';
import ResolveExpenseModal from '../ResolveExpenseModal';

/**
 * Individual expense badge with PaycheckService status integration
 */
const ExpenseBadge = ({ expense, paycheckService, paycheckDates }) => {
  const [showResolveModal, setShowResolveModal] = useState(false);

  // A Virtual Ledger forecast entry - not a real row, nothing to resolve
  // yet. Skip status math entirely; it's not "due" in any actionable sense.
  const isVirtual = expense.isVirtual === true;

  // A resolved cycle (paid in full / Skipped / short Partial): the row
  // still exists but the cycle is settled - its shortfall lives in the
  // spun-off Balance Due. Settled and inert, never actionable again.
  const isResolved = expense.resolution !== undefined;

  // Calculate status using PaycheckService
  const status =
    isVirtual || isResolved
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
  let statusClass;
  if (isVirtual) {
    statusClass = 'expense-badge--virtual';
  } else if (isResolved) {
    statusClass = `expense-badge--${expense.resolution.type}`; // paid | skipped | partial
  } else {
    statusClass = getStatusClass(status);
  }
  const remainingAmount = expense.amount - (expense.paidAmount || 0);

  // Check if this is a recurring expense
  const isRecurring =
    expense.recurringTemplateId !== null &&
    expense.recurringTemplateId !== undefined;
  const recurringClass = isRecurring ? 'expense-badge--recurring' : '';
  const oneOffClass = !isRecurring ? 'expense-badge--oneoff' : '';

  let title;
  if (isVirtual) {
    title = `${expense.name} - ~$${expense.amount.toLocaleString()}\nForecast: not due yet${expense.isVariableAmount ? ' (estimated - amount varies)' : ''}`;
  } else if (isResolved) {
    // resolvedAt is an ISO timestamp - formatShortDate's parser needs the
    // date part only.
    const paidOn = DateUtils.formatShortDate(
      expense.resolution.resolvedAt.slice(0, 10),
    );
    const shortfall =
      (expense.resolution.committedAmount || 0) -
      (expense.resolution.paidAmount || 0);
    let statusLine;
    if (expense.resolution.type === 'paid') {
      statusLine = `Paid in Full on ${paidOn}`;
    } else if (expense.resolution.type === 'skipped') {
      statusLine = `Skipped (No Payment) — owed as Balance Due ($${shortfall.toLocaleString()})`;
    } else {
      statusLine = `Partial Paid ($${(expense.resolution.paidAmount || 0).toLocaleString()} paid)`;
    }
    title = `${expense.name} - $${expense.amount.toLocaleString()}\nStatus: ${statusLine}\nRemaining: $${remainingAmount.toLocaleString()}${isRecurring ? '\n🔄 Recurring Expense' : '\n📅 One-time Expense'}`;
  } else {
    title = `${expense.name} - $${expense.amount.toLocaleString()}\nStatus: ${status}\nRemaining: $${remainingAmount.toLocaleString()}${isRecurring ? '\n🔄 Recurring Expense' : '\n📅 One-time Expense'}`;
  }

  // Virtual entries are a forecast, not a real row - nothing exists yet to
  // resolve. Resolved cycles are settled - re-resolving one would double-
  // debit the account and double-advance the cadence. Neither is
  // interactive.
  const inert = isVirtual || isResolved;

  const handleActivate = inert
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
        role={inert ? undefined : 'button'}
        tabIndex={inert ? undefined : 0}
        onClick={handleActivate}
        onKeyDown={
          inert
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
        !inert &&
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
    resolution: PropTypes.shape({
      type: PropTypes.oneOf(['paid', 'skipped', 'partial']).isRequired,
      resolvedAt: PropTypes.string.isRequired,
      paidAmount: PropTypes.number,
      committedAmount: PropTypes.number,
    }),
  }).isRequired,
  paycheckService: PropTypes.shape({
    calculateExpenseStatus: PropTypes.func.isRequired,
    getStatusColor: PropTypes.func.isRequired,
  }).isRequired,
  paycheckDates: PropTypes.object.isRequired,
};

export default ExpenseBadge;

import PropTypes from 'prop-types';

import { formatCurrency } from '../utils/accountUtils';
import { formatRelativeDueDate } from '../utils/dueDateLabel';
import { findPaymentSource } from '../utils/expenseUtils';

import PrivacyWrapper from './PrivacyWrapper';
import StatusBadge from './StatusBadge';

/**
 * One row in the priority list — name, payment source, remaining amount,
 * relative due date, and a Pay Now action.
 *
 * No local paid/overdue logic. `PriorityExpenseList` already ran the
 * classification that decided which section this row lives in; the section
 * header carries that meaning, so the row itself doesn't repeat a status
 * badge — matching the approved mockup. The one exception is `isBalanceDue`:
 * that's not a payment-status judgment made locally, it's a fact handed
 * down from the resolution log (this row is a shortfall spun off from a
 * different bill's cycle, not a bill in its own right), so it gets a small
 * badge of its own.
 */
const PriorityExpenseRow = ({
  expense,
  accounts,
  creditCards,
  onPayNow,
  isBalanceDue,
}) => {
  const source = findPaymentSource(expense, accounts, creditCards);
  const remaining = expense.amount - (expense.paidAmount || 0);

  return (
    <div className='priority-list-item'>
      <div className='priority-list-item-main'>
        <p className='priority-list-item-name'>
          {expense.name}
          {isBalanceDue && (
            <StatusBadge status='Balance Due' className='ml-2 align-middle' />
          )}
        </p>
        <p className='priority-list-item-meta'>
          {source?.name || 'No source set'} ·{' '}
          {formatRelativeDueDate(expense.dueDate)}
        </p>
      </div>
      <div className='priority-list-item-amount-group'>
        <span className='priority-list-item-amount'>
          <PrivacyWrapper>{formatCurrency(remaining)}</PrivacyWrapper>
        </span>
        <button
          type='button'
          className='priority-list-item-pay-now'
          onClick={() => onPayNow(expense)}
        >
          Pay now
        </button>
      </div>
    </div>
  );
};

PriorityExpenseRow.propTypes = {
  expense: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    amount: PropTypes.number.isRequired,
    paidAmount: PropTypes.number,
    dueDate: PropTypes.string,
    accountId: PropTypes.string,
    creditCardId: PropTypes.string,
  }).isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  creditCards: PropTypes.arrayOf(PropTypes.object).isRequired,
  onPayNow: PropTypes.func.isRequired,
  isBalanceDue: PropTypes.bool,
};

PriorityExpenseRow.defaultProps = {
  isBalanceDue: false,
};

export default PriorityExpenseRow;

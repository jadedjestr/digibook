import PropTypes from 'prop-types';

import { formatCurrency } from '../utils/accountUtils';
import { formatRelativeDueDate } from '../utils/dueDateLabel';
import { findPaymentSource } from '../utils/expenseUtils';

import PrivacyWrapper from './PrivacyWrapper';

/**
 * One row in the priority list — name, payment source, remaining amount,
 * relative due date, and a Pay Now action.
 *
 * No local paid/overdue logic. `PriorityExpenseList` already ran the
 * classification that decided which section this row lives in; the section
 * header carries that meaning, so the row itself doesn't repeat a status
 * badge — matching the approved mockup.
 */
const PriorityExpenseRow = ({ expense, accounts, creditCards, onPayNow }) => {
  const source = findPaymentSource(expense, accounts, creditCards);
  const remaining = expense.amount - (expense.paidAmount || 0);

  return (
    <div className='priority-list-item'>
      <div className='priority-list-item-main'>
        <p className='priority-list-item-name'>{expense.name}</p>
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
};

export default PriorityExpenseRow;

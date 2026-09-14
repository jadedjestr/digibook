import { Check, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';

import { formatCurrency } from '../utils/accountUtils';

import InlineEdit from './InlineEdit';
import PrivacyWrapper from './PrivacyWrapper';

const PendingTransactionRow = ({
  transaction,
  account = null,
  projectedBalance,
  accountOptions,
  categoryOptions,
  onUpdateTransaction,
  onComplete,
  onDelete,
}) => {
  const isProjectedDown = projectedBalance < (account?.currentBalance ?? 0);

  return (
    <div className='glass-row-list-item'>
      <div className='glass-row-list-item-main glass-row-list-item-main--stacked'>
        <div className='glass-row-list-item-title'>
          <InlineEdit
            value={transaction.description}
            onSave={description =>
              onUpdateTransaction(transaction.id, { description })
            }
            showEditIcon
          />
        </div>

        <div className='glass-row-list-item-meta'>
          <span className='glass-row-list-item-meta-field'>
            <span className='sr-only'>Account: </span>
            <InlineEdit
              value={transaction.accountId}
              onSave={accountId =>
                onUpdateTransaction(transaction.id, {
                  accountId: accountId || '',
                })
              }
              options={accountOptions}
              showEditIcon
            />
          </span>
          <span className='glass-row-list-item-meta-field'>
            <span className='sr-only'>Category: </span>
            <InlineEdit
              value={transaction.category}
              onSave={category =>
                onUpdateTransaction(transaction.id, { category })
              }
              options={categoryOptions}
              showEditIcon
            />
          </span>
          <span className='glass-row-list-item-meta-field'>
            <span className='sr-only'>Date: </span>
            <InlineEdit
              value={transaction.date}
              onSave={date => onUpdateTransaction(transaction.id, { date })}
              type='date'
              showEditIcon
            />
          </span>
        </div>
      </div>

      <div className='glass-row-list-stats'>
        <div className='glass-row-list-stat'>
          <span className='glass-row-list-stat-label'>Amount</span>
          <span
            className={`glass-row-list-stat-value ${
              transaction.amount < 0 ? 'text-red-400' : ''
            }`}
          >
            <InlineEdit
              value={transaction.amount}
              onSave={amount => onUpdateTransaction(transaction.id, { amount })}
              type='number'
              showEditIcon
            />
          </span>
        </div>

        <div className='glass-row-list-stat'>
          <span className='glass-row-list-stat-label'>Projected</span>
          <span
            className={`glass-row-list-stat-value ${
              isProjectedDown ? 'text-yellow-400' : ''
            }`}
          >
            <PrivacyWrapper>{formatCurrency(projectedBalance)}</PrivacyWrapper>
          </span>
        </div>

        <div className='glass-row-list-actions'>
          <button
            type='button'
            onClick={() => onComplete(transaction.id)}
            className='glass-row-list-icon-btn text-green-400 hover:text-green-300 hover:bg-green-500/20'
            title='Mark as Completed'
          >
            <Check size={16} />
          </button>
          <button
            type='button'
            onClick={() => onDelete(transaction.id)}
            className='glass-row-list-icon-btn text-red-400 hover:text-red-300 hover:bg-red-500/20'
            title='Delete Transaction'
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

PendingTransactionRow.propTypes = {
  transaction: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    accountId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    amount: PropTypes.number.isRequired,
    category: PropTypes.string,
    description: PropTypes.string,
    date: PropTypes.string,
  }).isRequired,
  account: PropTypes.shape({
    currentBalance: PropTypes.number,
  }),
  projectedBalance: PropTypes.number.isRequired,
  accountOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.any,
      label: PropTypes.string,
    }),
  ).isRequired,
  categoryOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.any,
      label: PropTypes.string,
    }),
  ).isRequired,
  onUpdateTransaction: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default PendingTransactionRow;

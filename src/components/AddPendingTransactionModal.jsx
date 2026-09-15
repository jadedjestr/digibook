import { ArrowDown, ArrowUp, DollarSign, Receipt, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import { dbHelpers } from '../db/database-clean';
import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { parseMoneyInput, moneyInputErrorMessage } from '../utils/validation';

const emptyTransaction = () => ({
  accountId: '',
  amount: '',
  category: '',
  description: '',
  date: DateUtils.today(),
  type: 'expense',
});

const AddPendingTransactionModal = ({
  isOpen,
  onClose,
  accounts,
  categoryOptions,
  onTransactionAdded,
}) => {
  const [transaction, setTransaction] = useState(emptyTransaction);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setTransaction(emptyTransaction());
    setErrors({});
    setIsSaving(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = () => {
    const newErrors = {};
    if (!transaction.accountId) {
      newErrors.accountId = 'Please select an account';
    }
    const parsedAmount = parseMoneyInput(transaction.amount);
    if (!parsedAmount.ok) {
      newErrors.amount = moneyInputErrorMessage(parsedAmount.reason);
    } else if (parsedAmount.value <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!transaction.description.trim()) {
      newErrors.description = 'Description is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const { value: amount } = parseMoneyInput(transaction.amount);
      await dbHelpers.addPendingTransaction({
        ...transaction,
        amount:
          transaction.type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
      });
      logger.success('Transaction added successfully');
      resetForm();
      onTransactionAdded();
    } catch (error) {
      logger.error('Error adding transaction:', error);
      setErrors({ general: 'Failed to add transaction. Please try again.' });
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedAccount = accounts.find(a => a.id === transaction.accountId);
  const parsedAmount = parseMoneyInput(transaction.amount);
  const canPreview =
    Boolean(selectedAccount) && parsedAmount.ok && parsedAmount.value > 0;

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto my-auto'>
      <div
        className='absolute inset-0 bg-black/70'
        onClick={handleClose}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            handleClose();
          }
        }}
        role='button'
        tabIndex={0}
        aria-label='Close modal'
      />

      <div className='relative w-full max-w-md mx-auto glass-panel glass-surface glass-surface--elevated max-h-[90vh] flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0'>
          <div className='flex items-center gap-3'>
            <div className='p-2 rounded-lg bg-emerald-500/20 text-emerald-300'>
              <Receipt size={20} />
            </div>
            <h3 className='text-lg font-semibold text-primary'>
              Add Pending Transaction
            </h3>
          </div>
          <button
            onClick={handleClose}
            className='p-1 text-white/50 hover:text-white transition-colors'
            aria-label='Close'
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className='p-6 space-y-5 overflow-y-auto flex-1 min-h-0'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-wide text-muted mb-2'>
              Type &amp; amount
            </p>
            <div className='flex gap-2 mb-3'>
              <button
                type='button'
                onClick={() =>
                  setTransaction({ ...transaction, type: 'expense' })
                }
                className={`glass-button glass-button--filter flex-1 flex items-center justify-center gap-2 ${
                  transaction.type === 'expense' ? 'active' : ''
                }`}
              >
                <ArrowDown size={15} />
                Expense
              </button>
              <button
                type='button'
                onClick={() =>
                  setTransaction({ ...transaction, type: 'income' })
                }
                className={`glass-button glass-button--filter flex-1 flex items-center justify-center gap-2 ${
                  transaction.type === 'income' ? 'active' : ''
                }`}
              >
                <ArrowUp size={15} />
                Income
              </button>
            </div>
            <div className='relative'>
              <DollarSign
                size={20}
                className='absolute left-3 top-1/2 -translate-y-1/2 text-white/40'
              />
              <input
                id='pending-tx-amount'
                type='number'
                inputMode='decimal'
                step='0.01'
                placeholder='0.00'
                value={transaction.amount}
                onChange={e =>
                  setTransaction({ ...transaction, amount: e.target.value })
                }
                className={`glass-input w-full text-center text-2xl font-semibold py-3 pl-10 ${
                  errors.amount ? 'glass-error' : ''
                }`}
              />
            </div>
            {errors.amount && (
              <p className='text-red-400 text-sm mt-1'>{errors.amount}</p>
            )}
          </div>

          <div>
            <p className='text-xs font-semibold uppercase tracking-wide text-muted mb-2'>
              Where
            </p>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label htmlFor='pending-tx-account' className='sr-only'>
                  Account
                </label>
                <select
                  id='pending-tx-account'
                  value={transaction.accountId}
                  onChange={e =>
                    setTransaction({
                      ...transaction,
                      accountId: e.target.value,
                    })
                  }
                  className={`glass-input w-full ${errors.accountId ? 'glass-error' : ''}`}
                >
                  <option value=''>Select Account</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {errors.accountId && (
                  <p className='text-red-400 text-sm mt-1'>
                    {errors.accountId}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor='pending-tx-category' className='sr-only'>
                  Category
                </label>
                <select
                  id='pending-tx-category'
                  value={transaction.category}
                  onChange={e =>
                    setTransaction({ ...transaction, category: e.target.value })
                  }
                  className='glass-input w-full'
                >
                  <option value=''>Select Category</option>
                  {categoryOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p className='text-xs font-semibold uppercase tracking-wide text-muted mb-2'>
              Details
            </p>
            <div className='grid grid-cols-[160px_1fr] gap-3'>
              <div>
                <label htmlFor='pending-tx-date' className='sr-only'>
                  Date
                </label>
                <input
                  id='pending-tx-date'
                  type='date'
                  value={transaction.date}
                  onChange={e =>
                    setTransaction({ ...transaction, date: e.target.value })
                  }
                  className='glass-input w-full'
                />
              </div>
              <div>
                <label htmlFor='pending-tx-description' className='sr-only'>
                  Description
                </label>
                <input
                  id='pending-tx-description'
                  type='text'
                  placeholder='Description'
                  value={transaction.description}
                  onChange={e =>
                    setTransaction({
                      ...transaction,
                      description: e.target.value,
                    })
                  }
                  className={`glass-input w-full ${errors.description ? 'glass-error' : ''}`}
                />
              </div>
            </div>
            {errors.description && (
              <p className='text-red-400 text-sm mt-1'>{errors.description}</p>
            )}
          </div>

          <div className='flex items-start gap-2 rounded-lg border border-dashed border-white/15 bg-white/5 px-3 py-2.5 text-sm text-secondary'>
            <Receipt size={15} className='mt-0.5 flex-none text-muted' />
            {canPreview ? (
              <span>
                {transaction.type === 'expense' ? 'Expense' : 'Income'} of{' '}
                <span className='text-primary font-medium'>
                  {formatCurrency(parsedAmount.value)}
                </span>{' '}
                {transaction.type === 'expense' ? 'from' : 'to'}{' '}
                {selectedAccount.name} on{' '}
                {DateUtils.formatShortDate(transaction.date)}.
              </span>
            ) : (
              <span>
                It&apos;ll appear as a pending transaction. Your balance only
                changes when you confirm the money moved.
              </span>
            )}
          </div>

          {errors.general && (
            <div className='bg-red-500/20 border border-red-400/50 rounded-lg p-3'>
              <p className='text-red-200 text-sm'>{errors.general}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-3 p-6 border-t border-white/10 flex-shrink-0'>
          <button
            onClick={handleClose}
            className='glass-button glass-button--secondary'
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className='glass-button glass-button--primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isSaving ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                <span>Adding...</span>
              </>
            ) : (
              <span>Add Transaction</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

AddPendingTransactionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  categoryOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  onTransactionAdded: PropTypes.func.isRequired,
};

export default AddPendingTransactionModal;

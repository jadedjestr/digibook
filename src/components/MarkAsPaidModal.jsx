import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { formatCurrency } from '../utils/accountUtils';

/**
 * Modal for marking an expense as paid (full or partial).
 * Used by the Upcoming Payments widget "Pay Now" and supports partial payment.
 * onConfirm(newPaidAmount, status) is called with the new total paidAmount and derived status.
 */
const MarkAsPaidModal = ({ expense, isOpen, onClose, onConfirm }) => {
  const amountDue = expense
    ? (expense.amount ?? 0) - (expense.paidAmount ?? 0)
    : 0;
  const [paidAmount, setPaidAmount] = useState(
    amountDue > 0 ? String(amountDue) : '0',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && expense) {
      const due = (expense.amount ?? 0) - (expense.paidAmount ?? 0);
      setPaidAmount(due > 0 ? String(due) : '0');
    }
  }, [isOpen, expense]);

  const handlePayFull = () => {
    setPaidAmount(String(amountDue));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!expense) return;
    const value = parseFloat(paidAmount);
    if (isNaN(value) || value < 0) return;
    const currentPaid = expense.paidAmount ?? 0;
    const newPaidAmount = currentPaid + value;
    const totalAmount = expense.amount ?? 0;
    const status = newPaidAmount >= totalAmount ? 'paid' : 'pending';
    setIsSubmitting(true);
    try {
      await onConfirm(newPaidAmount, status);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'
      role='dialog'
      aria-modal='true'
      aria-labelledby='mark-as-paid-title'
    >
      <div className='glass-panel p-6 max-w-md mx-4'>
        <h3
          id='mark-as-paid-title'
          className='text-lg font-semibold text-white mb-4'
        >
          Mark as paid
        </h3>
        {expense && (
          <>
            <p className='text-white/80 mb-1'>{expense.name}</p>
            <p className='text-sm text-white/60 mb-4'>
              Amount due: {formatCurrency(amountDue)}
            </p>
            <form onSubmit={handleSubmit}>
              <label
                htmlFor='mark-as-paid-amount'
                className='block text-sm font-medium text-white/80 mb-2'
              >
                Amount to pay
              </label>
              <input
                id='mark-as-paid-amount'
                type='number'
                min='0'
                step='0.01'
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                className='w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white mb-3'
              />
              <div className='flex gap-3 mb-4'>
                <button
                  type='button'
                  onClick={handlePayFull}
                  className='flex-1 px-4 py-2 glass-button glass-button--sm'
                >
                  Pay full ({formatCurrency(amountDue)})
                </button>
              </div>
              <div className='flex gap-3'>
                <button
                  type='button'
                  onClick={onClose}
                  className='flex-1 px-4 py-2 glass-button'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isSubmitting}
                  className='flex-1 px-4 py-2 glass-button glass-button--primary'
                >
                  {isSubmitting ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

MarkAsPaidModal.propTypes = {
  expense: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    amount: PropTypes.number,
    paidAmount: PropTypes.number,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

MarkAsPaidModal.defaultProps = {
  expense: null,
};

export default MarkAsPaidModal;

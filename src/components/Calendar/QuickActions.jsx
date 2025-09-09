import React from 'react';

import { useAppStore } from '../../stores/useAppStore';

/**
 * Quick Actions component for calendar interactions
 */
const QuickActions = ({ selectedExpense, onClose }) => {
  const { updateExpense } = useAppStore();

  if (!selectedExpense) return null;

  const handleMarkAsPaid = () => {
    updateExpense(selectedExpense.id, {
      paidAmount: selectedExpense.amount,
    });
    onClose();
  };

  const handleMarkAsPartial = () => {
    const partialAmount = selectedExpense.amount * 0.5; // 50% partial payment
    updateExpense(selectedExpense.id, {
      paidAmount: partialAmount,
    });
    onClose();
  };

  const handleResetPayment = () => {
    updateExpense(selectedExpense.id, {
      paidAmount: 0,
    });
    onClose();
  };

  return (
    <div className='quick-actions-overlay' onClick={onClose}>
      <div
        className='quick-actions-panel glass-panel'
        onClick={e => e.stopPropagation()}
      >
        <div className='quick-actions-header'>
          <h3 className='quick-actions-title'>Quick Actions</h3>
          <button
            onClick={onClose}
            className='quick-actions-close'
            aria-label='Close quick actions'
          >
            <svg
              width='20'
              height='20'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
            >
              <line x1='18' y1='6' x2='6' y2='18' />
              <line x1='6' y1='6' x2='18' y2='18' />
            </svg>
          </button>
        </div>

        <div className='quick-actions-content'>
          <div className='expense-details'>
            <h4 className='expense-name'>{selectedExpense.name}</h4>
            <div className='expense-amount'>
              ${selectedExpense.amount.toLocaleString()}
            </div>
            <div className='expense-due-date'>
              Due: {new Date(selectedExpense.dueDate).toLocaleDateString()}
            </div>
            {selectedExpense.paidAmount > 0 && (
              <div className='expense-paid'>
                Paid: ${selectedExpense.paidAmount.toLocaleString()}
              </div>
            )}
          </div>

          <div className='action-buttons'>
            <button
              onClick={handleMarkAsPaid}
              className='action-button action-button--success glass-button'
            >
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
              >
                <polyline points='20,6 9,17 4,12' />
              </svg>
              Mark as Paid
            </button>

            <button
              onClick={handleMarkAsPartial}
              className='action-button action-button--warning glass-button'
            >
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
              >
                <circle cx='12' cy='12' r='10' />
                <polyline points='12,6 12,12 16,14' />
              </svg>
              Mark 50% Paid
            </button>

            <button
              onClick={handleResetPayment}
              className='action-button action-button--danger glass-button'
            >
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
              >
                <polyline points='1,4 1,10 7,10' />
                <path d='M3.51,15a9,9,0,1,0,2.13-9.36L1,10' />
              </svg>
              Reset Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;

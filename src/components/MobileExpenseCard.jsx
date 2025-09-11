import {
  Edit3,
  Trash2,
  Copy,
  Check,
  X,
  Calendar,
  DollarSign,
  Building2,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { createPaymentSource } from '../types/paymentSource';

import PaymentSourceSelector from './PaymentSourceSelector';
import PrivacyWrapper from './PrivacyWrapper';
import StatusBadge from './StatusBadge';
import CreditCardPaymentInput from './CreditCardPaymentInput';

const MobileExpenseCard = ({
  expense,
  status,
  account,
  isNewExpense,
  isUpdating,
  onMarkAsPaid,
  onDuplicate,
  onDelete,
  onUpdateExpense,
  accounts,
  creditCards,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingField, setEditingField] = useState(null);

  // Create payment source from expense for display
  const currentPaymentSource = useMemo(() => {
    return createPaymentSource.fromExpense(expense);
  }, [expense]);

  // Get payment source display info
  const paymentSourceInfo = useMemo(() => {
    if (expense.accountId) {
      const account = accounts.find(acc => acc.id === expense.accountId);
      return {
        name: account?.name || 'Unknown Account',
        type: 'account',
      };
    } else if (expense.creditCardId) {
      const creditCard = creditCards.find(
        card => card.id === expense.creditCardId
      );
      return {
        name: creditCard?.name || 'Unknown Card',
        type: 'creditCard',
      };
    }
    return {
      name: 'No Payment Source',
      type: 'none',
    };
  }, [expense, accounts, creditCards]);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (field, currentValue) => {
    setEditingField(field);
    if (field === 'paymentSource') {
      setEditValue(currentPaymentSource);
    } else {
      setEditValue(currentValue);
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editingField && editValue !== undefined) {
      let updateData;

      if (editingField === 'paymentSource') {
        // Handle payment source updates
        updateData = {
          accountId: editValue.accountId,
          creditCardId: editValue.creditCardId,
        };
      } else {
        // Handle regular field updates
        updateData = { [editingField]: editValue };
      }

      await onUpdateExpense(expense.id, updateData);
    }
    setIsEditing(false);
    setEditingField(null);
    setEditValue('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingField(null);
    setEditValue('');
  };

  const formatDate = dateString => {
    if (!dateString) return 'Not set';
    return DateUtils.formatShortDate(dateString);
  };

  const formatAmount = amount => {
    return formatCurrency(parseFloat(amount));
  };

  const getStatusColor = status => {
    switch (status) {
      case 'Paid':
        return 'text-green-400';
      case 'Due This Week':
        return 'text-yellow-400';
      case 'Due Next Check':
        return 'text-blue-400';
      case 'Overdue':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div
      className={`
      glass-card transition-all duration-300
      ${isNewExpense ? 'new-expense-animation' : ''}
      ${isUpdating ? 'opacity-50' : ''}
    `}
    >
      {/* Header with name and status */}
      <div className='flex items-start justify-between mb-4'>
        <div className='flex-1 min-w-0'>
          <h3 className='text-lg font-semibold text-primary truncate'>
            {expense.name}
          </h3>
          <div className='flex items-center space-x-2 mt-1'>
            <StatusBadge status={status} />
            <span className={`text-sm font-medium ${getStatusColor(status)}`}>
              {status}
            </span>
          </div>
        </div>
        <div className='flex space-x-1 ml-2'>
          <button
            onClick={() => onMarkAsPaid(expense.id)}
            disabled={isUpdating}
            className='p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 transition-colors'
            title='Mark as paid'
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => onDuplicate(expense)}
            className='p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-colors'
            title='Duplicate'
          >
            <Copy size={16} />
          </button>
          <button
            onClick={() => onDelete(expense.id)}
            className='p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors'
            title='Delete'
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Expense Details Grid */}
      <div className='grid grid-cols-1 gap-4'>
        {/* Amount */}
        <div className='flex items-center justify-between p-3 bg-white/5 rounded-lg'>
          <div className='flex items-center space-x-2'>
            <DollarSign size={16} className='text-primary' />
            <span className='text-sm font-medium text-secondary'>Amount</span>
          </div>
          <div className='text-right'>
            {isEditing && editingField === 'amount' ? (
              <div className='flex items-center space-x-2'>
                <input
                  type='number'
                  step='0.01'
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className='glass-input w-24 text-right'
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  className='p-1 text-green-400 hover:text-green-300'
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={handleCancel}
                  className='p-1 text-red-400 hover:text-red-300'
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleEdit('amount', expense.amount)}
                className='text-lg font-bold text-primary hover:text-white transition-colors'
              >
                <PrivacyWrapper>${formatAmount(expense.amount)}</PrivacyWrapper>
              </button>
            )}
          </div>
        </div>

        {/* Due Date */}
        <div className='flex items-center justify-between p-3 bg-white/5 rounded-lg'>
          <div className='flex items-center space-x-2'>
            <Calendar size={16} className='text-primary' />
            <span className='text-sm font-medium text-secondary'>Due Date</span>
          </div>
          <div className='text-right'>
            {isEditing && editingField === 'dueDate' ? (
              <div className='flex items-center space-x-2'>
                <input
                  type='date'
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className='glass-input text-right'
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  className='p-1 text-green-400 hover:text-green-300'
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={handleCancel}
                  className='p-1 text-red-400 hover:text-red-300'
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleEdit('dueDate', expense.dueDate)}
                className='text-sm font-medium text-primary hover:text-white transition-colors'
              >
                {formatDate(expense.dueDate)}
              </button>
            )}
          </div>
        </div>

        {/* Payment Source */}
        <div className='flex items-center justify-between p-3 bg-white/5 rounded-lg'>
          <div className='flex items-center space-x-2'>
            <Building2 size={16} className='text-primary' />
            <span className='text-sm font-medium text-secondary'>
              Payment Source
            </span>
          </div>
          <div className='text-right'>
            {isEditing && editingField === 'paymentSource' ? (
              <div className='flex items-center space-x-2'>
                <div className='min-w-40'>
                  <PaymentSourceSelector
                    value={editValue}
                    onChange={setEditValue}
                    accounts={accounts}
                    creditCards={creditCards}
                    isCreditCardPayment={
                      expense.category === 'Credit Card Payment'
                    }
                    placeholder='Select payment source'
                  />
                </div>
                <button
                  onClick={handleSave}
                  className='p-1 text-green-400 hover:text-green-300'
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={handleCancel}
                  className='p-1 text-red-400 hover:text-red-300'
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() =>
                  handleEdit('paymentSource', currentPaymentSource)
                }
                className='text-sm font-medium text-primary hover:text-white transition-colors'
              >
                {paymentSourceInfo.name}
              </button>
            )}
          </div>
        </div>

        {/* Paid Amount */}
        <div className='flex items-center justify-between p-3 bg-white/5 rounded-lg'>
          <div className='flex items-center space-x-2'>
            <Check size={16} className='text-primary' />
            <span className='text-sm font-medium text-secondary'>
              Paid Amount
            </span>
          </div>
          <div className='text-right'>
            {isEditing && editingField === 'paidAmount' ? (
              (() => {
                console.log('MobileExpenseCard Debug:', {
                  expenseCategory: expense.category,
                  editingField,
                  isCreditCardPayment:
                    expense.category === 'Credit Card Payment',
                });
                return expense.category === 'Credit Card Payment';
              })() ? (
                <div className='w-full max-w-md'>
                  <CreditCardPaymentInput
                    expense={expense}
                    value={parseFloat(editValue) || 0}
                    onChange={value => setEditValue(value.toString())}
                    onValidationChange={result => {
                      // Store validation result for save button state
                      if (result && !result.isValid) {
                        // Visual feedback could be added here
                      }
                    }}
                    className='w-full'
                    autoFocus={true}
                  />
                  <div className='flex items-center justify-end space-x-2 mt-2'>
                    <button
                      onClick={handleSave}
                      className='p-1 text-green-400 hover:text-green-300'
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancel}
                      className='p-1 text-red-400 hover:text-red-300'
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className='flex items-center space-x-2'>
                  <input
                    type='number'
                    step='0.01'
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className='glass-input w-24 text-right'
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    className='p-1 text-green-400 hover:text-green-300'
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={handleCancel}
                    className='p-1 text-red-400 hover:text-red-300'
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={() => handleEdit('paidAmount', expense.paidAmount)}
                className='text-sm font-medium text-primary hover:text-white transition-colors'
              >
                <PrivacyWrapper>
                  ${formatAmount(expense.paidAmount)}
                </PrivacyWrapper>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className='mt-4'>
        <div className='flex items-center justify-between mb-2'>
          <span className='text-xs text-secondary'>Payment Progress</span>
          <span className='text-xs text-secondary'>
            {((expense.paidAmount / expense.amount) * 100).toFixed(0)}%
          </span>
        </div>
        <div className='w-full bg-white/10 rounded-full h-2'>
          <div
            className='bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300'
            style={{
              width: `${Math.min((expense.paidAmount / expense.amount) * 100, 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default MobileExpenseCard;

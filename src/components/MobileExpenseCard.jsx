import {
  Trash2,
  Copy,
  Check,
  X,
  Calendar,
  DollarSign,
  Building2,
  RefreshCw,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useMemo } from 'react';

import { createPaymentSource } from '../types/paymentSource';
import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { getPaymentSourceInfo } from '../utils/expenseUtils';

import CreditCardPaymentInput from './CreditCardPaymentInput';
import PaymentSourceSelector from './PaymentSourceSelector';
import PrivacyWrapper from './PrivacyWrapper';
import StatusBadge from './StatusBadge';

const MobileExpenseCard = ({
  expense,
  status,
  account: _account,
  isNewExpense,
  isUpdating,
  onMarkAsPaid,
  onDuplicate,
  onDelete,
  onUpdateExpense,
  onEditRecurring,
  accounts,
  creditCards,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingField, setEditingField] = useState(null);

  const isZeroBalanceCCPayment =
    expense.category === 'Credit Card Payment' &&
    expense.targetCreditCardId &&
    expense.amount === 0;

  const currentPaymentSource = useMemo(() => {
    return createPaymentSource.fromExpense(expense);
  }, [expense]);

  // Get payment source display info using V4 format utility
  const paymentSourceInfo = useMemo(() => {
    return getPaymentSourceInfo(expense, accounts, creditCards);
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
          <div className='flex items-center space-x-2'>
            {expense.recurringTemplateId && (
              <RefreshCw
                size={14}
                className='text-amber-400 flex-shrink-0'
                title='Recurring expense'
              />
            )}
            <h3
              className={`text-lg font-semibold text-primary truncate ${
                !expense.recurringTemplateId
                  ? 'border-l-2 border-l-purple-400/30 pl-2'
                  : ''
              }`}
            >
              {expense.name}
            </h3>
            {!expense.recurringTemplateId && (
              <span className='text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/30 flex-shrink-0'>
                One-time
              </span>
            )}
          </div>
          <div className='flex items-center space-x-2 mt-1'>
            <StatusBadge status={status} />
            <span className={`text-sm font-medium ${getStatusColor(status)}`}>
              {status}
            </span>
            <span
              className='text-xs text-white/50'
              title={
                isZeroBalanceCCPayment
                  ? 'No payment due this month (card has $0 balance)'
                  : expense.category === 'Credit Card Payment' &&
                      expense.recurringTemplateId
                    ? 'Recurring minimum payment; amount updates with card balance'
                    : undefined
              }
            >
              {expense.recurringTemplateId ? 'Recurring' : 'One-time'}
            </span>
          </div>
        </div>
        <div className='flex space-x-1 ml-2'>
          {!isZeroBalanceCCPayment && (
            <button
              onClick={() => onMarkAsPaid(expense.id)}
              disabled={isUpdating}
              className='p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 transition-colors'
              title='Mark as paid'
            >
              <Check size={16} />
            </button>
          )}
          {!isZeroBalanceCCPayment && (
            <button
              onClick={() => onDuplicate(expense)}
              className='p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-colors'
              title='Duplicate'
            >
              <Copy size={16} />
            </button>
          )}
          {expense.recurringTemplateId && onEditRecurring && (
            <button
              onClick={() => onEditRecurring(expense)}
              className='p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors'
              title='Edit recurring'
            >
              <RefreshCw size={16} />
            </button>
          )}
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
            {isZeroBalanceCCPayment ? (
              <span className='text-white/40 text-sm italic'>
                No payment due
              </span>
            ) : isEditing && editingField === 'amount' ? (
              <div className='flex items-center space-x-2'>
                <input
                  type='number'
                  step='0.01'
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className='glass-input w-24 text-right'
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
            {(() => {
              const editingPaidAmount =
                isEditing && editingField === 'paidAmount';
              const isCreditCardPayment =
                expense.category === 'Credit Card Payment';
              if (!editingPaidAmount) {
                return (
                  <button
                    onClick={() => handleEdit('paidAmount', expense.paidAmount)}
                    className='text-sm font-medium text-primary hover:text-white transition-colors'
                  >
                    <PrivacyWrapper>
                      ${formatAmount(expense.paidAmount)}
                    </PrivacyWrapper>
                  </button>
                );
              }
              if (isCreditCardPayment) {
                return (
                  <div className='w-full max-w-md'>
                    <CreditCardPaymentInput
                      expense={expense}
                      value={parseFloat(editValue) || 0}
                      onChange={value => setEditValue(value.toString())}
                      onValidationChange={() => {}}
                      className='w-full'
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
                );
              }
              return (
                <div className='flex items-center space-x-2'>
                  <input
                    type='number'
                    step='0.01'
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className='glass-input w-24 text-right'
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
              );
            })()}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isZeroBalanceCCPayment ? (
        <div className='mt-4 text-center text-white/40 text-xs italic'>
          No payment due — card has $0 balance
        </div>
      ) : (
        <div className='mt-4'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-xs text-secondary'>Payment Progress</span>
            <span className='text-xs text-secondary'>
              {expense.amount > 0
                ? ((expense.paidAmount / expense.amount) * 100).toFixed(0)
                : 0}
              %
            </span>
          </div>
          <div className='w-full bg-white/10 rounded-full h-2 overflow-hidden'>
            <div
              className='bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-transform duration-300'
              style={{
                width: '100%',
                transform: `scaleX(${expense.amount > 0 ? Math.min((expense.paidAmount / expense.amount) * 100, 100) / 100 : 0})`,
                transformOrigin: 'left',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

MobileExpenseCard.propTypes = {
  expense: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    amount: PropTypes.number,
    dueDate: PropTypes.string,
    category: PropTypes.string,
    paidAmount: PropTypes.number,
    recurringTemplateId: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
    accountId: PropTypes.string,
    creditCardId: PropTypes.string,
  }).isRequired,
  status: PropTypes.string.isRequired,
  account: PropTypes.object,
  isNewExpense: PropTypes.bool.isRequired,
  isUpdating: PropTypes.bool.isRequired,
  onMarkAsPaid: PropTypes.func.isRequired,
  onDuplicate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onUpdateExpense: PropTypes.func.isRequired,
  onEditRecurring: PropTypes.func.isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  creditCards: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default MobileExpenseCard;

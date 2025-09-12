import { Check, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { dbHelpers } from '../../db/database-clean';
import {
  validatePaymentSource,
  validateCreditCardPayment,
} from '../../utils/expenseValidation';
import { logger } from '../../utils/logger';
import { notify } from '../../utils/notifications';
import PaymentSourceSelector from '../PaymentSourceSelector';

const QuickAddRow = ({
  categoryName,
  accounts,
  creditCards,
  onExpenseAdded,
  onClose,
  isVisible,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    dueDate: '',
    amount: '',
    paymentSource: null,
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const nameInputRef = useRef(null);

  // Focus the name input when the row becomes visible
  useEffect(() => {
    if (isVisible && nameInputRef.current) {
      setTimeout(() => nameInputRef.current.focus(), 100);
    }
  }, [isVisible]);

  // Reset form when category changes or when closed
  useEffect(() => {
    if (!isVisible) {
      setFormData({
        name: '',
        dueDate: '',
        amount: '',
        paymentSource: null,
      });
      setErrors({});
      setJustSaved(false);
    }
  }, [isVisible, categoryName]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Real-time validation
    validateField(field, value);
  };

  const validateField = (field, value) => {
    const newErrors = { ...errors };

    switch (field) {
      case 'name':
        if (!value.trim()) {
          newErrors.name = 'Name is required';
        } else {
          delete newErrors.name;
        }
        break;
      case 'dueDate':
        if (!value) {
          newErrors.dueDate = 'Due date is required';
        } else {
          delete newErrors.dueDate;
        }
        break;
      case 'amount': {
        const amountValue = parseFloat(value);
        if (!value || isNaN(amountValue) || amountValue <= 0) {
          newErrors.amount = 'Amount must be greater than 0';
        } else {
          delete newErrors.amount;
        }
        break;
      }
      case 'paymentSource':
        if (!value) {
          newErrors.paymentSource = 'Payment source is required';
        } else {
          delete newErrors.paymentSource;
        }
        break;
    }

    setErrors(newErrors);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.dueDate) newErrors.dueDate = 'Due date is required';

    const amountValue = parseFloat(formData.amount);
    if (!formData.amount || isNaN(amountValue) || amountValue <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.paymentSource) {
      newErrors.paymentSource = 'Payment source is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const expenseData = {
        name: formData.name.trim(),
        dueDate: formData.dueDate,
        amount: parseFloat(formData.amount),
        accountId: formData.paymentSource?.accountId || null,
        creditCardId: formData.paymentSource?.creditCardId || null,
        category: categoryName,
        paidAmount: 0,
        status: 'pending',
      };

      // Validate the expense data
      validatePaymentSource(expenseData);
      if (categoryName === 'Credit Card Payment') {
        validateCreditCardPayment(expenseData);
      }

      const newExpenseId = await dbHelpers.addFixedExpenseV4(expenseData);

      // Show success notification to user
      notify.success(`Added "${formData.name}" to ${categoryName} expenses`);
      logger.success(`Added new ${categoryName} expense: ${formData.name}`);

      // Call the callback to refresh the data
      onExpenseAdded(newExpenseId);

      // Show brief success state
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1000);

      // Clear the form but keep it open for adding more expenses
      setFormData({
        name: '',
        dueDate: '',
        amount: '',
        paymentSource: formData.paymentSource, // Keep the same payment source
      });
      setErrors({});

      // Focus back to name input for next expense
      if (nameInputRef.current) {
        setTimeout(() => nameInputRef.current.focus(), 100);
      }
    } catch (error) {
      logger.error('Error adding expense:', error);
      setErrors({ submit: 'Failed to add expense. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <tr
      className={`border-t border-white/10 animate-in slide-in-from-top-2 duration-300 ${
        justSaved ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5'
      }`}
      onKeyDown={handleKeyDown}
    >
      {/* Name */}
      <td className='p-3'>
        <div className='space-y-1'>
          <input
            ref={nameInputRef}
            type='text'
            value={formData.name}
            onChange={e => handleInputChange('name', e.target.value)}
            placeholder='Enter expense name...'
            className={`w-full glass-input text-sm ${
              errors.name ? 'border-red-400' : ''
            }`}
          />
          {errors.name && <p className='text-xs text-red-400'>{errors.name}</p>}
        </div>
      </td>

      {/* Due Date */}
      <td className='p-3'>
        <div className='space-y-1'>
          <input
            type='date'
            value={formData.dueDate}
            onChange={e => handleInputChange('dueDate', e.target.value)}
            className={`w-full glass-input text-sm ${
              errors.dueDate ? 'border-red-400' : ''
            }`}
          />
          {errors.dueDate && (
            <p className='text-xs text-red-400'>{errors.dueDate}</p>
          )}
        </div>
      </td>

      {/* Amount */}
      <td className='p-3'>
        <div className='space-y-1'>
          <input
            type='number'
            step='0.01'
            min='0'
            value={formData.amount}
            onChange={e => handleInputChange('amount', e.target.value)}
            placeholder='0.00'
            className={`w-full glass-input text-sm ${
              errors.amount ? 'border-red-400' : ''
            }`}
          />
          {errors.amount && (
            <p className='text-xs text-red-400'>{errors.amount}</p>
          )}
        </div>
      </td>

      {/* Payment Source */}
      <td className='p-3'>
        <div className='space-y-1'>
          <PaymentSourceSelector
            value={formData.paymentSource}
            onChange={paymentSource =>
              handleInputChange('paymentSource', paymentSource)
            }
            accounts={accounts}
            creditCards={creditCards}
            isCreditCardPayment={categoryName === 'Credit Card Payment'}
            placeholder='Select payment source...'
            error={errors.paymentSource}
          />
        </div>
      </td>

      {/* Paid Amount (disabled for new expenses) */}
      <td className='p-3'>
        <span className='text-white/50 text-sm'>$0.00</span>
      </td>

      {/* Status (always pending for new expenses) */}
      <td className='p-3'>
        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'>
          Pending
        </span>
      </td>

      {/* Actions */}
      <td className='p-3'>
        <div className='flex space-x-2'>
          <button
            onClick={handleSave}
            disabled={isSaving || Object.keys(errors).length > 0}
            className={`p-1 transition-colors ${
              isSaving || Object.keys(errors).length > 0
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-green-300 hover:text-green-200'
            }`}
            title={isSaving ? 'Saving...' : 'Save expense (Enter)'}
          >
            {isSaving ? (
              <div className='w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin' />
            ) : (
              <Check size={16} />
            )}
          </button>
          <button
            onClick={onClose}
            className='p-1 text-red-300 hover:text-red-200'
            title='Cancel (Esc)'
          >
            <X size={16} />
          </button>
        </div>
      </td>

      {/* Submit Error */}
      {errors.submit && (
        <td colSpan='7' className='p-3'>
          <p className='text-xs text-red-400'>{errors.submit}</p>
        </td>
      )}
    </tr>
  );
};

export default QuickAddRow;

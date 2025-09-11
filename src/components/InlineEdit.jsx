import { Check, X } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';

import PrivacyWrapper from './PrivacyWrapper';
import CreditCardPaymentInput from './CreditCardPaymentInput';

const InlineEdit = ({
  value,
  onSave,
  type = 'text',
  expense = null,
  fieldName = null,
}) => {
  const [editValue, setEditValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const inputRef = useRef(null);

  // Check if this is a credit card payment amount field
  const isCreditCardPaymentAmount =
    expense?.category === 'Credit Card Payment' &&
    fieldName === 'paidAmount' &&
    type === 'number';

  // Debug logging to see what's happening
  console.log('InlineEdit Debug - ALL CASES:', {
    expenseCategory: expense?.category,
    fieldName,
    type,
    isCreditCardPaymentAmount,
    hasExpense: !!expense,
    expense: expense,
  });

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    // For credit card payments, check validation before saving
    if (
      isCreditCardPaymentAmount &&
      validationResult &&
      !validationResult.isValid
    ) {
      logger.warn('Cannot save invalid credit card payment amount');
      return;
    }

    // Parse number values properly for decimal amounts
    const valueToSave =
      type === 'number' ? parseFloat(editValue) || 0 : editValue;
    onSave(valueToSave);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text') {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  if (isEditing) {
    // Use enhanced credit card payment input for credit card payment amounts
    if (isCreditCardPaymentAmount) {
      return (
        <div className='space-y-2'>
          <div className='flex items-center space-x-2'>
            <div className='flex-1'>
              <CreditCardPaymentInput
                expense={expense}
                value={parseFloat(editValue) || 0}
                onChange={setEditValue}
                onValidationChange={setValidationResult}
                className='w-full'
                autoFocus={true}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={validationResult && !validationResult.isValid}
              className={`p-1 transition-colors ${
                validationResult && !validationResult.isValid
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-green-300 hover:text-green-200'
              }`}
              title={
                validationResult && !validationResult.isValid
                  ? 'Fix errors before saving'
                  : 'Save (Enter)'
              }
            >
              <Check size={14} />
            </button>
            <button
              onClick={handleCancel}
              className='p-1 text-red-300 hover:text-red-200'
              title='Cancel (Esc)'
            >
              <X size={14} />
            </button>
          </div>
        </div>
      );
    }

    // Regular inline editing for other fields
    return (
      <div className='flex items-center space-x-2'>
        {type === 'number' ? (
          <input
            ref={inputRef}
            type='number'
            value={editValue}
            onChange={e => {
              const value = e.target.value;

              // Allow empty string and valid numbers, including incomplete decimals
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setEditValue(value);
              }
            }}
            onKeyDown={handleKeyDown}
            className='glass-input text-sm w-20'
            step='0.01'
            min='0'
          />
        ) : type === 'date' ? (
          <input
            ref={inputRef}
            type='date'
            value={editValue}
            onChange={e => {
              logger.debug('Date input changed:', e.target.value);
              setEditValue(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            className='glass-input text-sm w-32'
          />
        ) : (
          <input
            ref={inputRef}
            type='text'
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className='glass-input text-sm w-full'
          />
        )}
        <button
          onClick={handleSave}
          className='p-1 text-green-300 hover:text-green-200'
          title='Save (Enter)'
        >
          <Check size={14} />
        </button>
        <button
          onClick={handleCancel}
          className='p-1 text-red-300 hover:text-red-200'
          title='Cancel (Esc)'
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  const formatDisplayValue = (val, type) => {
    if (type === 'number') {
      return <PrivacyWrapper>{formatCurrency(parseFloat(val))}</PrivacyWrapper>;
    } else if (type === 'date') {
      if (!val) return '';
      return DateUtils.formatDisplayDate(val);
    }
    return val;
  };

  return (
    <div
      className='cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors'
      onClick={() => setIsEditing(true)}
    >
      {formatDisplayValue(value, type)}
    </div>
  );
};

export default InlineEdit;

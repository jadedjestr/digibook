import { Check, Edit3, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';

import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';

import CreditCardPaymentInput from './CreditCardPaymentInput';
import PrivacyWrapper from './PrivacyWrapper';

const InlineEdit = ({
  value,
  onSave,
  type = 'text',
  expense = null,
  fieldName = null,
  options = null,
  showEditIcon = false,
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

  // Debug logging removed to reduce console noise

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

    // Select dropdown when options provided
    if (options && options.length > 0) {
      return (
        <div className='flex items-center space-x-2'>
          <select
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className='glass-input flex-1 glass-focus'
          >
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            className='text-green-400 hover:text-green-300 transition-colors'
          >
            <Check size={16} />
          </button>
          <button
            onClick={handleCancel}
            className='text-red-400 hover:text-red-300 transition-colors'
          >
            <X size={16} />
          </button>
        </div>
      );
    }

    // Regular inline editing for other fields
    const renderInput = () => {
      if (type === 'number') {
        return (
          <input
            ref={inputRef}
            type='number'
            value={editValue}
            onChange={e => {
              const value = e.target.value;
              const decimalRegex = /^\d*\.?\d*$/;
              if (value === '' || decimalRegex.test(value)) {
                setEditValue(value);
              }
            }}
            onKeyDown={handleKeyDown}
            className='glass-input text-sm w-20'
            step='0.01'
            min='0'
          />
        );
      }
      if (type === 'date') {
        return (
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
        );
      }
      return (
        <input
          ref={inputRef}
          type='text'
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className='glass-input text-sm w-full'
        />
      );
    };

    return (
      <div className='flex items-center space-x-2'>
        {renderInput()}
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
    if (options && options.length > 0) {
      const selectedOption = options.find(option => option.value == val);
      return selectedOption ? selectedOption.label : val;
    }
    if (type === 'number') {
      return <PrivacyWrapper>{formatCurrency(parseFloat(val))}</PrivacyWrapper>;
    }
    if (type === 'date') {
      if (!val) return '';
      return DateUtils.formatDisplayDate(val);
    }
    return val;
  };

  const displayContent = formatDisplayValue(value, type);
  const buttonClass = showEditIcon
    ? 'w-full text-left cursor-pointer hover:bg-white/5 rounded px-2 py-1 transition-all duration-200 group'
    : 'w-full text-left cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors';

  return (
    <button
      type='button'
      className={buttonClass}
      onClick={() => setIsEditing(true)}
      title={showEditIcon ? 'Click to edit' : undefined}
    >
      {showEditIcon ? (
        <>
          <span className='text-primary group-hover:text-white transition-colors'>
            {displayContent}
          </span>
          <Edit3
            size={14}
            className='inline ml-2 text-muted group-hover:text-white transition-colors opacity-0 group-hover:opacity-100'
          />
        </>
      ) : (
        displayContent
      )}
    </button>
  );
};

InlineEdit.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onSave: PropTypes.func.isRequired,
  type: PropTypes.string,
  expense: PropTypes.object,
  fieldName: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.any,
      label: PropTypes.string,
    }),
  ),
  showEditIcon: PropTypes.bool,
};

InlineEdit.defaultProps = {
  type: 'text',
  expense: null,
  fieldName: null,
  options: null,
  showEditIcon: false,
};

export default InlineEdit;

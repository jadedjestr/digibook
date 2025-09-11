import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, DollarSign, CheckCircle, Info } from 'lucide-react';
import { useExpenseOperations } from '../hooks/useExpenseOperations';
import { logger } from '../utils/logger';

/**
 * Enhanced Credit Card Payment Input Component
 *
 * Features:
 * - Real-time validation with overpayment warnings
 * - Smart payment suggestions (minimum, full, custom)
 * - Insufficient funds detection
 * - Credit balance handling
 * - Visual feedback for payment scenarios
 */
const CreditCardPaymentInput = ({
  expense,
  value,
  onChange,
  onValidationChange,
  disabled = false,
  className = '',
  showSuggestions = true,
  autoFocus = false,
}) => {
  const [inputValue, setInputValue] = useState(value?.toString() || '');
  const [validationResult, setValidationResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const { validateCreditCardPaymentAmount, generatePaymentSuggestions } =
    useExpenseOperations();

  // Generate payment suggestions
  const suggestions = useMemo(() => {
    if (
      !showSuggestions ||
      !expense ||
      expense.category !== 'Credit Card Payment'
    ) {
      return [];
    }
    return generatePaymentSuggestions(expense);
  }, [expense, generatePaymentSuggestions, showSuggestions]);

  // Validate payment amount in real-time
  useEffect(() => {
    if (!expense || expense.category !== 'Credit Card Payment') {
      setValidationResult(null);
      return;
    }

    const numericValue = parseFloat(inputValue) || 0;

    if (numericValue === 0) {
      setValidationResult(null);
      if (onValidationChange) onValidationChange(null);
      return;
    }

    try {
      const result = validateCreditCardPaymentAmount(expense, numericValue);
      setValidationResult(result);
      if (onValidationChange) onValidationChange(result);
    } catch (error) {
      logger.error('Validation error:', error);
      setValidationResult({
        isValid: false,
        errors: ['Validation failed'],
        warnings: [],
        suggestions: [],
      });
    }
  }, [
    inputValue,
    expense,
    validateCreditCardPaymentAmount,
    onValidationChange,
  ]);

  const handleInputChange = e => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(parseFloat(newValue) || 0);
  };

  const handleSuggestionClick = suggestion => {
    const amount = suggestion.amount.toFixed(2);
    setInputValue(amount);
    onChange?.(suggestion.amount);
  };

  // Enhanced styling function for Priority 1 improvements
  const getEnhancedInputClass = () => {
    let baseClass = `
      glass-input w-full pl-10 pr-10
      transition-all duration-300 ease-out
      hover:border-white/30
      hover:bg-gradient-to-r hover:from-white/5 hover:via-white/10 hover:to-white/5
      focus:transform focus:-translate-y-0.5
      focus:shadow-[0_10px_25px_rgba(0,0,0,0.2),0_0_0_3px_rgba(59,130,246,0.4),0_0_20px_rgba(59,130,246,0.2)]
      focus:border-blue-400/60
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `;

    // Add contextual color coding based on validation state
    if (validationResult) {
      if (!validationResult.isValid) {
        // Insufficient funds - red with pulse animation
        baseClass +=
          ' border-red-400 border-l-4 border-l-red-500 animate-pulse';
      } else if (validationResult.warnings.length > 0) {
        // Overpayment warning - yellow with subtle pulse
        const isOverpayment = validationResult.warnings.some(
          w =>
            w.toLowerCase().includes('overpay') ||
            w.toLowerCase().includes('more than')
        );
        if (isOverpayment) {
          baseClass += ' border-yellow-400 border-l-4 border-l-yellow-500';
        } else {
          baseClass += ' border-yellow-400 border-l-4 border-l-yellow-500';
        }
      } else {
        // Valid payment - green
        baseClass += ' border-green-400 border-l-4 border-l-green-500';
      }
    } else {
      baseClass += ' border-white/20';
    }

    return baseClass.trim().replace(/\s+/g, ' ');
  };

  const getIconComponent = () => {
    if (!validationResult) return null;
    if (!validationResult.isValid)
      return <AlertTriangle className='text-red-400 animate-pulse' size={16} />;
    if (validationResult.warnings.length > 0)
      return <AlertTriangle className='text-yellow-400' size={16} />;
    return <CheckCircle className='text-green-400' size={16} />;
  };

  // Enhanced suggestion button styling for Priority 1 improvements
  const getEnhancedSuggestionClass = suggestion => {
    const isSelected =
      suggestion.amount.toFixed(2) === parseFloat(inputValue || 0).toFixed(2);

    let baseClass = `
      px-4 py-2.5 rounded-xl text-sm font-medium
      transition-all duration-200 ease-out
      border border-transparent relative overflow-hidden
      transform hover:scale-105 active:scale-98
      hover:shadow-lg
      before:content-[''] before:absolute before:top-0 before:left-[-100%]
      before:w-full before:h-full before:bg-gradient-to-r
      before:from-transparent before:via-white/10 before:to-transparent
      before:transition-all before:duration-500
      hover:before:left-[100%]
    `;

    if (suggestion.type === 'info') {
      baseClass += ' bg-white/10 text-white/50 cursor-not-allowed';
    } else {
      // Enhanced button styling based on suggestion type
      switch (suggestion.type) {
        case 'minimum':
          baseClass += `
            bg-gradient-to-r from-yellow-500/20 to-yellow-600/20
            text-yellow-300 border-yellow-500/30
            hover:from-yellow-500/30 hover:to-yellow-600/30
            hover:border-yellow-400/50 hover:shadow-yellow-500/20
          `;
          break;
        case 'full':
          baseClass += `
            bg-gradient-to-r from-green-500/20 to-green-600/20
            text-green-300 border-green-500/30
            hover:from-green-500/30 hover:to-green-600/30
            hover:border-green-400/50 hover:shadow-green-500/20
          `;
          break;
        default:
          baseClass += `
            bg-gradient-to-r from-blue-500/20 to-blue-600/20
            text-blue-300 border-blue-500/30
            hover:from-blue-500/30 hover:to-blue-600/30
            hover:border-blue-400/50 hover:shadow-blue-500/20
          `;
      }
    }

    if (isSelected) {
      baseClass +=
        ' ring-2 ring-blue-400/60 ring-offset-1 ring-offset-gray-900';
    }

    return baseClass.trim().replace(/\s+/g, ' ');
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Payment Amount Input */}
      <div className='relative'>
        <div className='relative'>
          <DollarSign
            className='absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50'
            size={16}
          />
          <input
            type='number'
            step='0.01'
            min='0'
            value={inputValue}
            onChange={handleInputChange}
            disabled={disabled}
            autoFocus={autoFocus}
            placeholder='0.00'
            className={getEnhancedInputClass()}
          />
          <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
            {getIconComponent()}
          </div>
        </div>

        {/* Validation Messages */}
        {validationResult && (
          <div className='mt-2 space-y-1'>
            {/* Errors */}
            {validationResult.errors.map((error, index) => (
              <div
                key={`error-${index}`}
                className='flex items-start space-x-2 text-red-400 text-sm animate-in slide-in-from-left-2 duration-300'
              >
                <AlertTriangle
                  size={14}
                  className='mt-0.5 flex-shrink-0 animate-pulse'
                />
                <span>{error}</span>
              </div>
            ))}

            {/* Warnings */}
            {validationResult.warnings.map((warning, index) => (
              <div
                key={`warning-${index}`}
                className='flex items-start space-x-2 text-yellow-400 text-sm animate-in slide-in-from-left-2 duration-300'
              >
                <AlertTriangle size={14} className='mt-0.5 flex-shrink-0' />
                <span>{warning}</span>
              </div>
            ))}

            {/* Payment Info */}
            {validationResult.paymentInfo && validationResult.isValid && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className='flex items-center space-x-2 text-blue-400 text-sm hover:text-blue-300 transition-colors duration-200 hover:scale-105 transform'
              >
                <Info size={14} />
                <span>{showDetails ? 'Hide' : 'Show'} payment details</span>
              </button>
            )}
          </div>
        )}

        {/* Payment Details */}
        {showDetails && validationResult?.paymentInfo && (
          <div className='mt-3 glass-card p-3 text-sm space-y-2 animate-in slide-in-from-top-2 duration-300'>
            <div className='grid grid-cols-2 gap-2 text-white/70'>
              <div>Current Debt:</div>
              <div className='text-right font-medium text-white'>
                ${validationResult.paymentInfo.currentDebt.toFixed(2)}
              </div>

              <div>After Payment:</div>
              <div
                className={`text-right font-medium ${
                  validationResult.paymentInfo.afterPaymentDebt <= 0
                    ? 'text-green-400'
                    : 'text-white'
                }`}
              >
                $
                {Math.abs(
                  validationResult.paymentInfo.afterPaymentDebt
                ).toFixed(2)}
                {validationResult.paymentInfo.afterPaymentDebt < 0 &&
                  ' (credit)'}
              </div>

              <div>Available Funds:</div>
              <div className='text-right font-medium text-white'>
                ${validationResult.paymentInfo.availableFunds.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Suggestions */}
      {showSuggestions && suggestions.length > 0 && !disabled && (
        <div className='space-y-2'>
          <label className='text-sm font-medium text-white/70'>
            Payment Suggestions
          </label>
          <div className='flex flex-wrap gap-2'>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={suggestion.type === 'info'}
                className={getEnhancedSuggestionClass(suggestion)}
                title={suggestion.description}
              >
                {suggestion.label}
              </button>
            ))}
          </div>

          {/* Show description of selected suggestion */}
          {suggestions.find(
            s => s.amount.toFixed(2) === parseFloat(inputValue || 0).toFixed(2)
          ) && (
            <div className='text-sm text-white/70 italic animate-in fade-in duration-300'>
              {
                suggestions.find(
                  s =>
                    s.amount.toFixed(2) ===
                    parseFloat(inputValue || 0).toFixed(2)
                )?.description
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const getSuggestionButtonClass = type => {
  switch (type) {
    case 'minimum':
      return 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border border-yellow-500/30';
    case 'full':
      return 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30';
    case 'suggested':
      return 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30';
    case 'affordable':
      return 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30';
    default:
      return 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20';
  }
};

export default CreditCardPaymentInput;

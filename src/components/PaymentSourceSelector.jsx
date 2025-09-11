/**
 * PaymentSourceSelector Component
 *
 * A unified selector for choosing payment sources (accounts or credit cards)
 * using the new dual foreign key architecture. Provides clear visual distinction
 * between account types and handles the two-field credit card payment system.
 *
 * Features:
 * - Clean dropdown interface with proper visual hierarchy
 * - Automatic filtering for credit card payment mode
 * - Real-time balance display
 * - Proper validation integration
 * - Glass design system styling
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  CreditCard,
  PiggyBank,
  Building2,
  ChevronDown,
  Wallet,
} from 'lucide-react';
import PropTypes from 'prop-types';

import {
  createPaymentSource,
  PaymentSourceTypes,
} from '../types/paymentSource';

const PaymentSourceSelector = ({
  value = null,
  onChange,
  accounts = [],
  creditCards = [],
  isCreditCardPayment = false,
  label = 'Payment Source',
  error = null,
  disabled = false,
  placeholder = 'Select payment source',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Create unified options list based on payment type
  const options = useMemo(() => {
    const opts = [];

    // Always include accounts
    accounts.forEach(account => {
      opts.push({
        type: PaymentSourceTypes.ACCOUNT,
        id: account.id,
        name: account.name,
        balance: account.currentBalance || 0,
        accountType: account.type,
        icon: account.type === 'checking' ? Wallet : PiggyBank,
        iconColor:
          account.type === 'checking' ? 'text-blue-400' : 'text-green-400',
        displayBalance: `$${(account.currentBalance || 0).toLocaleString()}`,
        balanceColor:
          account.currentBalance >= 0 ? 'text-green-400' : 'text-red-400',
      });
    });

    // Include credit cards only for regular expenses (not credit card payments)
    if (!isCreditCardPayment) {
      creditCards.forEach(card => {
        opts.push({
          type: PaymentSourceTypes.CREDIT_CARD,
          id: card.id,
          name: card.name,
          balance: card.balance || 0,
          icon: CreditCard,
          iconColor: 'text-red-400',
          displayBalance:
            card.balance > 0
              ? `$${card.balance.toLocaleString()} debt`
              : 'Paid off',
          balanceColor: card.balance > 0 ? 'text-red-400' : 'text-green-400',
        });
      });
    }

    return opts;
  }, [accounts, creditCards, isCreditCardPayment]);

  // Find selected option
  const selectedOption = useMemo(() => {
    if (!value) return null;

    return options.find(opt => {
      if (value.accountId && opt.type === PaymentSourceTypes.ACCOUNT) {
        return opt.id === value.accountId;
      } else if (
        value.creditCardId &&
        opt.type === PaymentSourceTypes.CREDIT_CARD
      ) {
        return opt.id === value.creditCardId;
      }
      return false;
    });
  }, [value, options]);

  const handleSelection = useCallback(
    option => {
      const paymentSource =
        option.type === PaymentSourceTypes.ACCOUNT
          ? createPaymentSource.account(option.id)
          : createPaymentSource.creditCard(option.id);

      onChange(paymentSource);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  }, [disabled, isOpen]);

  const getOptionKey = option => `${option.type}-${option.id}`;

  return (
    <div className='relative'>
      {label && (
        <label className='block text-sm font-medium text-white mb-2'>
          {label}
          {isCreditCardPayment && (
            <span className='ml-2 text-xs text-blue-400'>(Funding Source)</span>
          )}
        </label>
      )}

      <button
        type='button'
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-white/15 cursor-pointer'
        } ${error ? 'border-red-400 focus:ring-red-500/50' : ''}`}
      >
        <div className='flex items-center space-x-3 min-w-0 flex-1'>
          {selectedOption ? (
            <>
              <selectedOption.icon
                size={20}
                className={selectedOption.iconColor}
              />
              <div className='text-left min-w-0 flex-1'>
                <div className='text-white font-medium truncate'>
                  {selectedOption.name}
                </div>
                <div className={`text-sm ${selectedOption.balanceColor}`}>
                  {selectedOption.displayBalance}
                  {selectedOption.accountType && (
                    <span className='ml-2 text-xs text-white/60 capitalize'>
                      {selectedOption.accountType}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <Building2 size={20} className='text-gray-400' />
              <span className='text-gray-400 font-medium'>{placeholder}</span>
            </>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`text-white/60 transition-transform duration-200 flex-shrink-0 ml-2 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && !disabled && options.length > 0 && (
        <div className='absolute top-full left-0 right-0 z-50 mt-2 bg-slate-900/95 border border-white/30 rounded-2xl shadow-2xl max-h-80 overflow-y-auto backdrop-blur-md'>
          {options.map((option, index) => (
            <button
              key={getOptionKey(option)}
              type='button'
              onClick={() => handleSelection(option)}
              className={`w-full flex items-center justify-between px-5 py-4 text-left transition-all duration-150 hover:bg-white/15 cursor-pointer border-b border-white/10 ${
                index === 0 ? 'rounded-t-2xl' : ''
              } ${
                index === options.length - 1 ? 'rounded-b-2xl border-b-0' : ''
              } ${
                selectedOption &&
                getOptionKey(selectedOption) === getOptionKey(option)
                  ? 'bg-white/10'
                  : ''
              }`}
            >
              <div className='flex items-center space-x-3 min-w-0 flex-1'>
                <option.icon size={20} className={option.iconColor} />
                <div className='min-w-0 flex-1'>
                  <div className='text-white font-medium truncate'>
                    {option.name}
                  </div>
                  <div className={`text-sm ${option.balanceColor}`}>
                    {option.displayBalance}
                    {option.accountType && (
                      <span className='ml-2 text-xs text-white/60 capitalize'>
                        {option.accountType}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedOption &&
                getOptionKey(selectedOption) === getOptionKey(option) && (
                  <div className='w-2 h-2 bg-blue-400 rounded-full flex-shrink-0 ml-2' />
                )}
            </button>
          ))}
        </div>
      )}

      {/* Empty state message */}
      {isOpen && !disabled && options.length === 0 && (
        <div className='absolute top-full left-0 right-0 z-50 mt-2 bg-slate-900/95 border border-white/30 rounded-2xl shadow-2xl backdrop-blur-md'>
          <div className='px-5 py-4 text-center text-white/60'>
            {isCreditCardPayment
              ? 'No checking or savings accounts available'
              : 'No payment sources available'}
          </div>
        </div>
      )}

      {error && <p className='mt-2 text-sm text-red-400'>{error}</p>}
    </div>
  );
};

PaymentSourceSelector.propTypes = {
  value: PropTypes.shape({
    type: PropTypes.oneOf([
      PaymentSourceTypes.ACCOUNT,
      PaymentSourceTypes.CREDIT_CARD,
    ]),
    accountId: PropTypes.number,
    creditCardId: PropTypes.number,
  }),
  onChange: PropTypes.func.isRequired,
  accounts: PropTypes.array,
  creditCards: PropTypes.array,
  isCreditCardPayment: PropTypes.bool,
  label: PropTypes.string,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
};

export default PaymentSourceSelector;

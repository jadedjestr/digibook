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

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
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
  const buttonRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

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

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate the height needed for all options
      // Each option is approximately 60px (py-4 = 16px top + 16px bottom + content height)
      const optionHeight = 60;
      const minDropdownHeight = 120; // Minimum height for 2 options
      const maxDropdownHeight = 300; // Maximum height before scrolling
      const totalNeededHeight = Math.min(
        options.length * optionHeight,
        maxDropdownHeight
      );

      // Calculate available space below and above the button
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Add some padding for better UX
      const padding = 20;

      let top, left, width, maxHeight;

      // Determine best position based on available space
      if (spaceBelow >= totalNeededHeight + padding) {
        // Enough space below - position normally
        top = rect.bottom + window.scrollY + 8;
        maxHeight = Math.min(totalNeededHeight, maxDropdownHeight);
      } else if (spaceAbove >= totalNeededHeight + padding) {
        // Not enough space below, but enough above - position above
        top = rect.top + window.scrollY - totalNeededHeight - 8;
        maxHeight = Math.min(totalNeededHeight, maxDropdownHeight);
      } else {
        // Not enough space in either direction - use available space with scrolling
        if (spaceBelow > spaceAbove) {
          // More space below, position below with limited height
          top = rect.bottom + window.scrollY + 8;
          maxHeight = Math.max(spaceBelow - padding, minDropdownHeight);
        } else {
          // More space above, position above with limited height
          top =
            rect.top +
            window.scrollY -
            Math.min(spaceAbove - padding, maxDropdownHeight) -
            8;
          maxHeight = Math.max(spaceAbove - padding, minDropdownHeight);
        }
      }

      // Ensure dropdown doesn't go off the right edge of viewport
      left = Math.min(
        rect.left + window.scrollX,
        viewportWidth - rect.width - 20
      );
      left = Math.max(left, 20); // Don't go off left edge either

      width = rect.width;

      // If we're still constrained, try to scroll the page to create more space
      if (maxHeight < totalNeededHeight && spaceBelow < spaceAbove) {
        // Try to scroll down to create more space below
        const scrollAmount = Math.min(100, totalNeededHeight - maxHeight + 20);
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });

        // Recalculate after a brief delay to allow scroll to complete
        setTimeout(() => {
          const newRect = buttonRef.current.getBoundingClientRect();
          const newSpaceBelow = window.innerHeight - newRect.bottom;
          const newMaxHeight = Math.max(
            newSpaceBelow - padding,
            minDropdownHeight
          );

          setDropdownPosition({
            top: newRect.bottom + window.scrollY + 8,
            left,
            width,
            maxHeight: Math.min(newMaxHeight, maxDropdownHeight),
          });
        }, 100);
      }

      setDropdownPosition({ top, left, width, maxHeight });
    }
  }, [isOpen, options.length]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = event => {
      if (buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = event => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

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
        ref={buttonRef}
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

      {/* Portal dropdown to avoid table overflow issues */}
      {isOpen &&
        !disabled &&
        options.length > 0 &&
        createPortal(
          <div
            className='fixed z-[9999] bg-slate-900/95 border border-white/30 rounded-2xl shadow-2xl backdrop-blur-md'
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: `${dropdownPosition.maxHeight || 300}px`,
              overflowY: 'auto',
              pointerEvents: 'auto', // Ensure click events work
            }}
          >
            {options.map((option, index) => (
              <button
                key={getOptionKey(option)}
                type='button'
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelection(option);
                }}
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
          </div>,
          document.body
        )}

      {/* Empty state message */}
      {isOpen &&
        !disabled &&
        options.length === 0 &&
        createPortal(
          <div
            className='fixed z-[9999] bg-slate-900/95 border border-white/30 rounded-2xl shadow-2xl backdrop-blur-md'
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: `${dropdownPosition.maxHeight || 300}px`,
              overflowY: 'auto',
              pointerEvents: 'auto', // Ensure click events work
            }}
          >
            <div className='px-5 py-4 text-center text-white/60'>
              {isCreditCardPayment
                ? 'No checking or savings accounts available'
                : 'No payment sources available'}
            </div>
          </div>,
          document.body
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

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, CreditCard, PiggyBank, Building2 } from 'lucide-react';

const AccountSelector = ({
  value,
  onSave,
  accounts,
  creditCards = [],
  isEditing = false,
  onEdit = null,
  onCancel = null,
  showSaveCancel = true,
  isCreditCardPayment = false,
}) => {
  const [editValue, setEditValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);

  // Only sync editValue with value prop when not editing
  useEffect(() => {
    if (!isOpen) {
      setEditValue(value);
    }
  }, [value, isOpen]);

  const handleSave = () => {
    console.log(`AccountSelector: Saving account change from ${value} to ${editValue}`);
    // Only save if the account actually changed
    if (editValue !== value) {
      console.log(`AccountSelector: Account changed, calling onSave with ${editValue}`);
      onSave(editValue);
    } else {
      console.log('AccountSelector: No change detected, not calling onSave');
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsOpen(false);
    if (onCancel) onCancel();
  };

  const handleToggleDropdown = (event) => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setIsOpen(!isOpen);
  };

  // Smart account filtering based on expense type
  // For credit card payments: only allow checking/savings accounts (funding source)
  // For regular expenses: allow all accounts (checking, savings, credit cards)
  const allAccounts = isCreditCardPayment 
    ? accounts.map(acc => ({ ...acc, type: 'account' }))
    : [
        ...accounts.map(acc => ({ ...acc, type: 'account' })),
        ...creditCards.map(card => ({
          ...card,
          type: 'creditCard',
          currentBalance: card.balance, // Map balance to currentBalance for consistency
          name: card.name, // Keep original name without "(Credit Card)" suffix
          // Create unique ID by prefixing with 'cc-' to avoid conflicts with regular accounts
          uniqueId: `cc-${card.id}`,
        })),
      ];

  // Find the selected account, checking both regular accounts and credit cards
  const selectedAccount = allAccounts.find(account => account.id === editValue);



  // Get account icon based on type
  const getAccountIcon = (accountType) => {
    switch (accountType?.toLowerCase()) {
    case 'checking':
      return <CreditCard size={16} className="text-blue-400" />;
    case 'savings':
      return <PiggyBank size={16} className="text-green-400" />;
    case 'creditcard':
      return <CreditCard size={16} className="text-red-400" />;
    default:
      return <Building2 size={16} className="text-purple-400" />;
    }
  };

  // Format balance for display
  const formatBalance = (balance) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(balance);
  };

  if (isEditing) {
    return (
      <div className="relative">
        <button
          onClick={handleToggleDropdown}
          className="w-full flex items-center justify-between px-4 py-3 text-sm bg-white/10 rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <div className="flex items-center space-x-3">
            {selectedAccount && getAccountIcon(selectedAccount.type)}
            <div className="text-left">
              <span className={selectedAccount ? 'text-white font-medium' : 'text-gray-400'}>
                {selectedAccount ? selectedAccount.name : 'Select account'}
              </span>
              {selectedAccount && selectedAccount.type === 'creditCard' && (
                <div className="text-xs text-red-300">
                  Credit Card • {selectedAccount.currentBalance > 0 ? `$${selectedAccount.currentBalance.toFixed(2)} debt` : 'Paid off'}
                </div>
              )}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-[9999] mt-2 bg-slate-900/95 border border-white/30 rounded-lg shadow-2xl max-h-96 overflow-y-auto backdrop-blur-md animate-in slide-in-from-top-2 duration-200">

            {allAccounts.map((account) => (
              <button
                key={`${account.type}-${account.id}`}
                onClick={() => {
                  // Prevent clicking on already selected account
                  if (account.id === value) {
                    return;
                  }
                  onSave(account.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-all duration-150 first:rounded-t-lg last:rounded-b-lg border-b border-white/10 last:border-b-0 ${
                  account.id === value
                    ? 'bg-blue-500/20 text-blue-300 cursor-default'
                    : 'text-white hover:bg-white/20 cursor-pointer'
                }`}
                disabled={account.id === value}
              >
                <div className="flex items-center space-x-3">
                  {getAccountIcon(account.type)}
                  <div className="text-left">
                    <div className="font-medium flex items-center space-x-2">
                      <span>{account.name}</span>
                      {account.type === 'creditCard' && (
                        <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-300 rounded-full border border-red-500/30">
                          Credit Card
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">
                      {account.type === 'creditCard' ? 'Debt Account' : account.type}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium ${
                    account.type === 'creditCard' && account.currentBalance > 0 
                      ? 'text-red-400' 
                      : 'text-green-400'
                  }`}>
                    {account.type === 'creditCard' && account.currentBalance > 0 
                      ? `Debt: ${formatBalance(account.currentBalance)}`
                      : formatBalance(account.currentBalance)
                    }
                  </div>
                  {account.type === 'creditCard' && account.creditLimit && (
                    <div className="text-xs text-gray-500">
                      Limit: {formatBalance(account.creditLimit)}
                    </div>
                  )}
                </div>
              </button>
            ))}

            {/* Unlink Account Option */}
            {selectedAccount && (
              <div className="border-t border-white/10">
                <button
                  onClick={() => {
                    console.log('AccountSelector: Unlinking account');
                    onSave(null); // Pass null to indicate unlinking
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-orange-300 hover:bg-orange-500/20 transition-all duration-150"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <span className="text-orange-400">✕</span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Unlink Account</div>
                    <div className="text-xs text-orange-400/70">
                      Remove account mapping
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {showSaveCancel && (
          <div className="flex space-x-2 mt-3">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs bg-green-500/20 text-green-300 rounded-md hover:bg-green-500/30 transition-colors font-medium"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs bg-gray-500/20 text-gray-300 rounded-md hover:bg-gray-500/30 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={buttonRef}
        className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors"
        onClick={handleToggleDropdown}
      >
        <div className="flex items-center space-x-2">
          {selectedAccount && getAccountIcon(selectedAccount.type)}
          <div className="text-left">
            <span className={selectedAccount ? 'text-white' : 'text-gray-400'}>
              {selectedAccount ? selectedAccount.name : (value === null ? 'No Account' : 'Select account')}
            </span>
            {selectedAccount && selectedAccount.type === 'creditCard' && (
              <div className="text-xs text-red-300">
                💳 Credit Card
              </div>
            )}
            {value === null && (
              <div className="text-xs text-orange-300">
                ⚠️ Unlinked
              </div>
            )}
          </div>
          <ChevronDown
            size={14}
            className={`text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {isOpen && createPortal(
        <div
          className="fixed z-[9999] bg-slate-900/95 border border-white/30 rounded-lg shadow-2xl max-h-64 overflow-y-auto backdrop-blur-md"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: Math.max(dropdownPosition.width, 300),
            minWidth: '300px',
            maxWidth: '400px',
          }}
        >
          {allAccounts.map((account) => (
            <button
              key={`${account.type}-${account.id}`}
              onClick={() => {
                // Prevent clicking on already selected account
                if (account.id === value) {
                  return;
                }
                onSave(account.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-all duration-150 first:rounded-t-lg last:rounded-b-lg border-b border-white/10 last:border-b-0 ${
                account.id === value
                  ? 'bg-blue-500/20 text-blue-300 cursor-default'
                  : 'text-white hover:bg-white/20 cursor-pointer'
              }`}
              disabled={account.id === value}
            >
              <div className="flex items-center space-x-3">
                {getAccountIcon(account.type)}
                <div className="text-left">
                  <div className="font-medium">{account.name}</div>
                  <div className="text-xs text-gray-400 capitalize">{account.type}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-green-400">
                  {formatBalance(account.currentBalance)}
                </div>
              </div>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default AccountSelector;

import React, { useState } from 'react';
import { ChevronDown, CreditCard, PiggyBank, Building2 } from 'lucide-react';

const AccountSelector = ({ 
  value, 
  onSave, 
  accounts, 
  isEditing = false, 
  onEdit = null,
  onCancel = null,
  showSaveCancel = true
}) => {
  const [editValue, setEditValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const handleSave = () => {
    onSave(editValue);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsOpen(false);
    if (onCancel) onCancel();
  };

  const handleToggleDropdown = (event) => {
    if (!isOpen) {
      // Calculate position relative to the button
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
  };

  const selectedAccount = accounts.find(account => account.id === editValue);

  // Get account icon based on type
  const getAccountIcon = (accountType) => {
    switch (accountType?.toLowerCase()) {
      case 'checking':
        return <CreditCard size={16} className="text-blue-400" />;
      case 'savings':
        return <PiggyBank size={16} className="text-green-400" />;
      default:
        return <Building2 size={16} className="text-purple-400" />;
    }
  };

  // Format balance for display
  const formatBalance = (balance) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
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
            <span className={selectedAccount ? 'text-white font-medium' : 'text-gray-400'}>
              {selectedAccount ? selectedAccount.name : 'Select account'}
            </span>
          </div>
          <ChevronDown 
            size={16} 
            className={`text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </button>
        
        {isOpen && (
          <div className="fixed z-[9999] bg-slate-900/95 border border-white/30 rounded-lg shadow-2xl max-h-96 overflow-y-auto backdrop-blur-md animate-in slide-in-from-top-2 duration-200" style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width || '400px',
            maxWidth: '90vw'
          }}>

            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  setEditValue(account.id);
                  handleSave();
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/20 transition-all duration-150 first:rounded-t-lg last:rounded-b-lg border-b border-white/10 last:border-b-0"
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
    <div 
      className="cursor-pointer hover:bg-white/10 px-4 py-3 rounded-lg transition-all duration-200"
      onClick={() => onEdit && onEdit()}
    >
      <div className="flex items-center space-x-3">
        {selectedAccount && getAccountIcon(selectedAccount.type)}
        <span className={selectedAccount ? 'text-white font-medium' : 'text-gray-400'}>
          {selectedAccount ? selectedAccount.name : 'Select account'}
        </span>
      </div>
    </div>
  );
};

export default AccountSelector; 
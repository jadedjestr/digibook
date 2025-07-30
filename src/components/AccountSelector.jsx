import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const AccountSelector = ({ 
  value, 
  onSave, 
  accounts, 
  isEditing = false, 
  onEdit = null,
  onCancel = null 
}) => {
  const [editValue, setEditValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = () => {
    onSave(editValue);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsOpen(false);
    if (onCancel) onCancel();
  };

  const selectedAccount = accounts.find(account => account.id === editValue);

  if (isEditing) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white/10 rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
        >
          <span className={selectedAccount ? 'text-white' : 'text-gray-400'}>
            {selectedAccount ? selectedAccount.name : 'Select account'}
          </span>
          <ChevronDown size={16} className="text-secondary" />
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  setEditValue(account.id);
                  handleSave();
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors"
              >
                {account.name}
              </button>
            ))}
          </div>
        )}
        
        <div className="flex space-x-2 mt-2">
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs bg-green-500/20 text-green-300 rounded hover:bg-green-500/30 transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="px-2 py-1 text-xs bg-gray-500/20 text-gray-300 rounded hover:bg-gray-500/30 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="cursor-pointer hover:bg-white/10 px-3 py-2 rounded transition-colors"
      onClick={() => onEdit && onEdit()}
    >
      <span className={selectedAccount ? 'text-white' : 'text-gray-400'}>
        {selectedAccount ? selectedAccount.name : 'Select account'}
      </span>
    </div>
  );
};

export default AccountSelector; 
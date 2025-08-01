import React, { useState, useEffect, useRef } from 'react';
import { X, CreditCard, PiggyBank, Building2, ChevronDown } from 'lucide-react';
import { dbHelpers } from '../db/database';

const AddExpensePanel = ({ 
  isOpen, 
  onClose, 
  accounts, 
  onDataChange 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    dueDate: '',
    amount: '',
    accountId: ''
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  
  const panelRef = useRef(null);
  const firstInputRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current.focus(), 100);
    }
  }, [isOpen]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleClose = () => {
    setFormData({ name: '', dueDate: '', amount: '', accountId: '' });
    setSelectedAccount(null);
    setErrors({});
    setIsDropdownOpen(false);
    onClose();
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.dueDate) newErrors.dueDate = 'Due date is required';
    if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (!formData.accountId) newErrors.accountId = 'Account is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const expenseData = {
        name: formData.name.trim(),
        dueDate: formData.dueDate,
        amount: parseFloat(formData.amount),
        accountId: formData.accountId,
        paidAmount: 0
      };

      await dbHelpers.addFixedExpense(expenseData);
      onDataChange();
      handleClose();
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Failed to add expense. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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

  const formatBalance = (balance) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(balance);
  };

  const handleAccountSelect = (account) => {
    setSelectedAccount(account);
    setFormData(prev => ({ ...prev, accountId: account.id }));
    setIsDropdownOpen(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[9998]"
        onClick={handleClose}
      />
      
      {/* Panel */}
      <div 
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-[480px] bg-slate-800/95 backdrop-blur-[20px] border-l border-white/20 shadow-[-8px_0_32px_rgba(0,0,0,0.3)] z-[9999] transform transition-transform duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Add New Expense</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Expense Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Expense Name
            </label>
            <input
              ref={firstInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-5 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white placeholder-white/50"
              placeholder="Enter expense name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => handleInputChange('dueDate', e.target.value)}
              className="w-full px-5 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white"
            />
            {errors.dueDate && (
              <p className="mt-1 text-sm text-red-400">{errors.dueDate}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              className="w-full px-5 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white placeholder-white/50"
              placeholder="0.00"
            />
            {errors.amount && (
              <p className="mt-1 text-sm text-red-400">{errors.amount}</p>
            )}
          </div>

          {/* Account Selector */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Account
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-5 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {selectedAccount && getAccountIcon(selectedAccount.type)}
                    <span className={selectedAccount ? 'text-white' : 'text-white/50'}>
                      {selectedAccount ? selectedAccount.name : 'Select account'}
                    </span>
                  </div>
                  <ChevronDown 
                    size={16} 
                    className={`text-white/50 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  />
                </div>
              </button>

              {/* Dropdown */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-[1001] mt-2 bg-slate-800/95 backdrop-blur-[16px] border border-white/20 rounded-2xl shadow-2xl max-h-64 overflow-y-auto">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleAccountSelect(account)}
                      className="w-full flex items-center justify-between px-5 py-4 text-white hover:bg-white/10 transition-all duration-150 first:rounded-t-2xl last:rounded-b-2xl border-b border-white/10 last:border-b-0"
                    >
                      <div className="flex items-center space-x-3">
                        {getAccountIcon(account.type)}
                        <div className="text-left">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-xs text-white/60 capitalize">{account.type}</div>
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
            </div>
            {errors.accountId && (
              <p className="mt-1 text-sm text-red-400">{errors.accountId}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/10 space-y-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-6 py-4 bg-blue-500/20 text-blue-300 rounded-xl hover:bg-blue-500/30 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Expense'}
          </button>
          <button
            onClick={handleClose}
            className="w-full px-6 py-4 bg-white/10 text-white/70 rounded-xl hover:bg-white/20 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

export default AddExpensePanel; 
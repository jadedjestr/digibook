import React, { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { X, CreditCard, PiggyBank, Building2, ChevronDown } from 'lucide-react';
import { dbHelpers } from '../db/database';

const AddExpensePanel = ({
  isOpen,
  onClose,
  accounts,
  creditCards = [],
  onDataChange,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    dueDate: '',
    amount: '',
    accountId: '',
    category: '',
  });
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Smart account filtering based on expense type
  const isCreditCardPayment = formData.name.toLowerCase().includes('payment') || 
                             formData.category === 'Credit Card Payment';

  // For credit card payments: only allow checking/savings accounts (funding source)
  // For regular expenses: allow all accounts (checking, savings, credit cards)
  const availableAccounts = isCreditCardPayment 
    ? accounts.map(acc => ({ ...acc, type: 'account' }))
    : [
        ...accounts.map(acc => ({ ...acc, type: 'account' })),
        ...creditCards.map(card => ({
          ...card,
          type: 'creditCard',
          currentBalance: card.balance,
          name: `${card.name} (Credit Card)`,
        })),
      ];

  const panelRef = useRef(null);
  const firstInputRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current.focus(), 100);
    }
  }, [isOpen]);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await dbHelpers.getCategories();
        setCategories(categoriesData);
      } catch (error) {
        logger.error('Error loading categories:', error);
      }
    };

    loadCategories();
  }, []);

  // Focus trap for modal
  useEffect(() => {
    if (!isOpen) return;

    const handleTabKey = (e) => {
      if (e.key === 'Tab') {
        const focusableElements = panelRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );

        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
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

  // Reset form when panel opens
  useEffect(() => {
    if (isOpen) {
      setFormData({ name: '', dueDate: '', amount: '', accountId: '', category: '' });
      setSelectedAccount(null);
      setErrors({});
    }
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
    onClose();
  };

  const handleInputChange = (field, value) => {
    console.log('handleInputChange:', { field, value, currentFormData: formData });

    // Simplified handling for amount field
    if (field === 'amount') {
      console.log('Amount field update:', { original: value });
      setFormData(prev => ({ ...prev, [field]: value }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.dueDate) newErrors.dueDate = 'Due date is required';

    // Improved amount validation for decimals
    const amountStr = formData.amount.toString().replace(/[$,]/g, ''); // Remove $ and commas
    const amountValue = parseFloat(amountStr);

    console.log('Amount validation:', {
      original: formData.amount,
      cleaned: amountStr,
      parsed: amountValue,
      isValid: !isNaN(amountValue) && amountValue > 0,
    });

    if (!formData.amount || isNaN(amountValue) || amountValue <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.accountId) newErrors.accountId = 'Account is required';
    if (!formData.category) newErrors.category = 'Category is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    console.log('handleSave - formData:', formData);
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const expenseData = {
        name: formData.name,
        dueDate: formData.dueDate,
        amount: parseFloat(formData.amount.toString().replace(/[$,]/g, '')),
        accountId: parseInt(formData.accountId),
        category: formData.category,
        paidAmount: 0,
        status: 'pending',
      };

      const newExpenseId = await dbHelpers.addFixedExpense(expenseData);

      // Handle balance updates based on account type
      const selectedAccount = availableAccounts.find(acc => acc.id === parseInt(formData.accountId));
      if (selectedAccount) {
        if (selectedAccount.type === 'creditCard') {
          // For credit card expenses, increase the credit card balance (increase debt)
          const newBalance = selectedAccount.balance + expenseData.amount;
          await dbHelpers.updateCreditCard(selectedAccount.id, { balance: newBalance });
          logger.success(`Credit card balance updated: ${selectedAccount.name} balance increased by ${expenseData.amount}`);
        }
        // For regular accounts, no balance change needed (will be handled when paid)
      }

      logger.success('Expense added successfully');
      onDataChange(newExpenseId);
      onClose();
    } catch (error) {
      logger.error('Error adding expense:', error);
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
      minimumFractionDigits: 2,
    }).format(balance);
  };

  const handleAccountSelect = (account) => {
    setSelectedAccount(account);
    setFormData(prev => ({ ...prev, accountId: account.id }));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity duration-[500ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          zIndex: 9999,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          visibility: isOpen ? 'visible' : 'hidden',
        }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-[450px] liquid-glass border-l border-white/20 shadow-[-8px_0_32px_rgba(0,0,0,0.3)] transform transition-all duration-[500ms] ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          boxSizing: 'border-box',
          right: '0px',
          zIndex: 10000,
          visibility: isOpen ? 'visible' : 'hidden',
        }}
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
              className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white placeholder-white/50"
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
              className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white"
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
              className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white placeholder-white/50"
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
            <select
              value={formData.accountId}
              onChange={(e) => {
                const accountId = parseInt(e.target.value) || '';
                const account = availableAccounts.find(acc => acc.id === accountId);
                setSelectedAccount(account);
                handleInputChange('accountId', accountId);
              }}
              className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white"
            >
              <option value="">Select account</option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {formatBalance(account.currentBalance)}
                </option>
              ))}
            </select>
            {errors.accountId && (
              <p className="mt-1 text-sm text-red-400">{errors.accountId}</p>
            )}
          </div>


          {/* Category Selector */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-400">{errors.category}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/10 space-y-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-6 py-4 glass-button bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Expense'}
          </button>
          <button
            onClick={handleClose}
            className="w-full px-6 py-4 glass-button bg-white/10 text-white/70 hover:bg-white/20"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

export default AddExpensePanel;

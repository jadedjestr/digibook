import React, { useState } from 'react';
import { Plus, Star, Trash2, Edit3, Check, X, Wallet, CreditCard, PiggyBank } from 'lucide-react';
import { dbHelpers } from '../db/database';
import PrivacyWrapper from '../components/PrivacyWrapper';
import { useFinanceCalculations } from '../services/financeService';
import { formatCurrency } from '../utils/accountUtils';

const Accounts = ({ accounts, pendingTransactions, onDataChange }) => {
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [newAccount, setNewAccount] = useState({
    name: '',
    type: 'checking',
    currentBalance: 0,
  });

  const { calculateLiquidBalance } = useFinanceCalculations(accounts, pendingTransactions);
  const liquidBalance = calculateLiquidBalance;



  const calculateProjectedBalance = (account) => {
    const pendingForAccount = pendingTransactions
      .filter(t => t.accountId === account.id)
      .reduce((sum, t) => sum + t.amount, 0);

    // For expenses (negative amounts), we add the pending amount to get the projected balance
    // For income (positive amounts), we also add the pending amount
    return account.currentBalance + pendingForAccount;
  };

  // Group accounts by type
  const groupedAccounts = accounts.reduce((groups, account) => {
    const type = account.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {});

  // Get account type icon
  const getAccountTypeIcon = (type) => {
    switch (type) {
    case 'checking':
      return <CreditCard size={20} className="text-blue-300" />;
    case 'savings':
      return <PiggyBank size={20} className="text-green-300" />;
    default:
      return <Wallet size={20} className="text-secondary" />;
    }
  };

  // Get account type display name
  const getAccountTypeDisplayName = (type) => {
    switch (type) {
    case 'checking':
      return 'Checking Accounts';
    case 'savings':
      return 'Savings Accounts';
    default:
      return `${type.charAt(0).toUpperCase() + type.slice(1)} Accounts`;
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!newAccount.name.trim()) {
      newErrors.name = 'Account name is required';
    }
    if (newAccount.currentBalance < 0) {
      newErrors.currentBalance = 'Balance cannot be negative';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddAccount = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Add a small delay to make loading state visible
      await new Promise(resolve => setTimeout(resolve, 500));

      await dbHelpers.addAccount(newAccount);
      setNewAccount({ name: '', type: 'checking', currentBalance: 0 });
      setIsAddingAccount(false);
      setErrors({});
      onDataChange();
    } catch (error) {
      console.error('Error adding account:', error);
      setErrors({ general: 'Failed to add account. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (accountId) => {
    try {
      console.log('Setting default account:', accountId);
      await dbHelpers.setDefaultAccount(accountId);
      console.log('Default account set successfully');
      onDataChange();
    } catch (error) {
      console.error('Error setting default account:', error);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      await dbHelpers.deleteAccount(accountId);
      onDataChange();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUpdateAccount = async (accountId, updates) => {
    try {
      await dbHelpers.updateAccount(accountId, updates);
      setEditingId(null);
      onDataChange();
    } catch (error) {
      console.error('Error updating account:', error);
    }
  };

  const InlineEdit = ({ value, onSave, type = 'text', options = null }) => {
    const [editValue, setEditValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = () => {
      onSave(editValue);
      setIsEditing(false);
    };

    const handleCancel = () => {
      setEditValue(value);
      setIsEditing(false);
    };

    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          {options ? (
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="glass-input flex-1 glass-focus"
              autoFocus
              onBlur={handleSave}
            >
              {options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="glass-input flex-1 glass-focus"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              onBlur={handleSave}
            />
          )}
          <button onClick={handleSave} className="text-green-400 hover:text-green-300 transition-colors">
            <Check size={16} />
          </button>
          <button onClick={handleCancel} className="text-red-400 hover:text-red-300 transition-colors">
            <X size={16} />
          </button>
        </div>
      );
    }

    return (
      <div
        onClick={() => setIsEditing(true)}
        className="cursor-pointer hover:bg-white/5 rounded px-2 py-1 transition-all duration-200 group"
        title="Click to edit"
      >
        <span className="text-primary group-hover:text-white transition-colors">
          {type === 'number' ? (
            <PrivacyWrapper>
              {formatCurrency(parseFloat(value))}
            </PrivacyWrapper>
          ) : value}
        </span>
        <Edit3 size={14} className="inline ml-2 text-muted group-hover:text-white transition-colors opacity-0 group-hover:opacity-100" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary text-shadow-lg">Accounts</h1>
          <p className="text-secondary">Manage your bank accounts and balances</p>
        </div>
        <button
          onClick={() => setIsAddingAccount(true)}
          className="glass-button flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Add Account</span>
        </button>
      </div>

      {/* Liquid Balance Card */}
      <div className="glass-card">
        <div className="text-sm font-medium text-secondary mb-3">Liquid Balance</div>
        <div className="balance-display">
          <PrivacyWrapper>
            {formatCurrency(liquidBalance)}
          </PrivacyWrapper>
        </div>
        <div className="text-xs text-muted mt-1">
          Across all accounts
        </div>
      </div>

      {/* Add Account Form */}
      {isAddingAccount && (
        <div className="glass-panel">
          <h3 className="text-lg font-semibold text-primary mb-4">Add New Account</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <input
                type="text"
                placeholder="Account Name"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                className={`glass-input w-full ${errors.name ? 'glass-error' : ''}`}
              />
              {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
            </div>
            <div>
              <select
                value={newAccount.type}
                onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                className="glass-input w-full"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </div>
            <div>
              <input
                type="number"
                placeholder="Current Balance"
                value={newAccount.currentBalance}
                onChange={(e) => setNewAccount({ ...newAccount, currentBalance: parseFloat(e.target.value) || 0 })}
                className={`glass-input w-full ${errors.currentBalance ? 'glass-error' : ''}`}
              />
              {errors.currentBalance && <p className="text-red-400 text-sm mt-1">{errors.currentBalance}</p>}
            </div>
          </div>
          {errors.general && (
            <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-3 mb-4">
              <p className="text-red-200 text-sm">{errors.general}</p>
            </div>
          )}
          <div className="flex space-x-3">
            <button
              onClick={handleAddAccount}
              disabled={isLoading}
              className={`glass-button flex items-center space-x-2 ${isLoading ? 'glass-loading' : ''}`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Add Account</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setIsAddingAccount(false);
                setErrors({});
                setNewAccount({ name: '', type: 'checking', currentBalance: 0 });
              }}
              className="glass-button bg-red-500/20 hover:bg-red-500/30"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Grouped Accounts Display */}
      {accounts.length === 0 ? (
        <div className="glass-panel">
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <h3 className="text-xl font-semibold text-primary mb-2">Ready to track your finances?</h3>
            <p className="text-secondary max-w-md mx-auto mb-6">
              Add your first account below to start managing your money with precision and style.
            </p>
            <button
              onClick={() => setIsAddingAccount(true)}
              className="glass-button flex items-center space-x-2 mx-auto"
            >
              <Wallet size={20} />
              <span>Add Your First Account</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
            <div key={type} className="glass-panel">
              {/* Account Type Header */}
              <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-white/10">
                {getAccountTypeIcon(type)}
                <h3 className="text-lg font-semibold text-primary">
                  {getAccountTypeDisplayName(type)}
                </h3>
                <span className="text-sm text-secondary">
                  {typeAccounts.length} account{typeAccounts.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Accounts Table for this type */}
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Current Balance</th>
                    <th>Projected Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {typeAccounts.map((account) => {
                    const projectedBalance = calculateProjectedBalance(account);
                    const isEditing = editingId === account.id;

                    console.log('Account data:', account);

                    return (
                      <tr key={account.id}>
                        <td>
                          <InlineEdit
                            value={account.name}
                            onSave={(name) => handleUpdateAccount(account.id, { name })}
                          />
                        </td>
                        <td>
                          <InlineEdit
                            value={account.currentBalance}
                            onSave={(currentBalance) => handleUpdateAccount(account.id, { currentBalance: parseFloat(currentBalance) || 0 })}
                            type="number"
                          />
                        </td>
                        <td>
                          <span className={`font-semibold ${
                            projectedBalance < account.currentBalance ? 'text-yellow-400' : 'text-primary'
                          }`}>
                            <PrivacyWrapper>
                              {formatCurrency(projectedBalance)}
                            </PrivacyWrapper>
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleSetDefault(account.id)}
                              className={`p-1 rounded transition-all duration-200 ${
                                account.isDefault
                                  ? 'text-yellow-400 bg-yellow-500/20'
                                  : 'text-muted hover:text-white hover:bg-white/10'
                              }`}
                              title={account.isDefault ? 'Default Account' : 'Set as Default'}
                            >
                              <Star size={16} fill={account.isDefault ? 'currentColor' : 'none'} />
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(account.id)}
                              className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-200"
                              title="Delete Account"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Accounts;

import React, { useState, useEffect } from 'react'
import { logger } from "../utils/logger";;
import { Plus, Check, Trash2, Edit3, X, Clock } from 'lucide-react'
import { dbHelpers } from '../db/database'
import { useFinanceCalculations } from '../services/financeService'

const PendingTransactions = ({ pendingTransactions, accounts, onDataChange }) => {
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);

  // Helper function to get today's date in local timezone
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [newTransaction, setNewTransaction] = useState({
    accountId: '',
    amount: 0,
    category: '',
    description: '',
    date: getTodayDate(), // Today's date in local timezone
    type: 'expense' // 'income' or 'expense'
  });

  const { calculateProjectedBalance, getAccountName } = useFinanceCalculations(accounts, pendingTransactions);

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

  const validateForm = () => {
    const newErrors = {};
    if (!newTransaction.accountId) {
      newErrors.accountId = 'Please select an account';
    }
    if (!newTransaction.amount || newTransaction.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!newTransaction.description.trim()) {
      newErrors.description = 'Description is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddTransaction = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      // Prepare transaction with correct sign based on type
      const transactionToAdd = {
        ...newTransaction,
        amount: newTransaction.type === 'expense' ? -Math.abs(newTransaction.amount) : Math.abs(newTransaction.amount)
      };
      
      await dbHelpers.addPendingTransaction(transactionToAdd);
      logger.success('Transaction added successfully');
      setNewTransaction({ accountId: '', amount: 0, category: '', description: '', date: getTodayDate(), type: 'expense' });
      setIsAddingTransaction(false);
      setErrors({});
      onDataChange();
    } catch (error) {
      logger.error('Error adding transaction:', error);
      setErrors({ general: 'Failed to add transaction. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteTransaction = async (transactionId) => {
    try {
      await dbHelpers.completePendingTransaction(transactionId);
      onDataChange();
    } catch (error) {
      logger.error("Error completing transaction:", error);
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      await dbHelpers.deletePendingTransaction(transactionId);
      onDataChange();
    } catch (error) {
      logger.error("Error deleting transaction:", error);
    }
  };

  const handleUpdateTransaction = async (transactionId, updates) => {
    try {
      await dbHelpers.updatePendingTransaction(transactionId, updates);
      onDataChange();
    } catch (error) {
      logger.error("Error updating transaction:", error);
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

    // Get display value for account selection
    const getDisplayValue = () => {
      if (options) {
        const selectedOption = options.find(option => option.value == value);
        return selectedOption ? selectedOption.label : value;
      }
      return type === 'number' ? `$${parseFloat(value).toFixed(2)}` : value;
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
          {getDisplayValue()}
        </span>
        <Edit3 size={14} className="inline ml-2 text-muted group-hover:text-white transition-colors opacity-0 group-hover:opacity-100" />
      </div>
    );
  };

  const categoryOptions = categories.map(category => ({
    value: category.name,
    label: `${category.icon} ${category.name}`
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary text-shadow-lg">Pending Transactions</h1>
          <p className="text-secondary">Track pending payments and their impact on balances</p>
        </div>
        <button
          onClick={() => setIsAddingTransaction(true)}
          className="glass-button flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Add Transaction</span>
        </button>
      </div>

      {/* Add Transaction Form */}
      {isAddingTransaction && (
        <div className="glass-panel">
          <h3 className="text-lg font-semibold text-primary mb-4">Add Pending Transaction</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <select
                value={newTransaction.accountId}
                onChange={(e) => setNewTransaction({ ...newTransaction, accountId: parseInt(e.target.value) || '' })}
                className={`glass-input w-full ${errors.accountId ? 'glass-error' : ''}`}
              >
                <option value="">Select Account</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              {errors.accountId && <p className="text-red-400 text-sm mt-1">{errors.accountId}</p>}
            </div>
            <div>
              <div className="flex space-x-2 mb-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="transactionType"
                    value="expense"
                    checked={newTransaction.type === 'expense'}
                    onChange={(e) => setNewTransaction({ ...newTransaction, type: e.target.value })}
                    className="text-green-400"
                  />
                  <span className="text-sm text-primary">Expense</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="transactionType"
                    value="income"
                    checked={newTransaction.type === 'income'}
                    onChange={(e) => setNewTransaction({ ...newTransaction, type: e.target.value })}
                    className="text-green-400"
                  />
                  <span className="text-sm text-primary">Income</span>
                </label>
              </div>
              <input
                type="number"
                placeholder="Amount"
                value={newTransaction.amount}
                onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) || 0 })}
                className={`glass-input w-full ${errors.amount ? 'glass-error' : ''}`}
              />
              {errors.amount && <p className="text-red-400 text-sm mt-1">{errors.amount}</p>}
            </div>
            <div>
              <select
                value={newTransaction.category}
                onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                className="glass-input w-full"
              >
                <option value="">Select Category</option>
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="text"
                placeholder="Description"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                className={`glass-input w-full ${errors.description ? 'glass-error' : ''}`}
              />
              {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description}</p>}
            </div>
            <div>
              <input
                type="date"
                value={newTransaction.date}
                onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                className="glass-input w-full"
              />
            </div>
          </div>
          {errors.general && (
            <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-3 mb-4">
              <p className="text-red-200 text-sm">{errors.general}</p>
            </div>
          )}
          <div className="flex space-x-3">
            <button
              onClick={handleAddTransaction}
              disabled={isLoading}
              className={`glass-button flex items-center space-x-2 ${isLoading ? 'glass-loading' : ''}`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Add Transaction</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setIsAddingTransaction(false);
                setErrors({});
                setNewTransaction({ accountId: '', amount: 0, category: '', description: '', date: getTodayDate(), type: 'expense' });
              }}
              className="glass-button bg-red-500/20 hover:bg-red-500/30"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="glass-panel">
        {pendingTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <h3 className="text-xl font-semibold text-primary mb-2">No pending transactions</h3>
            <p className="text-secondary max-w-md mx-auto mb-6">
              Add your first pending transaction to start tracking upcoming payments and their impact on your balances.
            </p>
            <button
              onClick={() => setIsAddingTransaction(true)}
              className="glass-button flex items-center space-x-2 mx-auto"
            >
              <Clock size={20} />
              <span>Add Your First Transaction</span>
            </button>
          </div>
        ) : (
          <table className="glass-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Description</th>
                <th>Date</th>
                <th>Projected Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingTransactions.map((transaction) => {
                const account = accounts.find(a => a.id === parseInt(transaction.accountId));
                const projectedBalance = calculateProjectedBalance(transaction.accountId);
                
                return (
                  <tr key={transaction.id}>
                    <td>
                      <InlineEdit
                        value={transaction.accountId}
                        onSave={(accountId) => handleUpdateTransaction(transaction.id, { accountId: parseInt(accountId) || 0 })}
                        options={accounts.map(acc => ({ value: acc.id, label: acc.name }))}
                      />
                    </td>
                    <td>
                      <InlineEdit
                        value={transaction.amount}
                        onSave={(amount) => handleUpdateTransaction(transaction.id, { amount: parseFloat(amount) || 0 })}
                        type="number"
                      />
                    </td>
                    <td>
                      <InlineEdit
                        value={transaction.category}
                        onSave={(category) => handleUpdateTransaction(transaction.id, { category })}
                        options={categoryOptions}
                      />
                    </td>
                    <td>
                      <InlineEdit
                        value={transaction.description}
                        onSave={(description) => handleUpdateTransaction(transaction.id, { description })}
                      />
                    </td>
                    <td>
                      <InlineEdit
                        value={transaction.date}
                        onSave={(date) => handleUpdateTransaction(transaction.id, { date })}
                        type="date"
                      />
                    </td>
                    <td>
                      <span className={`font-semibold ${
                        projectedBalance < (account?.currentBalance || 0) ? 'text-yellow-400' : 'text-primary'
                      }`}>
                        ${projectedBalance.toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCompleteTransaction(transaction.id)}
                          className="p-1 rounded text-green-400 hover:text-green-300 hover:bg-green-500/20 transition-all duration-200"
                          title="Mark as Completed"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-200"
                          title="Delete Transaction"
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
        )}
      </div>
    </div>
  );
};

export default PendingTransactions;

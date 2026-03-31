import { Plus, Check, Trash2, Clock } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useCallback } from 'react';

import InlineEdit from '../components/InlineEdit';
import PrivacyWrapper from '../components/PrivacyWrapper';
import { dbHelpers } from '../db/database-clean';
import { useFinanceCalculations } from '../services/financeService';
import { formatCurrency } from '../utils/accountUtils';
import { logger } from '../utils/logger';

// Helper function to get today's date in local timezone
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PendingTransactions = ({
  pendingTransactions,
  accounts,
  onDataChange,
}) => {
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);

  const [newTransaction, setNewTransaction] = useState({
    accountId: '',
    amount: 0,
    category: '',
    description: '',
    date: getTodayDate(), // Today's date in local timezone
    type: 'expense', // 'income' or 'expense'
  });

  const { getAccountProjectedBalances, getAccountName: _getAccountName } =
    useFinanceCalculations(accounts, pendingTransactions);

  const accountMap = useMemo(
    () => new Map(accounts.map(a => [a.id, a])),
    [accounts],
  );

  const accountOptions = useMemo(
    () => accounts.map(acc => ({ value: acc.id, label: acc.name })),
    [accounts],
  );

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
  }, [onDataChange]); // Refresh when categories are modified

  const validateForm = useCallback(() => {
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
  }, [newTransaction]);

  const handleAddTransaction = useCallback(async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Prepare transaction with correct sign based on type
      const transactionToAdd = {
        ...newTransaction,
        amount:
          newTransaction.type === 'expense'
            ? -Math.abs(newTransaction.amount)
            : Math.abs(newTransaction.amount),
      };

      await dbHelpers.addPendingTransaction(transactionToAdd);
      logger.success('Transaction added successfully');
      setNewTransaction({
        accountId: '',
        amount: 0,
        category: '',
        description: '',
        date: getTodayDate(),
        type: 'expense',
      });
      setIsAddingTransaction(false);
      setErrors({});
      onDataChange();
    } catch (error) {
      logger.error('Error adding transaction:', error);
      setErrors({ general: 'Failed to add transaction. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, newTransaction, onDataChange]);

  const handleCompleteTransaction = useCallback(
    async transactionId => {
      try {
        await dbHelpers.completePendingTransaction(transactionId);
        onDataChange();
      } catch (error) {
        logger.error('Error completing transaction:', error);
      }
    },
    [onDataChange],
  );

  const handleDeleteTransaction = useCallback(
    async transactionId => {
      if (!confirm('Are you sure you want to delete this transaction?')) return;

      try {
        await dbHelpers.deletePendingTransaction(transactionId);
        onDataChange();
      } catch (error) {
        logger.error('Error deleting transaction:', error);
      }
    },
    [onDataChange],
  );

  const handleUpdateTransaction = useCallback(
    async (transactionId, updates) => {
      try {
        await dbHelpers.updatePendingTransaction(transactionId, updates);
        onDataChange();
      } catch (error) {
        logger.error('Error updating transaction:', error);
      }
    },
    [onDataChange],
  );

  const categoryOptions = useMemo(
    () =>
      categories.map(category => ({
        value: category.name,
        label: `${category.icon} ${category.name}`,
      })),
    [categories],
  );

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-primary text-shadow-lg'>
            Pending Transactions
          </h1>
          <p className='text-secondary'>
            Track pending payments and their impact on balances
          </p>
        </div>
        <button
          onClick={() => setIsAddingTransaction(true)}
          className='glass-button flex items-center space-x-2'
        >
          <Plus size={20} />
          <span>Add Transaction</span>
        </button>
      </div>

      {/* Add Transaction Form */}
      {isAddingTransaction && (
        <div className='glass-panel'>
          <h3 className='text-lg font-semibold text-primary mb-4'>
            Add Pending Transaction
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4'>
            <div>
              <select
                value={newTransaction.accountId}
                onChange={e =>
                  setNewTransaction({
                    ...newTransaction,
                    accountId: e.target.value || '',
                  })
                }
                className={`glass-input w-full ${errors.accountId ? 'glass-error' : ''}`}
              >
                <option value=''>Select Account</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              {errors.accountId && (
                <p className='text-red-400 text-sm mt-1'>{errors.accountId}</p>
              )}
            </div>
            <div>
              <div className='flex space-x-2 mb-2'>
                <label className='flex items-center space-x-2 cursor-pointer'>
                  <input
                    type='radio'
                    name='transactionType'
                    value='expense'
                    checked={newTransaction.type === 'expense'}
                    onChange={e =>
                      setNewTransaction({
                        ...newTransaction,
                        type: e.target.value,
                      })
                    }
                    className='text-green-400'
                  />
                  <span className='text-sm text-primary'>Expense</span>
                </label>
                <label className='flex items-center space-x-2 cursor-pointer'>
                  <input
                    type='radio'
                    name='transactionType'
                    value='income'
                    checked={newTransaction.type === 'income'}
                    onChange={e =>
                      setNewTransaction({
                        ...newTransaction,
                        type: e.target.value,
                      })
                    }
                    className='text-green-400'
                  />
                  <span className='text-sm text-primary'>Income</span>
                </label>
              </div>
              <input
                type='number'
                placeholder='Amount'
                value={newTransaction.amount}
                onChange={e =>
                  setNewTransaction({
                    ...newTransaction,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                className={`glass-input w-full ${errors.amount ? 'glass-error' : ''}`}
              />
              {errors.amount && (
                <p className='text-red-400 text-sm mt-1'>{errors.amount}</p>
              )}
            </div>
            <div>
              <select
                value={newTransaction.category}
                onChange={e =>
                  setNewTransaction({
                    ...newTransaction,
                    category: e.target.value,
                  })
                }
                className='glass-input w-full'
              >
                <option value=''>Select Category</option>
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <input
                type='text'
                placeholder='Description'
                value={newTransaction.description}
                onChange={e =>
                  setNewTransaction({
                    ...newTransaction,
                    description: e.target.value,
                  })
                }
                className={`glass-input w-full ${errors.description ? 'glass-error' : ''}`}
              />
              {errors.description && (
                <p className='text-red-400 text-sm mt-1'>
                  {errors.description}
                </p>
              )}
            </div>
            <div>
              <input
                type='date'
                value={newTransaction.date}
                onChange={e =>
                  setNewTransaction({ ...newTransaction, date: e.target.value })
                }
                className='glass-input w-full'
              />
            </div>
          </div>
          {errors.general && (
            <div className='bg-red-500/20 border border-red-400/50 rounded-lg p-3 mb-4'>
              <p className='text-red-200 text-sm'>{errors.general}</p>
            </div>
          )}
          <div className='flex space-x-3'>
            <button
              onClick={handleAddTransaction}
              disabled={isLoading}
              className={`glass-button flex items-center space-x-2 ${isLoading ? 'glass-loading' : ''}`}
            >
              {isLoading ? (
                <>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
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
                setNewTransaction({
                  accountId: '',
                  amount: 0,
                  category: '',
                  description: '',
                  date: getTodayDate(),
                  type: 'expense',
                });
              }}
              className='glass-button glass-button--danger'
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className='glass-panel'>
        {pendingTransactions.length === 0 ? (
          <div className='empty-state'>
            <div className='empty-state-icon'>⏳</div>
            <h3 className='text-xl font-semibold text-primary mb-2'>
              No pending transactions
            </h3>
            <p className='text-secondary max-w-md mx-auto mb-6'>
              Add your first pending transaction to start tracking upcoming
              payments and their impact on your balances.
            </p>
            <button
              onClick={() => setIsAddingTransaction(true)}
              className='glass-button flex items-center space-x-2 mx-auto'
            >
              <Clock size={20} />
              <span>Add Your First Transaction</span>
            </button>
          </div>
        ) : (
          <table className='glass-table'>
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
              {pendingTransactions.map(transaction => {
                const account = accountMap.get(transaction.accountId);
                const projectedBalance =
                  getAccountProjectedBalances[transaction.accountId] ?? 0;

                return (
                  <tr key={transaction.id}>
                    <td>
                      <InlineEdit
                        value={transaction.accountId}
                        onSave={accountId =>
                          handleUpdateTransaction(transaction.id, {
                            accountId: accountId || '',
                          })
                        }
                        options={accountOptions}
                        showEditIcon
                      />
                    </td>
                    <td>
                      <InlineEdit
                        value={transaction.amount}
                        onSave={amount =>
                          handleUpdateTransaction(transaction.id, {
                            amount: parseFloat(amount) || 0,
                          })
                        }
                        type='number'
                        showEditIcon
                      />
                    </td>
                    <td>
                      <InlineEdit
                        value={transaction.category}
                        onSave={category =>
                          handleUpdateTransaction(transaction.id, { category })
                        }
                        options={categoryOptions}
                        showEditIcon
                      />
                    </td>
                    <td>
                      <InlineEdit
                        value={transaction.description}
                        onSave={description =>
                          handleUpdateTransaction(transaction.id, {
                            description,
                          })
                        }
                        showEditIcon
                      />
                    </td>
                    <td>
                      <InlineEdit
                        value={transaction.date}
                        onSave={date =>
                          handleUpdateTransaction(transaction.id, { date })
                        }
                        type='date'
                        showEditIcon
                      />
                    </td>
                    <td>
                      <span
                        className={`font-semibold ${
                          projectedBalance < (account?.currentBalance || 0)
                            ? 'text-yellow-400'
                            : 'text-primary'
                        }`}
                      >
                        <PrivacyWrapper>
                          {formatCurrency(projectedBalance)}
                        </PrivacyWrapper>
                      </span>
                    </td>
                    <td>
                      <div className='flex items-center space-x-2'>
                        <button
                          onClick={() =>
                            handleCompleteTransaction(transaction.id)
                          }
                          className='p-1 rounded text-green-400 hover:text-green-300 hover:bg-green-500/20 transition-all duration-200'
                          title='Mark as Completed'
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteTransaction(transaction.id)
                          }
                          className='p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-200'
                          title='Delete Transaction'
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

PendingTransactions.propTypes = {
  pendingTransactions: PropTypes.arrayOf(PropTypes.object).isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  onDataChange: PropTypes.func.isRequired,
};

export default PendingTransactions;

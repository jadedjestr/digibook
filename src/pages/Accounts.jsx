import {
  Plus,
  Star,
  Trash2,
  Wallet,
  CreditCard,
  PiggyBank,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import EmptyState from '../components/EmptyState';
import AccountsEmptyIllustration from '../components/illustrations/AccountsEmptyIllustration';
import InlineEdit from '../components/InlineEdit';
import MissingExpensesModal from '../components/MissingExpensesModal';
import PrivacyWrapper from '../components/PrivacyWrapper';
import { dbHelpers } from '../db/database-clean';
import { useFinanceCalculations } from '../services/financeService';
import {
  useAccounts,
  usePendingTransactions,
  useReloadAccounts,
} from '../stores/useAppStore';
import { formatCurrency } from '../utils/accountUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

const Accounts = () => {
  // Use Zustand store for data
  const accounts = useAccounts();
  const pendingTransactions = usePendingTransactions();
  const reloadAccounts = useReloadAccounts();
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [newAccount, setNewAccount] = useState({
    name: '',
    type: 'checking',
    currentBalance: 0,
  });
  const [isMissingExpensesModalOpen, setIsMissingExpensesModalOpen] =
    useState(false);
  const [orphanedCards, setOrphanedCards] = useState([]);

  const { calculateLiquidBalance } = useFinanceCalculations(
    accounts,
    pendingTransactions,
  );
  const liquidBalance = calculateLiquidBalance;

  // Build a Map once — O(M) — so per-account lookup is O(1) instead of O(M) each
  const pendingByAccount = useMemo(
    () =>
      pendingTransactions.reduce((map, t) => {
        map[t.accountId] = (map[t.accountId] || 0) + t.amount;
        return map;
      }, {}),
    [pendingTransactions],
  );

  const calculateProjectedBalance = useCallback(
    account => account.currentBalance + (pendingByAccount[account.id] || 0),
    [pendingByAccount],
  );

  // Group accounts by type
  const groupedAccounts = useMemo(
    () =>
      accounts.reduce((groups, account) => {
        const type = account.type;
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(account);
        return groups;
      }, {}),
    [accounts],
  );

  // Get account type icon
  const getAccountTypeIcon = type => {
    switch (type) {
      case 'checking':
        return <CreditCard size={20} className='text-blue-300' />;
      case 'savings':
        return <PiggyBank size={20} className='text-green-300' />;
      default:
        return <Wallet size={20} className='text-secondary' />;
    }
  };

  // Get account type display name
  const getAccountTypeDisplayName = type => {
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
      await new Promise(resolve => setTimeout(resolve, 500));

      await dbHelpers.addAccount(newAccount);
      setNewAccount({ name: '', type: 'checking', currentBalance: 0 });
      setIsAddingAccount(false);
      setErrors({});
      reloadAccounts();

      const orphans = await dbHelpers.getOrphanedCreditCards();
      if (orphans.length > 0) {
        setOrphanedCards(orphans);
        setIsMissingExpensesModalOpen(true);
      }
    } catch (error) {
      logger.error('Error adding account:', error);
      setErrors({ general: 'Failed to add account. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async accountId => {
    try {
      logger.debug('Setting default account:', accountId);
      await dbHelpers.setDefaultAccount(accountId);
      logger.debug('Default account set successfully');
      reloadAccounts();
    } catch (error) {
      logger.error('Error setting default account:', error);
    }
  };

  const handleDeleteAccount = async accountId => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      await dbHelpers.deleteAccount(accountId);
      reloadAccounts();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUpdateAccount = async (accountId, updates) => {
    try {
      await dbHelpers.updateAccount(accountId, updates);
      setEditingId(null);
      reloadAccounts();
    } catch (error) {
      logger.error('Error updating account:', error);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between pl-14 lg:pl-0'>
        <div>
          <h1 className='text-3xl font-bold text-primary text-shadow-lg'>
            Accounts
          </h1>
          <p className='text-secondary'>
            Manage your bank accounts and balances
          </p>
        </div>
        {/* Only show Add Account button when accounts exist */}
        {accounts.length > 0 && (
          <button
            onClick={() => setIsAddingAccount(true)}
            className='glass-button glass-button--primary flex items-center space-x-2'
          >
            <Plus size={20} />
            <span>Add Account</span>
          </button>
        )}
      </div>

      {/* Liquid Balance Card */}
      <div className='glass-card'>
        <div className='text-sm font-medium text-secondary mb-3'>
          Liquid Balance
        </div>
        <div className='balance-display'>
          <PrivacyWrapper>{formatCurrency(liquidBalance)}</PrivacyWrapper>
        </div>
        <div className='text-xs text-muted mt-1'>Across all accounts</div>
      </div>

      {/* Add Account Form */}
      {isAddingAccount && (
        <div className='glass-panel'>
          <h3 className='text-lg font-semibold text-primary mb-4'>
            Add New Account
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-4'>
            <div>
              <input
                type='text'
                placeholder='Account Name'
                value={newAccount.name}
                onChange={e =>
                  setNewAccount({ ...newAccount, name: e.target.value })
                }
                className={`glass-input w-full ${errors.name ? 'glass-error' : ''}`}
              />
              {errors.name && (
                <p className='text-red-400 text-sm mt-1'>{errors.name}</p>
              )}
            </div>
            <div>
              <select
                value={newAccount.type}
                onChange={e =>
                  setNewAccount({ ...newAccount, type: e.target.value })
                }
                className='glass-input w-full'
              >
                <option value='checking'>Checking</option>
                <option value='savings'>Savings</option>
              </select>
            </div>
            <div>
              <input
                type='number'
                placeholder='Current Balance'
                value={newAccount.currentBalance}
                onChange={e =>
                  setNewAccount({
                    ...newAccount,
                    currentBalance: parseFloat(e.target.value) || 0,
                  })
                }
                className={`glass-input w-full ${errors.currentBalance ? 'glass-error' : ''}`}
              />
              {errors.currentBalance && (
                <p className='text-red-400 text-sm mt-1'>
                  {errors.currentBalance}
                </p>
              )}
            </div>
          </div>
          {errors.general && (
            <div className='bg-red-500/20 border border-red-400/50 rounded-lg p-3 mb-4'>
              <p className='text-red-200 text-sm'>{errors.general}</p>
            </div>
          )}
          <div className='flex space-x-3'>
            <button
              onClick={handleAddAccount}
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
                  <span>Add Account</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setIsAddingAccount(false);
                setErrors({});
                setNewAccount({
                  name: '',
                  type: 'checking',
                  currentBalance: 0,
                });
              }}
              className='glass-button glass-button--danger'
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Grouped Accounts Display */}
      {accounts.length === 0 ? (
        <div className='glass-panel'>
          <EmptyState
            illustration={<AccountsEmptyIllustration />}
            title='No accounts yet'
            subtitle='Add your first account to start building your financial picture'
            action={{
              label: 'Add Your First Account',
              onClick: () => setIsAddingAccount(true),
              icon: <Wallet size={16} />,
            }}
          />
        </div>
      ) : (
        <div className='space-y-6'>
          {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
            <div key={type} className='glass-panel'>
              {/* Account Type Header */}
              <div className='flex items-center space-x-3 mb-4 pb-3 border-b border-white/10'>
                {getAccountTypeIcon(type)}
                <h3 className='text-lg font-semibold text-primary'>
                  {getAccountTypeDisplayName(type)}
                </h3>
                <span className='text-sm text-secondary'>
                  {typeAccounts.length} account
                  {typeAccounts.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Accounts Table for this type */}
              <div className='overflow-x-auto w-full'>
                <table className='glass-table min-w-max w-full'>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Current Balance</th>
                      <th>Projected Balance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeAccounts.map(account => {
                      const projectedBalance =
                        calculateProjectedBalance(account);
                      const _isEditing = editingId === account.id;

                      logger.debug('Account data:', account);

                      return (
                        <tr key={account.id}>
                          <td>
                            <InlineEdit
                              value={account.name}
                              onSave={name =>
                                handleUpdateAccount(account.id, { name })
                              }
                              showEditIcon
                            />
                          </td>
                          <td>
                            <InlineEdit
                              value={account.currentBalance}
                              onSave={currentBalance =>
                                handleUpdateAccount(account.id, {
                                  currentBalance:
                                    parseFloat(currentBalance) || 0,
                                })
                              }
                              type='number'
                              showEditIcon
                            />
                          </td>
                          <td>
                            <span
                              className={`font-semibold ${
                                projectedBalance < account.currentBalance
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
                                onClick={() => handleSetDefault(account.id)}
                                className={`p-1 rounded transition-all duration-200 ${
                                  account.isDefault
                                    ? 'text-yellow-400 bg-yellow-500/20'
                                    : 'text-muted hover:text-white hover:bg-white/10'
                                }`}
                                title={
                                  account.isDefault
                                    ? 'Default Account'
                                    : 'Set as Default'
                                }
                              >
                                <Star
                                  size={16}
                                  fill={
                                    account.isDefault ? 'currentColor' : 'none'
                                  }
                                />
                              </button>
                              <button
                                onClick={() => handleDeleteAccount(account.id)}
                                className='p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-200'
                                title='Delete Account'
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
            </div>
          ))}
        </div>
      )}

      <MissingExpensesModal
        isOpen={isMissingExpensesModalOpen}
        cards={orphanedCards}
        onConfirm={async () => {
          try {
            const count = await dbHelpers.createMissingCreditCardExpenses();
            if (count > 0) {
              notify.success(`Created ${count} missing payment expense(s)`);
            }
            reloadAccounts();
          } catch (error) {
            logger.error('Error creating missing expenses:', error);
            notify.error('Failed to create missing expenses');
          } finally {
            setIsMissingExpensesModalOpen(false);
            setOrphanedCards([]);
          }
        }}
        onSkip={() => {
          setIsMissingExpensesModalOpen(false);
          setOrphanedCards([]);
        }}
      />
    </div>
  );
};

export default Accounts;

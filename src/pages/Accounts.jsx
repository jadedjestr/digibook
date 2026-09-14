import { Plus, Wallet, CreditCard, PiggyBank } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import AccountRow from '../components/AccountRow';
import CreateAccountModal from '../components/CreateAccountModal';
import EmptyState from '../components/EmptyState';
import AccountsEmptyIllustration from '../components/illustrations/AccountsEmptyIllustration';
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

  const handleAccountCreated = useCallback(async () => {
    setIsAddingAccount(false);
    await reloadAccounts();

    const orphans = await dbHelpers.getOrphanedCreditCards();
    if (orphans.length > 0) {
      setOrphanedCards(orphans);
      setIsMissingExpensesModalOpen(true);
    }
  }, [reloadAccounts]);

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

  const handleUpdateAccount = async (accountId, updates, expectedUpdatedAt) => {
    try {
      await dbHelpers.updateAccount(accountId, updates, expectedUpdatedAt);
      await reloadAccounts();
    } catch (error) {
      logger.error('Error updating account:', error);
      if (error.message?.startsWith('STALE_WRITE')) {
        notify.error(
          'This account was changed elsewhere. Please reload and try again.',
        );
      } else {
        notify.error('Failed to update account');
      }
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

      <CreateAccountModal
        isOpen={isAddingAccount}
        onClose={() => setIsAddingAccount(false)}
        onAccountCreated={handleAccountCreated}
      />

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

              {/* Accounts for this type */}
              <div className='glass-row-list'>
                {typeAccounts.map(account => {
                  logger.debug('Account data:', account);

                  return (
                    <AccountRow
                      key={account.id}
                      account={account}
                      projectedBalance={calculateProjectedBalance(account)}
                      onUpdateAccount={handleUpdateAccount}
                      onSetDefault={handleSetDefault}
                      onDelete={handleDeleteAccount}
                    />
                  );
                })}
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

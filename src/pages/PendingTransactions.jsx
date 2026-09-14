import { Plus, Clock } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useCallback } from 'react';

import AddPendingTransactionModal from '../components/AddPendingTransactionModal';
import EmptyState from '../components/EmptyState';
import PendingEmptyIllustration from '../components/illustrations/PendingEmptyIllustration';
import PendingTransactionRow from '../components/PendingTransactionRow';
import { dbHelpers } from '../db/database-clean';
import { useFinanceCalculations } from '../services/financeService';
import { logger } from '../utils/logger';

const PendingTransactions = ({
  pendingTransactions,
  accounts,
  onDataChange,
}) => {
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [categories, setCategories] = useState([]);

  const { getAccountProjectedBalances } = useFinanceCalculations(
    accounts,
    pendingTransactions,
  );

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
      <div className='flex items-center justify-between pl-14 lg:pl-0'>
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
          className='glass-button glass-button--primary flex items-center space-x-2'
        >
          <Plus size={20} />
          <span>Add Transaction</span>
        </button>
      </div>

      <AddPendingTransactionModal
        isOpen={isAddingTransaction}
        onClose={() => setIsAddingTransaction(false)}
        accounts={accounts}
        categoryOptions={categoryOptions}
        onTransactionAdded={() => {
          setIsAddingTransaction(false);
          onDataChange();
        }}
      />

      {/* Transactions Table */}
      <div className='glass-panel'>
        {pendingTransactions.length === 0 ? (
          <EmptyState
            illustration={<PendingEmptyIllustration />}
            title='All clear'
            subtitle='No pending transactions — your balances are up to date'
            action={{
              label: 'Add Transaction',
              onClick: () => setIsAddingTransaction(true),
              icon: <Clock size={16} />,
            }}
          />
        ) : (
          <div className='glass-row-list'>
            {pendingTransactions.map(transaction => {
              const account = accountMap.get(transaction.accountId);
              const projectedBalance =
                getAccountProjectedBalances[transaction.accountId] ?? 0;
              return (
                <PendingTransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  account={account}
                  projectedBalance={projectedBalance}
                  accountOptions={accountOptions}
                  categoryOptions={categoryOptions}
                  onUpdateTransaction={handleUpdateTransaction}
                  onComplete={handleCompleteTransaction}
                  onDelete={handleDeleteTransaction}
                />
              );
            })}
          </div>
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

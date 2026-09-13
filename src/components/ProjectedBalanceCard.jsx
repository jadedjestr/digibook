import { TrendingUp, TrendingDown } from 'lucide-react';
import PropTypes from 'prop-types';

import { formatCurrency } from '../utils/accountUtils';
import { logger } from '../utils/logger';

import PrivacyWrapper from './PrivacyWrapper';

const ProjectedBalanceCard = ({
  accounts = [],
  creditCards: _creditCards = [],
  pendingTransactions = [],
  summaryTotals = {},
  showAccountName = true,
}) => {
  // Find the default account (the one marked as default or first account)
  const defaultAccount =
    accounts.find(account => account.isDefault === true) || accounts[0];
  const defaultAccountBalance = defaultAccount
    ? defaultAccount.currentBalance || defaultAccount.balance || 0
    : 0;

  // Start from the projected balance, not the raw one. Pending rows are
  // signed - spending that hasn't cleared is negative, an expected paycheck
  // is positive - so this corrects the figure in both directions at once.
  // Bills come from fixedExpenses, a separate table, so nothing double-counts.
  const pendingForAccount = defaultAccount
    ? pendingTransactions
        .filter(t => t.accountId === defaultAccount.id)
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    : 0;
  const projectedBalance = defaultAccountBalance + pendingForAccount;

  const { payThisWeekTotal = 0 } = summaryTotals;
  const balanceAfterExpenses = projectedBalance - payThisWeekTotal;

  // Debug logging
  logger.debug('ProjectedBalanceCard Debug:', {
    defaultAccount: defaultAccount
      ? { name: defaultAccount.name, balance: defaultAccountBalance }
      : null,
    pendingForAccount,
    payThisWeekTotal,
    balanceAfterExpenses,
    calculation: `${defaultAccountBalance} + ${pendingForAccount} - ${payThisWeekTotal} = ${balanceAfterExpenses}`,
  });
  const isPositive = balanceAfterExpenses >= 0;

  // Get the default account name
  const defaultAccountName = defaultAccount
    ? defaultAccount.name
    : 'No Account';

  return (
    <div className='glass-card'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-sm font-medium text-secondary'>After This Week</h3>
        {isPositive ? (
          <TrendingUp size={16} className='text-green-300' />
        ) : (
          <TrendingDown size={16} className='text-red-300' />
        )}
      </div>

      <div className='space-y-2'>
        <div className='text-center'>
          <div
            className={`text-2xl font-bold mb-1 ${
              isPositive ? 'text-green-300' : 'text-red-300'
            }`}
          >
            <PrivacyWrapper>
              {formatCurrency(balanceAfterExpenses)}
            </PrivacyWrapper>
          </div>
          <div className='text-xs text-secondary'>Projected Balance</div>
        </div>

        <div className='text-xs text-secondary text-center'>
          {showAccountName
            ? `${defaultAccountName} • After bills & pending`
            : 'After bills & pending'}
        </div>
      </div>
    </div>
  );
};

ProjectedBalanceCard.propTypes = {
  accounts: PropTypes.arrayOf(PropTypes.object),
  creditCards: PropTypes.arrayOf(PropTypes.object),
  pendingTransactions: PropTypes.arrayOf(PropTypes.object),
  summaryTotals: PropTypes.object,
  showAccountName: PropTypes.bool,
};

export default ProjectedBalanceCard;

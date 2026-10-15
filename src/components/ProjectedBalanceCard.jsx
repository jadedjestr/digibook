import { TrendingUp, TrendingDown } from 'lucide-react';
import PropTypes from 'prop-types';

import {
  formatCurrency,
  getDefaultAccount,
  getProjectedBalance,
} from '../utils/accountUtils';
import { logger } from '../utils/logger';

import PrivacyWrapper from './PrivacyWrapper';

const ProjectedBalanceCard = ({
  accounts = [],
  pendingTransactions = [],
  summaryTotals = {},
  showAccountName = true,
}) => {
  const defaultAccount = getDefaultAccount(accounts);

  // Start from the projected balance, not the raw one (see
  // getProjectedBalance). Bills come from fixedExpenses, a separate table,
  // so nothing double-counts.
  const projectedBalance = getProjectedBalance(
    defaultAccount,
    pendingTransactions,
  );

  const { payThisWeekTotal = 0 } = summaryTotals;
  const balanceAfterExpenses = projectedBalance - payThisWeekTotal;

  logger.debug('ProjectedBalanceCard Debug:', {
    defaultAccount: defaultAccount?.name ?? null,
    projectedBalance,
    payThisWeekTotal,
    balanceAfterExpenses,
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
  pendingTransactions: PropTypes.arrayOf(PropTypes.object),
  summaryTotals: PropTypes.object,
  showAccountName: PropTypes.bool,
};

export default ProjectedBalanceCard;

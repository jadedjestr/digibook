import { TrendingUp, TrendingDown } from 'lucide-react';

import { formatCurrency } from '../utils/accountUtils';

import PrivacyWrapper from './PrivacyWrapper';

const ProjectedBalanceCard = ({
  accounts = [],
  creditCards = [],
  summaryTotals = {},
}) => {
  // Find the default account (the one marked as default or first account)
  const defaultAccount =
    accounts.find(account => account.isDefault === true) || accounts[0];
  const defaultAccountBalance = defaultAccount
    ? defaultAccount.currentBalance || defaultAccount.balance || 0
    : 0;

  const { payThisWeekTotal = 0 } = summaryTotals;
  const balanceAfterExpenses = defaultAccountBalance - payThisWeekTotal;

  // Debug logging
  console.log('ProjectedBalanceCard Debug:', {
    defaultAccount: defaultAccount
      ? { name: defaultAccount.name, balance: defaultAccountBalance }
      : null,
    payThisWeekTotal,
    balanceAfterExpenses,
    calculation: `${defaultAccountBalance} - ${payThisWeekTotal} = ${balanceAfterExpenses}`,
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
          {defaultAccountName} • After expenses
        </div>
      </div>
    </div>
  );
};

export default ProjectedBalanceCard;

import { TrendingUp, TrendingDown } from 'lucide-react';

import { formatCurrency } from '../utils/accountUtils';

import PrivacyWrapper from './PrivacyWrapper';

const ProjectedBalanceCard = ({
  accounts = [],
  creditCards = [],
  summaryTotals = {},
}) => {
  // Calculate total balance from all accounts and credit cards
  const totalAccountBalance = accounts.reduce(
    (sum, account) => sum + (account.balance || 0),
    0
  );
  const totalCreditCardBalance = creditCards.reduce(
    (sum, card) => sum + (card.balance || 0),
    0
  );
  const projectedBalance = totalAccountBalance - totalCreditCardBalance;

  const { payThisWeekTotal = 0 } = summaryTotals;
  const balanceAfterExpenses = projectedBalance - payThisWeekTotal;

  // Debug logging
  console.log('ProjectedBalanceCard Debug:', {
    accounts: accounts.map(acc => ({ name: acc.name, balance: acc.balance })),
    creditCards: creditCards.map(card => ({ name: card.name, balance: card.balance })),
    totalAccountBalance,
    totalCreditCardBalance,
    projectedBalance,
    payThisWeekTotal,
    balanceAfterExpenses
  });
  const isPositive = balanceAfterExpenses >= 0;

  // Get the primary account name (first account or 'Primary Account')
  const defaultAccountName =
    accounts.length > 0 ? accounts[0].name : 'Primary Account';

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

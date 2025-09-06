import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import PrivacyWrapper from './PrivacyWrapper';

const ProjectedBalanceCard = ({ projectedBalance, payThisWeekTotal, defaultAccountName }) => {
  const balanceAfterExpenses = projectedBalance - payThisWeekTotal;
  const isPositive = balanceAfterExpenses >= 0;

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-secondary">After This Week</h3>
        {isPositive ? (
          <TrendingUp size={16} className="text-green-300" />
        ) : (
          <TrendingDown size={16} className="text-red-300" />
        )}
      </div>

      <div className="space-y-2">
        <div className="text-center">
          <div className={`text-2xl font-bold mb-1 ${
            isPositive ? 'text-green-300' : 'text-red-300'
          }`}>
            <PrivacyWrapper>
              ${balanceAfterExpenses.toFixed(2)}
            </PrivacyWrapper>
          </div>
          <div className="text-xs text-secondary">Projected Balance</div>
        </div>

        <div className="text-xs text-secondary text-center">
          {defaultAccountName} • After expenses
        </div>
      </div>
    </div>
  );
};

export default ProjectedBalanceCard;

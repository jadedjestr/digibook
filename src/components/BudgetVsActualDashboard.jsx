import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import PrivacyWrapper from './PrivacyWrapper';

const BudgetVsActualDashboard = ({ summary }) => {
  if (!summary) {
    return (
      <div className="glass-panel">
        <h2 className="text-xl font-bold text-white mb-4">Budget vs. Actual Overview</h2>
        <p className="text-white/70">Loading budget summary...</p>
      </div>
    );
  }

  const {
    totalBudget,
    totalActual,
    totalOverpayment,
    significantOverpayments,
    budgetAccuracy,
  } = summary;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy <= 100) return 'text-green-400';
    if (accuracy <= 120) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAccuracyIcon = (accuracy) => {
    if (accuracy <= 100) return CheckCircle;
    if (accuracy <= 120) return TrendingUp;
    return AlertTriangle;
  };

  const AccuracyIcon = getAccuracyIcon(budgetAccuracy);

  return (
    <div className="glass-panel">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Budget vs. Actual Overview</h2>
        <div className="flex items-center space-x-2">
          <AccuracyIcon className={`w-5 h-5 ${getAccuracyColor(budgetAccuracy)}`} />
          <span className={`font-semibold ${getAccuracyColor(budgetAccuracy)}`}>
            {budgetAccuracy.toFixed(1)}% of Budget
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Budgeted */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/70">Total Budgeted</p>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <PrivacyWrapper>
            <p className="text-xl font-bold text-white">{formatCurrency(totalBudget)}</p>
          </PrivacyWrapper>
        </div>

        {/* Total Spent */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/70">Total Spent</p>
            <TrendingDown className="w-4 h-4 text-purple-400" />
          </div>
          <PrivacyWrapper>
            <p className="text-xl font-bold text-white">{formatCurrency(totalActual)}</p>
          </PrivacyWrapper>
        </div>

        {/* Total Overpayment */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/70">Total Overpayment</p>
            <AlertTriangle className={`w-4 h-4 ${totalOverpayment > 0 ? 'text-orange-400' : 'text-green-400'}`} />
          </div>
          <PrivacyWrapper>
            <p className={`text-xl font-bold ${totalOverpayment > 0 ? 'text-orange-400' : 'text-green-400'}`}>
              {totalOverpayment > 0 ? '+' : ''}{formatCurrency(totalOverpayment)}
            </p>
          </PrivacyWrapper>
        </div>

        {/* Significant Overpayments */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/70">Significant Overpayments</p>
            <CheckCircle className={`w-4 h-4 ${significantOverpayments > 0 ? 'text-orange-400' : 'text-green-400'}`} />
          </div>
          <p className={`text-xl font-bold ${significantOverpayments > 0 ? 'text-orange-400' : 'text-green-400'}`}>
            {significantOverpayments}
          </p>
          <p className="text-xs text-white/50 mt-1">expenses &gt;20% over budget</p>
        </div>
      </div>

      {/* Budget Accuracy Bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-white/70">Budget Accuracy</p>
          <p className="text-sm text-white/50">
            {budgetAccuracy > 100 ? 'Over Budget' : 'Within Budget'}
          </p>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              budgetAccuracy <= 100 
                ? 'bg-gradient-to-r from-green-500 to-green-400' 
                : budgetAccuracy <= 120
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-400'
                  : 'bg-gradient-to-r from-red-500 to-red-400'
            }`}
            style={{ width: `${Math.min(budgetAccuracy, 150)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/50 mt-1">
          <span>0%</span>
          <span>100%</span>
          <span>150%+</span>
        </div>
      </div>

      {/* Insights */}
      {totalOverpayment > 0 && (
        <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5" />
            <div>
              <p className="text-orange-400 font-medium">Budget Analysis</p>
              <p className="text-white/70 text-sm mt-1">
                You've overpaid by <PrivacyWrapper><strong>{formatCurrency(totalOverpayment)}</strong></PrivacyWrapper> this cycle. 
                {significantOverpayments > 0 && (
                  <> {significantOverpayments} expense{significantOverpayments !== 1 ? 's' : ''} had significant overpayments (&gt;20%).</>
                )}
              </p>
              {budgetAccuracy > 120 && (
                <p className="text-white/70 text-sm mt-1">
                  Consider reviewing your budget allocations for better accuracy.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetVsActualDashboard;

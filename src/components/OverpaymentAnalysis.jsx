import React from 'react';
import { TrendingUp, AlertCircle, DollarSign } from 'lucide-react';
import PrivacyWrapper from './PrivacyWrapper';

const OverpaymentAnalysis = ({ data }) => {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="glass-panel">
        <h2 className="text-xl font-bold text-white mb-4">Overpayment Analysis</h2>
        <p className="text-white/70">No overpayment data available.</p>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Sort categories by overpayment amount (descending)
  const sortedCategories = Object.entries(data)
    .sort(([, a], [, b]) => b.totalOverpayment - a.totalOverpayment)
    .filter(([, categoryData]) => categoryData.totalOverpayment > 0);

  const totalOverpayment = Object.values(data)
    .reduce((sum, category) => sum + category.totalOverpayment, 0);

  const getCategoryIcon = (category) => {
    const iconMap = {
      'Credit Cards': '💳',
      'Utilities': '⚡',
      'Insurance': '🛡️',
      'Transportation': '🚗',
      'Housing': '🏠',
      'Food': '🍽️',
      'Healthcare': '🏥',
      'Entertainment': '🎬',
      'Shopping': '🛍️',
      'Education': '📚',
      'Miscellaneous': '📦',
      'Uncategorized': '❓',
    };
    return iconMap[category] || '📝';
  };

  const getOverpaymentColor = (percentage) => {
    if (percentage >= 50) return 'text-red-400';
    if (percentage >= 20) return 'text-orange-400';
    if (percentage >= 10) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="glass-panel">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Overpayment Analysis</h2>
        <div className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          <PrivacyWrapper>
            <span className="font-semibold text-green-400">
              {formatCurrency(totalOverpayment)} Total
            </span>
          </PrivacyWrapper>
        </div>
      </div>

      {sortedCategories.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <p className="text-white/70">No overpayments detected this cycle.</p>
          <p className="text-white/50 text-sm mt-2">You're staying within budget! 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedCategories.map(([categoryName, categoryData]) => {
            const overpaymentPercentage = categoryData.overpaymentPercentage;
            const maxBarWidth = 100;
            const barWidth = Math.min(
              (categoryData.totalOverpayment / totalOverpayment) * maxBarWidth,
              maxBarWidth
            );

            return (
              <div key={categoryName} className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getCategoryIcon(categoryName)}</span>
                    <div>
                      <h3 className="font-medium text-white">{categoryName}</h3>
                      <p className="text-sm text-white/50">
                        {categoryData.expenseCount} expense{categoryData.expenseCount !== 1 ? 's' : ''}
                        {categoryData.significantOverpayments > 0 && (
                          <span className="text-orange-400 ml-2">
                            ({categoryData.significantOverpayments} significant)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <PrivacyWrapper>
                      <p className="font-bold text-white">
                        {formatCurrency(categoryData.totalOverpayment)}
                      </p>
                    </PrivacyWrapper>
                    <p className={`text-sm font-medium ${getOverpaymentColor(overpaymentPercentage)}`}>
                      +{overpaymentPercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative">
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-red-400 transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-white/50">
                    <span>Budget: <PrivacyWrapper>{formatCurrency(categoryData.totalBudget)}</PrivacyWrapper></span>
                    <span>Actual: <PrivacyWrapper>{formatCurrency(categoryData.totalActual)}</PrivacyWrapper></span>
                  </div>
                </div>

                {/* Significant Overpayment Warning */}
                {overpaymentPercentage >= 20 && (
                  <div className="mt-3 flex items-center space-x-2 text-orange-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">
                      Significant overpayment detected
                      {categoryData.significantOverpayments > 1 && 
                        ` (${categoryData.significantOverpayments} expenses)`
                      }
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Insights */}
      {sortedCategories.length > 0 && (
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-blue-400 font-medium">Overpayment Insights</p>
              <p className="text-white/70 text-sm mt-1">
                {sortedCategories.length} categor{sortedCategories.length !== 1 ? 'ies have' : 'y has'} overpayments. 
                Top category: <strong>{sortedCategories[0][0]}</strong> with <PrivacyWrapper>
                  <strong>{formatCurrency(sortedCategories[0][1].totalOverpayment)}</strong>
                </PrivacyWrapper> overpaid.
              </p>
              {sortedCategories.some(([, data]) => data.overpaymentPercentage >= 20) && (
                <p className="text-white/70 text-sm mt-1">
                  Consider adjusting budget allocations for categories with significant overpayments.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverpaymentAnalysis;

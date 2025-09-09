import { TrendingUp, TrendingDown, BarChart3, Calendar } from 'lucide-react';
import React, { useMemo } from 'react';

import PrivacyWrapper from './PrivacyWrapper';

const MonthlyTrends = ({ history = [] }) => {
  const monthlyData = useMemo(() => {
    if (!history || !Array.isArray(history) || history.length === 0) return [];

    // Group by month/year and aggregate
    const grouped = history.reduce((acc, entry) => {
      const key = `${entry.year}-${entry.month.toString().padStart(2, '0')}`;

      if (!acc[key]) {
        acc[key] = {
          month: entry.month,
          year: entry.year,
          totalBudget: 0,
          totalActual: 0,
          totalOverpayment: 0,
          expenseCount: 0,
        };
      }

      acc[key].totalBudget += entry.budgetAmount || 0;
      acc[key].totalActual += entry.actualAmount || 0;
      acc[key].totalOverpayment += entry.overpaymentAmount || 0;
      acc[key].expenseCount += 1;

      return acc;
    }, {});

    // Convert to array and sort by date (newest first)
    return Object.values(grouped)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      })
      .slice(0, 12); // Last 12 months
  }, [history]);

  const formatCurrency = amount => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (month, year) => {
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  const getAccuracyColor = (actual, budget) => {
    if (budget === 0) return 'text-white/50';
    const accuracy = (actual / budget) * 100;
    if (accuracy <= 100) return 'text-green-400';
    if (accuracy <= 120) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTrendIcon = (current, previous) => {
    if (!previous) return null;
    if (current > previous) return TrendingUp;
    if (current < previous) return TrendingDown;
    return null;
  };

  const calculateTrends = () => {
    if (monthlyData.length < 2) return null;

    const current = monthlyData[0];
    const previous = monthlyData[1];

    return {
      budgetTrend: current.totalBudget - previous.totalBudget,
      actualTrend: current.totalActual - previous.totalActual,
      overpaymentTrend: current.totalOverpayment - previous.totalOverpayment,
    };
  };

  const trends = calculateTrends();

  if (!monthlyData || monthlyData.length === 0) {
    return (
      <div className='glass-panel'>
        <h2 className='text-xl font-bold text-white mb-4'>Monthly Trends</h2>
        <div className='text-center py-8'>
          <Calendar className='w-12 h-12 text-white/30 mx-auto mb-4' />
          <p className='text-white/70'>No monthly data available yet.</p>
          <p className='text-white/50 text-sm mt-2'>
            Start making payments to see trends over time.
          </p>
        </div>
      </div>
    );
  }

  // Calculate max value for chart scaling
  const maxValue = Math.max(
    ...monthlyData.map(d => Math.max(d.totalBudget, d.totalActual))
  );

  return (
    <div className='glass-panel'>
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-xl font-bold text-white'>Monthly Trends</h2>
        <div className='flex items-center space-x-2'>
          <BarChart3 className='w-5 h-5 text-purple-400' />
          <span className='text-sm text-white/70'>Last 12 Months</span>
        </div>
      </div>

      {/* Trend Summary Cards */}
      {trends && (
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          {/* Budget Trend */}
          <div className='glass-card p-4'>
            <div className='flex items-center justify-between mb-2'>
              <p className='text-sm text-white/70'>Budget Change</p>
              {trends.budgetTrend !== 0 && (
                <div className='flex items-center space-x-1'>
                  {trends.budgetTrend > 0 ? (
                    <TrendingUp className='w-4 h-4 text-red-400' />
                  ) : (
                    <TrendingDown className='w-4 h-4 text-green-400' />
                  )}
                </div>
              )}
            </div>
            <p
              className={`text-lg font-bold ${
                trends.budgetTrend > 0
                  ? 'text-red-400'
                  : trends.budgetTrend < 0
                    ? 'text-green-400'
                    : 'text-white'
              }`}
            >
              {trends.budgetTrend > 0 ? '+' : ''}
              <PrivacyWrapper>
                {formatCurrency(trends.budgetTrend)}
              </PrivacyWrapper>
            </p>
          </div>

          {/* Actual Trend */}
          <div className='glass-card p-4'>
            <div className='flex items-center justify-between mb-2'>
              <p className='text-sm text-white/70'>Spending Change</p>
              {trends.actualTrend !== 0 && (
                <div className='flex items-center space-x-1'>
                  {trends.actualTrend > 0 ? (
                    <TrendingUp className='w-4 h-4 text-red-400' />
                  ) : (
                    <TrendingDown className='w-4 h-4 text-green-400' />
                  )}
                </div>
              )}
            </div>
            <p
              className={`text-lg font-bold ${
                trends.actualTrend > 0
                  ? 'text-red-400'
                  : trends.actualTrend < 0
                    ? 'text-green-400'
                    : 'text-white'
              }`}
            >
              {trends.actualTrend > 0 ? '+' : ''}
              <PrivacyWrapper>
                {formatCurrency(trends.actualTrend)}
              </PrivacyWrapper>
            </p>
          </div>

          {/* Overpayment Trend */}
          <div className='glass-card p-4'>
            <div className='flex items-center justify-between mb-2'>
              <p className='text-sm text-white/70'>Overpayment Change</p>
              {trends.overpaymentTrend !== 0 && (
                <div className='flex items-center space-x-1'>
                  {trends.overpaymentTrend > 0 ? (
                    <TrendingUp className='w-4 h-4 text-orange-400' />
                  ) : (
                    <TrendingDown className='w-4 h-4 text-green-400' />
                  )}
                </div>
              )}
            </div>
            <p
              className={`text-lg font-bold ${
                trends.overpaymentTrend > 0
                  ? 'text-orange-400'
                  : trends.overpaymentTrend < 0
                    ? 'text-green-400'
                    : 'text-white'
              }`}
            >
              {trends.overpaymentTrend > 0 ? '+' : ''}
              <PrivacyWrapper>
                {formatCurrency(trends.overpaymentTrend)}
              </PrivacyWrapper>
            </p>
          </div>
        </div>
      )}

      {/* Monthly Chart */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between text-sm text-white/70'>
          <span>Month</span>
          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
              <div className='w-3 h-3 bg-blue-400 rounded-full' />
              <span>Budget</span>
            </div>
            <div className='flex items-center space-x-2'>
              <div className='w-3 h-3 bg-purple-400 rounded-full' />
              <span>Actual</span>
            </div>
            <div className='flex items-center space-x-2'>
              <div className='w-3 h-3 bg-orange-400 rounded-full' />
              <span>Overpayment</span>
            </div>
          </div>
        </div>

        {monthlyData.map((data, index) => {
          const budgetWidth =
            maxValue > 0 ? (data.totalBudget / maxValue) * 100 : 0;
          const actualWidth =
            maxValue > 0 ? (data.totalActual / maxValue) * 100 : 0;
          const overpaymentWidth =
            maxValue > 0 ? (data.totalOverpayment / maxValue) * 100 : 0;
          const accuracy =
            data.totalBudget > 0
              ? (data.totalActual / data.totalBudget) * 100
              : 0;

          return (
            <div key={`${data.year}-${data.month}`} className='glass-card p-4'>
              <div className='flex items-center justify-between mb-3'>
                <div className='flex items-center space-x-3'>
                  <span className='font-medium text-white min-w-[80px]'>
                    {formatMonth(data.month, data.year)}
                  </span>
                  <span className='text-sm text-white/50'>
                    {data.expenseCount} expenses
                  </span>
                </div>
                <div className='text-right'>
                  <PrivacyWrapper>
                    <p className='text-sm text-white'>
                      {formatCurrency(data.totalActual)} /{' '}
                      {formatCurrency(data.totalBudget)}
                    </p>
                  </PrivacyWrapper>
                  <p
                    className={`text-xs font-medium ${getAccuracyColor(data.totalActual, data.totalBudget)}`}
                  >
                    {accuracy.toFixed(1)}% of budget
                  </p>
                </div>
              </div>

              {/* Stacked Bar Chart */}
              <div className='space-y-2'>
                {/* Budget Bar */}
                <div className='relative'>
                  <div className='w-full bg-white/10 rounded-full h-2'>
                    <div
                      className='h-2 rounded-full bg-blue-400 transition-all duration-500'
                      style={{ width: `${budgetWidth}%` }}
                    />
                  </div>
                </div>

                {/* Actual Bar */}
                <div className='relative'>
                  <div className='w-full bg-white/10 rounded-full h-2'>
                    <div
                      className='h-2 rounded-full bg-purple-400 transition-all duration-500'
                      style={{ width: `${actualWidth}%` }}
                    />
                  </div>
                </div>

                {/* Overpayment Bar */}
                {data.totalOverpayment > 0 && (
                  <div className='relative'>
                    <div className='w-full bg-white/10 rounded-full h-2'>
                      <div
                        className='h-2 rounded-full bg-orange-400 transition-all duration-500'
                        style={{ width: `${overpaymentWidth}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Info */}
              {data.totalOverpayment > 0 && (
                <div className='mt-2 text-xs text-orange-400'>
                  Overpaid by{' '}
                  <PrivacyWrapper>
                    {formatCurrency(data.totalOverpayment)}
                  </PrivacyWrapper>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart Scale */}
      <div className='mt-4 flex justify-between text-xs text-white/50'>
        <span>$0</span>
        <span>
          <PrivacyWrapper>{formatCurrency(maxValue)}</PrivacyWrapper>
        </span>
      </div>
    </div>
  );
};

export default MonthlyTrends;

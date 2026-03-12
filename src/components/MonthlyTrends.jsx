import { TrendingUp, TrendingDown, BarChart3, Calendar } from 'lucide-react';
import PropTypes from 'prop-types';
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { usePrivacy } from '../contexts/PrivacyContext';

import PrivacyWrapper from './PrivacyWrapper';

const formatCurrency = amount =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const MonthlyTrendsTooltip = ({ active, payload, label }) => {
  const { isHidden } = usePrivacy();
  if (!active || !payload?.length || !label) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className='glass-card p-3 shadow-lg border border-white/10'>
      <p className='font-medium text-white mb-2'>{label}</p>
      <div className='space-y-1 text-sm'>
        <p className='text-white/80'>
          Budget: {isHidden ? '••••••' : formatCurrency(d.totalBudget)}
        </p>
        <p className='text-white/80'>
          Actual: {isHidden ? '••••••' : formatCurrency(d.totalActual)}
        </p>
        <p className='text-white/80'>
          Overpayment:{' '}
          {isHidden ? '••••••' : formatCurrency(d.totalOverpayment)}
        </p>
      </div>
    </div>
  );
};

const MonthlyTrends = ({ history = [], months = 12, onMonthsChange }) => {
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
      acc[key].expenseCount += entry.expenseCount ?? 1;

      return acc;
    }, {});

    // Sort by date (oldest first), take last N months so chart shows oldest→newest
    return Object.values(grouped)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })
      .slice(-months);
  }, [history, months]);

  const chartData = useMemo(
    () =>
      monthlyData.map(d => ({
        ...d,
        name: `${new Date(d.year, d.month - 1).toLocaleDateString('en-US', {
          month: 'short',
        })} ${String(d.year).slice(-2)}`,
      })),
    [monthlyData],
  );

  const calculateTrends = () => {
    if (monthlyData.length < 2) return null;

    const current = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];

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
            Mark expenses as paid and complete a pay cycle to see monthly
            trends.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='glass-panel'>
      <div className='flex items-center justify-between mb-6 flex-wrap gap-2'>
        <h2 className='text-xl font-bold text-white'>Monthly Trends</h2>
        <div className='flex items-center space-x-2'>
          {onMonthsChange && (
            <select
              className='glass-input text-sm py-1.5 px-2 rounded-lg'
              value={months}
              onChange={e => onMonthsChange(Number(e.target.value))}
              aria-label='Month range'
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
          )}
          <BarChart3 className='w-5 h-5 text-purple-400' />
          <span className='text-sm text-white/70'>Last {months} months</span>
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
              className={`text-lg font-bold ${(() => {
                if (trends.budgetTrend > 0) return 'text-red-400';
                if (trends.budgetTrend < 0) return 'text-green-400';
                return 'text-white';
              })()}`}
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
              className={`text-lg font-bold ${(() => {
                if (trends.actualTrend > 0) return 'text-red-400';
                if (trends.actualTrend < 0) return 'text-green-400';
                return 'text-white';
              })()}`}
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
              className={`text-lg font-bold ${(() => {
                if (trends.overpaymentTrend > 0) return 'text-orange-400';
                if (trends.overpaymentTrend < 0) return 'text-green-400';
                return 'text-white';
              })()}`}
            >
              {trends.overpaymentTrend > 0 ? '+' : ''}
              <PrivacyWrapper>
                {formatCurrency(trends.overpaymentTrend)}
              </PrivacyWrapper>
            </p>
          </div>
        </div>
      )}

      {/* Recharts Bar Chart */}
      <ResponsiveContainer width='100%' height={320}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.1)' />
          <XAxis dataKey='name' stroke='rgba(255,255,255,0.5)' fontSize={12} />
          <YAxis
            stroke='rgba(255,255,255,0.5)'
            fontSize={12}
            tickFormatter={v => `$${v.toLocaleString()}`}
          />
          <Tooltip content={<MonthlyTrendsTooltip />} />
          <Legend />
          <Bar dataKey='totalBudget' fill='#6366f1' name='Budget' />
          <Bar dataKey='totalActual' fill='#8b5cf6' name='Actual' />
          <Bar dataKey='totalOverpayment' fill='#f97316' name='Overpayment' />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

MonthlyTrends.propTypes = {
  history: PropTypes.arrayOf(PropTypes.object),
  months: PropTypes.number,
  onMonthsChange: PropTypes.func,
};

MonthlyTrends.defaultProps = {
  history: [],
  months: 12,
};

export default MonthlyTrends;

import { TrendingUp, DollarSign } from 'lucide-react';
import PropTypes from 'prop-types';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { usePrivacy } from '../contexts/PrivacyContext';

import EmptyState from './EmptyState';
import OverpaymentEmptyIllustration from './illustrations/OverpaymentEmptyIllustration';
import PrivacyWrapper from './PrivacyWrapper';

const formatCurrency = amount =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);

const OverpaymentTooltip = ({ active, payload }) => {
  const { isHidden } = usePrivacy();
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className='glass-card p-3 shadow-lg border border-white/10'>
      <p className='font-medium text-white mb-2'>{d.name}</p>
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
        <p className='text-white/80'>
          Overpayment %:{' '}
          {isHidden ? '••••••' : `${d.overpaymentPercentage?.toFixed(1) ?? 0}%`}
        </p>
      </div>
    </div>
  );
};

const OverpaymentAnalysis = ({ data, categories = [] }) => {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className='glass-panel'>
        <h2 className='text-xl font-bold text-white mb-2'>
          Overpayment Analysis
        </h2>
        <EmptyState
          illustration={<OverpaymentEmptyIllustration />}
          title='Within budget!'
          subtitle='No overpayment data available for this cycle'
        />
      </div>
    );
  }

  // Sort categories by overpayment amount (descending)
  const sortedCategories = Object.entries(data)
    .sort(([, a], [, b]) => b.totalOverpayment - a.totalOverpayment)
    .filter(([, categoryData]) => categoryData.totalOverpayment > 0);

  const totalOverpayment = Object.values(data).reduce(
    (sum, category) => sum + category.totalOverpayment,
    0,
  );

  const chartData = sortedCategories.map(([name, categoryData]) => ({
    name,
    ...categoryData,
  }));

  const _getCategoryIcon = name =>
    categories.find(c => c.name === name)?.icon ?? '📝';
  const getCategoryColor = name =>
    categories.find(c => c.name === name)?.color ?? '#6366f1';

  const _getOverpaymentColor = percentage => {
    if (percentage >= 50) return 'text-red-400';
    if (percentage >= 20) return 'text-orange-400';
    if (percentage >= 10) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className='glass-panel'>
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-xl font-bold text-white'>Overpayment Analysis</h2>
        <div className='flex items-center space-x-2'>
          <DollarSign className='w-5 h-5 text-green-400' />
          <PrivacyWrapper>
            <span className='font-semibold text-green-400'>
              {formatCurrency(totalOverpayment)} Total
            </span>
          </PrivacyWrapper>
        </div>
      </div>

      {sortedCategories.length === 0 ? (
        <EmptyState
          illustration={<OverpaymentEmptyIllustration />}
          title='Within budget!'
          subtitle="No overpayments this cycle — you're managing spending well"
        />
      ) : (
        <ResponsiveContainer
          width='100%'
          height={Math.max(200, sortedCategories.length * 60)}
        >
          <BarChart
            layout='vertical'
            data={chartData}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray='3 3'
              stroke='rgba(255,255,255,0.1)'
            />
            <XAxis
              type='number'
              stroke='rgba(255,255,255,0.5)'
              fontSize={12}
              tickFormatter={v => `$${v.toLocaleString()}`}
            />
            <YAxis
              type='category'
              dataKey='name'
              stroke='rgba(255,255,255,0.5)'
              fontSize={12}
              width={100}
            />
            <Tooltip content={<OverpaymentTooltip />} />
            <Bar dataKey='totalOverpayment' name='Overpayment'>
              {chartData.map(entry => (
                <Cell key={entry.name} fill={getCategoryColor(entry.name)} />
              ))}
            </Bar>
            <Bar dataKey='totalBudget' fill='#6366f1' name='Budget' />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Summary Insights */}
      {sortedCategories.length > 0 && (
        <div className='mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg'>
          <div className='flex items-start space-x-3'>
            <TrendingUp className='w-5 h-5 text-blue-400 mt-0.5' />
            <div>
              <p className='text-blue-400 font-medium'>Overpayment Insights</p>
              <p className='text-white/70 text-sm mt-1'>
                {sortedCategories.length} categor
                {sortedCategories.length !== 1 ? 'ies have' : 'y has'}{' '}
                overpayments. Top category:{' '}
                <strong>{sortedCategories[0][0]}</strong> with{' '}
                <PrivacyWrapper>
                  <strong>
                    {formatCurrency(sortedCategories[0][1].totalOverpayment)}
                  </strong>
                </PrivacyWrapper>{' '}
                overpaid.
              </p>
              {sortedCategories.some(
                ([, data]) => data.overpaymentPercentage >= 20,
              ) && (
                <p className='text-white/70 text-sm mt-1'>
                  Consider adjusting budget allocations for categories with
                  significant overpayments.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

OverpaymentAnalysis.propTypes = {
  data: PropTypes.object,
  categories: PropTypes.arrayOf(PropTypes.object),
};

OverpaymentAnalysis.defaultProps = {
  categories: [],
};

export default OverpaymentAnalysis;

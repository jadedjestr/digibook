import { ChevronLeft } from 'lucide-react';
import PropTypes from 'prop-types';

import { formatCurrency } from '../utils/accountUtils';

import PrivacyWrapper from './PrivacyWrapper';

const CategoryDetailView = ({ categoryName, categoryData, onBack }) => {
  const {
    budgeted,
    paid,
    remaining,
    color,
    paidPercentage,
    remainingPercentage,
  } = categoryData;

  const handleBackClick = () => {
    onBack?.();
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBackClick();
    }
  };

  return (
    <div className='space-y-6'>
      {/* Header with back button */}
      <div className='flex items-center gap-3'>
        <button
          onClick={handleBackClick}
          onKeyDown={handleKeyDown}
          className='glass-button glass-button--sm flex items-center justify-center'
          aria-label='Back to overview'
          tabIndex={0}
        >
          <ChevronLeft size={16} />
        </button>
        <div
          className='w-4 h-4 rounded-full flex-shrink-0'
          style={{ backgroundColor: color }}
          aria-hidden='true'
        />
        <h3 className='text-lg font-semibold text-white'>{categoryName}</h3>
      </div>

      {/* Total Budgeted */}
      <div className='text-center py-4'>
        <div className='text-sm text-white/60 mb-2'>Total Budgeted</div>
        <PrivacyWrapper>
          <div className='text-3xl font-bold text-white'>
            {formatCurrency(budgeted)}
          </div>
        </PrivacyWrapper>
      </div>

      {/* Paid and Remaining Section */}
      <div className='grid grid-cols-2 gap-4'>
        {/* Paid Amount */}
        <div className='glass-panel p-4 text-center'>
          <div className='text-xs text-white/60 mb-2'>Paid</div>
          <PrivacyWrapper>
            <div className='text-xl font-bold text-green-400 mb-1'>
              {formatCurrency(paid)}
            </div>
          </PrivacyWrapper>
          <div className='text-xs text-white/50'>
            {paidPercentage.toFixed(1)}% of budgeted
          </div>
        </div>

        {/* Remaining Amount */}
        <div className='glass-panel p-4 text-center'>
          <div className='text-xs text-white/60 mb-2'>Remaining</div>
          <PrivacyWrapper>
            <div className='text-xl font-bold text-yellow-400 mb-1'>
              {formatCurrency(remaining)}
            </div>
          </PrivacyWrapper>
          <div className='text-xs text-white/50'>
            {remainingPercentage.toFixed(1)}% of budgeted
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className='space-y-2'>
        <div className='flex justify-between text-xs text-white/60'>
          <span>Payment Progress</span>
          <span>{paidPercentage.toFixed(1)}% paid</span>
        </div>
        <div className='relative h-4 bg-white/10 rounded-full overflow-hidden'>
          {/* Paid portion */}
          <div
            className='absolute top-0 left-0 h-full bg-green-400 transition-all duration-500 ease-out'
            style={{ width: `${paidPercentage}%` }}
            aria-hidden='true'
          />
          {/* Remaining portion - starts after paid portion */}
          <div
            className='absolute top-0 h-full bg-yellow-400 transition-all duration-500 ease-out'
            style={{
              left: `${paidPercentage}%`,
              width: `${remainingPercentage}%`,
            }}
            aria-hidden='true'
          />
        </div>
      </div>
    </div>
  );
};

CategoryDetailView.propTypes = {
  categoryName: PropTypes.string.isRequired,
  categoryData: PropTypes.shape({
    budgeted: PropTypes.number,
    paid: PropTypes.number,
    remaining: PropTypes.number,
    color: PropTypes.string,
    paidPercentage: PropTypes.number,
    remainingPercentage: PropTypes.number,
  }).isRequired,
  onBack: PropTypes.func,
};

export default CategoryDetailView;

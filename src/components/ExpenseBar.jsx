import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { formatCurrency } from '../utils/accountUtils';

import PrivacyWrapper from './PrivacyWrapper';

const ExpenseBar = ({
  expense,
  index,
  totalAmount: _totalAmount,
  onCategoryClick,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const baseDelay = index * 100;
    const visibilityTimer = setTimeout(() => setIsVisible(true), baseDelay);
    const barTimer = setTimeout(
      () => setBarWidth(expense.percentage),
      baseDelay + 200,
    );

    return () => {
      clearTimeout(visibilityTimer);
      clearTimeout(barTimer);
    };
  }, [index, expense.percentage]);

  const handleClick = () => {
    onCategoryClick?.(expense.name);
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`
        flex items-center mb-3 p-2 rounded-lg transition-all duration-200
        hover:bg-gray-700 hover:translate-x-1 cursor-pointer
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
      style={{
        transform: isVisible ? 'translateX(0)' : 'translateX(-20px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
      role='button'
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${expense.name}: ${formatCurrency(expense.amount)} (${expense.percentage.toFixed(1)}% of total). Click to view expenses in this category.`}
    >
      {/* Color indicator dot */}
      <div
        className='w-6 h-6 rounded-full mr-3 flex-shrink-0'
        style={{ backgroundColor: expense.color }}
        aria-hidden='true'
      />

      {/* Expense name */}
      <span className='text-sm font-medium w-[180px] text-white truncate flex-shrink-0'>
        {expense.name}
      </span>

      {/* Progress bar container */}
      <div
        className='flex-grow h-2 bg-gray-600 rounded mx-3 flex-shrink-0 overflow-hidden'
        style={{ minWidth: '120px' }}
      >
        <div
          className='h-full rounded transition-transform duration-800 ease-out'
          style={{
            width: '100%',
            transform: `scaleX(${barWidth / 100})`,
            transformOrigin: 'left',
            backgroundColor: expense.color,
          }}
        />
      </div>

      {/* Dollar amount */}
      <span className='text-sm font-semibold text-white min-w-[80px] text-right flex-shrink-0'>
        <PrivacyWrapper>{formatCurrency(expense.amount)}</PrivacyWrapper>
      </span>

      {/* Percentage */}
      <span className='text-xs text-gray-400 min-w-[40px] text-right flex-shrink-0'>
        {expense.percentage.toFixed(1)}%
      </span>
    </div>
  );
};

ExpenseBar.propTypes = {
  expense: PropTypes.shape({
    name: PropTypes.string,
    amount: PropTypes.number,
    percentage: PropTypes.number,
    color: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
  totalAmount: PropTypes.number,
  onCategoryClick: PropTypes.func,
};

export default ExpenseBar;

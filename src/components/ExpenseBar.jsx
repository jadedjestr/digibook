import React, { useState, useEffect } from 'react';
import PrivacyWrapper from './PrivacyWrapper';

const ExpenseBar = ({ expense, index, totalAmount }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    // Stagger animation: 100ms delay between each item
    const visibilityTimer = setTimeout(() => setIsVisible(true), index * 100);
    
    // Animate bar width after visibility
    const barTimer = setTimeout(() => {
      setBarWidth(expense.percentage);
    }, index * 100 + 200);

    return () => {
      clearTimeout(visibilityTimer);
      clearTimeout(barTimer);
    };
  }, [index, expense.percentage]);

  return (
    <div 
      className={`
        flex items-center mb-3 p-2 rounded-lg transition-all duration-200 
        hover:bg-gray-700 hover:translate-x-1 cursor-pointer
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
      style={{ 
        transform: isVisible ? 'translateX(0)' : 'translateX(-20px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease'
      }}
      role="button"
      tabIndex={0}
      aria-label={`${expense.name}: $${expense.amount.toFixed(2)} (${expense.percentage.toFixed(1)}% of total expenses)`}
    >
      {/* Color indicator dot */}
      <div 
        className="w-6 h-6 rounded-full mr-3 flex-shrink-0"
        style={{ backgroundColor: expense.color }}
        aria-hidden="true"
      />
      
      {/* Expense name */}
      <span className="text-sm font-medium w-[120px] text-white truncate flex-shrink-0">
        {expense.name}
      </span>
      
      {/* Progress bar container */}
      <div className="flex-grow h-2 bg-gray-600 rounded mx-3 flex-shrink-0" style={{ minWidth: '100px' }}>
        <div 
          className="h-full rounded transition-all duration-800 ease-out"
          style={{ 
            width: `${barWidth}%`, 
            backgroundColor: expense.color 
          }}
        />
      </div>
      
      {/* Dollar amount */}
      <span className="text-sm font-semibold text-white min-w-[80px] text-right flex-shrink-0">
        <PrivacyWrapper>
          ${expense.amount.toFixed(2)}
        </PrivacyWrapper>
      </span>
      
      {/* Percentage */}
      <span className="text-xs text-gray-400 min-w-[40px] text-right flex-shrink-0">
        {expense.percentage.toFixed(1)}%
      </span>
    </div>
  );
};

export default ExpenseBar;

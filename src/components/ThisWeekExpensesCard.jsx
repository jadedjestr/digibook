import { Clock, DollarSign } from 'lucide-react';
import React from 'react';

import { formatCurrency } from '../utils/accountUtils';

const ThisWeekExpensesCard = ({ totalAmount, expenseCount }) => {
  return (
    <div className='glass-card'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-sm font-medium text-secondary'>
          This Week Expenses
        </h3>
        <Clock size={16} className='text-secondary' />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='text-center'>
          <div className='text-2xl font-bold text-orange-300 mb-1'>
            {formatCurrency(totalAmount)}
          </div>
          <div className='text-xs text-secondary'>Total Amount</div>
        </div>

        <div className='text-center'>
          <div className='text-2xl font-bold text-orange-300 mb-1'>
            {expenseCount}
          </div>
          <div className='text-xs text-secondary'>
            Expense{expenseCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThisWeekExpensesCard;

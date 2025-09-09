import { Calendar, Clock } from 'lucide-react';
import React from 'react';

import { DateUtils } from '../utils/dateUtils';

const PayDateCountdownCard = ({
  nextPayDate,
  followingPayDate,
  daysUntilNextPay,
  daysUntilFollowingPay,
}) => {
  const formatDate = dateString => {
    if (!dateString) return 'Not set';
    return DateUtils.formatShortDate(dateString);
  };

  return (
    <div className='glass-card'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-sm font-medium text-secondary'>
          Paycheck Countdown
        </h3>
        <Calendar size={16} className='text-secondary' />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='text-center'>
          <div className='text-lg font-semibold text-white mb-1'>
            {formatDate(nextPayDate)}
          </div>
          <div className='text-xs text-secondary mb-2'>Next Pay Date</div>
          <div className='flex items-center justify-center text-orange-300'>
            <Clock size={12} className='mr-1' />
            <span className='text-xs font-medium'>
              {daysUntilNextPay !== null
                ? `${daysUntilNextPay} days`
                : 'Not set'}
            </span>
          </div>
        </div>

        <div className='text-center'>
          <div className='text-lg font-semibold text-white mb-1'>
            {formatDate(followingPayDate)}
          </div>
          <div className='text-xs text-secondary mb-2'>Following Pay Date</div>
          <div className='flex items-center justify-center text-blue-300'>
            <Clock size={12} className='mr-1' />
            <span className='text-xs font-medium'>
              {daysUntilFollowingPay !== null
                ? `${daysUntilFollowingPay} days`
                : 'Not set'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayDateCountdownCard;

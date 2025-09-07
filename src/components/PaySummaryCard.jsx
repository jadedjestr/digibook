import { DollarSign } from 'lucide-react';

import { formatCurrency } from '../utils/accountUtils';

import PrivacyWrapper from './PrivacyWrapper';

const PaySummaryCard = ({ summaryTotals = {} }) => {
  const {
    payThisWeekTotal = 0,
    payNextCheckTotal = 0,
    overdueTotal = 0,
  } = summaryTotals;
  return (
    <div className='glass-card'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-sm font-medium text-secondary'>Payment Summary</h3>
        <DollarSign size={16} className='text-secondary' />
      </div>

      <div className='grid grid-cols-3 gap-3'>
        <div className='text-center'>
          <div className='text-xl font-bold text-orange-300 mb-1'>
            <PrivacyWrapper>{formatCurrency(payThisWeekTotal)}</PrivacyWrapper>
          </div>
          <div className='text-xs text-secondary'>Pay This Week</div>
        </div>

        <div className='text-center'>
          <div className='text-xl font-bold text-blue-300 mb-1'>
            <PrivacyWrapper>{formatCurrency(payNextCheckTotal)}</PrivacyWrapper>
          </div>
          <div className='text-xs text-secondary'>Pay with Next Check</div>
        </div>

        <div className='text-center'>
          <div className='text-xl font-bold text-red-300 mb-1'>
            <PrivacyWrapper>{formatCurrency(overdueTotal)}</PrivacyWrapper>
          </div>
          <div className='text-xs text-secondary'>Overdue</div>
        </div>
      </div>
    </div>
  );
};

export default PaySummaryCard;

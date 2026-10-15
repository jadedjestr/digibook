import { TrendingUp, TrendingDown } from 'lucide-react';
import PropTypes from 'prop-types';

import { formatCurrency } from '../utils/accountUtils';

import PrivacyWrapper from './PrivacyWrapper';

/**
 * "After This Week": money left in the default account once the bills due
 * up to the next payday are paid.
 *
 * Displays the first pay period of the forecast (buildPaycheckForecast, via
 * useBillForecast) rather than computing anything itself. It used to do its
 * own math, which left out overdue bills still owed and subtracted bills
 * charged to a card or paid from another account, so it disagreed with the
 * "Where your bills go" rows answering the same question. One source keeps
 * them equal.
 *
 * Without a pay schedule there is no first period; the card then shows the
 * starting balance and says why no bills came off it.
 */
const ProjectedBalanceCard = ({
  firstPeriod = null,
  startingCents = 0,
  accountName = null,
  showAccountName = true,
}) => {
  const leftCents = firstPeriod ? firstPeriod.leftCents : startingCents;
  const isPositive = leftCents >= 0;
  const overdueCents = firstPeriod?.overdueFromAccountCents ?? 0;

  let detail = 'After bills & pending';
  if (!firstPeriod) detail = 'Set your pay schedule to subtract bills';
  const prefix = showAccountName ? `${accountName ?? 'No Account'} • ` : '';

  return (
    <div className='glass-card'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-sm font-medium text-secondary'>After This Week</h3>
        {isPositive ? (
          <TrendingUp size={16} className='text-green-300' />
        ) : (
          <TrendingDown size={16} className='text-red-300' />
        )}
      </div>

      <div className='space-y-2'>
        <div className='text-center'>
          <div
            className={`text-2xl font-bold mb-1 ${
              isPositive ? 'text-green-300' : 'text-red-300'
            }`}
          >
            <PrivacyWrapper>{formatCurrency(leftCents / 100)}</PrivacyWrapper>
          </div>
          <div className='text-xs text-secondary'>Projected Balance</div>
        </div>

        <div className='text-xs text-secondary text-center'>
          {prefix}
          {detail}
        </div>
        {overdueCents > 0 && (
          <div className='text-xs text-secondary text-center'>
            Includes{' '}
            <PrivacyWrapper>
              {formatCurrency(overdueCents / 100)}
            </PrivacyWrapper>{' '}
            overdue
          </div>
        )}
      </div>
    </div>
  );
};

ProjectedBalanceCard.propTypes = {
  firstPeriod: PropTypes.shape({
    leftCents: PropTypes.number.isRequired,
    overdueFromAccountCents: PropTypes.number,
  }),
  startingCents: PropTypes.number,
  accountName: PropTypes.string,
  showAccountName: PropTypes.bool,
};

export default ProjectedBalanceCard;

import PropTypes from 'prop-types';

import { formatCurrency } from '../utils/accountUtils';

import PrivacyWrapper from './PrivacyWrapper';

/**
 * The page's one hero number: what's due this week.
 *
 * Replaces PaySummaryCard's three co-equal stats — the whole point of the
 * redesign was that a page with several same-weight numbers gives the eye
 * no reason to land on any one of them. `summaryTotals` is unchanged data
 * (see FixedExpenses.jsx), just no longer split three ways visually.
 */
// Default param, not defaultProps — React is deprecating defaultProps on
// function components. Guards the same case PaySummaryCard's defaultProps
// did: a caller that hasn't computed totals yet passing nothing at all, not
// just partial totals (the destructure below already covers a partial
// object on its own).
const FixedExpensesHero = ({ summaryTotals = {} }) => {
  const {
    payThisWeekTotal = 0,
    payNextCheckTotal = 0,
    overdueTotal = 0,
  } = summaryTotals;

  return (
    <div className='fixed-expenses-hero'>
      <p className='fixed-expenses-hero-label'>Due this week</p>
      <p className='fixed-expenses-hero-amount'>
        <PrivacyWrapper>{formatCurrency(payThisWeekTotal)}</PrivacyWrapper>
      </p>
      <p className='fixed-expenses-hero-sub'>
        {overdueTotal > 0 ? (
          <span className='fixed-expenses-hero-overdue'>
            <PrivacyWrapper>{formatCurrency(overdueTotal)}</PrivacyWrapper>{' '}
            overdue
          </span>
        ) : (
          <span className='fixed-expenses-hero-clear'>Nothing overdue</span>
        )}
        <span className='fixed-expenses-hero-divider'>·</span>
        <span>
          then{' '}
          <PrivacyWrapper>{formatCurrency(payNextCheckTotal)}</PrivacyWrapper>{' '}
          with your next check
        </span>
      </p>
    </div>
  );
};

FixedExpensesHero.propTypes = {
  summaryTotals: PropTypes.shape({
    payThisWeekTotal: PropTypes.number,
    payNextCheckTotal: PropTypes.number,
    overdueTotal: PropTypes.number,
  }),
};

export default FixedExpensesHero;

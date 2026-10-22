import PropTypes from 'prop-types';

import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { moneyInputErrorMessage, parseMoneyInput } from '../utils/validation';

/**
 * Read the "custom payment" half of the card form. The one place the typed
 * text becomes a number, used by both validation and save so they can't
 * disagree. Returns whole cents, so a pasted 100.005 can't leak into a bill.
 *
 * @param {'calculated'|'custom'} mode
 * @param {string} text - what the user typed
 * @returns {{ error: string|null, amount: number|null }} amount is null for
 *   the calculated payment (which is stored as "no custom amount")
 */
export const resolveCustomPayment = (mode, text) => {
  if (mode !== 'custom') return { error: null, amount: null };
  const parsed = parseMoneyInput(text);
  if (!parsed.ok) {
    return { error: moneyInputErrorMessage(parsed.reason), amount: null };
  }
  if (parsed.value <= 0) {
    return { error: 'Enter an amount above $0.00', amount: null };
  }
  return { error: null, amount: Math.round(parsed.value * 100) / 100 };
};

/**
 * The card and loan forms' "how should the monthly payment be set?" choice:
 * Calculated (from balance and payoff goal) or Custom (a typed dollar amount).
 *
 * Presentational: the page owns the form state and passes in `plan`, the
 * live read of what the typed amount would do (getCardPaymentPlan, or
 * getLoanPaymentPlan mapped to the same flags), so the promises made here
 * are the same ones the bill keeps. `noun` and `minimumLabel` word it for a
 * card or a loan.
 */
const CardPaymentModeField = ({
  mode,
  customPayment,
  error,
  plan,
  issuerMinimum,
  calculatedPayment,
  onChange,
  noun,
  minimumLabel,
  idPrefix,
}) => (
  <div>
    <span
      id={`${idPrefix}-payment-mode-label`}
      className='block text-sm font-medium text-white mb-2'
    >
      How should the monthly payment be set?
    </span>
    <div
      className='flex gap-2'
      role='group'
      aria-labelledby={`${idPrefix}-payment-mode-label`}
    >
      <button
        type='button'
        aria-pressed={mode === 'calculated'}
        onClick={() => onChange('paymentMode', 'calculated')}
        className={`glass-button glass-button--filter text-sm ${
          mode === 'calculated' ? 'active' : ''
        }`}
      >
        Calculated for me
      </button>
      <button
        type='button'
        aria-pressed={mode === 'custom'}
        onClick={() => onChange('paymentMode', 'custom')}
        className={`glass-button glass-button--filter text-sm ${
          mode === 'custom' ? 'active' : ''
        }`}
      >
        Custom amount
      </button>
    </div>

    {mode === 'custom' ? (
      <div className='mt-3'>
        <label
          htmlFor={`${idPrefix}-custom-payment`}
          className='block text-sm font-medium text-white mb-2'
        >
          Custom payment per month
        </label>
        <input
          id={`${idPrefix}-custom-payment`}
          type='text'
          inputMode='decimal'
          value={customPayment}
          onChange={e => onChange('customPayment', e.target.value)}
          className='w-full px-4 py-3 glass-input rounded-xl text-white'
          placeholder='0.00'
        />
        {error && <p className='text-red-400 text-sm mt-1'>{error}</p>}
        {plan?.belowIssuerMinimum && (
          <p className='text-yellow-400 text-sm mt-1'>
            This is below the {minimumLabel} of {formatCurrency(issuerMinimum)},
            so you may be charged a late fee.
          </p>
        )}
        {plan?.neverPaysOff && (
          <p className='text-yellow-400 text-sm mt-1'>
            This is less than the {noun}’s monthly interest, so the balance
            won’t go down.
          </p>
        )}
        {plan?.paysOffCard ? (
          <p className='text-white/50 text-xs mt-1'>
            This pays off the {noun}. The bill will be just what’s left.
          </p>
        ) : (
          plan?.projectedPayoffDate && (
            <p className='text-white/50 text-xs mt-1'>
              At this payment the {noun} is paid off by{' '}
              {DateUtils.formatShortDate(plan.projectedPayoffDate.slice(0, 10))}
              .
            </p>
          )
        )}
        <p className='text-white/50 text-xs mt-1'>
          You’ll pay this amount every month until the {noun} is paid off.
          Switch back to “Calculated for me” any time.
        </p>
      </div>
    ) : (
      <p className='text-white/50 text-xs mt-2'>
        The payment is recalculated from your balance and payoff goal.
        {calculatedPayment != null &&
          ` Right now: ${formatCurrency(calculatedPayment)}/month.`}
      </p>
    )}
  </div>
);

CardPaymentModeField.propTypes = {
  mode: PropTypes.oneOf(['calculated', 'custom']).isRequired,
  customPayment: PropTypes.string.isRequired,
  error: PropTypes.string,
  plan: PropTypes.shape({
    belowIssuerMinimum: PropTypes.bool,
    paysOffCard: PropTypes.bool,
    neverPaysOff: PropTypes.bool,
    projectedPayoffDate: PropTypes.string,
  }),
  issuerMinimum: PropTypes.number,
  calculatedPayment: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  noun: PropTypes.string,
  minimumLabel: PropTypes.string,
  idPrefix: PropTypes.string,
};

CardPaymentModeField.defaultProps = {
  error: undefined,
  plan: null,
  issuerMinimum: 0,
  calculatedPayment: undefined,
  noun: 'card',
  minimumLabel: 'card’s minimum payment',
  idPrefix: 'credit-card',
};

export default CardPaymentModeField;

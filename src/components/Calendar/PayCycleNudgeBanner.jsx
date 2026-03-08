import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';

import { NUDGE_DEFAULT_COPY } from '../../constants/payCycleNudgeTypes';

/**
 * Fill a message template with payload placeholders, e.g. {unpaidCount} -> payload.unpaidCount
 */
function fillMessage(template, payload = {}) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = payload[key];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

const PayCycleNudgeBanner = ({
  nudge,
  onReviewPastMonth,
  onStartReset,
  onDismiss,
  onMarkCurrentMonthPaid,
  onReviewScroll,
  onAction,
}) => {
  const primaryButtonRef = useRef(null);

  useEffect(() => {
    if (nudge && primaryButtonRef.current) {
      primaryButtonRef.current.focus();
    }
  }, [nudge]);

  if (!nudge) return null;

  const copy = NUDGE_DEFAULT_COPY[nudge.type];
  const message = copy ? fillMessage(copy.messageTemplate, nudge.payload) : '';

  const handleDismiss = dontShowAgain => {
    onDismiss(nudge.dismissKey, dontShowAgain);
  };

  const handlePrimary = () => {
    if (nudge.type === 'past_month') {
      onReviewPastMonth?.(nudge.payload.lastMonthKey);
      onAction?.(nudge, 'review');
    } else if (nudge.type === 'catch_up') {
      onMarkCurrentMonthPaid?.();
      onAction?.(nudge, 'mark_paid');
    } else if (nudge.type === 'reset') {
      onStartReset?.();
      onAction?.(nudge, 'start_reset');
    }
  };

  const handleSecondary = () => {
    if (nudge.type === 'past_month') {
      handleDismiss(false);
    } else if (nudge.type === 'catch_up') {
      onReviewScroll?.();
      onAction?.(nudge, 'review');
    } else if (nudge.type === 'reset') {
      handleDismiss(false);
      onAction?.(nudge, 'dismiss');
    }
  };

  const primaryLabel =
    nudge.type === 'past_month' && nudge.payload?.lastMonthLabel
      ? `Review ${nudge.payload.lastMonthLabel.split(' ')[0]}`
      : copy?.primaryAction || 'OK';
  const secondaryLabel = copy?.secondaryAction || 'Dismiss';

  return (
    <div
      className='glass-panel p-3 mb-4'
      role='status'
      aria-live='polite'
      aria-label='Pay cycle reminder'
    >
      <p className='text-secondary text-sm mb-2' id='pay-cycle-nudge-message'>
        {message}
      </p>
      <div className='flex flex-wrap items-center gap-2'>
        <button
          ref={primaryButtonRef}
          type='button'
          onClick={handlePrimary}
          className='glass-button glass-button--primary text-sm px-3 py-1.5'
          aria-describedby='pay-cycle-nudge-message'
        >
          {primaryLabel}
        </button>
        <button
          type='button'
          onClick={handleSecondary}
          className='glass-button text-sm px-3 py-1.5'
          aria-describedby='pay-cycle-nudge-message'
        >
          {secondaryLabel}
        </button>
        {nudge.type === 'catch_up' && (
          <button
            type='button'
            onClick={() => handleDismiss(false)}
            className='glass-button text-sm px-3 py-1.5'
          >
            Dismiss
          </button>
        )}
        {nudge.type === 'past_month' && (
          <button
            type='button'
            onClick={() => handleDismiss(true)}
            className='glass-button text-sm px-3 py-1.5 opacity-80'
          >
            Don&apos;t show again this month
          </button>
        )}
      </div>
    </div>
  );
};

PayCycleNudgeBanner.propTypes = {
  nudge: PropTypes.shape({
    type: PropTypes.oneOf(['past_month', 'catch_up', 'reset']).isRequired,
    payload: PropTypes.object,
    dismissKey: PropTypes.string.isRequired,
  }),
  onReviewPastMonth: PropTypes.func,
  onStartReset: PropTypes.func,
  onDismiss: PropTypes.func.isRequired,
  onMarkCurrentMonthPaid: PropTypes.func,
  onReviewScroll: PropTypes.func,
  onAction: PropTypes.func,
};

PayCycleNudgeBanner.defaultProps = {
  nudge: null,
  onReviewPastMonth: undefined,
  onStartReset: undefined,
  onMarkCurrentMonthPaid: undefined,
  onReviewScroll: undefined,
  onAction: undefined,
};

export default PayCycleNudgeBanner;

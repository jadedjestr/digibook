import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

import { NUDGE_DEFAULT_COPY } from '../../constants/payCycleNudgeTypes';

/**
 * Fill a message template with payload placeholders.
 */
function fillMessage(template, payload = {}) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = payload[key];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * Renders the nudge as a toast when nudge is non-null. Same props as PayCycleNudgeBanner.
 * Use as drop-in alternative to the banner (e.g. for mobile or user preference).
 */
const PayCycleNudgeToast = ({
  nudge,
  onReviewPastMonth,
  onStartReset,
  onDismiss,
  onMarkCurrentMonthPaid,
  onReviewScroll,
  onAction,
}) => {
  const toastIdRef = useRef(null);

  useEffect(() => {
    if (!nudge) {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      return;
    }

    const copy = NUDGE_DEFAULT_COPY[nudge.type];
    const message = copy
      ? fillMessage(copy.messageTemplate, nudge.payload)
      : '';

    const handleDismiss = dontShowAgain => {
      onDismiss(nudge.dismissKey, dontShowAgain);
      toast.dismiss(toastIdRef.current);
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
      toast.dismiss(toastIdRef.current);
    };

    const handleSecondary = () => {
      if (nudge.type === 'past_month') {
        handleDismiss(false);
      } else if (nudge.type === 'catch_up') {
        onReviewScroll?.();
        onAction?.(nudge, 'review');
        toast.dismiss(toastIdRef.current);
      } else if (nudge.type === 'reset') {
        handleDismiss(false);
      }
    };

    const primaryLabel =
      nudge.type === 'past_month' && nudge.payload?.lastMonthLabel
        ? `Review ${nudge.payload.lastMonthLabel.split(' ')[0]}`
        : copy?.primaryAction || 'OK';
    const secondaryLabel = copy?.secondaryAction || 'Dismiss';

    const content = (
      <div>
        <p className='mb-2'>{message}</p>
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={handlePrimary}
            className='px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm'
          >
            {primaryLabel}
          </button>
          <button
            type='button'
            onClick={handleSecondary}
            className='px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm'
          >
            {secondaryLabel}
          </button>
          {nudge.type === 'catch_up' && (
            <button
              type='button'
              onClick={() => handleDismiss(false)}
              className='px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm'
            >
              Dismiss
            </button>
          )}
          {nudge.type === 'past_month' && (
            <button
              type='button'
              onClick={() => handleDismiss(true)}
              className='px-3 py-1 opacity-80 text-sm'
            >
              Don&apos;t show again this month
            </button>
          )}
        </div>
      </div>
    );

    toastIdRef.current = toast.info(content, {
      autoClose: false,
      closeOnClick: false,
      draggable: false,
    });

    return () => {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, [
    nudge,
    onReviewPastMonth,
    onStartReset,
    onDismiss,
    onMarkCurrentMonthPaid,
    onReviewScroll,
    onAction,
  ]);

  return null;
};

PayCycleNudgeToast.propTypes = {
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

PayCycleNudgeToast.defaultProps = {
  nudge: null,
  onReviewPastMonth: undefined,
  onStartReset: undefined,
  onMarkCurrentMonthPaid: undefined,
  onReviewScroll: undefined,
  onAction: undefined,
};

export default PayCycleNudgeToast;

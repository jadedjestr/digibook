import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { dbHelpers } from '../db/database-clean';
import { useExpenseOperations } from '../hooks/useExpenseOperations';
import { formatCurrency } from '../utils/accountUtils';
import { notify } from '../utils/notifications';
import { validatePaidAmount } from '../utils/validation';

/**
 * Unified "resolve this bill" modal — replaces MarkAsPaidModal and
 * Calendar/QuickActions, which offered two different, partially
 * overlapping ways to record a payment (one with no Skip concept, one
 * with a hardcoded "50% paid" and an ad hoc "Reset Payment" that was
 * really an undo).
 *
 * Recurring-template expense: Pay Full / Partial (hidden for a
 * variable-amount template — there's no confirmed total yet to measure a
 * shortfall against) / Skip. Skip is simply Partial with $0 paid — not a
 * separate mechanism. Any of the three immediately advances the
 * template's cadence via resolveCycle; a shortfall spins off a Balance
 * Due automatically.
 *
 * One-off expense (including a Balance Due, which is just a normal
 * one-off): Pay Full / Partial only, via the existing updateExpenseV4
 * path, unchanged.
 */
const ResolveExpenseModal = ({ expense, isOpen, onClose }) => {
  const { updateExpenseV4, resolveCycle } = useExpenseOperations();

  const amountDue = expense
    ? (expense.amount ?? 0) - (expense.paidAmount ?? 0)
    : 0;
  const isRecurring = Boolean(expense?.recurringTemplateId);

  const [paidAmount, setPaidAmount] = useState(
    amountDue > 0 ? String(amountDue) : '0',
  );
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [isVariableAmount, setIsVariableAmount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !expense) return undefined;

    const due = (expense.amount ?? 0) - (expense.paidAmount ?? 0);
    setPaidAmount(due > 0 ? String(due) : '0');
    setShowPartialInput(false);
    setIsVariableAmount(false);

    if (!expense.recurringTemplateId) return undefined;

    let cancelled = false;
    dbHelpers
      .getRecurringExpenseTemplate(expense.recurringTemplateId)
      .then(template => {
        if (!cancelled) {
          setIsVariableAmount(Boolean(template?.isVariableAmount));
        }
      })
      .catch(() => {
        // Leave isVariableAmount at its default (false) - worst case,
        // Partial stays offered and resolveCycle's own server-side check
        // still rejects an illegal partial amount.
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, expense]);

  if (!isOpen || !expense) return null;

  const runResolution = async paidAmountValue => {
    setIsSubmitting(true);
    try {
      if (isRecurring) {
        await resolveCycle(expense.id, { paidAmount: paidAmountValue });
      } else {
        const status =
          paidAmountValue >= (expense.amount ?? 0) ? 'paid' : 'pending';
        await updateExpenseV4(
          expense.id,
          { paidAmount: paidAmountValue, status },
          false,
        );
      }
      onClose();
    } catch {
      // Both hooks already show their own error toast - keep the modal
      // open so the user can see it and retry rather than losing their
      // place.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayFull = () => runResolution(expense.amount ?? 0);
  const handleSkip = () => runResolution(0);

  const handlePartialSubmit = async e => {
    e.preventDefault();
    const value = parseFloat(paidAmount);
    const check = validatePaidAmount(value);
    if (!check.isValid) {
      notify.error(check.error);
      return;
    }
    const total = expense.amount ?? 0;
    await runResolution(value >= total ? total : value);
  };

  return (
    <div
      className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'
      role='dialog'
      aria-modal='true'
      aria-labelledby='resolve-expense-title'
    >
      <div className='glass-panel p-6 max-w-md mx-4'>
        <h3
          id='resolve-expense-title'
          className='text-lg font-semibold text-white mb-4'
        >
          {isRecurring ? 'Resolve this bill' : 'Mark as paid'}
        </h3>
        <p className='text-white/80 mb-1'>{expense.name}</p>
        <p className='text-sm text-white/60 mb-4'>
          Amount due: {formatCurrency(amountDue)}
        </p>

        {!showPartialInput ? (
          <>
            <div className='flex flex-col gap-3 mb-4'>
              <button
                type='button'
                onClick={handlePayFull}
                disabled={isSubmitting}
                className='px-4 py-2 glass-button glass-button--primary'
              >
                Pay full ({formatCurrency(amountDue)})
              </button>
              {!isVariableAmount && (
                <button
                  type='button'
                  onClick={() => setShowPartialInput(true)}
                  disabled={isSubmitting}
                  className='px-4 py-2 glass-button'
                >
                  Partial payment
                </button>
              )}
              {isRecurring && (
                <button
                  type='button'
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className='px-4 py-2 glass-button glass-button--sm text-white/70'
                >
                  Skip — the rest becomes a Balance Due
                </button>
              )}
            </div>
            {isVariableAmount && (
              <p className='text-xs text-white/50 mb-4'>
                Partial isn&apos;t offered here — this bill&apos;s amount can
                change, so there&apos;s no confirmed total yet to measure a
                shortfall against.
              </p>
            )}
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={onClose}
                disabled={isSubmitting}
                className='flex-1 px-4 py-2 glass-button'
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handlePartialSubmit}>
            <label
              htmlFor='resolve-expense-amount'
              className='block text-sm font-medium text-white/80 mb-2'
            >
              Amount to pay
            </label>
            <input
              id='resolve-expense-amount'
              type='number'
              inputMode='decimal'
              min='0'
              step='0.01'
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)}
              className='w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white mb-3'
            />
            {isRecurring && (
              <p className='text-xs text-white/50 mb-3'>
                The rest becomes a Balance Due, and next cycle starts right
                away.
              </p>
            )}
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() => setShowPartialInput(false)}
                disabled={isSubmitting}
                className='flex-1 px-4 py-2 glass-button'
              >
                Back
              </button>
              <button
                type='submit'
                disabled={isSubmitting}
                className='flex-1 px-4 py-2 glass-button glass-button--primary'
              >
                {isSubmitting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

ResolveExpenseModal.propTypes = {
  expense: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    amount: PropTypes.number,
    paidAmount: PropTypes.number,
    recurringTemplateId: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

ResolveExpenseModal.defaultProps = {
  expense: null,
};

export default ResolveExpenseModal;

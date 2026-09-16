import PropTypes from 'prop-types';
import { useState, useEffect, useMemo } from 'react';

import { dbHelpers } from '../db/database-clean';
import { useExpenseOperations } from '../hooks/useExpenseOperations';
import { useLoans } from '../stores/useAppStore';
import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { notify } from '../utils/notifications';
import { validatePaidAmount } from '../utils/validation';

// Mirrors resolveCycle's own epsilon (database-clean.js) - keeps "does
// this leave a shortfall" consistent between the UI's pre-check and the
// DB layer's own validation, so the shortfall-outcome screen only ever
// appears when resolveCycle would actually require an outcome.
const SHORTFALL_EPSILON = 0.004;

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
 * template's cadence via resolveCycle.
 *
 * Whenever Skip or a Partial payment leaves a shortfall, this modal never
 * assumes what that shortfall means — it asks. A "shortfallOutcome" step
 * offers "I'll pay this after my next paycheck" (deferred — resolveCycle
 * spins off a Balance Due due at the next paycheck) or "I don't owe this
 * anymore" (forgiven — no Balance Due at all), and choosing forgiven
 * immediately asks a second, explicit question — never silent, never
 * deferred to later — about also pausing the template.
 *
 * One-off expense (including a Balance Due, which is just a normal
 * one-off): Pay Full / Partial only, via the existing updateExpenseV4
 * path, unchanged. A Balance Due has nothing further to defer or forgive,
 * so it never sees the shortfall-outcome screens.
 */
const ResolveExpenseModal = ({ expense, isOpen, onClose }) => {
  const { updateExpenseV4, resolveCycle } = useExpenseOperations();
  const loans = useLoans();

  const amountDue = expense
    ? (expense.amount ?? 0) - (expense.paidAmount ?? 0)
    : 0;
  const isRecurring = Boolean(expense?.recurringTemplateId);

  // A tracked loan payment: real-interest-tracking is on for the target
  // loan (interestAccruedThrough set). Drives the live interest/principal
  // preview below - a read-only projection through the exact same
  // computeLoanInterest function the actual payment posts with, so the
  // preview and the posted split always agree.
  const trackedLoan = useMemo(() => {
    if (expense?.category !== 'Loan Payment' || !expense?.targetLoanId) {
      return null;
    }
    const loan = loans.find(l => l.id === expense.targetLoanId);
    return loan?.interestAccruedThrough ? loan : null;
  }, [loans, expense?.category, expense?.targetLoanId]);

  const previewSplit = paidAmountValue => {
    if (!trackedLoan || !(paidAmountValue > 0)) return null;
    try {
      return dbHelpers.computeLoanInterest(
        trackedLoan,
        DateUtils.today(),
        paidAmountValue,
      );
    } catch {
      // e.g. paidAmountValue exceeds payoff mid-typing - just show nothing
      // rather than an error while the user is still entering a number.
      return null;
    }
  };

  const [paidAmount, setPaidAmount] = useState(
    amountDue > 0 ? String(amountDue) : '0',
  );

  // 'choose' -> Pay Full / Partial / Skip (today's screen)
  // 'partialInput' -> the amount-to-pay form
  // 'shortfallOutcome' -> deferred vs forgiven, only reached when the
  //   chosen amount leaves a real shortfall on a recurring expense
  // 'forgivenFollowup' -> the explicit "also pause the template?" question
  const [step, setStep] = useState('choose');
  const [pendingPaidAmount, setPendingPaidAmount] = useState(0);
  const [isVariableAmount, setIsVariableAmount] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !expense) return undefined;

    const due = (expense.amount ?? 0) - (expense.paidAmount ?? 0);
    setPaidAmount(due > 0 ? String(due) : '0');
    setStep('choose');
    setPendingPaidAmount(0);
    setIsVariableAmount(false);
    setTemplateName('');

    if (!expense.recurringTemplateId) return undefined;

    let cancelled = false;
    dbHelpers
      .getRecurringExpenseTemplate(expense.recurringTemplateId)
      .then(template => {
        if (!cancelled) {
          setIsVariableAmount(Boolean(template?.isVariableAmount));
          setTemplateName(template?.name || expense.name);
        }
      })
      .catch(() => {
        // Leave isVariableAmount/templateName at their defaults - worst
        // case, Partial stays offered and resolveCycle's own server-side
        // check still rejects an illegal partial amount.
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, expense]);

  if (!isOpen || !expense) return null;

  const hasShortfall = value =>
    (expense.amount ?? 0) - value > SHORTFALL_EPSILON;

  const runResolution = async (paidAmountValue, outcomeOptions = {}) => {
    setIsSubmitting(true);
    try {
      // Computed from the loan state as it is right now, immediately
      // before posting - identical inputs to what the payment-posting
      // path itself will use, so this is exactly what's about to happen,
      // not a guess.
      const split = previewSplit(paidAmountValue);

      if (isRecurring) {
        await resolveCycle(expense.id, {
          paidAmount: paidAmountValue,
          ...outcomeOptions,
        });
      } else {
        const status =
          paidAmountValue >= (expense.amount ?? 0) ? 'paid' : 'pending';
        await updateExpenseV4(
          expense.id,
          { paidAmount: paidAmountValue, status },
          false,
        );
      }
      if (split && split.principalPaid === 0) {
        notify.info('This payment did not reduce principal');
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

  const handleSkip = () => {
    if (hasShortfall(0)) {
      setPendingPaidAmount(0);
      setStep('shortfallOutcome');
    } else {
      // A zero-amount bill has nothing to defer or forgive.
      runResolution(0);
    }
  };

  const handlePartialSubmit = e => {
    e.preventDefault();
    const value = parseFloat(paidAmount);
    const check = validatePaidAmount(value);
    if (!check.isValid) {
      notify.error(check.error);
      return;
    }
    const total = expense.amount ?? 0;
    const capped = value >= total ? total : value;
    if (isRecurring && hasShortfall(capped)) {
      setPendingPaidAmount(capped);
      setStep('shortfallOutcome');
    } else {
      runResolution(capped);
    }
  };

  const handleDefer = () =>
    runResolution(pendingPaidAmount, { shortfallOutcome: 'deferred' });

  const handleChooseForgive = () => setStep('forgivenFollowup');

  const handleForgive = pauseTemplateOnForgive =>
    runResolution(pendingPaidAmount, {
      shortfallOutcome: 'forgiven',
      pauseTemplateOnForgive,
    });

  const shortfallAmount = (expense.amount ?? 0) - pendingPaidAmount;

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

        {step === 'choose' && (
          <>
            {trackedLoan &&
              (() => {
                const split = previewSplit(amountDue);
                if (!split) return null;
                return (
                  <p className='text-xs text-white/50 mb-3'>
                    Interest {formatCurrency(split.interestPaid)} · Principal{' '}
                    {formatCurrency(split.principalPaid)} · Remaining principal{' '}
                    {formatCurrency(split.principalAfter)}
                  </p>
                );
              })()}
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
                  onClick={() => setStep('partialInput')}
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
                  Skip
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
        )}

        {step === 'partialInput' && (
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
            {trackedLoan &&
              (() => {
                const split = previewSplit(parseFloat(paidAmount));
                if (!split) return null;
                return (
                  <p className='text-xs text-white/50 mb-3'>
                    Interest {formatCurrency(split.interestPaid)} · Principal{' '}
                    {formatCurrency(split.principalPaid)} · Remaining principal{' '}
                    {formatCurrency(split.principalAfter)}
                  </p>
                );
              })()}
            {isRecurring && (
              <p className='text-xs text-white/50 mb-3'>
                If anything&apos;s left over, you&apos;ll be asked how to handle
                it.
              </p>
            )}
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() => setStep('choose')}
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

        {step === 'shortfallOutcome' && (
          <>
            <p className='text-white/80 mb-4'>
              How do you want to handle the remaining{' '}
              {formatCurrency(shortfallAmount)}?
            </p>
            <div className='flex flex-col gap-3 mb-4'>
              <button
                type='button'
                onClick={handleDefer}
                disabled={isSubmitting}
                className='px-4 py-2 glass-button glass-button--primary text-left'
              >
                I&apos;ll pay this after my next paycheck
              </button>
              <button
                type='button'
                onClick={handleChooseForgive}
                disabled={isSubmitting}
                className='px-4 py-2 glass-button text-left'
              >
                I don&apos;t owe this anymore
              </button>
            </div>
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() => setStep('choose')}
                disabled={isSubmitting}
                className='flex-1 px-4 py-2 glass-button'
              >
                Back
              </button>
            </div>
          </>
        )}

        {step === 'forgivenFollowup' && (
          <>
            <p className='text-white/80 mb-4'>
              Also stop future bills from {templateName || expense.name}?
            </p>
            <div className='flex flex-col gap-3 mb-4'>
              <button
                type='button'
                onClick={() => handleForgive(true)}
                disabled={isSubmitting}
                className='px-4 py-2 glass-button glass-button--primary'
              >
                Yes, pause it
              </button>
              <button
                type='button'
                onClick={() => handleForgive(false)}
                disabled={isSubmitting}
                className='px-4 py-2 glass-button'
              >
                No, keep it active
              </button>
            </div>
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() => setStep('shortfallOutcome')}
                disabled={isSubmitting}
                className='flex-1 px-4 py-2 glass-button'
              >
                Back
              </button>
            </div>
          </>
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
    category: PropTypes.string,
    targetLoanId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
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

import { Lock, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useMemo, useRef, useState } from 'react';

import { createPaymentSource } from '../types/paymentSource';
import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { getExpenseEditPolicy } from '../utils/expenseEditPolicy';
import { moneyInputErrorMessage, parseMoneyInput } from '../utils/validation';

import DatePicker from './DatePicker';
import PaymentSourceSelector from './PaymentSourceSelector';

const toCents = value => Math.round(Number(value) * 100);

const Field = ({ id, label, hint, locked, error, children }) => (
  <div className='mb-4'>
    <label
      htmlFor={id}
      className='block text-sm font-medium text-ink-soft mb-1'
    >
      {label}
    </label>
    {children}
    <Note id={`${id}-note`} hint={hint} locked={locked} error={error} />
  </div>
);

const Note = ({ id, hint, locked, error }) => {
  if (error) {
    return (
      <p id={id} role='alert' className='text-xs mt-1 text-red-400'>
        {error}
      </p>
    );
  }
  if (!hint) return null;
  return (
    <p id={id} className='text-xs mt-1 text-ink-faint flex items-start gap-1'>
      {locked && (
        <Lock size={12} className='mt-0.5 flex-shrink-0' aria-hidden='true' />
      )}
      <span>{hint}</span>
    </p>
  );
};

Field.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  locked: PropTypes.bool,
  error: PropTypes.string,
  children: PropTypes.node.isRequired,
};

Note.propTypes = {
  id: PropTypes.string.isRequired,
  hint: PropTypes.string,
  locked: PropTypes.bool,
  error: PropTypes.string,
};

/**
 * Edit one bill. Presentational on purpose: the page owns the writes
 * (`onSave` / `onDelete`), so this component never touches the database and
 * can be tested with plain callbacks.
 *
 * What can be edited comes entirely from `getExpenseEditPolicy`; this file
 * only renders it. Two rules worth knowing before changing anything here:
 *
 * - The amount input is seeded from `expense.amount`, the bill's total. The
 *   priority row shows `amount - paidAmount`; seeding from that would save the
 *   remaining balance back as the total.
 * - `onSave` receives only the keys the user actually changed. The write path
 *   sanitizes the merged record, so sending untouched fields would only give
 *   its rules more chances to fire against values the user never meant to
 *   touch.
 */
const EditExpenseModal = ({
  expense,
  isOpen,
  isBalanceDue,
  initialStep,
  accounts,
  creditCards,
  onClose,
  onSave,
  onDelete,
  onSkipOrStop,
}) => {
  const policy = useMemo(
    () => (expense ? getExpenseEditPolicy(expense, { isBalanceDue }) : null),
    [expense, isBalanceDue],
  );

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [source, setSource] = useState(null);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState('edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef(null);

  // Re-seed only when a different bill opens. A store refresh while the modal
  // is open hands us a new `expense` object for the same bill, and re-seeding
  // on that would wipe what the user has typed.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!isOpen || !expense) return;
    setName(expense.name ?? '');
    setAmountText(String(expense.amount ?? ''));
    setDueDate(expense.dueDate ?? '');
    setSource(createPaymentSource.fromExpense(expense));
    setErrors({});
    setStep(initialStep);
    setIsSubmitting(false);
    nameRef.current?.focus();
  }, [isOpen, expense?.id]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !expense || !policy) return null;

  const { fields, removal } = policy;
  const paid = Number(expense.paidAmount || 0);

  const handleSave = async event => {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors = {};
    const updates = {};

    const trimmedName = name.trim();
    if (!trimmedName) nextErrors.name = 'Enter a name';
    else if (trimmedName !== expense.name) updates.name = trimmedName;

    if (!fields.amount.locked) {
      const parsed = parseMoneyInput(amountText);
      if (!parsed.ok) {
        nextErrors.amount = moneyInputErrorMessage(parsed.reason);
      } else if (toCents(parsed.value) !== toCents(expense.amount)) {
        // The floor only applies to a changed amount, so a legacy row already
        // at or below its paid amount can still be renamed.
        if (parsed.value <= fields.amount.mustExceed) {
          nextErrors.amount =
            fields.amount.mustExceed > 0
              ? `Enter more than the ${formatCurrency(fields.amount.mustExceed)} already paid`
              : 'Enter an amount above $0.00';
        } else {
          updates.amount = toCents(parsed.value) / 100;
        }
      }
    }

    if (!fields.dueDate.locked) {
      if (!DateUtils.isValidDate(dueDate))
        nextErrors.dueDate = 'Choose a due date';
      else if (dueDate !== expense.dueDate) updates.dueDate = dueDate;
    }

    if (!fields.paymentSource.locked) {
      const accountId = source?.accountId || null;
      const creditCardId = source?.creditCardId || null;
      if (!accountId && !creditCardId) {
        nextErrors.paymentSource = 'Choose a payment source';
      } else if (
        accountId !== (expense.accountId || null) ||
        creditCardId !== (expense.creditCardId || null)
      ) {
        updates.accountId = accountId;
        updates.creditCardId = creditCardId;
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(expense.id, updates);
      onClose();
    } catch {
      // The write path already raised its own error toast; stay open so the
      // user's edits aren't lost.
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onDelete(expense.id);
      onClose();
    } catch {
      setIsSubmitting(false);
    }
  };

  const renderRemoval = () => {
    if (removal.action === 'delete') {
      return (
        <button
          type='button'
          onClick={() => setStep('confirmDelete')}
          className='text-sm text-ink-soft hover:text-ink hover:underline underline-offset-2'
        >
          Delete bill
        </button>
      );
    }
    if (removal.action === 'skipOrStop') {
      return (
        <button
          type='button'
          onClick={() => onSkipOrStop(expense)}
          className='text-sm text-ink-soft hover:text-ink hover:underline underline-offset-2'
        >
          Skip or stop this bill
        </button>
      );
    }
    return (
      <p className='text-xs text-ink-faint sm:max-w-[14rem]'>
        {removal.reason}
      </p>
    );
  };

  return (
    <div
      className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'
      role='dialog'
      aria-modal='true'
      aria-labelledby='edit-expense-title'
    >
      <div className='glass-panel p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto'>
        <div className='flex items-start justify-between mb-4'>
          <div>
            <h3
              id='edit-expense-title'
              className='text-lg font-semibold text-ink'
            >
              {step === 'confirmDelete' ? 'Delete this bill?' : 'Edit bill'}
            </h3>
            <p className='text-xs text-ink-faint mt-0.5'>{policy.kindLabel}</p>
          </div>
          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            aria-label='Close'
            className='text-ink-faint hover:text-ink'
          >
            <X size={18} aria-hidden='true' />
          </button>
        </div>

        {step === 'confirmDelete' ? (
          <>
            <p className='text-ink mb-1'>{expense.name}</p>
            <p className='text-sm text-ink-soft mb-5'>
              {isBalanceDue
                ? 'You’ll no longer owe this balance. Your payment history will still show it as deferred.'
                : 'This can’t be undone.'}
            </p>
            <div className='flex justify-end gap-3'>
              <button
                type='button'
                onClick={() =>
                  initialStep === 'confirmDelete' ? onClose() : setStep('edit')
                }
                disabled={isSubmitting}
                className='text-sm text-ink-soft hover:text-ink px-3'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleDelete}
                disabled={isSubmitting}
                className='px-4 py-2 glass-button'
              >
                Delete bill
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSave} noValidate>
            <Field id='edit-expense-name' label='Name' error={errors.name}>
              <input
                id='edit-expense-name'
                ref={nameRef}
                type='text'
                value={name}
                onChange={event => setName(event.target.value)}
                aria-describedby='edit-expense-name-note'
                className='glass-input w-full'
              />
            </Field>

            <Field
              id='edit-expense-amount'
              label='Amount'
              error={errors.amount}
              locked={fields.amount.locked}
              hint={
                fields.amount.reason ||
                (paid > 0
                  ? `Paid so far ${formatCurrency(paid)}. The total must stay above that.`
                  : null)
              }
            >
              <input
                id='edit-expense-amount'
                type='text'
                inputMode='decimal'
                value={amountText}
                disabled={fields.amount.locked}
                onChange={event => setAmountText(event.target.value)}
                aria-describedby='edit-expense-amount-note'
                className='glass-input w-full'
              />
            </Field>

            <Field
              id='edit-expense-due-date'
              label='Due date'
              error={errors.dueDate}
              locked={fields.dueDate.locked}
              hint={fields.dueDate.reason}
            >
              <DatePicker
                id='edit-expense-due-date'
                value={dueDate}
                onChange={setDueDate}
                disabled={fields.dueDate.locked}
              />
            </Field>

            <div className='mb-4'>
              <PaymentSourceSelector
                value={source}
                onChange={setSource}
                accounts={accounts}
                creditCards={creditCards}
                label='Payment source'
                error={errors.paymentSource}
                disabled={fields.paymentSource.locked}
              />
              {!errors.paymentSource && (
                <Note
                  id='edit-expense-source-note'
                  hint={fields.paymentSource.reason}
                  locked={fields.paymentSource.locked}
                />
              )}
            </div>

            <div className='flex flex-wrap items-center justify-between gap-3 mt-2'>
              <div className='w-full sm:w-auto'>{renderRemoval()}</div>
              <div className='flex items-center gap-3 ml-auto'>
                <button
                  type='button'
                  onClick={onClose}
                  disabled={isSubmitting}
                  className='text-sm text-ink-soft hover:text-ink px-3'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isSubmitting}
                  className='px-4 py-2 glass-button glass-button--primary whitespace-nowrap'
                >
                  Save changes
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

EditExpenseModal.propTypes = {
  expense: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    amount: PropTypes.number,
    paidAmount: PropTypes.number,
    dueDate: PropTypes.string,
    accountId: PropTypes.string,
    creditCardId: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  isBalanceDue: PropTypes.bool,
  initialStep: PropTypes.oneOf(['edit', 'confirmDelete']),
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  creditCards: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSkipOrStop: PropTypes.func.isRequired,
};

EditExpenseModal.defaultProps = {
  expense: null,
  isBalanceDue: false,
  initialStep: 'edit',
};

export default EditExpenseModal;

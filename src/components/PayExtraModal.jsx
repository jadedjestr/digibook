import { CreditCard, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { dbHelpers } from '../db/database-clean';
import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications.jsx';
import { moneyInputErrorMessage, parseMoneyInput } from '../utils/validation';

const shortDate = date =>
  DateUtils.parseDate(date)?.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }) ?? date;

/**
 * Record an extra payment on a card, or edit one that hasn't cleared.
 *
 * Only the amount must be typed: the account defaults to the one last used
 * for this card (else the card's funding account, else the first), "already
 * cleared" to the card's paymentsPostInstantly setting, and the date to
 * today. Before saving it says what will happen, in the same terms the rules
 * use (dbHelpers.previewCardPayment), so the user sees the bill shrink before
 * committing to it.
 */
const PayExtraModal = ({
  isOpen,
  card,
  accounts,
  defaultAccountId = null,
  payment = null,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(payment);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cleared, setCleared] = useState(false);
  const [paymentDate, setPaymentDate] = useState(DateUtils.today());
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const amountRef = useRef(null);

  // Fresh defaults each time the form opens.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setError('');
    setIsSaving(false);
    if (payment) {
      setAmount(String(payment.amount));
      setAccountId(payment.accountId);
      setCleared(false);
      setPaymentDate(payment.date);
    } else {
      setAmount('');
      setCleared(card.paymentsPostInstantly === true);
      setPaymentDate(DateUtils.today());
      setAccountId(defaultAccountId ?? accounts[0]?.id ?? '');
      dbHelpers
        .getCardPayments(card.id)
        .then(previous => {
          const last = [...previous].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          )[0];
          if (!cancelled && last && accounts.some(a => a.id === last.accountId))
            setAccountId(last.accountId);
        })
        .catch(() => {});
    }
    setTimeout(() => amountRef.current?.focus(), 0);
    return () => {
      cancelled = true;
    };
  }, [isOpen, payment, card, accounts, defaultAccountId]);

  useEffect(() => {
    if (!isOpen || !DateUtils.isValidDate(paymentDate)) return undefined;
    let cancelled = false;
    dbHelpers
      .previewCardPayment(card.id, paymentDate)
      .then(result => {
        if (!cancelled) setPreview(result);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, card.id, paymentDate]);

  if (!isOpen) return null;

  const parsed = parseMoneyInput(amount);
  const value = parsed.ok ? parsed.value : 0;

  // While editing, this payment's own amount is already counted as "on its
  // way" and already taken off the bill; add it back for the preview.
  const ownOnTheirWay = isEdit ? payment.amount : 0;
  const ownOnBill =
    isEdit && payment.date.slice(0, 7) === paymentDate.slice(0, 7)
      ? (payment.appliedCents || 0) / 100
      : 0;
  const owes = preview
    ? preview.balance - (preview.onTheirWay - ownOnTheirWay)
    : null;
  const billOwed = preview?.bill ? preview.bill.owed + ownOnBill : null;

  let effect = null;
  if (preview && value > 0) {
    const newBalance = preview.balance - value;
    const when = cleared ? 'now' : 'when it clears';
    let billLine =
      ' The card bill is already paid this month, so only the balance drops.';
    if (billOwed !== null) {
      const left = Math.max(0, billOwed - value);
      billLine =
        left === 0
          ? ` The ${shortDate(preview.bill.dueDate)} bill of ${formatCurrency(billOwed)} is covered.`
          : ` The ${shortDate(preview.bill.dueDate)} bill drops from ${formatCurrency(billOwed)} to ${formatCurrency(left)}.`;
    }
    effect = `${card.name}'s balance goes from ${formatCurrency(preview.balance)} to ${formatCurrency(newBalance)} ${when}.${billLine}`;
  }

  const handleSubmit = async event => {
    event.preventDefault();
    if (!parsed.ok) {
      setError(moneyInputErrorMessage(parsed.reason));
      return;
    }
    if (parsed.value <= 0) {
      setError('Enter an amount greater than $0');
      return;
    }
    if (owes !== null && parsed.value > owes + 0.0001) {
      setError(
        `That's more than ${card.name} owes (${formatCurrency(Math.max(owes, 0))})`,
      );
      return;
    }
    if (!DateUtils.isValidDate(paymentDate)) {
      setError('Enter a valid date');
      return;
    }
    setIsSaving(true);
    try {
      if (isEdit) {
        await dbHelpers.updateCardPayment(payment.id, {
          amount: parsed.value,
          accountId,
          paymentDate,
        });
        notify.success('Payment updated');
      } else {
        await dbHelpers.recordCardPayment({
          creditCardId: card.id,
          accountId,
          amount: parsed.value,
          paymentDate,
          cleared,
        });
        notify.success(
          cleared ? 'Payment recorded' : 'Payment recorded as on its way',
        );
      }
      onSaved();
    } catch (saveError) {
      logger.error('Saving card payment failed', saveError);
      setError(saveError.message || 'Could not save the payment');
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4'>
      <div
        className='absolute inset-0 bg-black/70'
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
        }}
        role='button'
        tabIndex={-1}
        aria-label='Close'
      />
      <form
        onSubmit={handleSubmit}
        className='relative w-full max-w-md mx-auto glass-panel glass-surface glass-surface--elevated space-y-4'
        aria-labelledby='pay-extra-title'
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <CreditCard size={20} className='text-secondary' />
            <h3 id='pay-extra-title' className='text-lg font-semibold'>
              {isEdit ? 'Edit payment' : `Pay extra on ${card.name}`}
            </h3>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='p-1 text-secondary'
            aria-label='Close'
          >
            <X size={20} />
          </button>
        </div>

        <div>
          <label htmlFor='pay-extra-amount' className='block text-sm mb-1'>
            Amount
          </label>
          <input
            id='pay-extra-amount'
            ref={amountRef}
            inputMode='decimal'
            className='glass-input w-full'
            placeholder='400.00'
            value={amount}
            onChange={e => {
              setAmount(e.target.value);
              setError('');
            }}
          />
          {owes !== null && (
            <p className='text-xs text-secondary mt-1'>
              {card.name} owes {formatCurrency(Math.max(owes, 0))}
              {preview.onTheirWay - ownOnTheirWay > 0 &&
                ' after payments on their way'}
            </p>
          )}
        </div>

        <div>
          <label htmlFor='pay-extra-account' className='block text-sm mb-1'>
            From
          </label>
          <select
            id='pay-extra-account'
            className='glass-input w-full'
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
          >
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name} ({formatCurrency(account.currentBalance ?? 0)})
              </option>
            ))}
          </select>
        </div>

        {!isEdit && (
          <div>
            <span className='block text-sm mb-1'>Has the money moved?</span>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={() => setCleared(true)}
                className={`glass-button glass-button--filter text-sm ${cleared ? 'active' : ''}`}
                aria-pressed={cleared}
              >
                Already cleared
              </button>
              <button
                type='button'
                onClick={() => setCleared(false)}
                className={`glass-button glass-button--filter text-sm ${cleared ? '' : 'active'}`}
                aria-pressed={!cleared}
              >
                Sent, still clearing
              </button>
            </div>
          </div>
        )}

        <div>
          <label htmlFor='pay-extra-date' className='block text-sm mb-1'>
            Date
          </label>
          <input
            id='pay-extra-date'
            type='date'
            className='glass-input w-full'
            value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
          />
        </div>

        {effect && (
          <p className='text-sm text-secondary' data-testid='pay-extra-effect'>
            {effect}
          </p>
        )}
        {error && (
          <p className='text-sm text-red-300' role='alert'>
            {error}
          </p>
        )}

        <div className='flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='glass-button glass-button--secondary'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={isSaving}
            className='glass-button glass-button--primary'
          >
            {isEdit ? 'Save' : 'Record payment'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};

PayExtraModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  card: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    paymentsPostInstantly: PropTypes.bool,
  }).isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  defaultAccountId: PropTypes.string,
  payment: PropTypes.shape({
    id: PropTypes.string.isRequired,
    amount: PropTypes.number.isRequired,
    accountId: PropTypes.string,
    date: PropTypes.string,
    appliedCents: PropTypes.number,
  }),
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default PayExtraModal;

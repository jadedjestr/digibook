import PropTypes from 'prop-types';
import { useState } from 'react';

import { dbHelpers } from '../db/database-clean';
import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { notify, showConfirmation } from '../utils/notifications.jsx';

import PrivacyWrapper from './PrivacyWrapper';

const COLLAPSED_COUNT = 4;

const shortDate = date =>
  DateUtils.parseDate(date)?.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }) ?? date;

const STATUS_LABEL = {
  sent: 'On its way',
  cleared: 'Cleared',
  paid: 'Paid',
  partial: 'Partly paid',
  skipped: 'Skipped',
  covered: 'Covered by extra payments',
};

/**
 * Everything paid toward one card, newest first: extra payments and the
 * monthly bill (dbHelpers.getCardPaymentHistory). Extra payments carry their
 * own actions - Cleared / Edit / Delete while on their way, Undo once
 * cleared - each confirmed first, since each moves money or a bill.
 */
const CardPaymentHistory = ({ history, accounts, onEdit, onChanged }) => {
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState(null);

  if (history.length === 0) return null;

  const accountName = id =>
    accounts.find(account => account.id === id)?.name ?? 'an account';
  const visible = showAll ? history : history.slice(0, COLLAPSED_COUNT);

  const act = async (entry, confirmText, action, doneText) => {
    if (!(await showConfirmation(confirmText))) return;
    setBusyId(entry.id);
    try {
      await action();
      notify.success(doneText);
      onChanged();
    } catch (error) {
      logger.error('Card payment action failed', error);
      notify.error(error.message || 'That did not work');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className='card-payment-history'>
      <div className='credit-info-label'>Payments</div>
      <ul className='card-payment-list'>
        {visible.map(entry => {
          const busy = busyId === entry.id;
          const money = (
            <PrivacyWrapper>{formatCurrency(entry.amount)}</PrivacyWrapper>
          );
          return (
            <li key={`${entry.kind}-${entry.id}`} className='card-payment-row'>
              <div className='card-payment-main'>
                <span className='card-payment-date'>
                  {shortDate(entry.date)}
                </span>
                <span>
                  {entry.kind === 'extra' ? 'Extra' : 'Monthly bill'}
                  {/* A covered or skipped bill moved no money; "$0.00"
                      would read as an error. */}
                  {entry.amount > 0 && (
                    <>
                      {' · '}
                      {money}
                      {entry.accountId
                        ? ` from ${accountName(entry.accountId)}`
                        : ''}
                    </>
                  )}
                </span>
                <span className='card-payment-status'>
                  {STATUS_LABEL[entry.status] ?? entry.status}
                </span>
              </div>
              {entry.kind === 'extra' && (
                <div className='card-payment-actions'>
                  {entry.status === 'sent' && (
                    <>
                      <button
                        type='button'
                        disabled={busy}
                        className='glass-button glass-button--secondary glass-button--sm'
                        onClick={() =>
                          act(
                            entry,
                            `Mark this ${formatCurrency(entry.amount)} payment as cleared? The card and account balances will both change.`,
                            () => dbHelpers.clearCardPayment(entry.id),
                            'Payment cleared',
                          )
                        }
                      >
                        Cleared
                      </button>
                      <button
                        type='button'
                        disabled={busy}
                        className='glass-button glass-button--secondary glass-button--sm'
                        onClick={() => onEdit(entry)}
                      >
                        Edit
                      </button>
                      <button
                        type='button'
                        disabled={busy}
                        className='glass-button glass-button--secondary glass-button--sm'
                        onClick={() =>
                          act(
                            entry,
                            `Delete this ${formatCurrency(entry.amount)} payment? The card bill gets its amount back.`,
                            () => dbHelpers.deleteCardPayment(entry.id),
                            'Payment deleted',
                          )
                        }
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {entry.status === 'cleared' && (
                    <button
                      type='button'
                      disabled={busy}
                      className='glass-button glass-button--secondary glass-button--sm'
                      onClick={() =>
                        act(
                          entry,
                          `Undo this ${formatCurrency(entry.amount)} payment? Both balances and the card bill go back to how they were.`,
                          () => dbHelpers.undoCardPayment(entry.id),
                          'Payment undone',
                        )
                      }
                    >
                      Undo
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {history.length > COLLAPSED_COUNT && (
        <button
          type='button'
          className='glass-button glass-button--secondary glass-button--sm'
          onClick={() => setShowAll(value => !value)}
        >
          {showAll ? 'Show fewer' : `Show all ${history.length}`}
        </button>
      )}
    </div>
  );
};

CardPaymentHistory.propTypes = {
  history: PropTypes.arrayOf(
    PropTypes.shape({
      kind: PropTypes.oneOf(['extra', 'bill']).isRequired,
      id: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired,
      amount: PropTypes.number.isRequired,
      accountId: PropTypes.string,
      status: PropTypes.string.isRequired,
    }),
  ).isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  onEdit: PropTypes.func.isRequired,
  onChanged: PropTypes.func.isRequired,
};

export default CardPaymentHistory;

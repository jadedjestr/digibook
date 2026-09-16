import { Edit, Trash2, AlertTriangle } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useRef } from 'react';

import { dbHelpers } from '../db/database-clean';
import { DateUtils } from '../utils/dateUtils';
import { generateId } from '../utils/generateId';
import { formatLoanBalance, getLoanPayoffProgress } from '../utils/loanUtils';
import { notify } from '../utils/notifications';
import { parseMoneyInput } from '../utils/validation';

import PrivacyWrapper from './PrivacyWrapper';
import StatusBadge from './StatusBadge';

const EnhancedLoanCard = ({
  loan,
  fundingSourceName = null,
  onChangeFundingSource,
  onEdit,
  onDelete,
  onInterestOperationComplete,
  index = 0,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionAmount, setCorrectionAmount] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [shortfallOutcome, setShortfallOutcome] = useState('');
  const correctionRequest = useRef(null);
  const [correctionTarget, setCorrectionTarget] = useState(null);

  const balanceInfo = formatLoanBalance(loan.balance);
  const progress = getLoanPayoffProgress(loan);
  const monthlyInterest =
    (Math.max(loan.balance, 0) * (loan.interestRate / 100)) / 12;
  const daysUntilDue = loan.daysUntilDue || 0;

  const isTracked = Boolean(loan.interestAccruedThrough);
  const interestToday = useMemo(() => {
    if (!isTracked) return null;
    return dbHelpers.computeLoanInterest(loan, DateUtils.today());
  }, [isTracked, loan]);
  const undoableOperation =
    isTracked &&
    loan.lastInterestOperation?.version === 2 &&
    loan.lastInterestOperation?.status === 'active'
      ? loan.lastInterestOperation
      : null;

  const handleUndo = async () => {
    if (!undoableOperation) return;
    setIsBusy(true);
    try {
      await dbHelpers.undoLastLoanInterestOperation(
        loan.id,
        undoableOperation.operationId,
        { expectedVersion: loan.interestStateVersion },
      );
      notify.success('Payment undone');
      onInterestOperationComplete?.();
    } catch (error) {
      notify.error(error.message || 'Failed to undo payment');
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartCorrect = () => {
    const cashAmount = undoableOperation?.cashAmount;
    setCorrectionAmount(
      Number.isFinite(cashAmount) ? cashAmount.toFixed(2) : '',
    );
    correctionRequest.current = null;
    setCorrectionTarget({
      receipt: undoableOperation,
      version: loan.interestStateVersion,
    });
    setShortfallOutcome('');
    setIsCorrecting(true);
  };

  const handleSubmitCorrection = async e => {
    e.preventDefault();
    if (!correctionTarget) return;
    const target = correctionTarget.receipt;
    const parsed = parseMoneyInput(correctionAmount);
    const value = parsed.value;
    if (!parsed.ok || value < 0) {
      notify.error('Enter a valid amount');
      return;
    }
    const signature = JSON.stringify([
      value,
      shortfallOutcome,
      target.operationId,
    ]);
    if (correctionRequest.current?.signature !== signature)
      correctionRequest.current = { signature, id: generateId() };
    setIsBusy(true);
    try {
      await dbHelpers.correctLatestLoanPayment(
        loan.id,
        target.affectedExpenseId,
        value,
        {
          operationId: target.operationId,
          expectedVersion: correctionTarget.version,
          requestId: correctionRequest.current.id,
          shortfallOutcome: shortfallOutcome || null,
        },
      );
      notify.success('Payment corrected');
      setIsCorrecting(false);
      onInterestOperationComplete?.();
    } catch (error) {
      notify.error(error.message || 'Failed to correct payment');
    } finally {
      setIsBusy(false);
    }
  };

  // The payment required to hit the target payoff date, computed live for
  // display the same way the materialization path computes it - this
  // card never stores its own copy of the amount.
  const paymentResult = dbHelpers.calculateRequiredLoanPayment(
    loan.balance,
    loan.interestRate,
    loan.dueDate,
    loan.targetPayoffDate,
  );

  useEffect(() => {
    const baseDelay = index * 100;
    const visibilityTimer = setTimeout(() => setIsVisible(true), baseDelay);
    const barTimer = setTimeout(
      () => setProgressWidth(progress.percent),
      baseDelay + 500,
    );

    return () => {
      clearTimeout(visibilityTimer);
      clearTimeout(barTimer);
    };
  }, [index, progress.percent]);

  const getDueDateStatus = days => {
    if (days <= 7) return 'Due Soon';
    if (days <= 14) return 'Payment Due';
    return null;
  };

  const formatCurrency = amount => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = value => `${value.toFixed(1)}%`;
  const formatInterestRate = value => `${value.toFixed(2)}%`;

  const formatDate = dateString => {
    if (!dateString) return 'N/A';

    // Parse as local date to avoid timezone shifts
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCountdownText = days => {
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today!';
    if (days === 1) return 'Due tomorrow';
    return `${days} days until due`;
  };

  const isPaymentUrgent = daysUntilDue <= 7 && daysUntilDue >= 0;
  const badgeStatus = balanceInfo.isPaidOff
    ? 'Paid Off'
    : getDueDateStatus(daysUntilDue);

  return (
    <div
      className={`loan-card ${className} ${
        isVisible ? 'slide-in-up' : 'opacity-0'
      }`}
    >
      {/* Header Section */}
      <div className='loan-card-header'>
        <div>
          <h3 className='loan-card-title'>{loan.name}</h3>
          {loan.lender && (
            <p className='text-sm text-white/50'>{loan.lender}</p>
          )}
          <div className='loan-card-balance'>
            <PrivacyWrapper>
              <span className={`font-bold ${balanceInfo.className}`}>
                {balanceInfo.formattedAmount}
              </span>
            </PrivacyWrapper>
            <span className='text-sm opacity-75 ml-2'>
              {balanceInfo.isPaidOff ? '' : 'Remaining'}
            </span>
          </div>
        </div>

        <div className='loan-card-actions'>
          <div className='loan-card-badges'>
            {badgeStatus && <StatusBadge status={badgeStatus} variant='loan' />}
          </div>

          <div className='flex gap-2'>
            <button
              onClick={() => onEdit(loan)}
              className='loan-card-action-btn edit'
              aria-label={`Edit ${loan.name}`}
            >
              <Edit size={12} />
            </button>
            <button
              onClick={() => onDelete(loan)}
              className='loan-card-action-btn delete'
              aria-label={`Delete ${loan.name}`}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Financial Overview Grid */}
      <div className='loan-info-grid'>
        <div className='loan-info-item'>
          <div className='loan-info-label'>Original Principal</div>
          <div className='loan-info-value'>
            <PrivacyWrapper>
              {loan.principalAmount
                ? formatCurrency(loan.principalAmount)
                : 'N/A'}
            </PrivacyWrapper>
          </div>
        </div>
        <div className='loan-info-item'>
          <div className='loan-info-label'>Interest Rate</div>
          <div className='loan-info-value'>
            <PrivacyWrapper>
              {formatInterestRate(loan.interestRate)}
            </PrivacyWrapper>
          </div>
        </div>
        <div className='loan-info-item'>
          <div className='loan-info-label'>Monthly Interest</div>
          <div className='loan-info-value'>
            <PrivacyWrapper>{formatCurrency(monthlyInterest)}</PrivacyWrapper>
          </div>
        </div>
        <div className='loan-info-item'>
          <div className='loan-info-label'>Calculated Payment</div>
          <div className='loan-info-value'>
            <PrivacyWrapper>
              {paymentResult.success
                ? formatCurrency(paymentResult.payment)
                : '—'}
            </PrivacyWrapper>
          </div>
        </div>
      </div>

      {/* Payoff Progress Section - always "success": more progress is
          never a bad thing, unlike credit-card utilization. */}
      <div className='utilization-section'>
        <div className='utilization-header'>
          <span className='utilization-label'>Principal Paid Off</span>
          <span className='utilization-percentage success'>
            <PrivacyWrapper>
              {formatPercentage(progress.percent)}
            </PrivacyWrapper>
          </span>
        </div>
        <div className='utilization-bar'>
          <div
            className='utilization-fill success'
            style={{
              transform: `scaleX(${progressWidth / 100})`,
              transformOrigin: 'left',
            }}
            aria-label={`Principal paid off: ${formatPercentage(progress.percent)}`}
          />
        </div>
      </div>

      {/* Payment Section */}
      <div className='payment-section'>
        <div className={`payment-item ${isPaymentUrgent ? 'urgent' : ''}`}>
          <div className='loan-info-label'>Due Date</div>
          <div className='payment-date'>{formatDate(loan.dueDate)}</div>
          <div
            className={`payment-countdown ${isPaymentUrgent ? 'urgent' : ''}`}
          >
            {getCountdownText(daysUntilDue)}
          </div>
        </div>
        <div className='payment-item'>
          <div className='loan-info-label'>Calculated Payment</div>
          <div className='payment-amount'>
            <PrivacyWrapper>
              {paymentResult.success
                ? formatCurrency(paymentResult.payment)
                : '—'}
            </PrivacyWrapper>
          </div>
        </div>
        <div className='payment-item'>
          <div className='loan-info-label'>Paid from</div>
          <div className='payment-amount flex items-center gap-2'>
            <span>{fundingSourceName || 'Not set'}</span>
            {typeof onChangeFundingSource === 'function' && (
              <button
                type='button'
                onClick={() => onChangeFundingSource(loan.id)}
                className='text-sm text-blue-400 hover:text-blue-300 underline focus:outline-none focus:ring-0'
              >
                Change
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Additional Info Section */}
      <div className='additional-info'>
        <div className='additional-info-item'>
          <span>Target Payoff</span>
          <span>{formatDate(loan.targetPayoffDate)}</span>
        </div>
        {isTracked && interestToday && (
          <>
            <div className='additional-info-item'>
              <span>Unpaid Interest</span>
              <PrivacyWrapper>
                <span>{formatCurrency(interestToday.collectibleInterest)}</span>
              </PrivacyWrapper>
            </div>
            <div className='additional-info-item'>
              <span>Total Owed Today</span>
              <PrivacyWrapper>
                <span>{formatCurrency(interestToday.totalOwedToday)}</span>
              </PrivacyWrapper>
            </div>
          </>
        )}
      </div>

      {isTracked &&
        loan.lastInterestOperation &&
        loan.lastInterestOperation.version !== 2 && (
          <p className='text-sm text-ink-soft'>
            This older payment has no safe undo snapshot. Its balances are
            preserved; use a financial snapshot correction if needed.
          </p>
        )}

      {/* Interest tracking: undo / correct the latest payment */}
      {undoableOperation && !isCorrecting && (
        <div className='flex gap-2 mt-2'>
          <button
            type='button'
            onClick={handleUndo}
            disabled={isBusy}
            className='loan-card-action-btn text-sm px-3 py-1.5'
          >
            Undo last payment
          </button>
          <button
            type='button'
            onClick={handleStartCorrect}
            disabled={isBusy}
            className='loan-card-action-btn text-sm px-3 py-1.5'
          >
            Correct latest payment
          </button>
        </div>
      )}
      {undoableOperation && isCorrecting && (
        <form
          onSubmit={handleSubmitCorrection}
          className='flex flex-wrap items-center gap-2 mt-2'
        >
          <label htmlFor={`loan-correct-${loan.id}`} className='sr-only'>
            Corrected payment amount
          </label>
          <input
            id={`loan-correct-${loan.id}`}
            type='number'
            inputMode='decimal'
            step='0.01'
            min='0'
            value={correctionAmount}
            onChange={e => setCorrectionAmount(e.target.value)}
            className='glass-input rounded-lg px-2 py-1 text-sm w-28'
          />
          {correctionTarget?.receipt.cycle &&
            Number(correctionAmount) > 0 &&
            correctionTarget.receipt.previousExpensePaidAmount +
              Number(correctionAmount) <
              correctionTarget.receipt.expenseAfter.amount && (
              <label className='text-sm text-ink-soft'>
                Remaining scheduled amount
                <select
                  aria-label='Corrected shortfall'
                  value={shortfallOutcome}
                  required
                  onChange={e => setShortfallOutcome(e.target.value)}
                  className='glass-input'
                >
                  <option value=''>Choose a reminder</option>
                  <option value='deferred'>Create catch-up bill</option>
                  <option value='forgiven'>
                    No catch-up bill (debt remains)
                  </option>
                </select>
              </label>
            )}
          <button
            type='submit'
            disabled={isBusy}
            className='loan-card-action-btn text-sm px-3 py-1.5'
          >
            Save
          </button>
          <button
            type='button'
            onClick={() => setIsCorrecting(false)}
            disabled={isBusy}
            className='loan-card-action-btn text-sm px-3 py-1.5'
          >
            Cancel
          </button>
        </form>
      )}

      {/* Visual Alerts */}
      {isPaymentUrgent && (
        <div className='flex items-center gap-2 text-red-400 text-sm'>
          <AlertTriangle size={14} />
          <span>Payment due soon</span>
        </div>
      )}
    </div>
  );
};

EnhancedLoanCard.propTypes = {
  loan: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    lender: PropTypes.string,
    balance: PropTypes.number,
    principalAmount: PropTypes.number,
    interestRate: PropTypes.number,
    daysUntilDue: PropTypes.number,
    dueDate: PropTypes.string,
    targetPayoffDate: PropTypes.string,
    unpaidInterest: PropTypes.number,
    interestStateVersion: PropTypes.number,
    interestAccruedThrough: PropTypes.string,
    lastInterestOperation: PropTypes.shape({
      version: PropTypes.number,
      cycle: PropTypes.object,
      expenseAfter: PropTypes.object,
      previousExpensePaidAmount: PropTypes.number,
      operationId: PropTypes.string,
      affectedExpenseId: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
      ]),
      cashAmount: PropTypes.number,
      status: PropTypes.string,
    }),
  }).isRequired,
  fundingSourceName: PropTypes.string,
  onChangeFundingSource: PropTypes.func,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onInterestOperationComplete: PropTypes.func,
  index: PropTypes.number,
  className: PropTypes.string,
};

EnhancedLoanCard.defaultProps = {
  fundingSourceName: null,
  onChangeFundingSource: undefined,
  onInterestOperationComplete: undefined,
  index: 0,
  className: '',
};

export default EnhancedLoanCard;

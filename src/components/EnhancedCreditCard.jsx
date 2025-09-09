import { Edit, Trash2, AlertTriangle } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import PrivacyWrapper from './PrivacyWrapper';
import StatusBadge from './StatusBadge';

const EnhancedCreditCard = ({
  card,
  onEdit,
  onDelete,
  index = 0,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [utilizationWidth, setUtilizationWidth] = useState(0);

  useEffect(() => {
    // Staggered animation for card entry
    const visibilityTimer = setTimeout(() => setIsVisible(true), index * 100);

    // Animate utilization bar after card is visible
    const barTimer = setTimeout(
      () => {
        setUtilizationWidth(card.utilization);
      },
      index * 100 + 500
    );

    return () => {
      clearTimeout(visibilityTimer);
      clearTimeout(barTimer);
    };
  }, [index, card.utilization]);

  // Calculate derived values
  const utilization =
    card.utilization || (card.balance / card.creditLimit) * 100;
  const availableCredit = card.creditLimit - card.balance;
  const monthlyInterest = (card.balance * (card.interestRate / 100)) / 12;
  const daysUntilDue = card.daysUntilDue || 0;

  // Status badge logic
  const getUtilizationStatus = percentage => {
    if (percentage >= 70) return 'High Usage';
    if (percentage >= 30) return 'Above Ideal';
    return 'Good Standing';
  };

  const getDueDateStatus = days => {
    if (days <= 7) return 'Due Soon';
    if (days <= 14) return 'Payment Due';
    return null;
  };

  const getUtilizationColor = percentage => {
    if (percentage >= 70) return 'danger';
    if (percentage >= 30) return 'warning';
    return 'success';
  };

  const formatCurrency = amount => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = value => {
    return `${value.toFixed(1)}%`;
  };

  const formatInterestRate = value => {
    return `${value.toFixed(2)}%`;
  };

  const formatDate = dateString => {
    // Parse as local date to avoid timezone shifts
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getCountdownText = days => {
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today!';
    if (days === 1) return 'Due tomorrow';
    return `${days} days until due`;
  };

  const isPaymentUrgent = daysUntilDue <= 7 && daysUntilDue >= 0;

  return (
    <div
      className={`credit-card ${className} ${
        isVisible ? 'slide-in-up' : 'opacity-0'
      }`}
      style={{
        '--utilization-percentage': `${utilization}%`,
      }}
    >
      {/* Header Section */}
      <div className='credit-card-header'>
        <div>
          <h3 className='credit-card-title'>{card.name}</h3>
          <p className='credit-card-balance'>
            <PrivacyWrapper>{formatCurrency(card.balance)}</PrivacyWrapper>
          </p>
        </div>

        <div className='credit-card-actions'>
          <div className='credit-card-badges'>
            <StatusBadge
              status={getUtilizationStatus(utilization)}
              variant='credit-card'
            />
            {getDueDateStatus(daysUntilDue) && (
              <StatusBadge
                status={getDueDateStatus(daysUntilDue)}
                variant='credit-card'
              />
            )}
          </div>

          <div className='flex gap-2'>
            <button
              onClick={() => onEdit(card)}
              className='credit-card-action-btn edit'
              aria-label={`Edit ${card.name}`}
            >
              <Edit size={12} />
            </button>
            <button
              onClick={() => onDelete(card)}
              className='credit-card-action-btn delete'
              aria-label={`Delete ${card.name}`}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Financial Overview Grid */}
      <div className='credit-info-grid'>
        <div className='credit-info-item'>
          <div className='credit-info-label'>Credit Limit</div>
          <div className='credit-info-value'>
            <PrivacyWrapper>{formatCurrency(card.creditLimit)}</PrivacyWrapper>
          </div>
        </div>
        <div className='credit-info-item'>
          <div className='credit-info-label'>Available Credit</div>
          <div className='credit-info-value'>
            <PrivacyWrapper>{formatCurrency(availableCredit)}</PrivacyWrapper>
          </div>
        </div>
        <div className='credit-info-item'>
          <div className='credit-info-label'>Interest Rate</div>
          <div className='credit-info-value'>
            <PrivacyWrapper>
              {formatInterestRate(card.interestRate)}
            </PrivacyWrapper>
          </div>
        </div>
        <div className='credit-info-item'>
          <div className='credit-info-label'>Monthly Interest</div>
          <div className='credit-info-value'>
            <PrivacyWrapper>{formatCurrency(monthlyInterest)}</PrivacyWrapper>
          </div>
        </div>
      </div>

      {/* Utilization Section */}
      <div className='utilization-section'>
        <div className='utilization-header'>
          <span className='utilization-label'>Credit Utilization</span>
          <span
            className={`utilization-percentage ${getUtilizationColor(utilization)}`}
          >
            <PrivacyWrapper>{formatPercentage(utilization)}</PrivacyWrapper>
          </span>
        </div>
        <div className='utilization-bar'>
          <div
            className={`utilization-fill ${getUtilizationColor(utilization)} progress-animate`}
            style={{ width: `${utilizationWidth}%` }}
            aria-label={`Credit utilization: ${formatPercentage(utilization)}`}
          />
        </div>
      </div>

      {/* Payment Section */}
      <div className='payment-section'>
        <div className={`payment-item ${isPaymentUrgent ? 'urgent' : ''}`}>
          <div className='credit-info-label'>Due Date</div>
          <div className='payment-date'>{formatDate(card.dueDate)}</div>
          <div
            className={`payment-countdown ${isPaymentUrgent ? 'urgent' : ''}`}
          >
            {getCountdownText(daysUntilDue)}
          </div>
        </div>
        <div className='payment-item'>
          <div className='credit-info-label'>Minimum Payment</div>
          <div className='payment-amount'>
            <PrivacyWrapper>
              {formatCurrency(card.minimumPayment)}
            </PrivacyWrapper>
          </div>
        </div>
      </div>

      {/* Additional Info Section */}
      <div className='additional-info'>
        <div className='additional-info-item'>
          <span>Statement Date</span>
          <span>
            {card.statementClosingDate
              ? formatDate(card.statementClosingDate)
              : 'N/A'}
          </span>
        </div>
        <div className='additional-info-item'>
          <span>Utilization vs Ideal</span>
          <span
            className={utilization > 30 ? 'text-yellow-400' : 'text-green-400'}
          >
            <PrivacyWrapper>
              {utilization > 30
                ? `+${(utilization - 30).toFixed(1)}%`
                : `${(30 - utilization).toFixed(1)}% under`}
            </PrivacyWrapper>
          </span>
        </div>
      </div>

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

export default EnhancedCreditCard;

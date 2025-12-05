import {
  Calculator,
  CreditCard,
  Calendar,
  DollarSign,
  TrendingDown,
  Edit3,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { dbHelpers } from '../db/database-clean';
import { logger } from '../utils/logger';

import PrivacyWrapper from './PrivacyWrapper';

const DebtPayoffCalculator = ({ creditCards = [], onDataChange }) => {
  const [selectedCard, setSelectedCard] = useState(null);
  const [calculatorData, setCalculatorData] = useState({
    balance: 0,
    payment: 0,
    interestRate: 18.99,
    creditLimit: 0,
    minimumPayment: 0,
  });
  const [payoffResult, setPayoffResult] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (creditCards.length > 0 && !selectedCard) {
      setSelectedCard(creditCards[0]);
    }
  }, [creditCards, selectedCard]);

  useEffect(() => {
    if (selectedCard) {
      setCalculatorData({
        balance: selectedCard.balance || 0,
        payment: selectedCard.minimumPayment || 0,
        interestRate: selectedCard.interestRate || 18.99,
        creditLimit: selectedCard.creditLimit || 0,
        minimumPayment: selectedCard.minimumPayment || 0,
      });
    }
  }, [selectedCard]);

  useEffect(() => {
    calculatePayoff();
  }, [calculatorData]);

  const calculatePayoff = async () => {
    const { balance, payment, interestRate } = calculatorData;

    if (balance <= 0 || payment <= 0) {
      setPayoffResult(null);
      return;
    }

    try {
      const result = await dbHelpers.calculateDebtPayoff(
        balance,
        payment,
        interestRate
      );
      setPayoffResult(result);
    } catch (error) {
      logger.error('Error calculating debt payoff:', error);
      setPayoffResult(null);
    }
  };

  const handleInputChange = (field, value) => {
    setCalculatorData(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0,
    }));
  };

  const updateCreditCard = async updates => {
    if (!selectedCard) return;

    try {
      await dbHelpers.updateCreditCard(selectedCard.id, updates);
      logger.success('Credit card updated successfully');
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      logger.error('Error updating credit card:', error);
    }
  };

  const formatCurrency = amount => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = dateString => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getPayoffColor = () => {
    if (
      !payoffResult ||
      !payoffResult.success ||
      payoffResult.payoffMonths === -1
    )
      return 'text-red-400';
    if (payoffResult.payoffMonths <= 12) return 'text-green-400';
    if (payoffResult.payoffMonths <= 24) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getUtilizationColor = utilization => {
    if (utilization >= 90) return 'text-red-400';
    if (utilization >= 70) return 'text-orange-400';
    if (utilization >= 50) return 'text-yellow-400';
    return 'text-green-400';
  };

  const creditUtilization =
    calculatorData.creditLimit > 0
      ? (calculatorData.balance / calculatorData.creditLimit) * 100
      : 0;

  if (creditCards.length === 0) {
    return (
      <div className='glass-panel'>
        <h2 className='text-xl font-bold text-white mb-4'>
          Debt Payoff Calculator
        </h2>
        <div className='text-center py-8'>
          <CreditCard className='w-12 h-12 text-white/30 mx-auto mb-4' />
          <p className='text-white/70'>No credit cards found.</p>
          <p className='text-white/50 text-sm mt-2'>
            Add credit cards to use the payoff calculator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='glass-panel'>
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-xl font-bold text-white'>Debt Payoff Calculator</h2>
        <div className='flex items-center space-x-2'>
          <Calculator className='w-5 h-5 text-blue-400' />
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`p-2 rounded-lg transition-colors ${
              isEditing
                ? 'bg-blue-500/20 text-blue-400'
                : 'hover:bg-white/10 text-white/70'
            }`}
            title='Edit Mode'
          >
            <Edit3 className='w-4 h-4' />
          </button>
        </div>
      </div>

      {/* Credit Card Selector */}
      {creditCards.length > 1 && (
        <div className='mb-6'>
          <label className='block text-sm font-medium text-white/70 mb-2'>
            Select Credit Card
          </label>
          <select
            value={selectedCard?.id || ''}
            onChange={e => {
              const card = creditCards.find(
                c => c.id === parseInt(e.target.value)
              );
              setSelectedCard(card);
            }}
            className='glass-input w-full'
          >
            {creditCards.map(card => (
              <option key={card.id} value={card.id}>
                {card.name} - {formatCurrency(card.balance)}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedCard && (
        <>
          {/* Credit Card Info */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
            {/* Current Balance */}
            <div className='glass-card p-4'>
              <label className='block text-sm font-medium text-white/70 mb-2'>
                Current Balance
              </label>
              {isEditing ? (
                <input
                  type='number'
                  value={calculatorData.balance}
                  onChange={e => handleInputChange('balance', e.target.value)}
                  onBlur={() =>
                    updateCreditCard({ balance: calculatorData.balance })
                  }
                  className='glass-input w-full'
                  step='0.01'
                  min='0'
                />
              ) : (
                <PrivacyWrapper>
                  <p className='text-xl font-bold text-white'>
                    {formatCurrency(calculatorData.balance)}
                  </p>
                </PrivacyWrapper>
              )}
            </div>

            {/* Credit Limit */}
            <div className='glass-card p-4'>
              <label className='block text-sm font-medium text-white/70 mb-2'>
                Credit Limit
              </label>
              {isEditing ? (
                <input
                  type='number'
                  value={calculatorData.creditLimit}
                  onChange={e =>
                    handleInputChange('creditLimit', e.target.value)
                  }
                  onBlur={() =>
                    updateCreditCard({
                      creditLimit: calculatorData.creditLimit,
                    })
                  }
                  className='glass-input w-full'
                  step='0.01'
                  min='0'
                />
              ) : (
                <PrivacyWrapper>
                  <p className='text-xl font-bold text-white'>
                    {formatCurrency(calculatorData.creditLimit)}
                  </p>
                </PrivacyWrapper>
              )}
              <p
                className={`text-sm mt-1 ${getUtilizationColor(creditUtilization)}`}
              >
                {creditUtilization.toFixed(1)}% utilization
              </p>
            </div>

            {/* Interest Rate */}
            <div className='glass-card p-4'>
              <label className='block text-sm font-medium text-white/70 mb-2'>
                Interest Rate (APR)
              </label>
              {isEditing ? (
                <input
                  type='number'
                  value={calculatorData.interestRate}
                  onChange={e =>
                    handleInputChange('interestRate', e.target.value)
                  }
                  onBlur={() =>
                    updateCreditCard({
                      interestRate: calculatorData.interestRate,
                    })
                  }
                  className='glass-input w-full'
                  step='0.01'
                  min='0'
                  max='50'
                />
              ) : (
                <p className='text-xl font-bold text-white'>
                  {calculatorData.interestRate.toFixed(2)}%
                </p>
              )}
            </div>

            {/* Monthly Payment */}
            <div className='glass-card p-4'>
              <label className='block text-sm font-medium text-white/70 mb-2'>
                Monthly Payment
              </label>
              <input
                type='number'
                value={calculatorData.payment}
                onChange={e => handleInputChange('payment', e.target.value)}
                className='glass-input w-full'
                step='0.01'
                min='0'
              />
              <p className='text-sm text-white/50 mt-1'>
                Minimum: {formatCurrency(calculatorData.minimumPayment)}
              </p>
            </div>
          </div>

          {/* Payoff Results */}
          {payoffResult && (
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold text-white'>
                Payoff Projection
              </h3>

              {payoffResult.payoffMonths === -1 ? (
                <div className='glass-card p-4 border border-red-500/20 bg-red-500/10'>
                  <div className='flex items-center space-x-3'>
                    <TrendingDown className='w-6 h-6 text-red-400' />
                    <div>
                      <p className='text-red-400 font-medium'>
                        Payment Too Low
                      </p>
                      <p className='text-white/70 text-sm'>
                        Monthly payment of{' '}
                        {formatCurrency(calculatorData.payment)} doesn't cover
                        interest ({formatCurrency(payoffResult.monthlyInterest)}
                        /month). Debt will never be paid off.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  {/* Payoff Time */}
                  <div className='glass-card p-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <Calendar className='w-4 h-4 text-blue-400' />
                      <p className='text-sm text-white/70'>Payoff Time</p>
                    </div>
                    <p className={`text-xl font-bold ${getPayoffColor()}`}>
                      {payoffResult.success && payoffResult.payoffMonths > 0
                        ? `${payoffResult.payoffMonths} months`
                        : 'N/A'}
                    </p>
                    <p className='text-sm text-white/50'>
                      {payoffResult.success && payoffResult.payoffDate
                        ? formatDate(payoffResult.payoffDate)
                        : 'Unable to calculate'}
                    </p>
                  </div>

                  {/* Total Interest */}
                  <div className='glass-card p-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <DollarSign className='w-4 h-4 text-red-400' />
                      <p className='text-sm text-white/70'>Total Interest</p>
                    </div>
                    <PrivacyWrapper>
                      <p className='text-xl font-bold text-red-400'>
                        {formatCurrency(payoffResult.totalInterest)}
                      </p>
                    </PrivacyWrapper>
                  </div>

                  {/* Total Cost */}
                  <div className='glass-card p-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <Calculator className='w-4 h-4 text-purple-400' />
                      <p className='text-sm text-white/70'>Total Cost</p>
                    </div>
                    <PrivacyWrapper>
                      <p className='text-xl font-bold text-purple-400'>
                        {payoffResult.success
                          ? formatCurrency(
                              calculatorData.balance +
                                payoffResult.totalInterest
                            )
                          : 'N/A'}
                      </p>
                    </PrivacyWrapper>
                  </div>
                </div>
              )}

              {/* Payment Scenarios */}
              {payoffResult.payoffMonths > 0 && (
                <div className='glass-card p-4'>
                  <h4 className='font-medium text-white mb-3'>
                    What if you paid more?
                  </h4>
                  <div className='space-y-2 text-sm'>
                    {[50, 100, 200].map(extra => {
                      const newPayment = calculatorData.payment + extra;
                      if (newPayment <= calculatorData.payment) return null;

                      const monthlyRate =
                        calculatorData.interestRate / 100 / 12;
                      let balance = calculatorData.balance;
                      let months = 0;
                      let totalInterest = 0;

                      while (balance > 0.01 && months < 600) {
                        const interestPayment = balance * monthlyRate;
                        const principalPayment = Math.min(
                          newPayment - interestPayment,
                          balance
                        );
                        totalInterest += interestPayment;
                        balance -= principalPayment;
                        months++;
                      }

                      const timeSaved = payoffResult.payoffMonths - months;
                      const interestSaved =
                        payoffResult.totalInterest - totalInterest;

                      return (
                        <div
                          key={extra}
                          className='flex justify-between items-center py-2 border-b border-white/10 last:border-b-0'
                        >
                          <span className='text-white/70'>
                            +{formatCurrency(extra)}/month (
                            {formatCurrency(newPayment)} total)
                          </span>
                          <span className='text-green-400'>
                            Save {timeSaved} months,{' '}
                            <PrivacyWrapper>
                              {formatCurrency(interestSaved)}
                            </PrivacyWrapper>{' '}
                            interest
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DebtPayoffCalculator;

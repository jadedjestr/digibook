import {
  Calculator,
  Calendar,
  DollarSign,
  TrendingDown,
  Edit3,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { dbHelpers } from '../db/database-clean';
import { logger } from '../utils/logger';
import { parseMoneyInput } from '../utils/validation';

import EmptyState from './EmptyState';
import LoansEmptyIllustration from './illustrations/LoansEmptyIllustration';
import PrivacyWrapper from './PrivacyWrapper';

const LoanPayoffCalculator = ({ loans = [] }) => {
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [calculatorData, setCalculatorData] = useState({
    balance: 0,
    payment: 0,
    interestRate: 0,
    calculatedPayment: 0,
  });
  const [payoffResult, setPayoffResult] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (loans.length > 0 && !selectedLoan) {
      setSelectedLoan(loans[0]);
    }
  }, [loans, selectedLoan]);

  useEffect(() => {
    if (selectedLoan) {
      // Seed the payment from the loan's own calculated payment - the same
      // amount it's actually being billed to hit its target payoff date -
      // falling back to a rough balance/12 estimate when that formula can't
      // resolve (e.g. no target date on record).
      const paymentResult = dbHelpers.calculateRequiredLoanPayment(
        selectedLoan.balance,
        selectedLoan.interestRate,
        selectedLoan.dueDate,
        selectedLoan.targetPayoffDate,
      );
      const seededPayment = paymentResult.success
        ? paymentResult.payment
        : (selectedLoan.balance || 0) / 12;

      setCalculatorData({
        balance: selectedLoan.balance || 0,
        payment: seededPayment,
        interestRate: selectedLoan.interestRate || 0,
        calculatedPayment: seededPayment,
      });
    }
  }, [selectedLoan]);

  useEffect(() => {
    const calculatePayoff = async () => {
      const { balance, payment, interestRate } = calculatorData;

      if (balance <= 0 || payment <= 0) {
        setPayoffResult(null);
        return;
      }

      try {
        // Generic amortization - identical to the credit card calculator's
        // call, since debt payoff math doesn't care what the debt is.
        const result = await dbHelpers.calculateDebtPayoff(
          balance,
          payment,
          interestRate,
        );
        setPayoffResult(result);
      } catch (error) {
        logger.error('Error calculating loan payoff:', error);
        setPayoffResult(null);
      }
    };

    calculatePayoff();
  }, [calculatorData]);

  const handleInputChange = (field, value) => {
    const parsed = parseMoneyInput(value, { allowEmpty: true });
    setCalculatorData(prev => ({
      ...prev,

      // Keep the last good value rather than collapsing to 0 mid-typing.
      [field]: parsed.ok ? parsed.value : prev[field],
    }));
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
    return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
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

  if (loans.length === 0) {
    return (
      <div className='glass-panel'>
        <h2 className='text-xl font-bold text-white mb-2'>
          Loan Payoff Calculator
        </h2>
        <EmptyState
          illustration={<LoansEmptyIllustration />}
          title='No loans to calculate'
          subtitle='Add loans to unlock the loan payoff calculator'
        />
      </div>
    );
  }

  return (
    <div className='glass-panel'>
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-xl font-bold text-white'>Loan Payoff Calculator</h2>
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

      {isEditing && (
        <p className='text-xs text-white/50 mb-4'>
          What-if only — edit your real loan from Loans.
        </p>
      )}

      {/* Loan Selector */}
      {loans.length > 1 && (
        <div className='mb-6'>
          <label
            htmlFor='loan-payoff-calc-loan'
            className='block text-sm font-medium text-white/70 mb-2'
          >
            Select Loan
          </label>
          <select
            id='loan-payoff-calc-loan'
            value={selectedLoan?.id || ''}
            onChange={e => {
              const loan = loans.find(l => l.id === e.target.value);
              setSelectedLoan(loan);
            }}
            className='glass-input w-full'
          >
            {loans.map(loan => (
              <option key={loan.id} value={loan.id}>
                {loan.name} - {formatCurrency(loan.balance)}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedLoan && (
        <>
          {/* Loan Info */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
            {/* Current Balance */}
            <div className='glass-card p-4'>
              <label
                htmlFor='loan-payoff-calc-balance'
                className='block text-sm font-medium text-white/70 mb-2'
              >
                Current Balance
              </label>
              {isEditing ? (
                <input
                  id='loan-payoff-calc-balance'
                  type='number'
                  inputMode='decimal'
                  value={calculatorData.balance}
                  onChange={e => handleInputChange('balance', e.target.value)}
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

            {/* Target Payoff Date - informational only. It's what the
                seeded payment above was calculated to hit, but it isn't an
                input to the what-if amortization itself (that only takes
                balance/payment/interestRate), so it stays read-only even in
                edit mode. */}
            <div className='glass-card p-4'>
              <p className='block text-sm font-medium text-white/70 mb-2'>
                Target Payoff Date
              </p>
              <p className='text-xl font-bold text-white'>
                {formatDate(selectedLoan.targetPayoffDate)}
              </p>
              <p className='text-sm text-white/50 mt-1'>
                On the loan&apos;s own record
              </p>
            </div>

            {/* Interest Rate */}
            <div className='glass-card p-4'>
              <label
                htmlFor='loan-payoff-calc-interest-rate'
                className='block text-sm font-medium text-white/70 mb-2'
              >
                Interest Rate (APR)
              </label>
              {isEditing ? (
                <input
                  id='loan-payoff-calc-interest-rate'
                  type='number'
                  inputMode='decimal'
                  value={calculatorData.interestRate}
                  onChange={e =>
                    handleInputChange('interestRate', e.target.value)
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
              <label
                htmlFor='loan-payoff-calc-monthly-payment'
                className='block text-sm font-medium text-white/70 mb-2'
              >
                Monthly Payment
              </label>
              <input
                id='loan-payoff-calc-monthly-payment'
                type='number'
                inputMode='decimal'
                value={calculatorData.payment}
                onChange={e => handleInputChange('payment', e.target.value)}
                className='glass-input w-full'
                step='0.01'
                min='0'
              />
              <p className='text-sm text-white/50 mt-1'>
                Calculated: {formatCurrency(calculatorData.calculatedPayment)}
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
                        {formatCurrency(calculatorData.payment)} doesn&apos;t
                        cover interest (
                        {formatCurrency(payoffResult.monthlyInterest)}
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
                                payoffResult.totalInterest,
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
                          balance,
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

LoanPayoffCalculator.propTypes = {
  loans: PropTypes.arrayOf(PropTypes.object),
};

LoanPayoffCalculator.defaultProps = {
  loans: [],
};

export default LoanPayoffCalculator;

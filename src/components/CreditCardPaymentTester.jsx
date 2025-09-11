import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

import CreditCardPaymentInput from './CreditCardPaymentInput';
import { formatCreditCardBalance } from '../utils/creditCardUtils';

/**
 * Testing component for Credit Card Payment edge cases
 *
 * This component helps verify that our enhancement handles:
 * 1. Overpayments (paying more than debt balance)
 * 2. Insufficient funds in funding account
 * 3. Credit balances (negative debt)
 * 4. Payment suggestions
 */
const CreditCardPaymentTester = () => {
  const [selectedScenario, setSelectedScenario] = useState('basic');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [validationResult, setValidationResult] = useState(null);

  // Test scenarios
  const scenarios = {
    basic: {
      name: 'Basic: $50 min payment, $500 debt',
      description: 'Testing the edge case from your question',
      expense: {
        id: 1,
        name: 'Test Card Payment',
        category: 'Credit Card Payment',
        amount: 50,
        paidAmount: 0,
        accountId: 1,
        targetCreditCardId: 1,
      },
      accounts: [
        {
          id: 1,
          name: 'Checking Account',
          type: 'checking',
          currentBalance: 1200,
        },
      ],
      creditCards: [
        {
          id: 1,
          name: 'Test Credit Card',
          balance: 500,
          creditLimit: 2000,
          minimumPayment: 50,
          interestRate: 18.99,
        },
      ],
    },
    overpayment: {
      name: 'Overpayment: Pay $100 on $30 debt',
      description: 'Testing overpayment creating credit balance',
      expense: {
        id: 2,
        name: 'Low Balance Card Payment',
        category: 'Credit Card Payment',
        amount: 25,
        paidAmount: 0,
        accountId: 1,
        targetCreditCardId: 2,
      },
      accounts: [
        {
          id: 1,
          name: 'Checking Account',
          type: 'checking',
          currentBalance: 800,
        },
      ],
      creditCards: [
        {
          id: 2,
          name: 'Low Balance Card',
          balance: 30,
          creditLimit: 1000,
          minimumPayment: 25,
          interestRate: 22.99,
        },
      ],
    },
    insufficientFunds: {
      name: 'Insufficient Funds: $50 payment, $30 available',
      description: 'Testing insufficient funds validation',
      expense: {
        id: 3,
        name: 'High Payment Request',
        category: 'Credit Card Payment',
        amount: 50,
        paidAmount: 0,
        accountId: 1,
        targetCreditCardId: 3,
      },
      accounts: [
        {
          id: 1,
          name: 'Low Balance Checking',
          type: 'checking',
          currentBalance: 30,
        },
      ],
      creditCards: [
        {
          id: 3,
          name: 'Regular Card',
          balance: 800,
          creditLimit: 1500,
          minimumPayment: 50,
          interestRate: 19.99,
        },
      ],
    },
    creditBalance: {
      name: 'Credit Balance: Card already has -$50 credit',
      description: 'Testing payments on cards with existing credit balance',
      expense: {
        id: 4,
        name: 'Credit Balance Card Payment',
        category: 'Credit Card Payment',
        amount: 25,
        paidAmount: 0,
        accountId: 1,
        targetCreditCardId: 4,
      },
      accounts: [
        {
          id: 1,
          name: 'Checking Account',
          type: 'checking',
          currentBalance: 500,
        },
      ],
      creditCards: [
        {
          id: 4,
          name: 'Credit Balance Card',
          balance: -50, // Credit balance
          creditLimit: 1000,
          minimumPayment: 0,
          interestRate: 20.99,
        },
      ],
    },
  };

  const currentScenario = scenarios[selectedScenario];
  const currentCard = currentScenario.creditCards[0];
  const balanceInfo = formatCreditCardBalance(currentCard.balance);

  return (
    <div className='glass-panel p-6 space-y-6'>
      <div className='text-center'>
        <h2 className='text-2xl font-bold text-white mb-2'>
          Credit Card Payment Testing
        </h2>
        <p className='text-white/70'>
          Test edge cases for credit card payment validation and suggestions
        </p>
      </div>

      {/* Scenario Selector */}
      <div className='space-y-3'>
        <label className='block text-sm font-medium text-white/70'>
          Test Scenario
        </label>
        <select
          value={selectedScenario}
          onChange={e => {
            setSelectedScenario(e.target.value);
            setPaymentAmount(0);
            setValidationResult(null);
          }}
          className='glass-input w-full'
        >
          {Object.entries(scenarios).map(([key, scenario]) => (
            <option key={key} value={key}>
              {scenario.name}
            </option>
          ))}
        </select>
        <p className='text-sm text-white/60'>{currentScenario.description}</p>
      </div>

      {/* Current Scenario Info */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div className='glass-card p-4'>
          <h3 className='font-medium text-white mb-3'>Credit Card Info</h3>
          <div className='space-y-2 text-sm'>
            <div className='flex justify-between'>
              <span className='text-white/70'>Balance:</span>
              <span className={balanceInfo.className}>
                {balanceInfo.displayText}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-white/70'>Credit Limit:</span>
              <span className='text-white'>${currentCard.creditLimit}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-white/70'>Min Payment:</span>
              <span className='text-white'>${currentCard.minimumPayment}</span>
            </div>
          </div>
        </div>

        <div className='glass-card p-4'>
          <h3 className='font-medium text-white mb-3'>Funding Account</h3>
          <div className='space-y-2 text-sm'>
            <div className='flex justify-between'>
              <span className='text-white/70'>Name:</span>
              <span className='text-white'>
                {currentScenario.accounts[0].name}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-white/70'>Balance:</span>
              <span className='text-white'>
                ${currentScenario.accounts[0].currentBalance}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Input Testing */}
      <div className='space-y-4'>
        <h3 className='font-medium text-white'>Test Payment Amount</h3>
        <CreditCardPaymentInput
          expense={currentScenario.expense}
          value={paymentAmount}
          onChange={setPaymentAmount}
          onValidationChange={setValidationResult}
          accounts={currentScenario.accounts}
          creditCards={currentScenario.creditCards}
          className='w-full'
        />
      </div>

      {/* Results Display */}
      {validationResult && (
        <div className='space-y-4'>
          <h3 className='font-medium text-white'>Validation Results</h3>

          <div className='grid grid-cols-1 gap-4'>
            {/* Overall Status */}
            <div
              className={`flex items-center space-x-2 p-3 rounded-lg ${
                validationResult.isValid
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-red-500/20 border border-red-500/30'
              }`}
            >
              {validationResult.isValid ? (
                <CheckCircle className='text-green-400' size={20} />
              ) : (
                <AlertTriangle className='text-red-400' size={20} />
              )}
              <span
                className={
                  validationResult.isValid ? 'text-green-300' : 'text-red-300'
                }
              >
                {validationResult.isValid
                  ? 'Payment validation passed'
                  : 'Payment validation failed'}
              </span>
            </div>

            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <div className='space-y-2'>
                <h4 className='text-sm font-medium text-red-400'>Errors:</h4>
                {validationResult.errors.map((error, index) => (
                  <div
                    key={index}
                    className='flex items-start space-x-2 text-sm text-red-300'
                  >
                    <AlertTriangle size={16} className='mt-0.5 flex-shrink-0' />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {validationResult.warnings.length > 0 && (
              <div className='space-y-2'>
                <h4 className='text-sm font-medium text-yellow-400'>
                  Warnings:
                </h4>
                {validationResult.warnings.map((warning, index) => (
                  <div
                    key={index}
                    className='flex items-start space-x-2 text-sm text-yellow-300'
                  >
                    <AlertTriangle size={16} className='mt-0.5 flex-shrink-0' />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Payment Impact */}
            {validationResult.paymentInfo && (
              <div className='glass-card p-4'>
                <h4 className='text-sm font-medium text-white mb-3'>
                  Payment Impact
                </h4>
                <div className='grid grid-cols-2 gap-2 text-sm'>
                  <div className='text-white/70'>Current Debt:</div>
                  <div className='text-white font-medium'>
                    ${validationResult.paymentInfo.currentDebt.toFixed(2)}
                  </div>

                  <div className='text-white/70'>After Payment:</div>
                  <div
                    className={`font-medium ${
                      validationResult.paymentInfo.afterPaymentDebt <= 0
                        ? 'text-green-400'
                        : 'text-white'
                    }`}
                  >
                    $
                    {Math.abs(
                      validationResult.paymentInfo.afterPaymentDebt
                    ).toFixed(2)}
                    {validationResult.paymentInfo.afterPaymentDebt < 0 &&
                      ' (credit)'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Testing Instructions */}
      <div className='glass-card p-4'>
        <h3 className='font-medium text-white mb-3 flex items-center space-x-2'>
          <Info size={16} />
          <span>Testing Instructions</span>
        </h3>
        <div className='text-sm text-white/70 space-y-2'>
          <p>
            • <strong>Basic scenario:</strong> Try entering $100 (should allow
            but warn about overpayment)
          </p>
          <p>
            • <strong>Overpayment scenario:</strong> Try entering $100 on $30
            debt (should create credit balance)
          </p>
          <p>
            • <strong>Insufficient funds:</strong> Try entering $50 with only
            $30 available (should block)
          </p>
          <p>
            • <strong>Credit balance:</strong> Try any payment on negative
            balance (should warn)
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreditCardPaymentTester;

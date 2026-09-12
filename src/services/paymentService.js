/**
 * Payment source lookups, validation, and suggestions for the dual foreign
 * key architecture (expenses paid from accounts or credit cards, not both).
 *
 * The actual balance-mutating payment logic lives in
 * dbHelpers.applyExpensePaymentChangeAtomic (db/database-clean.js), not
 * here - this service only reads/validates against the in-memory
 * accounts/creditCards arrays it's constructed with, for UI display and
 * pre-flight checks.
 */

import {
  createPaymentSource as _createPaymentSource,
  PaymentSourceTypes,
} from '../types/paymentSource';
import { getDefaultMinimumPaymentAmount } from '../utils/creditCardUtils';

export class PaymentService {
  constructor(accounts, creditCards) {
    this.accounts = accounts;
    this.creditCards = creditCards;
  }

  /**
   * Get payment source details for display in UI
   *
   * @param {Object} expense - The expense object
   * @returns {Object} Payment source information
   */
  getPaymentSourceDetails(expense) {
    if (expense.accountId) {
      const account = this.accounts.find(acc => acc.id === expense.accountId);
      return {
        type: PaymentSourceTypes.ACCOUNT,
        source: account,
        displayName: account?.name || 'Unknown Account',
        balance: account?.currentBalance || 0,
        formattedBalance: `$${(account?.currentBalance || 0).toLocaleString()}`,
        isValid: !!account,
      };
    } else if (expense.creditCardId) {
      const creditCard = this.creditCards.find(
        card => card.id === expense.creditCardId,
      );
      return {
        type: PaymentSourceTypes.CREDIT_CARD,
        source: creditCard,
        displayName: creditCard?.name || 'Unknown Card',
        balance: creditCard?.balance || 0,
        formattedBalance:
          creditCard?.balance > 0
            ? `$${creditCard.balance.toLocaleString()} debt`
            : 'Paid off',
        isValid: !!creditCard,
      };
    }

    return {
      type: 'none',
      source: null,
      displayName: 'No Payment Source',
      balance: 0,
      formattedBalance: '$0.00',
      isValid: false,
    };
  }

  /**
   * Get credit card payment details (for two-field system display)
   *
   * @param {Object} expense - Credit card payment expense
   * @returns {Object} Credit card payment information
   */
  getCreditCardPaymentDetails(expense) {
    if (expense.category !== 'Credit Card Payment') {
      return null;
    }

    const fundingAccount = this.accounts.find(
      acc => acc.id === expense.accountId,
    );
    const targetCreditCard = this.creditCards.find(
      card => card.id === expense.targetCreditCardId,
    );

    return {
      fundingSource: {
        type: PaymentSourceTypes.ACCOUNT,
        source: fundingAccount,
        displayName: fundingAccount?.name || 'Unknown Account',
        balance: fundingAccount?.currentBalance || 0,
        isValid: !!fundingAccount,
      },
      target: {
        type: PaymentSourceTypes.CREDIT_CARD,
        source: targetCreditCard,
        displayName: targetCreditCard?.name || 'Unknown Card',
        balance: targetCreditCard?.balance || 0,
        isValid: !!targetCreditCard,
      },
    };
  }

  /**
   * Validate that all payment source references exist
   *
   * @param {Object} expense - The expense to validate
   * @returns {Object} Validation result
   */
  validatePaymentSources(expense) {
    const errors = [];
    const warnings = [];

    // Check payment source exists
    if (expense.accountId) {
      const account = this.accounts.find(acc => acc.id === expense.accountId);
      if (!account) {
        errors.push(`Account with ID ${expense.accountId} not found`);
      }
    }

    if (expense.creditCardId) {
      const creditCard = this.creditCards.find(
        card => card.id === expense.creditCardId,
      );
      if (!creditCard) {
        errors.push(`Credit card with ID ${expense.creditCardId} not found`);
      }
    }

    // Check credit card payment specific validation
    if (expense.category === 'Credit Card Payment') {
      if (!expense.accountId) {
        errors.push(
          'Credit card payments must have funding account (accountId)',
        );
      }
      if (!expense.targetCreditCardId) {
        errors.push(
          'Credit card payments must have target credit card (targetCreditCardId)',
        );
      }
      if (expense.creditCardId) {
        errors.push(
          'Credit card payments cannot have creditCardId (use targetCreditCardId)',
        );
      }

      if (expense.targetCreditCardId) {
        const targetCard = this.creditCards.find(
          card => card.id === expense.targetCreditCardId,
        );
        if (!targetCard) {
          errors.push(
            `Target credit card with ID ${expense.targetCreditCardId} not found`,
          );
        }
      }
    }

    // Check for sufficient funds (warning, not error)
    if (expense.accountId && expense.paidAmount > 0) {
      const account = this.accounts.find(acc => acc.id === expense.accountId);
      if (account && account.currentBalance < expense.paidAmount) {
        warnings.push(
          `Insufficient funds in ${account.name}: $${account.currentBalance} available, $${expense.paidAmount} required`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Enhanced validation for credit card payments including overpayment checks
   *
   * @param {Object} expense - The credit card payment expense
   * @param {number} paymentAmount - The amount being paid
   * @returns {Object} Enhanced validation result
   */
  validateCreditCardPaymentAmount(expense, paymentAmount) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      paymentInfo: {},
    };

    if (expense.category !== 'Credit Card Payment') {
      result.errors.push('This validation is only for credit card payments');
      result.isValid = false;
      return result;
    }

    const fundingAccount = this.accounts.find(
      acc => acc.id === expense.accountId,
    );
    const targetCreditCard = this.creditCards.find(
      card => card.id === expense.targetCreditCardId,
    );

    if (!fundingAccount || !targetCreditCard) {
      result.errors.push('Invalid payment source or target credit card');
      result.isValid = false;
      return result;
    }

    // Payment amount validations
    if (paymentAmount <= 0) {
      result.errors.push('Payment amount must be greater than $0');
      result.isValid = false;
    }

    // Insufficient funds check
    if (paymentAmount > fundingAccount.currentBalance) {
      result.errors.push(
        `Insufficient funds in ${fundingAccount.name}. Available: $${fundingAccount.currentBalance.toFixed(2)}, Required: $${paymentAmount.toFixed(2)}`,
      );
      result.isValid = false;
    }

    // Overpayment warning (not an error - still allow it)
    if (
      paymentAmount > targetCreditCard.balance &&
      targetCreditCard.balance > 0
    ) {
      const overpayment = paymentAmount - targetCreditCard.balance;
      result.warnings.push(
        `Payment exceeds current debt by $${overpayment.toFixed(2)}. This will create a credit balance on your ${targetCreditCard.name}.`,
      );
    }

    // Zero balance warning
    if (targetCreditCard.balance <= 0) {
      result.warnings.push(
        `${targetCreditCard.name} already has a zero or credit balance. This payment will increase your credit balance.`,
      );
    }

    // Generate payment suggestions
    result.suggestions = this.generatePaymentSuggestions(
      targetCreditCard,
      fundingAccount,
    );

    // Payment info for UI display
    result.paymentInfo = {
      currentDebt: targetCreditCard.balance,
      minimumPayment: getDefaultMinimumPaymentAmount(targetCreditCard),
      availableFunds: fundingAccount.currentBalance,
      afterPaymentDebt: targetCreditCard.balance - paymentAmount,
      fundingAccountName: fundingAccount.name,
      targetCardName: targetCreditCard.name,
    };

    return result;
  }

  /**
   * Generate smart payment suggestions based on debt and available funds
   *
   * @param {Object} creditCard - The target credit card
   * @param {Object} fundingAccount - The funding account
   * @returns {Array} Array of payment suggestions
   */
  generatePaymentSuggestions(creditCard, fundingAccount) {
    const suggestions = [];
    const debt = creditCard.balance;
    const available = fundingAccount.currentBalance;
    const minimum = getDefaultMinimumPaymentAmount(creditCard);

    // Only suggest if there's actual debt
    if (debt <= 0) {
      return [
        {
          type: 'info',
          label: 'No Payment Needed',
          amount: 0,
          description: 'This credit card has no outstanding balance',
        },
      ];
    }

    // Minimum payment suggestion
    if (minimum > 0 && minimum <= available) {
      suggestions.push({
        type: 'minimum',
        label: `Pay Minimum ($${minimum.toFixed(2)})`,
        amount: minimum,
        description: 'Meets minimum payment requirement',
      });
    }

    // Full balance suggestion (if affordable)
    if (debt <= available && debt !== minimum) {
      suggestions.push({
        type: 'full',
        label: `Pay Full Balance ($${debt.toFixed(2)})`,
        amount: debt,
        description: 'Pays off the entire debt',
      });
    }

    // Suggested "good" payment (between minimum and full)
    if (debt > minimum && minimum > 0) {
      const suggestedAmount = Math.min(minimum * 2, debt, available);
      if (suggestedAmount > minimum && suggestedAmount < debt) {
        suggestions.push({
          type: 'suggested',
          label: `Pay $${suggestedAmount.toFixed(2)}`,
          amount: suggestedAmount,
          description: 'Reduces debt faster than minimum',
        });
      }
    }

    // If no suggestions yet, at least show what they can afford
    if (suggestions.length === 0 && available > 0) {
      const affordableAmount = Math.min(available, debt);
      suggestions.push({
        type: 'affordable',
        label: `Pay $${affordableAmount.toFixed(2)}`,
        amount: affordableAmount,
        description:
          available >= debt
            ? 'Maximum affordable payment'
            : 'Uses all available funds',
      });
    }

    return suggestions;
  }
}

/**
 * Factory function to create PaymentService instance
 * This ensures we always have fresh account/credit card data
 *
 * @param {Array} accounts - Current accounts array
 * @param {Array} creditCards - Current credit cards array
 * @returns {PaymentService} New PaymentService instance
 */
export const createPaymentService = (accounts, creditCards) => {
  return new PaymentService(accounts, creditCards);
};

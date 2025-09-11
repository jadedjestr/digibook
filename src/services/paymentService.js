/**
 * Payment Service for Dual Foreign Key Architecture
 *
 * This service handles all payment processing logic for the new architecture
 * where expenses can be paid from either accounts or credit cards, but not both.
 *
 * Key Features:
 * - Processes regular expense payments (account or credit card)
 * - Handles credit card payments (two-field system: funding account → target credit card)
 * - Manages account balance updates
 * - Provides payment source information for UI display
 * - Maintains audit trails for all transactions
 */

import { dbHelpers } from '../db/database-clean';
import { logger } from '../utils/logger';
import {
  createPaymentSource,
  PaymentSourceTypes,
} from '../types/paymentSource';

export class PaymentService {
  constructor(accounts, creditCards) {
    this.accounts = accounts;
    this.creditCards = creditCards;
  }

  /**
   * Process payment for an expense with new architecture
   *
   * @param {Object} expense - The expense object
   * @param {number} newPaidAmount - New paid amount
   * @returns {Promise<void>}
   */
  async processExpensePayment(expense, newPaidAmount) {
    const paymentDifference = newPaidAmount - expense.paidAmount;

    if (paymentDifference === 0) {
      return; // No change in payment amount
    }

    try {
      if (expense.category === 'Credit Card Payment') {
        await this.processCreditCardPayment(expense, paymentDifference);
      } else {
        await this.processRegularExpensePayment(expense, paymentDifference);
      }

      logger.success(
        `Payment processed: $${paymentDifference} for ${expense.name}`
      );
    } catch (error) {
      logger.error('Payment processing failed:', error);
      throw error;
    }
  }

  /**
   * Handle credit card payment using two-field system
   * accountId = funding source (checking/savings)
   * targetCreditCardId = target credit card to pay down
   *
   * @param {Object} expense - Credit card payment expense
   * @param {number} paymentDifference - Amount being paid
   * @returns {Promise<void>}
   */
  async processCreditCardPayment(expense, paymentDifference) {
    const fundingAccount = this.accounts.find(
      acc => acc.id === expense.accountId
    );
    const targetCreditCard = this.creditCards.find(
      card => card.id === expense.targetCreditCardId
    );

    if (!fundingAccount) {
      throw new Error(`Funding account not found: ${expense.accountId}`);
    }
    if (!targetCreditCard) {
      throw new Error(
        `Target credit card not found: ${expense.targetCreditCardId}`
      );
    }

    // 1. Decrease funding account balance (money goes out)
    const newAccountBalance = fundingAccount.currentBalance - paymentDifference;
    await dbHelpers.updateAccount(fundingAccount.id, {
      currentBalance: newAccountBalance,
    });

    // 2. Decrease credit card balance (debt paid down)
    const newCreditCardBalance = targetCreditCard.balance - paymentDifference;
    await dbHelpers.updateCreditCard(targetCreditCard.id, {
      balance: newCreditCardBalance,
    });

    // 3. Create audit log for the transaction
    await dbHelpers.addAuditLog('PAYMENT', 'creditCardPayment', expense.id, {
      fundingAccountId: fundingAccount.id,
      fundingAccountName: fundingAccount.name,
      targetCreditCardId: targetCreditCard.id,
      targetCreditCardName: targetCreditCard.name,
      amount: paymentDifference,
      newAccountBalance,
      newCreditCardBalance,
      description: `Credit card payment: $${paymentDifference} from ${fundingAccount.name} to ${targetCreditCard.name}`,
    });

    logger.success(
      `Paid $${paymentDifference} to ${targetCreditCard.name} from ${fundingAccount.name}`
    );
  }

  /**
   * Handle regular expense payment (groceries, utilities, etc.)
   * Can be paid from either checking/savings account or credit card
   *
   * @param {Object} expense - Regular expense
   * @param {number} paymentDifference - Amount being paid
   * @returns {Promise<void>}
   */
  async processRegularExpensePayment(expense, paymentDifference) {
    if (expense.accountId) {
      // Paid from checking/savings account
      await this.processAccountPayment(expense, paymentDifference);
    } else if (expense.creditCardId) {
      // Paid with credit card (increases debt)
      await this.processCreditCardCharge(expense, paymentDifference);
    } else {
      throw new Error(
        `No payment source specified for expense: ${expense.name}`
      );
    }
  }

  /**
   * Process payment from checking/savings account
   *
   * @param {Object} expense - The expense
   * @param {number} paymentDifference - Amount being paid
   * @returns {Promise<void>}
   */
  async processAccountPayment(expense, paymentDifference) {
    const account = this.accounts.find(acc => acc.id === expense.accountId);
    if (!account) {
      throw new Error(`Account not found: ${expense.accountId}`);
    }

    const newBalance = account.currentBalance - paymentDifference;
    await dbHelpers.updateAccount(account.id, { currentBalance: newBalance });

    await dbHelpers.addAuditLog('PAYMENT', 'account', account.id, {
      expenseId: expense.id,
      expenseName: expense.name,
      amount: paymentDifference,
      newBalance,
      description: `Expense payment: ${expense.name} - $${paymentDifference}`,
    });

    logger.success(
      `Paid $${paymentDifference} for ${expense.name} from ${account.name}`
    );
  }

  /**
   * Process charge to credit card (increases debt)
   *
   * @param {Object} expense - The expense
   * @param {number} paymentDifference - Amount being charged
   * @returns {Promise<void>}
   */
  async processCreditCardCharge(expense, paymentDifference) {
    const creditCard = this.creditCards.find(
      card => card.id === expense.creditCardId
    );
    if (!creditCard) {
      throw new Error(`Credit card not found: ${expense.creditCardId}`);
    }

    const newBalance = creditCard.balance + paymentDifference; // Increase debt
    await dbHelpers.updateCreditCard(creditCard.id, { balance: newBalance });

    await dbHelpers.addAuditLog('PAYMENT', 'creditCard', creditCard.id, {
      expenseId: expense.id,
      expenseName: expense.name,
      amount: paymentDifference,
      newBalance,
      description: `Expense payment: ${expense.name} - $${paymentDifference} charged to card`,
    });

    logger.success(
      `Charged $${paymentDifference} for ${expense.name} to ${creditCard.name}`
    );
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
        card => card.id === expense.creditCardId
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
      acc => acc.id === expense.accountId
    );
    const targetCreditCard = this.creditCards.find(
      card => card.id === expense.targetCreditCardId
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
        card => card.id === expense.creditCardId
      );
      if (!creditCard) {
        errors.push(`Credit card with ID ${expense.creditCardId} not found`);
      }
    }

    // Check credit card payment specific validation
    if (expense.category === 'Credit Card Payment') {
      if (!expense.accountId) {
        errors.push(
          'Credit card payments must have funding account (accountId)'
        );
      }
      if (!expense.targetCreditCardId) {
        errors.push(
          'Credit card payments must have target credit card (targetCreditCardId)'
        );
      }
      if (expense.creditCardId) {
        errors.push(
          'Credit card payments cannot have creditCardId (use targetCreditCardId)'
        );
      }

      if (expense.targetCreditCardId) {
        const targetCard = this.creditCards.find(
          card => card.id === expense.targetCreditCardId
        );
        if (!targetCard) {
          errors.push(
            `Target credit card with ID ${expense.targetCreditCardId} not found`
          );
        }
      }
    }

    // Check for sufficient funds (warning, not error)
    if (expense.accountId && expense.paidAmount > 0) {
      const account = this.accounts.find(acc => acc.id === expense.accountId);
      if (account && account.currentBalance < expense.paidAmount) {
        warnings.push(
          `Insufficient funds in ${account.name}: $${account.currentBalance} available, $${expense.paidAmount} required`
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
      acc => acc.id === expense.accountId
    );
    const targetCreditCard = this.creditCards.find(
      card => card.id === expense.targetCreditCardId
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
        `Insufficient funds in ${fundingAccount.name}. Available: $${fundingAccount.currentBalance.toFixed(2)}, Required: $${paymentAmount.toFixed(2)}`
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
        `Payment exceeds current debt by $${overpayment.toFixed(2)}. This will create a credit balance on your ${targetCreditCard.name}.`
      );
    }

    // Zero balance warning
    if (targetCreditCard.balance <= 0) {
      result.warnings.push(
        `${targetCreditCard.name} already has a zero or credit balance. This payment will increase your credit balance.`
      );
    }

    // Generate payment suggestions
    result.suggestions = this.generatePaymentSuggestions(
      targetCreditCard,
      fundingAccount
    );

    // Payment info for UI display
    result.paymentInfo = {
      currentDebt: targetCreditCard.balance,
      minimumPayment: targetCreditCard.minimumPayment || 0,
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
    const minimum = creditCard.minimumPayment || 0;

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

/**
 * Utility function to create payment service from store
 *
 * @param {Object} store - Zustand store object
 * @returns {PaymentService} PaymentService instance
 */
export const createPaymentServiceFromStore = store => {
  return new PaymentService(store.accounts, store.creditCards);
};

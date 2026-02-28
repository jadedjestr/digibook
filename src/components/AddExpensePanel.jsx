import { X, CreditCard, PiggyBank, Building2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { dbHelpers } from '../db/database-clean';
import {
  createTemplate,
  generateNextOccurrence,
  preGenerateOccurrences,
} from '../services/recurringExpenseService';
import { DateUtils } from '../utils/dateUtils';
import {
  validatePaymentSource,
  validateCreditCardPayment,
} from '../utils/expenseValidation';
import { logger } from '../utils/logger';

import PaymentSourceSelector from './PaymentSourceSelector';
import RecurringExpenseModal from './RecurringExpenseModal';

const AddExpensePanel = ({
  isOpen,
  onClose,
  accounts,
  creditCards = [],
  onDataChange,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    dueDate: '',
    amount: '',
    paymentSource: null, // New structure: { type, accountId, creditCardId }
    category: '',
    targetCreditCardId: '', // For credit card payments only
  });
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  // Smart account filtering based on expense type
  const isCreditCardPayment = formData.category === 'Credit Card Payment';

  // Debug logging removed - accounts are working correctly

  const panelRef = useRef(null);
  const firstInputRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current.focus(), 100);
    }
  }, [isOpen]);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await dbHelpers.getCategories();
        setCategories(categoriesData);
      } catch (error) {
        logger.error('Error loading categories:', error);
      }
    };

    loadCategories();
  }, []);

  // Focus trap for modal
  useEffect(() => {
    if (!isOpen) return;

    const handleTabKey = e => {
      if (e.key === 'Tab') {
        const focusableElements = panelRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );

        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      // Store the current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      // Cleanup on unmount
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Reset form when panel opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        dueDate: '',
        amount: '',
        paymentSource: null,
        category: '',
      });
      setErrors({});
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = e => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleClose = () => {
    setFormData({
      name: '',
      dueDate: '',
      amount: '',
      paymentSource: null,
      category: '',
      targetCreditCardId: '',
    });
    setErrors({});
    setMakeRecurring(false);
    setShowRecurringModal(false);
    onClose();
  };

  const handleSaveRecurring = async recurringData => {
    try {
      // Validate the base expense data before creating the template
      if (!validateForm()) {
        throw new Error(
          'Please fix form errors before creating recurring template',
        );
      }

      // Build expense data (for validation only)
      const expenseData = {
        name: formData.name,
        dueDate: formData.dueDate,
        amount: parseFloat(formData.amount.toString().replace(/[$,]/g, '')),
        accountId: formData.paymentSource?.accountId || null,
        creditCardId: formData.paymentSource?.creditCardId || null,
        category: formData.category,
        status: 'pending',
        paidAmount: 0,
      };

      validatePaymentSource(expenseData);
      if (expenseData.category === 'Credit Card Payment') {
        validateCreditCardPayment(expenseData);
      }

      // Create recurring template with V4 format (template-first flow)
      const templateData = {
        name: recurringData.name,
        baseAmount: parseFloat(formData.amount.toString().replace(/[$,]/g, '')),
        frequency: recurringData.frequency,
        intervalValue: recurringData.intervalValue,
        intervalUnit: recurringData.intervalUnit || 'months',
        startDate: recurringData.startDate,
        endDate: recurringData.endDate || null,
        category: formData.category,
        accountId: formData.paymentSource?.accountId || null, // V4 format
        creditCardId: formData.paymentSource?.creditCardId || null,
        targetCreditCardId: formData.targetCreditCardId || null,
        notes: recurringData.notes,
        isVariableAmount: recurringData.isVariableAmount,
      };

      const templateId = await createTemplate(templateData);

      // If first occurrence is due now, generate via unified path
      const today = DateUtils.today();
      const isFirstDueNow =
        recurringData.startDate && recurringData.startDate <= today;

      let generatedExpenseId = null;
      if (isFirstDueNow) {
        try {
          generatedExpenseId = await generateNextOccurrence(templateId);
          logger.success(
            `Recurring expense created. First occurrence added for ${
              recurringData.startDate
            }.`,
          );
        } catch (error) {
          logger.warn(
            'Recurring template created but first occurrence not generated:',
            error,
          );
        }
      } else {
        logger.success(
          `Recurring expense created. First occurrence on ${
            recurringData.startDate
          }.`,
        );
      }

      // Pre-generate multiple occurrences (6 months ahead)
      try {
        const result = await preGenerateOccurrences(templateId, 6);
        if (result.generated > 0) {
          logger.success(
            `Pre-generated ${result.generated} future occurrences (6 months).`,
          );
        }
      } catch (error) {
        logger.warn('Could not pre-generate future occurrences:', error);

        // Don't fail the entire operation if pre-generation fails
      }

      // Close modal
      setShowRecurringModal(false);
      setMakeRecurring(false);
      handleClose();

      // Always call onDataChange after pre-generation to reload expenses
      // Pre-generation may have created multiple expenses, so we need to reload
      // Pass generatedExpenseId if available, otherwise pass a flag to indicate reload is needed
      if (onDataChange) {
        // Pass generatedExpenseId if available, else truthy to trigger reload
        onDataChange(generatedExpenseId || true);
      }
    } catch (error) {
      logger.error('Error creating recurring expense:', error);
      throw error;
    }
  };

  const handleInputChange = (field, value) => {
    // Reset payment source when switching TO credit card payment
    if (field === 'category') {
      const wasCreditCardPayment = formData.category === 'Credit Card Payment';
      const willBeCreditCardPayment = value === 'Credit Card Payment';

      // Reset only when switching TO "Credit Card Payment"
      if (!wasCreditCardPayment && willBeCreditCardPayment) {
        // Switching TO credit card payment - reset selection
        setFormData(prev => ({
          ...prev,
          [field]: value,
          paymentSource: null, // Reset payment source - need to pick funding account
          targetCreditCardId: '',
        }));
      } else {
        // Keep selection for other category changes
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else {
      // Simplified handling for other fields
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Handle payment source changes
  const handlePaymentSourceChange = paymentSource => {
    setFormData(prev => ({ ...prev, paymentSource }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.dueDate) newErrors.dueDate = 'Due date is required';

    // Improved amount validation for decimals
    const amountStr = formData.amount.toString().replace(/[$,]/g, ''); // Remove $ and commas
    const amountValue = parseFloat(amountStr);

    if (!formData.amount || isNaN(amountValue) || amountValue <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    // Payment source validation
    if (!formData.paymentSource) {
      newErrors.paymentSource = 'Payment source is required';
    }

    if (!formData.category) newErrors.category = 'Category is required';

    // For credit card payments, validate target credit card and funding source
    if (isCreditCardPayment) {
      if (!formData.targetCreditCardId) {
        newErrors.targetCreditCardId = 'Target credit card is required';
      }
      if (formData.paymentSource && formData.paymentSource.type !== 'account') {
        newErrors.paymentSource =
          'Credit card payments must be funded from checking/savings account';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    // If recurring is checked, don't save here - wait for modal
    if (makeRecurring) {
      return;
    }

    setIsSaving(true);
    try {
      const expenseData = {
        name: formData.name,
        dueDate: formData.dueDate,
        amount: parseFloat(formData.amount.toString().replace(/[$,]/g, '')),

        // New payment source structure
        accountId: formData.paymentSource?.accountId || null,
        creditCardId: formData.paymentSource?.creditCardId || null,
        category: formData.category,
        paidAmount: 0,
        status: 'pending',
        ...(isCreditCardPayment && {
          targetCreditCardId: formData.targetCreditCardId,
        }),
      };

      // Validate the expense data with our new validation functions
      validatePaymentSource(expenseData);
      if (isCreditCardPayment) {
        validateCreditCardPayment(expenseData);
      }

      const newExpenseId = await dbHelpers.addFixedExpenseV4(expenseData);

      // We don't update credit card balances when creating expenses.
      // Balances update when expenses are marked as paid.

      logger.success('Expense added successfully');
      onDataChange(newExpenseId);
      onClose();
    } catch (error) {
      logger.error('Error adding expense:', error);
      alert('Failed to add expense. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Debug logging for account selection issues (dev only)
  if (process.env.NODE_ENV === 'development' && formData.name === 'Claude') {
    logger.debug('🔍 AddExpensePanel Debug for Claude expense:', {
      category: formData.category,
      isCreditCardPayment,
      accountId: formData.accountId,
      targetCreditCardId: formData.targetCreditCardId,
      accountsCount: accounts?.length,
      creditCardsCount: creditCards?.length,
      shouldShowCreditCardSelector: isCreditCardPayment,
      accountSelectorMode: isCreditCardPayment
        ? 'checking/savings only'
        : 'all accounts',
      resetBehavior: 'Only reset when switching TO Credit Card Payment',
    });
  }

  const _getAccountIcon = accountType => {
    switch (accountType?.toLowerCase()) {
      case 'checking':
        return <CreditCard size={16} className='text-blue-400' />;
      case 'savings':
        return <PiggyBank size={16} className='text-green-400' />;
      default:
        return <Building2 size={16} className='text-purple-400' />;
    }
  };

  return (
    <>
      {/* Backdrop - rendered as portal to ensure full viewport coverage */}
      {isOpen &&
        createPortal(
          <div
            className='fixed bg-black/20 backdrop-blur-[2px] transition-opacity duration-[500ms] ease-[cubic-bezier(0.4,0,0.2,1)]'
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
              opacity: isOpen ? 1 : 0,
              pointerEvents: isOpen ? 'auto' : 'none',
              visibility: isOpen ? 'visible' : 'hidden',
            }}
            onClick={handleClose}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClose();
              }
            }}
            role='button'
            tabIndex={0}
            aria-label='Close panel'
          />,
          document.body,
        )}

      {/* Panel */}
      <div
        ref={panelRef}
        className='fixed top-0 right-0 h-full w-[450px] glass-panel glass-panel--elevated border-l border-white/20 shadow-[-8px_0_32px_rgba(0,0,0,0.3)] transform transition-all duration-[500ms] ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden'
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          boxSizing: 'border-box',
          right: '0px',
          zIndex: 10000,
          visibility: isOpen ? 'visible' : 'hidden',
        }}
      >
        {/* Header */}
        <div className='flex items-center justify-between p-8 border-b border-white/10'>
          <h2 className='text-xl font-semibold text-white'>Add New Expense</h2>
          <button
            onClick={handleClose}
            className='p-2 hover:bg-white/10 rounded-lg transition-colors'
          >
            <X size={20} className='text-white' />
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto p-8 space-y-6'>
          {/* Expense Name */}
          <div>
            <label
              htmlFor='add-expense-name'
              className='block text-sm font-medium text-white mb-2'
            >
              Expense Name
            </label>
            <input
              id='add-expense-name'
              ref={firstInputRef}
              type='text'
              value={formData.name}
              onChange={e => handleInputChange('name', e.target.value)}
              className='w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white placeholder-white/50'
              placeholder='Enter expense name'
            />
            {errors.name && (
              <p className='mt-1 text-sm text-red-400'>{errors.name}</p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label
              htmlFor='add-expense-due-date'
              className='block text-sm font-medium text-white mb-2'
            >
              Due Date
            </label>
            <input
              id='add-expense-due-date'
              type='date'
              value={formData.dueDate}
              onChange={e => handleInputChange('dueDate', e.target.value)}
              className='w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white'
            />
            {errors.dueDate && (
              <p className='mt-1 text-sm text-red-400'>{errors.dueDate}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor='add-expense-amount'
              className='block text-sm font-medium text-white mb-2'
            >
              Amount
            </label>
            <input
              id='add-expense-amount'
              type='number'
              step='0.01'
              min='0'
              value={formData.amount}
              onChange={e => handleInputChange('amount', e.target.value)}
              className='w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white placeholder-white/50'
              placeholder='0.00'
            />
            {errors.amount && (
              <p className='mt-1 text-sm text-red-400'>{errors.amount}</p>
            )}
          </div>

          {/* Category Selection - REQUIRED FIRST */}
          <div>
            <label
              htmlFor='add-expense-category'
              className='block text-sm font-medium text-white mb-2'
            >
              Category <span className='text-red-400'>*</span>
            </label>
            <select
              id='add-expense-category'
              value={formData.category}
              onChange={e => handleInputChange('category', e.target.value)}
              className='w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white'
            >
              <option value=''>Select category first...</option>
              {categories.map(category => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className='mt-1 text-sm text-red-400'>{errors.category}</p>
            )}
          </div>

          {/* Payment Source Selector - Only show after category is selected */}
          {formData.category && (
            <PaymentSourceSelector
              value={formData.paymentSource}
              onChange={handlePaymentSourceChange}
              accounts={accounts}
              creditCards={creditCards}
              isCreditCardPayment={isCreditCardPayment}
              label={
                isCreditCardPayment
                  ? 'Pay FROM (Funding Account)'
                  : 'Payment Source'
              }
              error={errors.paymentSource}
            />
          )}

          {/* Target Credit Card Selector - Only for Credit Card Payments */}
          {isCreditCardPayment && (
            <div>
              <label
                htmlFor='add-expense-target-credit-card'
                className='block text-sm font-medium text-white mb-2'
              >
                Pay TO (Target Credit Card)
              </label>
              <select
                id='add-expense-target-credit-card'
                value={formData.targetCreditCardId}
                onChange={e =>
                  handleInputChange('targetCreditCardId', e.target.value)
                }
                className='w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white'
              >
                <option value=''>Select credit card</option>
                {creditCards.map(card => (
                  <option key={card.id} value={card.id}>
                    {card.name} - Debt: $
                    {card.balance?.toLocaleString() || '0.00'}
                  </option>
                ))}
              </select>
              {errors.targetCreditCardId && (
                <p className='mt-1 text-sm text-red-400'>
                  {errors.targetCreditCardId}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='p-8 border-t border-white/10 space-y-3'>
          {/* Make Recurring Checkbox */}
          <div className='flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10'>
            <input
              type='checkbox'
              id='makeRecurring'
              checked={makeRecurring}
              onChange={e => {
                setMakeRecurring(e.target.checked);
                if (e.target.checked) {
                  // Validate form first before showing modal
                  const tempErrors = validateForm();
                  if (Object.keys(tempErrors).length === 0) {
                    setShowRecurringModal(true);
                  } else {
                    setErrors(tempErrors);
                    setMakeRecurring(false);
                  }
                }
              }}
              className='rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-500/30'
            />
            <label
              htmlFor='makeRecurring'
              className='text-white/90 font-medium cursor-pointer'
            >
              Make this expense recurring
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || makeRecurring}
            className='w-full px-6 py-4 glass-button glass-button--primary disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {(() => {
              if (isSaving) return 'Saving...';
              if (makeRecurring) return 'Configure recurring settings above';
              return 'Save Expense';
            })()}
          </button>
          <button
            onClick={handleClose}
            className='w-full px-6 py-4 glass-button glass-button--secondary'
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Recurring Expense Modal */}
      <RecurringExpenseModal
        isOpen={showRecurringModal}
        onClose={() => {
          setShowRecurringModal(false);
          setMakeRecurring(false);
        }}
        expenseData={formData}
        onSave={handleSaveRecurring}
      />
    </>
  );
};

AddExpensePanel.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  creditCards: PropTypes.arrayOf(PropTypes.object),
  onDataChange: PropTypes.func.isRequired,
};

export default AddExpensePanel;

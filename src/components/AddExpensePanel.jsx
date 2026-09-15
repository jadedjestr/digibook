import { DollarSign, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { calculateNextPayDates } from '../constants/payFrequency';
import { dbHelpers } from '../db/database-clean';
import {
  createTemplate,
  firstOccurrenceMaterializeThrough,
  generateNextOccurrence,
  getFrequencyLabel,
  FREQUENCY_OPTIONS,
} from '../services/recurringExpenseService';
import {
  useCategories,
  useFixedExpenses,
  usePaycheckSettings,
  useReloadAccounts,
} from '../stores/useAppStore';
import { createPaymentSource } from '../types/paymentSource';
import { DateUtils } from '../utils/dateUtils';
import {
  validatePaymentSource,
  validateCreditCardPayment,
} from '../utils/expenseValidation';
import { logger } from '../utils/logger';

import CreateAccountModal from './CreateAccountModal';
import PaymentSourceSelector from './PaymentSourceSelector';

const CREDIT_CARD_PAYMENT_CATEGORY = 'Credit Card Payment';
const RECENT_CATEGORY_LIMIT = 3;

const emptyFormData = () => ({
  name: '',
  dueDate: '',
  amount: '',
  paymentSource: null, // { type, accountId, creditCardId }
  category: '',
  targetCreditCardId: '', // For credit card payments only
});

const emptyRecurring = () => ({
  frequency: 'monthly',
  intervalValue: 1,
  intervalUnit: 'months',
  startDate: '',
  endDate: '',
  isVariableAmount: false,
  notes: '',
});

const AddExpensePanel = ({
  isOpen,
  onClose,
  accounts,
  creditCards = [],
  onDataChange,
}) => {
  // Pay cycle anchor: decides whether a brand-new recurring template's
  // first occurrence is materialized immediately (within the current pay
  // period, so it's actionable in the priority list and hero totals) or
  // left for the due-date sweep.
  const paycheckSettings = usePaycheckSettings();
  const [formData, setFormData] = useState(emptyFormData);
  const [isCreditCardPayment, setIsCreditCardPayment] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurring, setRecurring] = useState(emptyRecurring);
  const [showMoreRecurringOptions, setShowMoreRecurringOptions] =
    useState(false);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const categories = useCategories();
  const fixedExpenses = useFixedExpenses();
  const reloadAccounts = useReloadAccounts();

  const panelRef = useRef(null);
  const firstInputRef = useRef(null);

  const defaultAccount = useMemo(
    () => accounts.find(a => a.isDefault) ?? null,
    [accounts],
  );

  // The categories you've actually picked lately, most recent first - so
  // the common case is one tap instead of opening the full dropdown.
  // Credit Card Payment is excluded: it's driven by the toggle below now,
  // not a value you pick from this list.
  const recentCategories = useMemo(() => {
    const seen = new Set();
    const picks = [];
    const byRecency = [...fixedExpenses].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
    for (const expense of byRecency) {
      if (
        expense.category &&
        expense.category !== CREDIT_CARD_PAYMENT_CATEGORY &&
        !seen.has(expense.category)
      ) {
        seen.add(expense.category);
        picks.push(expense.category);
      }
      if (picks.length >= RECENT_CATEGORY_LIMIT) break;
    }
    return picks;
  }, [fixedExpenses]);

  const categoryIcon = useCallback(
    name => categories.find(c => c.name === name)?.icon ?? '',
    [categories],
  );

  // Focus management
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current.focus(), 100);
    }
  }, [isOpen]);

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

  // No manual body scroll-lock here - this used to force `document.body`
  // itself into `position: fixed`, which is a real, unique difference from
  // every other modal in the app (none of them touch body's own styles).
  // `position: fixed` always promotes an element to its own compositing
  // layer, and this was the one place that was happening on <body> - the
  // ancestor of everything - at the exact moment a blurred modal opened on
  // top of it. The outer wrapper's own `overflow-y-auto` already keeps the
  // modal itself scrollable without needing to touch the page underneath,
  // same as CreateAccountModal/AddPendingTransactionModal.

  // Reset form when the panel opens, defaulting Due Date to today and
  // Payment Source to the default account. Also re-runs if defaultAccount
  // shows up while isOpen is already true - that only happens right after
  // the no-default-account gate below creates one, at which point this
  // form hasn't rendered yet, so there's nothing in-progress to clobber.
  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...emptyFormData(),
        dueDate: DateUtils.today(),
        paymentSource: defaultAccount
          ? createPaymentSource.account(defaultAccount.id)
          : null,
      });
      setIsCreditCardPayment(false);
      setIsRecurring(false);
      setRecurring(emptyRecurring());
      setShowMoreRecurringOptions(false);
      setErrors({});
    }

    // Deliberately keyed on defaultAccount?.id, not the object: accounts
    // re-renders with a new object identity on every store update, and this
    // reset must only fire on open or on the account's identity changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultAccount?.id]);

  const handleClose = useCallback(() => {
    setFormData(emptyFormData());
    setIsCreditCardPayment(false);
    setIsRecurring(false);
    setRecurring(emptyRecurring());
    setShowMoreRecurringOptions(false);
    setErrors({});
    onClose();
  }, [onClose]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = e => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  const effectiveCategory = isCreditCardPayment
    ? CREDIT_CARD_PAYMENT_CATEGORY
    : formData.category;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCreditCardToggle = next => {
    setIsCreditCardPayment(next);
    if (!next) {
      // Target card only means something in credit-card-payment mode.
      // Payment Source stays as-is: every account in this app is a
      // checking/savings account, so the current selection is still a
      // valid funding source either way - only credit cards themselves
      // get filtered out of that picker while the toggle is on.
      setFormData(prev => ({ ...prev, targetCreditCardId: '' }));
    }
    setErrors(prev => ({ ...prev, category: '', targetCreditCardId: '' }));
  };

  const handleRecurringToggle = next => {
    setIsRecurring(next);
    if (next) {
      setRecurring(prev => ({
        ...prev,
        startDate: prev.startDate || formData.dueDate || DateUtils.today(),
      }));
    }
    setErrors(prev => ({
      ...prev,
      frequency: '',
      intervalValue: '',
      startDate: '',
      endDate: '',
    }));
  };

  const updateRecurring = (field, value) => {
    setRecurring(prev => ({ ...prev, [field]: value }));
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

    if (!isCreditCardPayment && !formData.category) {
      newErrors.category = 'Category is required';
    }

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

    if (isRecurring) {
      if (!recurring.frequency) newErrors.frequency = 'Frequency is required';
      if (
        recurring.frequency === 'custom' &&
        (!recurring.intervalValue || recurring.intervalValue < 1)
      ) {
        newErrors.intervalValue = 'Interval must be at least 1';
      }
      if (!recurring.startDate) {
        newErrors.startDate = 'Start date is required';
      } else if (!DateUtils.isValidDate(recurring.startDate)) {
        newErrors.startDate = 'Invalid date format';
      }
      if (recurring.endDate) {
        if (!DateUtils.isValidDate(recurring.endDate)) {
          newErrors.endDate = 'Invalid date format';
        } else {
          const start = DateUtils.parseDate(recurring.startDate);
          const end = DateUtils.parseDate(recurring.endDate);
          if (start && end && end < start) {
            newErrors.endDate = 'End date must be after start date';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const parsedAmount = parseFloat(
        formData.amount.toString().replace(/[$,]/g, ''),
      );
      const expenseData = {
        name: formData.name,
        dueDate: formData.dueDate,
        amount: parsedAmount,

        // New payment source structure
        accountId: formData.paymentSource?.accountId || null,
        creditCardId: formData.paymentSource?.creditCardId || null,
        category: effectiveCategory,
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

      if (isRecurring) {
        // Create recurring template with V4 format (template-first flow)
        const templateData = {
          name: formData.name,
          baseAmount: parsedAmount,
          frequency: recurring.frequency,
          intervalValue: recurring.intervalValue,
          intervalUnit: recurring.intervalUnit || 'months',
          startDate: recurring.startDate,
          endDate: recurring.endDate || null,
          category: effectiveCategory,
          accountId: formData.paymentSource?.accountId || null,
          creditCardId: formData.paymentSource?.creditCardId || null,
          targetCreditCardId: formData.targetCreditCardId || null,
          notes: recurring.notes,
          isVariableAmount: recurring.isVariableAmount,
        };

        const templateId = await createTemplate(templateData);

        // Materialize the first occurrence immediately when it lands within
        // the current pay period, so it is actionable in the priority list
        // and hero totals instead of existing only as a virtual calendar
        // forecast. Without paycheck settings there is no pay period to
        // anchor to - fall back to the old due-date-only behaviour.
        const today = DateUtils.today();
        const materializeThrough = firstOccurrenceMaterializeThrough(
          calculateNextPayDates(
            paycheckSettings?.lastPaycheckDate,
            paycheckSettings?.frequency,
          ).nextPayDate,
          today,
        );
        let generatedExpenseId = null;
        if (recurring.startDate && recurring.startDate <= materializeThrough) {
          try {
            generatedExpenseId = await generateNextOccurrence(templateId, {
              allowFuture: true,
            });
            logger.success(
              `Recurring expense created. First occurrence added for ${recurring.startDate}.`,
            );
          } catch (error) {
            logger.warn(
              'Recurring template created but first occurrence not generated:',
              error,
            );
          }
        } else {
          logger.success(
            `Recurring expense created. First occurrence on ${recurring.startDate}.`,
          );
        }

        onDataChange(generatedExpenseId || true);
      } else {
        const newExpenseId = await dbHelpers.addFixedExpenseV4(expenseData);

        // We don't update credit card balances when creating expenses.
        // Balances update when expenses are marked as paid.
        logger.success('Expense added successfully');
        onDataChange(newExpenseId);
      }

      onClose();
    } catch (error) {
      logger.error('Error adding expense:', error);
      alert('Failed to add expense. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // No default account exists (the app only auto-assigns one when at
  // least one account already does - see dbHelpers.ensureDefaultAccount).
  // An expense has to be paid from somewhere, so gate on creating one
  // first rather than opening a form with no valid payment source at all.
  // Same reusable modal CreditCards.jsx already uses for the equivalent
  // "need a funding account first" moment.
  if (!defaultAccount) {
    return (
      <CreateAccountModal
        isOpen={isOpen}
        onClose={onClose}
        onAccountCreated={reloadAccounts}
        description="Add an account first so there's somewhere for this expense to come from. You'll come right back here to finish adding the expense."
      />
    );
  }

  const selectedAmount = parseFloat(
    formData.amount.toString().replace(/[$,]/g, ''),
  );
  const canPreview =
    formData.name.trim() &&
    !isNaN(selectedAmount) &&
    selectedAmount > 0 &&
    (isCreditCardPayment ? formData.targetCreditCardId : formData.category);
  const previewAccountName =
    formData.paymentSource?.type === 'account'
      ? accounts.find(a => a.id === formData.paymentSource.accountId)?.name
      : null;
  const previewCardName = isCreditCardPayment
    ? creditCards.find(c => c.id === formData.targetCreditCardId)?.name
    : null;

  // A one-line description of the repeat cadence, e.g. "Repeats monthly"
  // or "Repeats every 2 weeks until Dec 1, 2026" - mirrors what
  // RecurringExpenseModal used to show, now computed for the inline fields.
  let recurringDescription = '';
  if (isRecurring) {
    if (recurring.frequency === 'custom') {
      const unitLabel =
        { days: 'day', weeks: 'week', months: 'month', years: 'year' }[
          recurring.intervalUnit
        ] || 'month';
      const plural = recurring.intervalValue > 1 ? 's' : '';
      recurringDescription = `Repeats every ${recurring.intervalValue} ${unitLabel}${plural}`;
    } else {
      const label = getFrequencyLabel(recurring.frequency);
      recurringDescription = label ? `Repeats ${label.toLowerCase()}` : '';
    }
    if (recurring.endDate) {
      recurringDescription += ` until ${DateUtils.formatShortDate(recurring.endDate)}`;
    }
  }

  return (
    <>
      {/* Single portal wrapping both backdrop and panel, matching every
          other modal in the app (CreateAccountModal, RecurringExpenseModal,
          etc). This used to be two separate fixed-position portals, and was
          also the only full-viewport-height, edge-pinned surface in the
          app - a dramatically larger blurred area than any other modal's
          centered max-w card. Both were plausible contributors to a
          confirmed Safari 18/macOS 15 backdrop-filter rendering bug
          (https://discussions.apple.com/thread/255764118); matching the
          smaller, single-portal shape every other modal already uses rules
          out both at once rather than guessing which one mattered. */}
      {createPortal(
        <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto my-auto'>
          <div
            className='absolute inset-0 bg-black/60'
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
          />

          <div
            ref={panelRef}
            className='relative w-full max-w-lg mx-auto glass-panel glass-surface glass-surface--elevated max-h-[90vh] flex flex-col'
          >
            {/* Header */}
            <div className='flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0'>
              <h2 className='text-xl font-semibold text-white'>
                Add New Expense
              </h2>
              <button
                onClick={handleClose}
                className='p-2 hover:bg-white/10 rounded-lg transition-colors'
              >
                <X size={20} className='text-white' />
              </button>
            </div>

            {/* Content */}
            <div className='flex-1 overflow-y-auto p-6 space-y-5'>
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

              {/* Amount - hero field */}
              <div>
                <label
                  htmlFor='add-expense-amount'
                  className='block text-sm font-medium text-white mb-2'
                >
                  Amount
                </label>
                <div className='relative'>
                  <DollarSign
                    size={20}
                    className='absolute left-4 top-1/2 -translate-y-1/2 text-white/40'
                  />
                  <input
                    id='add-expense-amount'
                    type='number'
                    inputMode='decimal'
                    step='0.01'
                    min='0'
                    value={formData.amount}
                    onChange={e => handleInputChange('amount', e.target.value)}
                    className='w-full pl-11 pr-5 py-4 glass-input rounded-2xl text-center text-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white placeholder-white/50'
                    placeholder='0.00'
                  />
                </div>
                {errors.amount && (
                  <p className='mt-1 text-sm text-red-400'>{errors.amount}</p>
                )}
              </div>

              {/* Category - recent picks first, full list always available.
                  Hidden while paying down a credit card: that toggle sets
                  the category implicitly, so picking one here too would
                  just be a second, conflicting answer to the same question. */}
              {!isCreditCardPayment && (
                <div>
                  <label
                    htmlFor='add-expense-category'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Category <span className='text-red-400'>*</span>
                  </label>
                  {recentCategories.length > 0 && (
                    <div className='flex flex-wrap gap-2 mb-2'>
                      {recentCategories.map(name => (
                        <button
                          key={name}
                          type='button'
                          onClick={() => handleInputChange('category', name)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                            formData.category === name
                              ? 'bg-orange-500/20 border-orange-400/40 text-orange-200'
                              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {categoryIcon(name)} {name}
                        </button>
                      ))}
                    </div>
                  )}
                  <select
                    id='add-expense-category'
                    value={formData.category}
                    onChange={e =>
                      handleInputChange('category', e.target.value)
                    }
                    className='w-full px-5 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white'
                  >
                    <option value=''>Select a category...</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.name}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className='mt-1 text-sm text-red-400'>
                      {errors.category}
                    </p>
                  )}
                </div>
              )}

              {/* Credit card payment toggle - an explicit switch instead of
                  a hidden category value, so it's visible and it works. */}
              <button
                type='button'
                onClick={() => handleCreditCardToggle(!isCreditCardPayment)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
                  isCreditCardPayment
                    ? 'bg-orange-500/15 border-orange-400/40'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <span
                  className={`text-sm font-medium ${isCreditCardPayment ? 'text-orange-200' : 'text-white/80'}`}
                >
                  💳 This pays down a credit card
                </span>
                <span
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                    isCreditCardPayment ? 'bg-orange-400' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      isCreditCardPayment ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>

              {/* Due Date + Payment Source - always visible together, not
                  gated behind Category, and pre-filled with today and your
                  default account so the common case needs no input here. */}
              <div className='grid grid-cols-2 gap-3'>
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
                    className='w-full px-4 py-4 glass-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white'
                  />
                  {errors.dueDate && (
                    <p className='mt-1 text-sm text-red-400'>
                      {errors.dueDate}
                    </p>
                  )}
                </div>
                <div>
                  <PaymentSourceSelector
                    value={formData.paymentSource}
                    onChange={handlePaymentSourceChange}
                    accounts={accounts}
                    creditCards={creditCards}
                    isCreditCardPayment={isCreditCardPayment}
                    label={isCreditCardPayment ? 'Pay From' : 'Payment Source'}
                    error={errors.paymentSource}
                  />
                </div>
              </div>

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

              {/* Recurring - toggle reveals Frequency + Start Date inline,
                  right here, instead of opening a second modal. The
                  less-common fields (End Date, Notes, Variable Amount) are
                  tucked under "More options" since most recurring expenses
                  never need them. */}
              <div>
                <button
                  type='button'
                  onClick={() => handleRecurringToggle(!isRecurring)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    isRecurring
                      ? 'bg-orange-500/15 border-orange-400/40'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${isRecurring ? 'text-orange-200' : 'text-white/80'}`}
                  >
                    🔁 Make this recurring
                  </span>
                  <span
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                      isRecurring ? 'bg-orange-400' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                        isRecurring ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>

                {isRecurring && (
                  <div className='mt-3 p-4 rounded-xl bg-black/20 border border-dashed border-white/15 space-y-4'>
                    <div className='grid grid-cols-2 gap-3'>
                      <div>
                        <label
                          htmlFor='add-expense-frequency'
                          className='block text-sm font-medium text-white mb-2'
                        >
                          Repeats
                        </label>
                        <select
                          id='add-expense-frequency'
                          value={recurring.frequency}
                          onChange={e =>
                            updateRecurring('frequency', e.target.value)
                          }
                          className='w-full px-4 py-3 glass-input rounded-xl text-white'
                        >
                          {FREQUENCY_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {errors.frequency && (
                          <p className='mt-1 text-sm text-red-400'>
                            {errors.frequency}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor='add-expense-start-date'
                          className='block text-sm font-medium text-white mb-2'
                        >
                          Starts
                        </label>
                        <input
                          id='add-expense-start-date'
                          type='date'
                          value={recurring.startDate}
                          onChange={e =>
                            updateRecurring('startDate', e.target.value)
                          }
                          className='w-full px-4 py-3 glass-input rounded-xl text-white'
                        />
                        {errors.startDate && (
                          <p className='mt-1 text-sm text-red-400'>
                            {errors.startDate}
                          </p>
                        )}
                      </div>
                    </div>

                    {recurring.frequency === 'custom' && (
                      <div>
                        <label
                          htmlFor='add-expense-interval-value'
                          className='block text-sm font-medium text-white mb-2'
                        >
                          Repeat every
                        </label>
                        <div className='flex gap-2'>
                          <input
                            id='add-expense-interval-value'
                            type='number'
                            inputMode='numeric'
                            min='1'
                            value={recurring.intervalValue}
                            onChange={e =>
                              updateRecurring(
                                'intervalValue',
                                parseInt(e.target.value, 10) || 1,
                              )
                            }
                            className='flex-1 px-4 py-3 glass-input rounded-xl text-white'
                          />
                          <select
                            value={recurring.intervalUnit}
                            onChange={e =>
                              updateRecurring('intervalUnit', e.target.value)
                            }
                            className='px-4 py-3 glass-input rounded-xl text-white'
                          >
                            <option value='days'>Days</option>
                            <option value='weeks'>Weeks</option>
                            <option value='months'>Months</option>
                            <option value='years'>Years</option>
                          </select>
                        </div>
                        {errors.intervalValue && (
                          <p className='mt-1 text-sm text-red-400'>
                            {errors.intervalValue}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type='button'
                      onClick={() => setShowMoreRecurringOptions(v => !v)}
                      className='text-xs text-white/50 hover:text-white/70 transition-colors'
                    >
                      {showMoreRecurringOptions
                        ? '⌃ Fewer options'
                        : '⌄ More options (end date, notes, variable amount)'}
                    </button>

                    {showMoreRecurringOptions && (
                      <div className='space-y-4 pt-1'>
                        <div>
                          <label
                            htmlFor='add-expense-end-date'
                            className='block text-sm font-medium text-white mb-2'
                          >
                            End Date{' '}
                            <span className='text-white/50 text-xs'>
                              (optional)
                            </span>
                          </label>
                          <input
                            id='add-expense-end-date'
                            type='date'
                            value={recurring.endDate}
                            onChange={e =>
                              updateRecurring('endDate', e.target.value)
                            }
                            min={recurring.startDate || undefined}
                            className='w-full px-4 py-3 glass-input rounded-xl text-white'
                          />
                          {errors.endDate && (
                            <p className='mt-1 text-sm text-red-400'>
                              {errors.endDate}
                            </p>
                          )}
                        </div>
                        <div className='flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10'>
                          <input
                            type='checkbox'
                            id='isVariableAmount'
                            checked={recurring.isVariableAmount}
                            onChange={e =>
                              updateRecurring(
                                'isVariableAmount',
                                e.target.checked,
                              )
                            }
                            className='rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500/30'
                          />
                          <label
                            htmlFor='isVariableAmount'
                            className='text-white/90 text-sm font-medium cursor-pointer'
                          >
                            Variable amount (amount may change)
                          </label>
                        </div>
                        <div>
                          <label
                            htmlFor='add-expense-notes'
                            className='block text-sm font-medium text-white mb-2'
                          >
                            Notes{' '}
                            <span className='text-white/50 text-xs'>
                              (optional)
                            </span>
                          </label>
                          <textarea
                            id='add-expense-notes'
                            value={recurring.notes}
                            onChange={e =>
                              updateRecurring('notes', e.target.value)
                            }
                            rows='2'
                            className='w-full px-4 py-3 glass-input rounded-xl text-white resize-none'
                            placeholder='Additional notes about this recurring expense...'
                          />
                        </div>
                      </div>
                    )}

                    {recurringDescription && (
                      <p className='text-xs text-orange-200/80'>
                        {recurringDescription}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className='flex items-start gap-2 rounded-lg border border-dashed border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/70'>
                <span className='mt-0.5'>🧾</span>
                {canPreview ? (
                  <span>
                    <span className='text-white font-medium'>
                      ${selectedAmount.toFixed(2)}
                    </span>{' '}
                    {isCreditCardPayment ? (
                      <>
                        toward{' '}
                        <span className='text-white'>{previewCardName}</span>
                      </>
                    ) : (
                      <>
                        for{' '}
                        <span className='text-white'>{formData.category}</span>
                      </>
                    )}
                    {previewAccountName && (
                      <>
                        {' '}
                        from{' '}
                        <span className='text-white'>{previewAccountName}</span>
                      </>
                    )}
                    {formData.dueDate && (
                      <>
                        {' '}
                        · due{' '}
                        <span className='text-white'>
                          {DateUtils.formatShortDate(formData.dueDate)}
                        </span>
                      </>
                    )}
                    {isRecurring && recurringDescription && (
                      <>
                        {' '}
                        ·{' '}
                        <span className='text-white'>
                          {recurringDescription}
                        </span>
                      </>
                    )}
                    .
                  </span>
                ) : (
                  <span>
                    It&apos;ll appear as a pending fixed expense until you mark
                    it paid.
                  </span>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className='p-6 border-t border-white/10 space-y-3 flex-shrink-0'>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className='w-full px-6 py-4 glass-button glass-button--primary disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {isSaving ? 'Saving...' : 'Save Expense'}
              </button>
              <button
                onClick={handleClose}
                className='w-full px-6 py-4 glass-button glass-button--secondary'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
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

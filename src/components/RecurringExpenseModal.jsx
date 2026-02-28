import { X, Clock, Calendar, DollarSign } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { dbHelpers } from '../db/database-clean';
import { FREQUENCY_OPTIONS } from '../services/recurringExpenseService';
import { createPaymentSource } from '../types/paymentSource';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';

import PaymentSourceSelector from './PaymentSourceSelector';

/**
 * Modal for configuring recurring expense settings
 * Supports both create and edit modes
 */
const RecurringExpenseModal = ({
  isOpen,
  onClose,
  expenseData,
  onSave,
  mode = 'create',
  templateId: _templateId = null,
  initialData = null,
  onPause = null,
  onDelete = null,
  accounts = [],
  creditCards = [],
}) => {
  const [recurringData, setRecurringData] = useState({
    name: '',
    amount: '',
    category: '',
    paymentSource: null,
    targetCreditCardId: '', // For credit card payments
    frequency: 'monthly',
    intervalValue: 1,
    intervalUnit: 'months',
    startDate: '',
    endDate: '',
    isVariableAmount: false,
    notes: '',
  });

  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Use static constant directly - no service instantiation needed
  const frequencyOptions = FREQUENCY_OPTIONS;

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

    if (mode === 'edit') {
      loadCategories();
    }
  }, [mode]);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        // Edit mode: prefill from template
        // Create payment source from template data (templates have same structure as expenses)
        const paymentSource = createPaymentSource.fromExpense(initialData);

        setRecurringData({
          name: initialData.name || '',
          amount: initialData.baseAmount?.toString() || '',
          category: initialData.category || '',
          paymentSource,
          targetCreditCardId: initialData.targetCreditCardId || '', // For credit card payments
          frequency: initialData.frequency || 'monthly',
          intervalValue: initialData.intervalValue || 1,
          intervalUnit: initialData.intervalUnit || 'months',
          startDate: initialData.startDate || DateUtils.today(),
          endDate: initialData.endDate || '',
          isVariableAmount: initialData.isVariableAmount || false,
          notes: initialData.notes || '',
        });
      } else if (expenseData) {
        // Create mode: prefill from expense data
        setRecurringData({
          name: expenseData.name || '',
          frequency: 'monthly',
          intervalValue: 1,
          intervalUnit: 'months',
          startDate: expenseData.dueDate || DateUtils.today(),
          endDate: '',
          isVariableAmount: false,
          notes: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, expenseData, mode, initialData]);

  const validateForm = () => {
    const newErrors = {};

    if (!recurringData.name.trim()) {
      newErrors.name = 'Template name is required';
    }

    // In edit mode, validate amount, category, and payment source
    if (mode === 'edit') {
      if (!recurringData.amount || parseFloat(recurringData.amount) <= 0) {
        newErrors.amount = 'Amount must be greater than 0';
      }

      if (!recurringData.category) {
        newErrors.category = 'Category is required';
      }

      if (!recurringData.paymentSource) {
        newErrors.paymentSource = 'Payment source is required';
      }
    }

    if (!recurringData.frequency) {
      newErrors.frequency = 'Frequency is required';
    }

    if (recurringData.frequency === 'custom') {
      if (!recurringData.intervalValue || recurringData.intervalValue < 1) {
        newErrors.intervalValue = 'Interval must be at least 1';
      }
    }

    if (!recurringData.startDate) {
      newErrors.startDate = 'Start date is required';
    } else if (!DateUtils.isValidDate(recurringData.startDate)) {
      newErrors.startDate = 'Invalid date format';
    }

    // Validate end date if provided
    if (recurringData.endDate) {
      if (!DateUtils.isValidDate(recurringData.endDate)) {
        newErrors.endDate = 'Invalid date format';
      } else {
        const startDate = DateUtils.parseDate(recurringData.startDate);
        const endDate = DateUtils.parseDate(recurringData.endDate);
        if (startDate && endDate && endDate < startDate) {
          newErrors.endDate = 'End date must be after start date';
        }
      }
    }

    return newErrors;
  };

  const handleSave = async () => {
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(recurringData);
      handleClose();
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setRecurringData({
      name: '',
      amount: '',
      category: '',
      paymentSource: null,
      frequency: 'monthly',
      intervalValue: 1,
      intervalUnit: 'months',
      startDate: '',
      endDate: '',
      isVariableAmount: false,
      notes: '',
    });
    setErrors({});
    onClose();
  };

  const updateRecurringData = (field, value) => {
    setRecurringData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const getFrequencyDescription = () => {
    let description = '';
    switch (recurringData.frequency) {
      case 'monthly':
        description = 'This expense will repeat every month';
        break;
      case 'quarterly':
        description = 'This expense will repeat every 3 months';
        break;
      case 'biannually':
        description = 'This expense will repeat every 6 months';
        break;
      case 'annually':
        description = 'This expense will repeat every year';
        break;
      case 'custom': {
        const unitMap = {
          days: 'day',
          weeks: 'week',
          months: 'month',
          years: 'year',
        };
        const unitLabel = unitMap[recurringData.intervalUnit] || 'month';
        const plural = recurringData.intervalValue > 1 ? 's' : '';
        description = `This expense will repeat every ${recurringData.intervalValue} ${unitLabel}${plural}`;
        break;
      }
      default:
        description = '';
        break;
    }

    // Add end date info if present
    if (recurringData.endDate) {
      const endDateDisplay = DateUtils.formatDisplayDate(recurringData.endDate);
      description += ` until ${endDateDisplay}`;
    }

    return description;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto my-auto'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/60 backdrop-blur-sm'
        onClick={handleClose}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClose();
          }
        }}
        role='button'
        tabIndex={0}
        aria-label='Close modal'
      />

      {/* Modal */}
      <div className='relative w-full max-w-md mx-auto glass-panel glass-surface glass-surface--elevated max-h-[90vh] flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0'>
          <div className='flex items-center gap-3'>
            <div className='p-2 rounded-lg bg-amber-500/20 text-amber-300'>
              <Clock size={20} />
            </div>
            <h2 className='text-xl font-semibold text-white'>
              {mode === 'edit' ? 'Edit Recurring Template' : 'Make Recurring'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className='p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors'
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className='p-6 space-y-6 overflow-y-auto flex-1 min-h-0'>
          {/* Amount - Only in edit mode */}
          {mode === 'edit' && (
            <div>
              <label
                htmlFor='recurring-modal-amount'
                className='block text-sm font-medium text-white/90 mb-2'
              >
                Amount <span className='text-red-400'>*</span>
              </label>
              <div className='relative'>
                <DollarSign
                  size={18}
                  className='absolute left-3 top-1/2 -translate-y-1/2 text-white/40'
                />
                <input
                  id='recurring-modal-amount'
                  type='number'
                  step='0.01'
                  min='0'
                  value={recurringData.amount}
                  onChange={e => updateRecurringData('amount', e.target.value)}
                  className='w-full pl-10 pr-4 py-3 glass-input'
                  placeholder='0.00'
                />
              </div>
              {errors.amount && (
                <p className='mt-1 text-sm text-red-400'>{errors.amount}</p>
              )}
            </div>
          )}

          {/* Category - Only in edit mode */}
          {mode === 'edit' && (
            <div>
              <label
                htmlFor='recurring-modal-category'
                className='block text-sm font-medium text-white/90 mb-2'
              >
                Category <span className='text-red-400'>*</span>
              </label>
              <select
                id='recurring-modal-category'
                value={recurringData.category}
                onChange={e => updateRecurringData('category', e.target.value)}
                className='w-full px-4 py-3 glass-input'
              >
                <option value=''>Select category...</option>
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
          )}

          {/* Payment Source - Only in edit mode */}
          {mode === 'edit' && recurringData.category && (
            <div>
              <PaymentSourceSelector
                value={recurringData.paymentSource}
                onChange={paymentSource =>
                  updateRecurringData('paymentSource', paymentSource)
                }
                accounts={accounts}
                creditCards={creditCards}
                isCreditCardPayment={
                  recurringData.category === 'Credit Card Payment'
                }
                placeholder='Select payment source...'
                error={errors.paymentSource}
                label='Payment Source *'
              />
            </div>
          )}

          {/* Template Name */}
          <div>
            <label
              htmlFor='recurring-modal-name'
              className='block text-sm font-medium text-white/90 mb-2'
            >
              Template Name
            </label>
            <div className='relative'>
              <DollarSign
                size={18}
                className='absolute left-3 top-1/2 -translate-y-1/2 text-white/40'
              />
              <input
                id='recurring-modal-name'
                type='text'
                value={recurringData.name}
                onChange={e => updateRecurringData('name', e.target.value)}
                className='w-full pl-10 pr-4 py-3 glass-input'
                placeholder='e.g., Car Insurance Premium'
              />
            </div>
            {errors.name && (
              <p className='mt-1 text-sm text-red-400'>{errors.name}</p>
            )}
          </div>

          {/* Frequency */}
          <div>
            <label
              htmlFor='recurring-modal-frequency'
              className='block text-sm font-medium text-white/90 mb-2'
            >
              Repeat Frequency
            </label>
            <select
              id='recurring-modal-frequency'
              value={recurringData.frequency}
              onChange={e => updateRecurringData('frequency', e.target.value)}
              className='w-full px-4 py-3 glass-input'
            >
              {frequencyOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.frequency && (
              <p className='mt-1 text-sm text-red-400'>{errors.frequency}</p>
            )}
          </div>

          {/* Custom Interval */}
          {recurringData.frequency === 'custom' && (
            <div>
              <label
                htmlFor='recurring-modal-interval-value'
                className='block text-sm font-medium text-white/90 mb-2'
              >
                Repeat Every
              </label>
              <div className='flex gap-2'>
                <input
                  id='recurring-modal-interval-value'
                  type='number'
                  min='1'
                  max={(() => {
                    const u = recurringData.intervalUnit;
                    if (u === 'days') return '365';
                    if (u === 'weeks') return '52';
                    if (u === 'months') return '60';
                    if (u === 'years') return '20';
                    return '10';
                  })()}
                  value={recurringData.intervalValue}
                  onChange={e =>
                    updateRecurringData(
                      'intervalValue',
                      parseInt(e.target.value) || 1,
                    )
                  }
                  className='flex-1 px-4 py-3 glass-input'
                  placeholder='Number'
                />
                <select
                  value={recurringData.intervalUnit}
                  onChange={e =>
                    updateRecurringData('intervalUnit', e.target.value)
                  }
                  className='px-4 py-3 glass-input'
                  style={{ minWidth: '120px' }}
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

          {/* Start Date */}
          <div>
            <label
              htmlFor='recurring-modal-start-date'
              className='block text-sm font-medium text-white/90 mb-2'
            >
              Start Date
            </label>
            <div className='relative'>
              <Calendar
                size={18}
                className='absolute left-3 top-1/2 -translate-y-1/2 text-white/40'
              />
              <input
                id='recurring-modal-start-date'
                type='date'
                value={recurringData.startDate}
                onChange={e => updateRecurringData('startDate', e.target.value)}
                className='w-full pl-10 pr-4 py-3 glass-input'
              />
            </div>
            {errors.startDate && (
              <p className='mt-1 text-sm text-red-400'>{errors.startDate}</p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label
              htmlFor='recurring-modal-end-date'
              className='block text-sm font-medium text-white/90 mb-2'
            >
              End Date <span className='text-white/60 text-xs'>(optional)</span>
            </label>
            <div className='relative'>
              <Calendar
                size={18}
                className='absolute left-3 top-1/2 -translate-y-1/2 text-white/40'
              />
              <input
                id='recurring-modal-end-date'
                type='date'
                value={recurringData.endDate}
                onChange={e => updateRecurringData('endDate', e.target.value)}
                min={recurringData.startDate || undefined}
                className='w-full pl-10 pr-4 py-3 glass-input'
                placeholder='Leave empty for no end date'
              />
            </div>
            {errors.endDate && (
              <p className='mt-1 text-sm text-red-400'>{errors.endDate}</p>
            )}
          </div>

          {/* Variable Amount Option */}
          <div className='flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10'>
            <input
              type='checkbox'
              id='variableAmount'
              checked={recurringData.isVariableAmount}
              onChange={e =>
                updateRecurringData('isVariableAmount', e.target.checked)
              }
              className='rounded border-white/30 bg-white/10 text-amber-500 focus:ring-amber-500/30'
            />
            <label
              htmlFor='variableAmount'
              className='text-white/90 font-medium cursor-pointer'
            >
              Variable amount (amount may change)
            </label>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor='recurring-modal-notes'
              className='block text-sm font-medium text-white/90 mb-2'
            >
              Notes (optional)
            </label>
            <textarea
              id='recurring-modal-notes'
              value={recurringData.notes}
              onChange={e => updateRecurringData('notes', e.target.value)}
              className='w-full px-4 py-3 glass-input resize-none'
              rows='2'
              placeholder='Additional notes about this recurring expense...'
            />
          </div>

          {/* Description */}
          <div className='p-3 rounded-lg bg-amber-500/10 border border-amber-500/20'>
            <p className='text-sm text-amber-200'>
              {getFrequencyDescription()}
            </p>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className='p-3 rounded-lg bg-red-500/10 border border-red-500/20'>
              <p className='text-sm text-red-300'>{errors.submit}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='p-6 border-t border-white/10 space-y-3 flex-shrink-0'>
          {mode === 'edit' ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className='w-full px-6 py-3 glass-button glass-button--primary disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <div className='flex gap-3'>
                {onPause && (
                  <button
                    onClick={onPause}
                    className='flex-1 px-6 py-3 glass-button glass-button--secondary'
                  >
                    {initialData?.isActive ? 'Pause' : 'Resume'}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className='flex-1 px-6 py-3 glass-button glass-button--danger'
                  >
                    Delete Template
                  </button>
                )}
              </div>
              <button
                onClick={handleClose}
                className='w-full px-6 py-3 glass-button glass-button--secondary'
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className='w-full px-6 py-3 glass-button glass-button--primary disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {isSaving ? 'Creating...' : 'Create Recurring Template'}
              </button>
              <button
                onClick={handleClose}
                className='w-full px-6 py-3 glass-button glass-button--secondary'
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

RecurringExpenseModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  expenseData: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  mode: PropTypes.oneOf(['create', 'edit']),
  templateId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  initialData: PropTypes.object,
  onPause: PropTypes.func,
  onDelete: PropTypes.func,
  accounts: PropTypes.array,
  creditCards: PropTypes.array,
};

export default RecurringExpenseModal;

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Calendar, DollarSign } from 'lucide-react';
import PropTypes from 'prop-types';

import { recurringExpenseService } from '../services/recurringExpenseService';
import { DateUtils } from '../utils/dateUtils';

/**
 * Modal for configuring recurring expense settings
 */
const RecurringExpenseModal = ({ isOpen, onClose, expenseData, onSave }) => {
  const [recurringData, setRecurringData] = useState({
    name: '',
    frequency: 'monthly',
    intervalValue: 1,
    startDate: '',
    isVariableAmount: false,
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const frequencyOptions = recurringExpenseService.getFrequencyOptions();

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && expenseData) {
      setRecurringData({
        name: expenseData.name || '',
        frequency: 'monthly',
        intervalValue: 1,
        startDate: expenseData.dueDate || DateUtils.today(),
        isVariableAmount: false,
        notes: '',
      });
      setErrors({});
    }
  }, [isOpen, expenseData]);

  const validateForm = () => {
    const newErrors = {};

    if (!recurringData.name.trim()) {
      newErrors.name = 'Template name is required';
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
      frequency: 'monthly',
      intervalValue: 1,
      startDate: '',
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
    switch (recurringData.frequency) {
      case 'monthly':
        return 'This expense will repeat every month';
      case 'quarterly':
        return 'This expense will repeat every 3 months';
      case 'biannually':
        return 'This expense will repeat every 6 months';
      case 'annually':
        return 'This expense will repeat every year';
      case 'custom':
        return `This expense will repeat every ${recurringData.intervalValue} month${recurringData.intervalValue > 1 ? 's' : ''}`;
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/60 backdrop-blur-sm'
        onClick={handleClose}
      />

      {/* Modal */}
      <div className='relative w-full max-w-md mx-auto glass-panel glass-surface glass-surface--elevated'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b border-white/10'>
          <div className='flex items-center gap-3'>
            <div className='p-2 rounded-lg bg-amber-500/20 text-amber-300'>
              <Clock size={20} />
            </div>
            <h2 className='text-xl font-semibold text-white'>Make Recurring</h2>
          </div>
          <button
            onClick={handleClose}
            className='p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors'
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className='p-6 space-y-6'>
          {/* Template Name */}
          <div>
            <label className='block text-sm font-medium text-white/90 mb-2'>
              Template Name
            </label>
            <div className='relative'>
              <DollarSign
                size={18}
                className='absolute left-3 top-1/2 -translate-y-1/2 text-white/40'
              />
              <input
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
            <label className='block text-sm font-medium text-white/90 mb-2'>
              Repeat Frequency
            </label>
            <select
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
              <label className='block text-sm font-medium text-white/90 mb-2'>
                Repeat Every (months)
              </label>
              <input
                type='number'
                min='1'
                max='60'
                value={recurringData.intervalValue}
                onChange={e =>
                  updateRecurringData('intervalValue', parseInt(e.target.value))
                }
                className='w-full px-4 py-3 glass-input'
                placeholder='Number of months'
              />
              {errors.intervalValue && (
                <p className='mt-1 text-sm text-red-400'>
                  {errors.intervalValue}
                </p>
              )}
            </div>
          )}

          {/* Start Date */}
          <div>
            <label className='block text-sm font-medium text-white/90 mb-2'>
              Start Date
            </label>
            <div className='relative'>
              <Calendar
                size={18}
                className='absolute left-3 top-1/2 -translate-y-1/2 text-white/40'
              />
              <input
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
            <label className='block text-sm font-medium text-white/90 mb-2'>
              Notes (optional)
            </label>
            <textarea
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
        <div className='p-6 border-t border-white/10 space-y-3'>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className='w-full px-6 py-3 glass-button bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isSaving ? 'Creating...' : 'Create Recurring Template'}
          </button>
          <button
            onClick={handleClose}
            className='w-full px-6 py-3 glass-button bg-white/10 text-white/70 hover:bg-white/20'
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

RecurringExpenseModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  expenseData: PropTypes.object,
  onSave: PropTypes.func.isRequired,
};

export default RecurringExpenseModal;

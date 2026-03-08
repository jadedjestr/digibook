import { Landmark, Plus, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import { dbHelpers } from '../db/database-clean';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

const CreateAccountModal = ({ isOpen, onClose, onAccountCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking',
    currentBalance: 0,
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setFormData({ name: '', type: 'checking', currentBalance: 0 });
    setErrors({});
    setIsSaving(false);
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Account name is required';
    }
    if (formData.currentBalance < 0) {
      newErrors.currentBalance = 'Balance cannot be negative';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const id = await dbHelpers.addAccount(formData);
      const account = { ...formData, id };
      notify.success(`Account "${formData.name}" created`);
      resetForm();
      onAccountCreated(account);
    } catch (error) {
      logger.error('Error creating account from modal:', error);
      setErrors({ general: 'Failed to create account. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4'>
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

      <div className='relative w-full max-w-md mx-auto glass-panel glass-surface glass-surface--elevated'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <div className='p-2 rounded-lg bg-blue-500/20 text-blue-300'>
              <Landmark size={20} />
            </div>
            <h3 className='text-lg font-semibold text-primary'>
              Create Bank Account
            </h3>
          </div>
          <button
            onClick={handleClose}
            className='p-1 text-white/50 hover:text-white transition-colors'
          >
            <X size={20} />
          </button>
        </div>

        <p className='text-secondary text-sm mb-6'>
          To track credit card payments, a checking or savings account is needed
          as the funding source. Create one now to continue.
        </p>

        <div className='space-y-4 mb-6'>
          <div>
            <label
              htmlFor='acct-name'
              className='block text-primary font-medium mb-1 text-sm'
            >
              Account Name
            </label>
            <input
              id='acct-name'
              type='text'
              placeholder='e.g. Main Checking'
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className={`glass-input w-full ${errors.name ? 'glass-error' : ''}`}
            />
            {errors.name && (
              <p className='text-red-400 text-sm mt-1'>{errors.name}</p>
            )}
          </div>

          <div>
            <label
              htmlFor='acct-type'
              className='block text-primary font-medium mb-1 text-sm'
            >
              Account Type
            </label>
            <select
              id='acct-type'
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
              className='glass-input w-full'
            >
              <option value='checking'>Checking</option>
              <option value='savings'>Savings</option>
            </select>
          </div>

          <div>
            <label
              htmlFor='acct-balance'
              className='block text-primary font-medium mb-1 text-sm'
            >
              Starting Balance
            </label>
            <input
              id='acct-balance'
              type='number'
              value={formData.currentBalance}
              onChange={e =>
                setFormData({
                  ...formData,
                  currentBalance: parseFloat(e.target.value) || 0,
                })
              }
              className={`glass-input w-full ${errors.currentBalance ? 'glass-error' : ''}`}
            />
            {errors.currentBalance && (
              <p className='text-red-400 text-sm mt-1'>
                {errors.currentBalance}
              </p>
            )}
          </div>
        </div>

        {errors.general && (
          <div className='bg-red-500/20 border border-red-400/50 rounded-lg p-3 mb-4'>
            <p className='text-red-200 text-sm'>{errors.general}</p>
          </div>
        )}

        <div className='flex justify-end gap-3'>
          <button
            onClick={handleClose}
            className='glass-button glass-button--danger'
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`glass-button flex items-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSaving ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Create Account</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

CreateAccountModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAccountCreated: PropTypes.func.isRequired,
};

export default CreateAccountModal;

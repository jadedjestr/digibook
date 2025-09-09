import { Calendar, Clock } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { dbHelpers } from '../db/database-clean';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

const PaycheckManager = ({ onDataChange }) => {
  const [paycheckSettings, setPaycheckSettings] = useState({
    lastPaycheckDate: '',
    frequency: 'biweekly',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPaycheckSettings();
  }, []);

  const loadPaycheckSettings = async () => {
    try {
      const settings = await dbHelpers.getPaycheckSettings();
      logger.debug('Loaded paycheck settings from database:', settings);
      if (settings) {
        setPaycheckSettings({
          lastPaycheckDate: settings.lastPaycheckDate || '',
          frequency: settings.frequency || 'biweekly',
        });
        logger.debug('Paycheck settings loaded successfully');
      }
    } catch (error) {
      logger.error('Error loading paycheck settings:', error);
      notify.error('Failed to load paycheck settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) {
      logger.warn(
        'Save operation already in progress, ignoring duplicate request'
      );
      return;
    }

    try {
      setIsSaving(true);

      // Validate the date format before saving
      if (
        paycheckSettings.lastPaycheckDate &&
        !DateUtils.isValidDate(paycheckSettings.lastPaycheckDate)
      ) {
        notify.error('Please enter a valid date in the correct format.');
        return;
      }

      logger.debug('Saving paycheck settings:', paycheckSettings);
      await dbHelpers.updatePaycheckSettings(paycheckSettings);
      logger.success('Paycheck settings saved successfully');

      // Show success notification
      notify.success('Paycheck settings saved successfully!');

      // Call onDataChange if it's provided
      if (typeof onDataChange === 'function') {
        onDataChange();
      } else {
        logger.warn('onDataChange prop not provided or not a function');
      }
    } catch (error) {
      logger.error('Error saving paycheck settings:', error);
      logger.error('Error details:', error.message, error.stack);

      // Show more specific error message
      let errorMessage = 'Failed to save paycheck settings. Please try again.';
      if (error.message.includes('Invalid date format')) {
        errorMessage =
          'Please enter a valid date in the correct format (YYYY-MM-DD).';
      } else if (error.message.includes('Invalid frequency')) {
        errorMessage = 'Please select a valid pay frequency.';
      } else if (
        error.message.includes('database') ||
        error.message.includes('Database')
      ) {
        errorMessage =
          'Database error occurred. Please refresh the page and try again.';
      }

      notify.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateNextPayDates = () => {
    if (!paycheckSettings.lastPaycheckDate) {
      return null;
    }

    // Use DateUtils for consistent date parsing
    const lastPayDate = DateUtils.parseDate(paycheckSettings.lastPaycheckDate);
    if (!lastPayDate) {
      return null;
    }

    const nextPayDate = new Date(lastPayDate);
    nextPayDate.setDate(nextPayDate.getDate() + 14);

    const followingPayDate = new Date(lastPayDate);
    followingPayDate.setDate(followingPayDate.getDate() + 28);

    return {
      nextPayDate: DateUtils.formatDate(nextPayDate),
      followingPayDate: DateUtils.formatDate(followingPayDate),
    };
  };

  const nextPayDates = calculateNextPayDates();

  if (isLoading) {
    return (
      <div className='glass-panel'>
        <div className='text-center py-8'>
          <div className='glass-loading' />
          <p className='text-white/70 mt-4'>Loading paycheck settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='glass-panel'>
      <div className='flex items-center space-x-2 mb-6'>
        <Calendar size={20} className='text-primary' />
        <h3 className='text-lg font-semibold text-primary'>Paycheck Manager</h3>
      </div>

      <div className='space-y-6'>
        {/* Last Paycheck Date */}
        <div>
          <label className='block text-primary font-medium mb-2'>
            Last Paycheck Date
          </label>
          <input
            type='date'
            value={paycheckSettings.lastPaycheckDate}
            onChange={e =>
              setPaycheckSettings({
                ...paycheckSettings,
                lastPaycheckDate: e.target.value,
              })
            }
            className='glass-input w-full'
          />
          <p className='text-secondary text-sm mt-1'>
            This date is used to calculate your future pay dates
          </p>
        </div>

        {/* Pay Frequency */}
        <div>
          <label className='block text-primary font-medium mb-2'>
            Pay Frequency
          </label>
          <select
            value={paycheckSettings.frequency}
            onChange={e =>
              setPaycheckSettings({
                ...paycheckSettings,
                frequency: e.target.value,
              })
            }
            className='glass-input w-full'
          >
            <option value='biweekly'>Biweekly (every 2 weeks)</option>
            {/* Future: Add more options like semi-monthly, monthly */}
          </select>
          <p className='text-secondary text-sm mt-1'>
            Currently only biweekly pay schedules are supported
          </p>
        </div>

        {/* Preview Next Pay Dates */}
        {nextPayDates && (
          <div className='bg-white/5 rounded-lg p-4'>
            <div className='flex items-center space-x-2 mb-3'>
              <Clock size={16} className='text-secondary' />
              <h4 className='text-primary font-medium'>Next Pay Dates</h4>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <div className='text-sm text-secondary'>Next Paycheck</div>
                <div className='text-white font-medium'>
                  {DateUtils.formatDisplayDate(nextPayDates.nextPayDate)}
                </div>
              </div>
              <div>
                <div className='text-sm text-secondary'>Following Paycheck</div>
                <div className='text-white font-medium'>
                  {DateUtils.formatDisplayDate(nextPayDates.followingPayDate)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className='flex justify-between'>
          <button
            onClick={() => {
              loadPaycheckSettings();
              notify.info('Reloading paycheck settings...');
            }}
            disabled={isLoading}
            className='glass-button flex items-center space-x-2 opacity-70 hover:opacity-100'
          >
            <Clock size={16} />
            <span>Reload Settings</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !paycheckSettings.lastPaycheckDate}
            className={`glass-button flex items-center space-x-2 ${
              isSaving || !paycheckSettings.lastPaycheckDate
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {isSaving ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Calendar size={16} />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaycheckManager;

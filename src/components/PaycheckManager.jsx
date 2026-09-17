import { Calendar, Clock } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import {
  calculateNextPayDates,
  DEFAULT_PAY_FREQUENCY,
  PAY_FREQUENCIES,
} from '../constants/payFrequency';
import { dbHelpers } from '../db/database-clean';
import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

import DatePicker from './DatePicker';

const PaycheckManager = ({ onDataChange }) => {
  const [paycheckSettings, setPaycheckSettings] = useState({
    lastPaycheckDate: '',
    frequency: DEFAULT_PAY_FREQUENCY,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);

  // Income lives in its own table, so it is loaded separately rather than
  // widened onto the paycheck settings object.
  const [income, setIncome] = useState({
    isEnabled: false,
    accountId: '',
    expectedAmount: '',
  });
  const [learnedAmount, setLearnedAmount] = useState(null);

  useEffect(() => {
    (async () => {
      await selfHealPaycheckAnchor();
      await loadPaycheckSettings();
    })();
  }, []);

  const selfHealPaycheckAnchor = async () => {
    try {
      const { advanced } = await dbHelpers.selfHealPaycheckAnchor();
      if (advanced) {
        notify.info('Your pay-cycle anchor date was updated automatically.');
      }
    } catch (error) {
      logger.error('Error self-healing paycheck anchor:', error);
    }
  };

  const loadPaycheckSettings = async () => {
    try {
      const [settings, source, accountList] = await Promise.all([
        dbHelpers.getPaycheckSettings(),
        dbHelpers.getPrimaryIncomeSource(),
        dbHelpers.getAccounts(),
      ]);
      logger.debug('Loaded paycheck settings from database:', settings);
      if (settings) {
        setPaycheckSettings({
          lastPaycheckDate: settings.lastPaycheckDate || '',
          frequency: settings.frequency || DEFAULT_PAY_FREQUENCY,
        });
        logger.debug('Paycheck settings loaded successfully');
      }
      setAccounts(accountList || []);
      setIncome({
        isEnabled: source?.isEnabled ?? false,
        accountId: source?.accountId || '',
        expectedAmount:
          source?.expectedAmount != null ? String(source.expectedAmount) : '',
      });
      setLearnedAmount(
        source ? await dbHelpers.getLearnedIncomeAmount(source.id) : null,
      );
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
        'Save operation already in progress, ignoring duplicate request',
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

      if (income.isEnabled && !income.accountId) {
        notify.error('Choose which account your paycheck lands in.');
        return;
      }

      logger.debug('Saving paycheck settings:', paycheckSettings);
      await dbHelpers.updatePaycheckSettings(paycheckSettings);

      const existing = await dbHelpers.getPrimaryIncomeSource();
      const wasEnabled = existing?.isEnabled ?? false;

      await dbHelpers.upsertIncomeSource({
        isEnabled: income.isEnabled,
        accountId: income.accountId || null,
        expectedAmount:
          income.expectedAmount === '' ? 0 : income.expectedAmount,

        // Enabling starts from today so switching on never backfills
        // months of imaginary back-pay.
        ...(income.isEnabled && !wasEnabled
          ? { lastGeneratedDate: DateUtils.today() }
          : {}),
      });

      // Turning it off clears predictions the user never acted on. Confirmed
      // paychecks are real history and are left alone.
      if (!income.isEnabled && wasEnabled && existing) {
        await dbHelpers.sweepUnconfirmedIncome(existing.id);
      }

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

  const nextPayDates = calculateNextPayDates(
    paycheckSettings.lastPaycheckDate,
    paycheckSettings.frequency,
  );

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
          <label
            htmlFor='paycheck-last-date'
            className='block text-primary font-medium mb-2'
          >
            Last Paycheck Date
          </label>
          <DatePicker
            id='paycheck-last-date'
            value={paycheckSettings.lastPaycheckDate}
            onChange={date =>
              setPaycheckSettings({
                ...paycheckSettings,
                lastPaycheckDate: date,
              })
            }
          />
          <p className='text-secondary text-sm mt-1'>
            This date is used to calculate your future pay dates
          </p>
        </div>

        {/* Pay Frequency */}
        <div>
          <label
            htmlFor='paycheck-frequency'
            className='block text-primary font-medium mb-2'
          >
            Pay Frequency
          </label>
          <select
            id='paycheck-frequency'
            value={paycheckSettings.frequency}
            onChange={e =>
              setPaycheckSettings({
                ...paycheckSettings,
                frequency: e.target.value,
              })
            }
            className='glass-input w-full'
          >
            {Object.entries(PAY_FREQUENCIES).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Automatic paycheck entry */}
        <div className='border-t border-white/10 pt-6'>
          <div className='flex items-start space-x-3'>
            <input
              id='income-enabled'
              type='checkbox'
              checked={income.isEnabled}
              onChange={e =>
                setIncome({ ...income, isEnabled: e.target.checked })
              }
              className='mt-1'
            />
            <label htmlFor='income-enabled' className='cursor-pointer'>
              <span className='block text-primary font-medium'>
                Add my paycheck automatically
              </span>
              <span className='block text-secondary text-sm mt-1'>
                Starting with your next payday, it appears as a pending
                transaction — not retroactively if today is already payday. Your
                balance only changes when you confirm the money landed.
              </span>
            </label>
          </div>

          {income.isEnabled && (
            <div className='space-y-4 mt-4 pl-7'>
              <div>
                <label
                  htmlFor='income-account'
                  className='block text-primary font-medium mb-2'
                >
                  Lands in
                </label>
                <select
                  id='income-account'
                  value={income.accountId}
                  onChange={e =>
                    setIncome({ ...income, accountId: e.target.value })
                  }
                  className='glass-input w-full'
                >
                  <option value=''>Select an account</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor='income-amount'
                  className='block text-primary font-medium mb-2'
                >
                  Usual amount
                </label>
                <input
                  id='income-amount'
                  type='number'
                  inputMode='decimal'
                  value={income.expectedAmount}
                  onChange={e =>
                    setIncome({ ...income, expectedAmount: e.target.value })
                  }
                  className='glass-input w-full'
                  step='0.01'
                  min='0'
                />
                <p className='text-secondary text-sm mt-1'>
                  Roughly what you usually get. Correct it when each paycheck
                  lands — an estimate never affects your real balance.
                </p>
                {learnedAmount != null && (
                  <p className='text-sm mt-2 text-green-300'>
                    Using {formatCurrency(learnedAmount)} — the average of your
                    last 3 paychecks.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preview Next Pay Dates */}
        {nextPayDates.nextPayDate && (
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

PaycheckManager.propTypes = {
  onDataChange: PropTypes.func.isRequired,
};

export default PaycheckManager;

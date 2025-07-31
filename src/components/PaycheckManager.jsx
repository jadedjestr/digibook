import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { dbHelpers } from '../db/database';
import { DateUtils } from '../utils/dateUtils';

const PaycheckManager = ({ onDataChange }) => {
  const [paycheckSettings, setPaycheckSettings] = useState({
    lastPaycheckDate: '',
    frequency: 'biweekly'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPaycheckSettings();
  }, []);

  const loadPaycheckSettings = async () => {
    try {
      const settings = await dbHelpers.getPaycheckSettings();
      if (settings) {
        setPaycheckSettings({
          lastPaycheckDate: settings.lastPaycheckDate || '',
          frequency: settings.frequency || 'biweekly'
        });
      }
    } catch (error) {
      console.error('Error loading paycheck settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!paycheckSettings.lastPaycheckDate) {
      alert('Please enter your last paycheck date.');
      return;
    }

    setIsSaving(true);
    try {
      console.log('Saving paycheck settings:', paycheckSettings);
      await dbHelpers.updatePaycheckSettings(paycheckSettings);
      console.log('Paycheck settings saved successfully');
      onDataChange();
      alert('Paycheck settings saved successfully!');
    } catch (error) {
      console.error('Error saving paycheck settings:', error);
      console.error('Error details:', error.message, error.stack);
      alert('Failed to save paycheck settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateNextPayDates = () => {
    if (!paycheckSettings.lastPaycheckDate) return null;

    // Parse the date string and ensure it's treated as local time
    const [year, month, day] = paycheckSettings.lastPaycheckDate.split('-').map(Number);
    const lastPayDate = new Date(year, month - 1, day); // month is 0-indexed
    
    const nextPayDate = new Date(lastPayDate);
    nextPayDate.setDate(nextPayDate.getDate() + 14);
    
    const followingPayDate = new Date(lastPayDate);
    followingPayDate.setDate(followingPayDate.getDate() + 28);

    // Format dates consistently in local time
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      nextPayDate: formatDate(nextPayDate),
      followingPayDate: formatDate(followingPayDate)
    };
  };

  const nextPayDates = calculateNextPayDates();

  if (isLoading) {
    return (
      <div className="glass-panel">
        <div className="text-center py-8">
          <div className="glass-loading"></div>
          <p className="text-white/70 mt-4">Loading paycheck settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <div className="flex items-center space-x-2 mb-6">
        <Calendar size={20} className="text-primary" />
        <h3 className="text-lg font-semibold text-primary">Paycheck Manager</h3>
      </div>

      <div className="space-y-6">
        {/* Last Paycheck Date */}
        <div>
          <label className="block text-primary font-medium mb-2">
            Last Paycheck Date
          </label>
          <input
            type="date"
            value={paycheckSettings.lastPaycheckDate}
            onChange={(e) => setPaycheckSettings({
              ...paycheckSettings,
              lastPaycheckDate: e.target.value
            })}
            className="glass-input w-full"
          />
          <p className="text-secondary text-sm mt-1">
            This date is used to calculate your future pay dates
          </p>
        </div>

        {/* Pay Frequency */}
        <div>
          <label className="block text-primary font-medium mb-2">
            Pay Frequency
          </label>
          <select
            value={paycheckSettings.frequency}
            onChange={(e) => setPaycheckSettings({
              ...paycheckSettings,
              frequency: e.target.value
            })}
            className="glass-input w-full"
          >
            <option value="biweekly">Biweekly (every 2 weeks)</option>
            {/* Future: Add more options like semi-monthly, monthly */}
          </select>
          <p className="text-secondary text-sm mt-1">
            Currently only biweekly pay schedules are supported
          </p>
        </div>

        {/* Preview Next Pay Dates */}
        {nextPayDates && (
          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Clock size={16} className="text-secondary" />
              <h4 className="text-primary font-medium">Next Pay Dates</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-secondary">Next Paycheck</div>
                <div className="text-white font-medium">
                  {DateUtils.formatDisplayDate(nextPayDates.nextPayDate)}
                </div>
              </div>
              <div>
                <div className="text-sm text-secondary">Following Paycheck</div>
                <div className="text-white font-medium">
                  {DateUtils.formatDisplayDate(nextPayDates.followingPayDate)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving || !paycheckSettings.lastPaycheckDate}
            className={`glass-button flex items-center space-x-2 ${
              isSaving || !paycheckSettings.lastPaycheckDate ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
import React, { useState, useEffect } from 'react';
import { dbHelpers } from '../db/database';
import { PaycheckService } from '../services/paycheckService';
import PaySummaryCard from '../components/PaySummaryCard';
import PayDateCountdownCard from '../components/PayDateCountdownCard';
import FixedExpensesTable from '../components/FixedExpensesTable';
import StartCycleButton from '../components/StartCycleButton';

const FixedExpenses = ({ accounts: accountsProp, onDataChange }) => {
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState(accountsProp || []);
  const [paycheckSettings, setPaycheckSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showResetPrompt, setShowResetPrompt] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setAccounts(accountsProp || []);
  }, [accountsProp]);

  const loadData = async () => {
    try {
      const [expensesData, paycheckSettingsData] = await Promise.all([
        dbHelpers.getFixedExpenses(),
        dbHelpers.getPaycheckSettings()
      ]);
      
      setExpenses(expensesData);
      setAccounts(accountsProp || []);
      setPaycheckSettings(paycheckSettingsData);
    } catch (error) {
      console.error('Error loading fixed expenses data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataChange = () => {
    loadData();
    onDataChange();
  };

  const paycheckService = new PaycheckService(paycheckSettings);
  const paycheckDates = paycheckService.calculatePaycheckDates();
  const summaryTotals = paycheckService.calculateSummaryTotals(expenses, paycheckDates);

  const handleStartNewCycle = async () => {
    if (!confirm('Are you sure you want to start a new cycle? This will reset all paid amounts to 0.')) {
      return;
    }

    try {
      // Reset all paid amounts to 0
      const resetPromises = expenses.map(expense => 
        dbHelpers.updateFixedExpense(expense.id, { paidAmount: 0 })
      );
      
      await Promise.all(resetPromises);
      
      // Add audit log
      const currentMonth = new Date().toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
      await dbHelpers.addAuditLog('RESET', 'fixedExpenses', 'all', {
        message: `Reset Fixed Expenses for ${currentMonth}`
      });
      
      handleDataChange();
    } catch (error) {
      console.error('Error starting new cycle:', error);
      alert('Failed to start new cycle. Please try again.');
    }
  };

  // Check if we should prompt for monthly reset
  useEffect(() => {
    if (paycheckSettings && expenses.length > 0) {
      const shouldReset = paycheckService.shouldPromptReset(expenses, paycheckDates);
      setShowResetPrompt(shouldReset);
    }
  }, [expenses, paycheckSettings, paycheckDates]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white text-shadow-lg">Fixed Expenses</h1>
            <p className="text-white/70">Track recurring monthly expenses</p>
          </div>
        </div>
        <div className="glass-panel">
          <div className="text-center py-12">
            <div className="glass-loading"></div>
            <p className="text-white/70 mt-4">Loading fixed expenses...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white text-shadow-lg">Fixed Expenses</h1>
          <p className="text-white/70">Track recurring monthly expenses</p>
        </div>
      </div>

      {/* Paycheck Settings Warning */}
      {!paycheckSettings && (
        <div className="glass-panel bg-yellow-500/10 border-yellow-500/30">
          <div className="text-center py-6">
            <h3 className="text-lg font-semibold text-yellow-300 mb-2">Setup Required</h3>
            <p className="text-white/70 mb-4">
              Please configure your paycheck settings in the Settings tab to enable expense status tracking.
            </p>
            <button
              onClick={() => window.location.hash = '#settings'}
              className="glass-button bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
            >
              Go to Settings
            </button>
          </div>
        </div>
      )}

      {/* Monthly Reset Prompt */}
      {showResetPrompt && (
        <div className="glass-panel bg-blue-500/10 border-blue-500/30">
          <div className="text-center py-6">
            <h3 className="text-lg font-semibold text-blue-300 mb-2">New Month Detected</h3>
            <p className="text-white/70 mb-4">
              You've completed all fixed expenses for this pay cycle. Would you like to reset all expenses for the new month?
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleStartNewCycle}
                className="glass-button bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
              >
                Reset for New Month
              </button>
              <button
                onClick={() => setShowResetPrompt(false)}
                className="glass-button bg-gray-500/20 text-gray-300 hover:bg-gray-500/30"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {paycheckSettings && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PaySummaryCard
            payThisWeekTotal={summaryTotals.payThisWeek}
            payNextCheckTotal={summaryTotals.payNextCheck}
          />
          <PayDateCountdownCard
            nextPayDate={paycheckDates.nextPayDate}
            followingPayDate={paycheckDates.followingPayDate}
            daysUntilNextPay={paycheckDates.daysUntilNextPay}
            daysUntilFollowingPay={paycheckDates.daysUntilFollowingPay}
          />
        </div>
      )}

      {/* Fixed Expenses Table */}
      <FixedExpensesTable
        expenses={expenses}
        accounts={accounts}
        paycheckSettings={paycheckSettings}
        onDataChange={handleDataChange}
      />

      {/* Start New Cycle Button */}
      <div className="flex justify-center">
        <StartCycleButton
          onClick={handleStartNewCycle}
          disabled={expenses.length === 0}
        />
      </div>
    </div>
  );
};

export default FixedExpenses; 
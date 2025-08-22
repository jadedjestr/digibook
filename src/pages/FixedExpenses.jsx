import React, { useState, useEffect } from 'react'
import { logger } from "../utils/logger";
import { dbHelpers } from '../db/database'
import { PaycheckService } from '../services/paycheckService'
import PaySummaryCard from '../components/PaySummaryCard'
import PayDateCountdownCard from '../components/PayDateCountdownCard'
import ProjectedBalanceCard from '../components/ProjectedBalanceCard'
import FixedExpensesTable from '../components/FixedExpensesTable'
import StartCycleButton from '../components/StartCycleButton'
import CategoryExpenseSummary from '../components/CategoryExpenseSummary'

const FixedExpenses = ({ accounts: accountsProp, creditCards: creditCardsProp = [], pendingTransactions = [], onDataChange, isPanelOpen, setIsPanelOpen }) => {
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState(accountsProp || []);
  const [creditCards, setCreditCards] = useState(creditCardsProp || []);
  const [paycheckSettings, setPaycheckSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [showResetPrompt, setShowResetPrompt] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setAccounts(accountsProp || []);
    setCreditCards(creditCardsProp || []);
  }, [accountsProp, creditCardsProp]);

  const loadData = async () => {
    try {
      const [expensesData, paycheckSettingsData, categoriesData] = await Promise.all([
        dbHelpers.getFixedExpenses(),
        dbHelpers.getPaycheckSettings(),
        dbHelpers.getCategories()
      ]);
      
      logger.component("FixedExpenses", "accountsProp", accountsProp);
      logger.component("FixedExpenses", "expensesData", expensesData);
      logger.component("FixedExpenses", "paycheckSettingsData", paycheckSettingsData);
      
      setExpenses(expensesData);
      setAccounts(accountsProp || []);
      setPaycheckSettings(paycheckSettingsData);
      setCategories(categoriesData);
    } catch (error) {
      logger.error("Error loading fixed expenses data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataChange = async () => {
    try {
      // Only reload what's needed instead of everything
      const [expensesData, categoriesData] = await Promise.all([
        dbHelpers.getFixedExpenses(),
        dbHelpers.getCategories()
      ]);
      
      setExpenses(expensesData);
      setCategories(categoriesData);
      
      // Notify parent
      onDataChange();
    } catch (error) {
      logger.error("Error updating expense data:", error);
    }
  };

  const handleExpenseUpdate = async (updatedExpense) => {
    try {
      // Update the expense in local state without triggering a full reload
      setExpenses(prevExpenses => 
        prevExpenses.map(expense => 
          expense.id === updatedExpense.id ? updatedExpense : expense
        )
      );
      
      // Only notify parent for account changes that affect account balances
      if (updatedExpense.accountId !== undefined) {
        onDataChange();
      }
    } catch (error) {
      logger.error("Error updating expense in local state:", error);
    }
  };

  const paycheckService = new PaycheckService(paycheckSettings);
  const paycheckDates = paycheckService.calculatePaycheckDates();
  const summaryTotals = paycheckService.calculateSummaryTotals(expenses, paycheckDates);
  
  // Calculate overdue expenses total
  const overdueExpenses = expenses.filter(expense => {
    const status = paycheckService.calculateExpenseStatus(expense, paycheckDates);
    return status === 'Overdue';
  });
  
  const overdueTotal = overdueExpenses.reduce((total, expense) => {
    return total + (expense.amount - expense.paidAmount);
  }, 0);
  
  // Calculate projected balance for default account
  const defaultAccount = accounts.find(account => account.isDefault === true);
  const projectedBalance = defaultAccount ? (() => {
    const pendingForAccount = pendingTransactions
      .filter(t => parseInt(t.accountId) === defaultAccount.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return defaultAccount.currentBalance + pendingForAccount;
  })() : 0;
  


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
        message: 'Reset Fixed Expenses for ' + currentMonth
      });
      
      logger.success('New cycle started successfully');
      handleDataChange();
    } catch (error) {
      logger.error('Error starting new cycle:', error);
      alert('Failed to start new cycle. Please try again.');
    }
  };
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PaySummaryCard
            payThisWeekTotal={summaryTotals.payThisWeek}
            payNextCheckTotal={summaryTotals.payNextCheck}
            overdueTotal={overdueTotal}
          />
          <PayDateCountdownCard
            nextPayDate={paycheckDates.nextPayDate}
            followingPayDate={paycheckDates.followingPayDate}
            daysUntilNextPay={paycheckDates.daysUntilNextPay}
            daysUntilFollowingPay={paycheckDates.daysUntilFollowingPay}
          />
          <ProjectedBalanceCard
            projectedBalance={projectedBalance}
            payThisWeekTotal={summaryTotals.payThisWeek}
            defaultAccountName={defaultAccount?.name || 'Default Account'}
          />
        </div>
      )}

      {/* Category Summary */}
      <CategoryExpenseSummary
        expenses={expenses}
        categories={categories}
      />

      {/* Fixed Expenses Table */}
      <FixedExpensesTable
        expenses={expenses}
        accounts={accounts}
        creditCards={creditCards}
        paycheckSettings={paycheckSettings}
        onDataChange={handleDataChange}
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
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
import React, { useState } from 'react';
import { PaycheckService } from '../services/paycheckService';
import PaySummaryCard from '../components/PaySummaryCard';
import PayDateCountdownCard from '../components/PayDateCountdownCard';
import ProjectedBalanceCard from '../components/ProjectedBalanceCard';
import FixedExpensesTable from '../components/FixedExpensesTable';
import StartCycleButton from '../components/StartCycleButton';
import CategoryExpenseSummary from '../components/CategoryExpenseSummary';
import { useAppStore } from '../stores/useAppStore';

const FixedExpenses = () => {
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  
  // Use Zustand store for data
  const {
    accounts,
    creditCards,
    pendingTransactions,
    fixedExpenses,
    paycheckSettings,
    categories,
    isPanelOpen,
    isLoading,
    setPanelOpen,
  } = useAppStore();

  // Initialize paycheck service
  const paycheckService = new PaycheckService(paycheckSettings);
  const paycheckDates = paycheckService.calculatePaycheckDates();
  const summaryTotals = paycheckService.calculateSummaryTotals(fixedExpenses, paycheckDates);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-white/70">Loading expenses...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <PaySummaryCard
          summaryTotals={summaryTotals}
          paycheckDates={paycheckDates}
        />
        <PayDateCountdownCard
          paycheckDates={paycheckDates}
        />
        <ProjectedBalanceCard
          accounts={accounts}
          creditCards={creditCards}
          summaryTotals={summaryTotals}
        />
      </div>

      {/* Start Cycle Button */}
      <StartCycleButton
        onReset={() => setShowResetPrompt(true)}
      />

      {/* Category Summary */}
      <CategoryExpenseSummary
        expenses={fixedExpenses}
        categories={categories}
      />

      {/* Main Expenses Table */}
      <FixedExpensesTable />

      {/* Reset Confirmation Modal */}
      {showResetPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-panel p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Reset Pay Cycle
            </h3>
            <p className="text-white/70 mb-6">
              This will mark all expenses as unpaid and reset the pay cycle. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetPrompt(false)}
                className="flex-1 px-4 py-2 glass-button"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Implement reset functionality
                  setShowResetPrompt(false);
                }}
                className="flex-1 px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedExpenses;
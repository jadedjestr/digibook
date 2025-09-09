import React, { useState, useEffect } from 'react';

import BudgetVsActualDashboard from '../components/BudgetVsActualDashboard';
import DebtPayoffCalculator from '../components/DebtPayoffCalculator';
import MonthlyTrends from '../components/MonthlyTrends';
import OverpaymentAnalysis from '../components/OverpaymentAnalysis';
import { dbHelpers } from '../db/database-clean';
import { logger } from '../utils/logger';

const Insights = ({ accounts = [], creditCards = [], onDataChange }) => {
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [overpaymentData, setOverpaymentData] = useState({});
  const [monthlyHistory, setMonthlyHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInsightsData();
  }, []);

  const loadInsightsData = async () => {
    try {
      setIsLoading(true);
      const [summary, categoryData, history] = await Promise.all([
        dbHelpers.getBudgetVsActualSummary(),
        dbHelpers.getOverpaymentByCategory(),
        dbHelpers.getMonthlyExpenseHistory(12),
      ]);

      setBudgetSummary(summary);
      setOverpaymentData(categoryData);
      setMonthlyHistory(history);
    } catch (error) {
      logger.error('Error loading insights data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataRefresh = () => {
    loadInsightsData();
    if (onDataChange) {
      onDataChange();
    }
  };

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-white text-shadow-lg'>
              Insights
            </h1>
            <p className='text-white/70'>
              Financial analytics and budget insights
            </p>
          </div>
        </div>
        <div className='glass-panel'>
          <div className='text-center py-12'>
            <div className='glass-loading' />
            <p className='text-white/70 mt-4'>Loading insights...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-white text-shadow-lg'>
            Insights
          </h1>
          <p className='text-white/70'>
            Financial analytics and budget insights
          </p>
        </div>
        <button
          onClick={handleDataRefresh}
          className='glass-button px-4 py-2 text-sm'
        >
          Refresh Data
        </button>
      </div>

      {/* Budget vs Actual Dashboard */}
      <BudgetVsActualDashboard summary={budgetSummary} />

      {/* Row 1: Overpayment Analysis and Debt Calculator */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <OverpaymentAnalysis data={overpaymentData} />
        <DebtPayoffCalculator
          creditCards={creditCards}
          onDataChange={handleDataRefresh}
        />
      </div>

      {/* Row 2: Monthly Trends */}
      <MonthlyTrends history={monthlyHistory} />
    </div>
  );
};

export default Insights;

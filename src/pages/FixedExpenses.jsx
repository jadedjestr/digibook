import React from 'react';

const FixedExpenses = ({ onDataChange }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white text-shadow-lg">Fixed Expenses</h1>
          <p className="text-white/70">Track recurring monthly expenses</p>
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="glass-panel">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-white mb-2">Coming Soon</h3>
          <p className="text-white/70 max-w-md mx-auto">
            Fixed expenses tracking will be available in a future update. 
            This will help you manage recurring monthly payments like rent, utilities, and subscriptions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FixedExpenses; 
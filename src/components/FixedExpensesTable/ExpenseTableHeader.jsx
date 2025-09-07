import React from 'react';
import { Plus, SortAsc, SortDesc, Filter, Eye, EyeOff } from 'lucide-react';
import { formatCurrency } from '../../utils/accountUtils';

/**
 * Header component for the Fixed Expenses Table
 * Displays summary information, controls, and action buttons
 */
const ExpenseTableHeader = ({
  expenses,
  groupedExpenses,
  totals,
  categoryTotals,
  sortBy,
  setSortBy,
  showOnlyUnpaid,
  setShowOnlyUnpaid,
  setIsPanelOpen,
}) => {
  // Use memoized totals for better performance
  const {
    totalExpenses,
    totalAmount,
    totalPaid,
    totalRemaining,
  } = totals;

  // Use memoized category totals
  const categoryCounts = Object.entries(categoryTotals).map(([categoryName, categoryData]) => ({
    name: categoryName,
    count: categoryData.count,
    total: categoryData.total,
  }));

  return (
    <div className="glass-panel p-6">
      {/* Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Fixed Expenses</h2>
          <div className="flex flex-wrap gap-4 text-sm text-white/70">
            <span>{totalExpenses} expenses</span>
            <span>Total: {formatCurrency(totalAmount)}</span>
            <span>Paid: {formatCurrency(totalPaid)}</span>
            <span className="text-yellow-300">Remaining: {formatCurrency(totalRemaining)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Sort Control */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSortBy(sortBy === 'dueDate' ? 'name' : 'dueDate')}
                className="flex items-center gap-1 px-3 py-2 text-sm glass-button"
                title={`Sort by ${sortBy === 'dueDate' ? 'name' : 'due date'}`}
              >
                {sortBy === 'dueDate' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                {sortBy === 'dueDate' ? 'Due Date' : 'Name'}
              </button>
            </div>

            {/* Show Only Unpaid Toggle */}
            <button
              onClick={() => setShowOnlyUnpaid(!showOnlyUnpaid)}
              className={`flex items-center gap-1 px-3 py-2 text-sm transition-colors ${
                showOnlyUnpaid 
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' 
                  : 'glass-button'
              }`}
              title={showOnlyUnpaid ? 'Show all expenses' : 'Show only unpaid expenses'}
            >
              {showOnlyUnpaid ? <EyeOff size={16} /> : <Eye size={16} />}
              {showOnlyUnpaid ? 'All' : 'Unpaid'}
            </button>
          </div>

          {/* Add Expense Button */}
          <button
            onClick={() => setIsPanelOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors"
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Category Summary */}
      {categoryCounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {categoryCounts.map(({ name, count, total }) => (
            <div
              key={name}
              className="glass-panel p-3 text-center"
            >
              <div className="text-sm text-white/70 mb-1">
                {name === 'Uncategorized' ? 'Uncategorized' : name}
              </div>
              <div className="text-lg font-semibold text-white mb-1">
                {count}
              </div>
              <div className="text-xs text-white/60">
                {formatCurrency(total)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-300">
              {formatCurrency(totalPaid)}
            </div>
            <div className="text-xs text-white/60">Total Paid</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-300">
              {formatCurrency(totalRemaining)}
            </div>
            <div className="text-xs text-white/60">Remaining</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-300">
              {totalExpenses}
            </div>
            <div className="text-xs text-white/60">Total Expenses</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-300">
              {categoryCounts.length}
            </div>
            <div className="text-xs text-white/60">Categories</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseTableHeader;

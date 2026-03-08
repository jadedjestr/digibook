import { Plus, SortAsc, SortDesc, Eye, EyeOff } from 'lucide-react';
import PropTypes from 'prop-types';

import { formatCurrency } from '../../utils/accountUtils';

/**
 * Header component for the Fixed Expenses Table
 * Displays summary information, controls, and action buttons
 */
const ExpenseTableHeader = ({
  expenses: _expenses,
  groupedExpenses,
  totals,
  categoryTotals,
  sortBy,
  setSortBy,
  showOnlyUnpaid,
  setShowOnlyUnpaid,
  expenseTypeFilter,
  setExpenseTypeFilter,
  setIsPanelOpen,
  onCategoryClick,
  variant = 'full',
}) => {
  // Use memoized totals for better performance
  const { totalExpenses, totalAmount, totalPaid, totalRemaining } = totals;

  // Category rows in same order as groupedExpenses (matches blocks below)
  const categoryRows =
    groupedExpenses && typeof groupedExpenses === 'object'
      ? Object.keys(groupedExpenses).map(categoryName => {
          const data = categoryTotals[categoryName] || {};
          return {
            name: categoryName,
            count: data.count ?? 0,
            totalBudgeted: data.totalBudgeted ?? 0,
          };
        })
      : [];

  const controlsStrip = (
    <div className='flex flex-wrap items-center gap-2'>
      <button
        onClick={() => setSortBy(sortBy === 'dueDate' ? 'name' : 'dueDate')}
        className='flex items-center gap-1 px-3 py-2 text-sm glass-button'
        title={`Sort by ${sortBy === 'dueDate' ? 'name' : 'due date'}`}
      >
        {sortBy === 'dueDate' ? <SortAsc size={16} /> : <SortDesc size={16} />}
        {sortBy === 'dueDate' ? 'Due Date' : 'Name'}
      </button>
      <button
        onClick={() => setShowOnlyUnpaid(!showOnlyUnpaid)}
        className={`flex items-center gap-1 px-3 py-2 text-sm transition-colors ${
          showOnlyUnpaid
            ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
            : 'glass-button'
        }`}
        title={
          showOnlyUnpaid ? 'Show all expenses' : 'Show only unpaid expenses'
        }
      >
        {showOnlyUnpaid ? <EyeOff size={16} /> : <Eye size={16} />}
        {showOnlyUnpaid ? 'All' : 'Unpaid'}
      </button>
      <select
        value={expenseTypeFilter}
        onChange={e => setExpenseTypeFilter(e.target.value)}
        className='px-3 py-2 text-sm glass-button bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
        title='Filter by expense type'
      >
        <option value='all'>All Types</option>
        <option value='recurring'>Recurring Only</option>
        <option value='oneoff'>One-Off Only</option>
      </select>
      <button
        onClick={() => setIsPanelOpen(true)}
        className='flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors'
      >
        <Plus size={16} />
        Add Expense
      </button>
    </div>
  );

  if (variant === 'minimal') {
    return (
      <div className='glass-panel p-4'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
          <h2 className='text-xl font-bold text-white'>Fixed Expenses</h2>
          {controlsStrip}
        </div>
      </div>
    );
  }

  return (
    <div className='glass-panel p-6'>
      {/* Main Header */}
      <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6'>
        <div>
          <h2 className='text-2xl font-bold text-white mb-2'>Fixed Expenses</h2>
          <div className='flex flex-wrap gap-4 text-sm text-white/70'>
            <span>{totalExpenses} expenses</span>
            <span>Total Budgeted: {formatCurrency(totalAmount)}</span>
            <span>Paid: {formatCurrency(totalPaid)}</span>
            <span className='text-yellow-300'>
              Remaining: {formatCurrency(totalRemaining)}
            </span>
          </div>
        </div>

        <div className='flex flex-col sm:flex-row gap-3'>
          {/* Controls */}
          <div className='flex items-center gap-2'>
            {/* Sort Control */}
            <div className='flex items-center gap-1'>
              <button
                onClick={() =>
                  setSortBy(sortBy === 'dueDate' ? 'name' : 'dueDate')
                }
                className='flex items-center gap-1 px-3 py-2 text-sm glass-button'
                title={`Sort by ${sortBy === 'dueDate' ? 'name' : 'due date'}`}
              >
                {sortBy === 'dueDate' ? (
                  <SortAsc size={16} />
                ) : (
                  <SortDesc size={16} />
                )}
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
              title={
                showOnlyUnpaid
                  ? 'Show all expenses'
                  : 'Show only unpaid expenses'
              }
            >
              {showOnlyUnpaid ? <EyeOff size={16} /> : <Eye size={16} />}
              {showOnlyUnpaid ? 'All' : 'Unpaid'}
            </button>

            {/* Expense Type Filter */}
            <select
              value={expenseTypeFilter}
              onChange={e => setExpenseTypeFilter(e.target.value)}
              className='px-3 py-2 text-sm glass-button bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
              title='Filter by expense type'
            >
              <option value='all'>All Types</option>
              <option value='recurring'>Recurring Only</option>
              <option value='oneoff'>One-Off Only</option>
            </select>
          </div>

          {/* Add Expense Button */}
          <button
            onClick={() => setIsPanelOpen(true)}
            className='flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors'
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* By category: single card with summary strip + table */}
      {categoryRows.length > 0 && (
        <div className='glass-panel p-4 mt-4'>
          <h3 className='text-sm font-medium text-white/80 mb-3'>
            Category breakdown
          </h3>
          <div className='flex flex-wrap gap-4 text-sm text-white/70 mb-4'>
            <span>Total budgeted: {formatCurrency(totalAmount)}</span>
            <span>Paid: {formatCurrency(totalPaid)}</span>
            <span className='text-yellow-300'>
              Remaining: {formatCurrency(totalRemaining)}
            </span>
            <span>{totalExpenses} expenses</span>
          </div>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[280px] text-left'>
              <thead>
                <tr className='border-b border-white/10 text-xs text-white/60 uppercase tracking-wide'>
                  <th className='pb-2 pr-4 font-medium'>Category</th>
                  <th className='pb-2 pr-4 font-medium text-right'>Count</th>
                  <th className='pb-2 font-medium text-right'>Amount</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map(({ name, count, totalBudgeted }) => (
                  <tr
                    key={name}
                    role={onCategoryClick ? 'button' : null}
                    tabIndex={onCategoryClick ? 0 : undefined}
                    onClick={() => onCategoryClick?.(name)}
                    onKeyDown={e => {
                      if (
                        onCategoryClick &&
                        (e.key === 'Enter' || e.key === ' ')
                      ) {
                        e.preventDefault();
                        onCategoryClick(name);
                      }
                    }}
                    className={`border-b border-white/5 text-sm ${
                      onCategoryClick
                        ? 'cursor-pointer hover:bg-white/5 focus:outline-none focus:bg-white/5'
                        : ''
                    }`}
                  >
                    <td className='py-2 pr-4 text-white'>
                      {name === 'Uncategorized' ? 'Uncategorized' : name}
                    </td>
                    <td className='py-2 pr-4 text-right text-white/80'>
                      {count}
                    </td>
                    <td className='py-2 text-right text-white/80'>
                      {formatCurrency(totalBudgeted)}
                    </td>
                  </tr>
                ))}
                <tr className='border-t border-white/10 text-sm font-medium text-white/80'>
                  <td className='pt-2 pr-4'>Total</td>
                  <td className='pt-2 pr-4 text-right'>{totalExpenses}</td>
                  <td className='pt-2 text-right'>
                    {formatCurrency(totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

ExpenseTableHeader.propTypes = {
  expenses: PropTypes.arrayOf(PropTypes.object),
  groupedExpenses: PropTypes.object,
  totals: PropTypes.shape({
    totalExpenses: PropTypes.number,
    totalAmount: PropTypes.number,
    totalPaid: PropTypes.number,
    totalRemaining: PropTypes.number,
  }).isRequired,
  categoryTotals: PropTypes.object.isRequired,
  sortBy: PropTypes.string.isRequired,
  setSortBy: PropTypes.func.isRequired,
  showOnlyUnpaid: PropTypes.bool.isRequired,
  setShowOnlyUnpaid: PropTypes.func.isRequired,
  expenseTypeFilter: PropTypes.string.isRequired,
  setExpenseTypeFilter: PropTypes.func.isRequired,
  setIsPanelOpen: PropTypes.func.isRequired,
  onCategoryClick: PropTypes.func,
  variant: PropTypes.oneOf(['full', 'minimal']),
};

export default ExpenseTableHeader;

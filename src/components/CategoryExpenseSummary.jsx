import PropTypes from 'prop-types';
import { useState, useMemo, memo } from 'react';

import { formatCurrency } from '../utils/accountUtils';
import { createCategoryMap, getCategoryFromMap } from '../utils/categoryUtils';

import CategoryDetailView from './CategoryDetailView';
import DonutChart from './DonutChart';

const calculateTotals = (expenses, categoryMap) => {
  // Guard clauses for input validation
  if (!expenses || !Array.isArray(expenses)) return {};
  if (!categoryMap || !(categoryMap instanceof Map)) return {};

  return expenses.reduce((totals, expense) => {
    // Validate expense data
    const amount = Number(expense?.amount) || 0;
    const paidAmount = Number(expense?.paidAmount) || 0;

    // Skip invalid expenses (NaN, negative amounts)
    if (isNaN(amount) || amount < 0) return totals;

    const category = expense?.category || 'Uncategorized';
    if (!totals[category]) {
      const categoryData = getCategoryFromMap(categoryMap, category);
      totals[category] = {
        total: 0,
        paid: 0,
        count: 0,
        color: categoryData?.color || '#6B7280',
      };
    }

    // Sum original budgeted amounts, not remaining
    totals[category].total += amount;
    totals[category].paid += paidAmount || 0;
    totals[category].count += 1;
    return totals;
  }, {});
};

const CategoryExpenseSummaryBase = ({
  expenses,
  categories,
  onCategoryClick,
  compact = false,
}) => {
  // State management
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Input validation - default to empty arrays if null/undefined
  const safeExpenses = expenses || [];
  const safeCategories = categories || [];
  const hasExplicitExpensesProp = expenses !== null && expenses !== undefined;

  // Create categoryMap for O(1) lookups
  const categoryMap = useMemo(
    () => createCategoryMap(safeCategories),
    [safeCategories],
  );

  // Treat expenses as already scoped by the parent view (month/range)
  const categoryTotals = calculateTotals(safeExpenses, categoryMap);

  const totalAmount = Object.values(categoryTotals).reduce(
    (sum, cat) => sum + cat.total,
    0,
  );

  // Calculate percentages and prepare for visualization
  const categoryData = Object.entries(categoryTotals)
    .map(([name, data]) => ({
      name,
      total: data.total,
      paid: data.paid,
      count: data.count,
      percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
      color: data.color,
    }))
    .sort((a, b) => b.total - a.total); // Sort by total amount descending

  // Prepare expense data for donut chart
  const expenseData = categoryData.map(category => ({
    name: category.name,
    amount: category.total,
    percentage: category.percentage,
    color: category.color,
  }));

  // Helper function to get category details (uses current month expenses to match chart)
  const getCategoryDetails = categoryName => {
    const categoryExpenses = safeExpenses.filter(
      e => (e.category || 'Uncategorized') === categoryName,
    );
    const budgeted = categoryExpenses.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0,
    );
    const paid = categoryExpenses.reduce(
      (sum, e) => sum + (Number(e.paidAmount) || 0),
      0,
    );
    const remaining = Math.max(0, budgeted - paid);

    const categoryInfo = categoryTotals[categoryName] || {};
    const paidPercentage = budgeted > 0 ? (paid / budgeted) * 100 : 0;
    const remainingPercentage = budgeted > 0 ? (remaining / budgeted) * 100 : 0;

    return {
      budgeted,
      paid,
      remaining,
      paidPercentage,
      remainingPercentage,
      color: categoryInfo.color || '#6B7280',
      expenses: categoryExpenses,
    };
  };

  // Event handlers
  const handleSegmentClick = categoryName => {
    setSelectedCategory(categoryName);
    onCategoryClick?.(categoryName);
  };

  const handleBackClick = () => {
    setSelectedCategory(null);
  };

  return (
    <div className='glass-card p-6'>
      <h3
        className={`font-semibold text-primary ${
          compact ? 'text-base mb-3' : 'text-lg mb-4'
        }`}
      >
        Expense Distribution
      </h3>

      {/* Show appropriate message based on state */}
      {safeExpenses.length === 0 ? (
        <div className='text-center py-4'>
          <p className='text-white/60'>
            {hasExplicitExpensesProp
              ? 'No expenses to display.'
              : 'No fixed expenses added yet.'}
          </p>
          <p className='text-sm text-white/40 mt-1'>
            {hasExplicitExpensesProp
              ? 'Try selecting a different time range.'
              : 'Add expenses to see the distribution breakdown.'}
          </p>
        </div>
      ) : compact ? (
        // eslint-disable-next-line lines-around-comment -- compact layout comment
        /* Compact: donut on top, category table full width below */
        <div
          className='category-expense-summary-compact'
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '1rem',
          }}
        >
          <div
            className='category-expense-summary-compact-donut'
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <DonutChart
              data={expenseData}
              totalAmount={totalAmount}
              onSegmentClick={handleSegmentClick}
              size={150}
              showTotalUnderLegend={true}
              hideTable
            />
          </div>
          {selectedCategory ? (
            <div className='category-expense-summary-compact-detail'>
              <CategoryDetailView
                categoryName={selectedCategory}
                categoryData={getCategoryDetails(selectedCategory)}
                onBack={handleBackClick}
              />
            </div>
          ) : (
            <div className='category-expense-summary-compact-table-wrap'>
              <table className='category-expense-summary-compact-table'>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className='text-right'>%</th>
                    <th className='text-right'>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData.map(({ name, percentage, total }) => (
                    <tr
                      key={name}
                      role='button'
                      tabIndex={0}
                      onClick={() => handleSegmentClick(name)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSegmentClick(name);
                        }
                      }}
                      className='cursor-pointer hover:bg-white/5 focus:outline-none focus:bg-white/5'
                    >
                      <td>
                        {name === 'Uncategorized' ? 'Uncategorized' : name}
                      </td>
                      <td className='text-right'>{percentage.toFixed(1)}%</td>
                      <td className='text-right'>{formatCurrency(total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total Budgeted</td>
                    <td colSpan={2} className='text-right font-semibold'>
                      {formatCurrency(totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div
          className='relative overflow-hidden'
          style={{ minHeight: '400px' }}
        >
          {/* Donut Chart View */}
          <div
            className={`absolute inset-0 transition-transform duration-500 ease-in-out ${
              selectedCategory === null
                ? 'translate-x-0 opacity-100'
                : '-translate-x-full opacity-0'
            }`}
          >
            <DonutChart
              data={expenseData}
              totalAmount={totalAmount}
              onSegmentClick={handleSegmentClick}
              size={300}
              showTotalUnderLegend={true}
            />
          </div>

          {/* Category Detail View */}
          <div
            className={`absolute inset-0 transition-transform duration-500 ease-in-out ${
              selectedCategory !== null
                ? 'translate-x-0 opacity-100'
                : 'translate-x-full opacity-0'
            }`}
            style={{ pointerEvents: selectedCategory ? 'auto' : 'none' }}
          >
            {selectedCategory && (
              <CategoryDetailView
                categoryName={selectedCategory}
                categoryData={getCategoryDetails(selectedCategory)}
                onBack={handleBackClick}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CategoryExpenseSummary = memo(
  CategoryExpenseSummaryBase,
  (prevProps, nextProps) => {
    if (prevProps.compact !== nextProps.compact) return false;

    // Check onCategoryClick prop (Bug 1 fix)
    if (prevProps.onCategoryClick !== nextProps.onCategoryClick) return false;

    // Fast length checks first
    const prevLength = prevProps.expenses?.length || 0;
    const nextLength = nextProps.expenses?.length || 0;
    if (prevLength !== nextLength) return false;

    const prevCatLength = prevProps.categories?.length || 0;
    const nextCatLength = nextProps.categories?.length || 0;
    if (prevCatLength !== nextCatLength) return false;

    // Convert categories arrays to Maps before passing to calculateTotals
    const prevCategoryMap = createCategoryMap(prevProps.categories || []);
    const nextCategoryMap = createCategoryMap(nextProps.categories || []);

    // Calculate totals (only if lengths match)
    const prevTotals = calculateTotals(
      prevProps.expenses || [],
      prevCategoryMap,
    );
    const nextTotals = calculateTotals(
      nextProps.expenses || [],
      nextCategoryMap,
    );

    // Compare keys - verify they contain the same keys, not just same length
    const prevKeys = Object.keys(prevTotals).sort();
    const nextKeys = Object.keys(nextTotals).sort();
    if (prevKeys.length !== nextKeys.length) return false;

    // Verify keys are identical (not just same length)
    if (!prevKeys.every((key, index) => key === nextKeys[index])) {
      return false;
    }

    // Compare values directly including color and paid (Bug 2 fix)
    return prevKeys.every(key => {
      const prev = prevTotals[key];
      const next = nextTotals[key];

      // Safety check: ensure both values exist before accessing properties
      if (!prev || !next) return false;
      return (
        prev.total === next.total &&
        prev.paid === next.paid &&
        prev.count === next.count &&
        prev.color === next.color
      );
    });
  },
);

CategoryExpenseSummaryBase.propTypes = {
  expenses: PropTypes.arrayOf(PropTypes.object),
  categories: PropTypes.arrayOf(PropTypes.object),
  onCategoryClick: PropTypes.func,
  compact: PropTypes.bool,
};

CategoryExpenseSummary.propTypes = CategoryExpenseSummaryBase.propTypes;

export default CategoryExpenseSummary;

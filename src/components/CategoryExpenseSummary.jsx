import React from 'react';
import PrivacyWrapper from './PrivacyWrapper';
import { formatCurrency } from '../utils/accountUtils';
import ExpenseBar from './ExpenseBar';

const calculateTotals = (expenses, categories) => {
  return expenses.reduce((totals, expense) => {
    const category = expense.category || 'Uncategorized';
    if (!totals[category]) {
      totals[category] = {
        total: 0,
        count: 0,
        color: categories.find(c => c.name === category)?.color || '#6B7280',
      };
    }
    const remaining = expense.amount - (expense.paidAmount || 0);
    totals[category].total += remaining > 0 ? remaining : 0; // Don't count negative remainders
    totals[category].count += 1;
    return totals;
  }, {});
};

const CategoryExpenseSummaryBase = ({ expenses, categories }) => {
  // Use shared calculation logic
  const categoryTotals = calculateTotals(expenses, categories);

  const totalAmount = Object.values(categoryTotals).reduce((sum, cat) => sum + cat.total, 0);

  // Calculate percentages and prepare for visualization
  const categoryData = Object.entries(categoryTotals).map(([name, data]) => ({
    name,
    total: data.total,
    count: data.count,
    percentage: (data.total / totalAmount) * 100,
    color: data.color,
  })).sort((a, b) => b.total - a.total); // Sort by total amount descending

  // Prepare expense data for bar chart
  const expenseData = categoryData.map(category => ({
    name: category.name,
    amount: category.total,
    percentage: category.percentage,
    color: category.color,
  }));

  return (
    <div className="glass-panel">
      <h3 className="text-lg font-semibold text-primary mb-4">Expense Distribution</h3>

      {/* Horizontal Bar Chart Layout */}
      <div className="space-y-0">
        {expenseData.map((expense, index) => (
          <ExpenseBar
            key={expense.name}
            expense={expense}
            index={index}
            totalAmount={totalAmount}
          />
        ))}
      </div>

      {/* Total Section */}
      <div className="mt-5 pt-4 border-t border-white/10">
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/70">Total Fixed Expenses</span>
          <PrivacyWrapper>
            <span className="text-lg font-bold text-white">{formatCurrency(totalAmount)}</span>
          </PrivacyWrapper>
        </div>
      </div>
    </div>
  );
};

const CategoryExpenseSummary = React.memo(CategoryExpenseSummaryBase, (prevProps, nextProps) => {
  // Only re-render if the totals or categories actually changed
  const prevTotals = calculateTotals(prevProps.expenses, prevProps.categories);
  const nextTotals = calculateTotals(nextProps.expenses, nextProps.categories);
  return JSON.stringify(prevTotals) === JSON.stringify(nextTotals);
});

export default CategoryExpenseSummary;

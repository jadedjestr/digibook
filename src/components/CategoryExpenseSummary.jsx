import React from 'react';
import PrivacyWrapper from './PrivacyWrapper';
import { Home, Zap, Shield, Car, Smartphone, CreditCard, Stethoscope, GraduationCap, Package } from 'lucide-react';

const calculateTotals = (expenses, categories) => {
  return expenses.reduce((totals, expense) => {
    const category = expense.category || 'Uncategorized';
    if (!totals[category]) {
      totals[category] = {
        total: 0,
        count: 0,
        color: categories.find(c => c.name === category)?.color || '#6B7280'
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
    color: data.color
  })).sort((a, b) => b.total - a.total); // Sort by total amount descending

  // Generate SVG path for pie chart
  const generatePieChart = () => {
    const size = 160; // SVG size
    const radius = size / 2;
    const center = size / 2;
    let startAngle = 0;
    
    return categoryData.map(category => {
      const angle = (category.percentage / 100) * 360;
      const endAngle = startAngle + angle;
      
      // Calculate path
      const x1 = center + radius * Math.cos(Math.PI * startAngle / 180);
      const y1 = center + radius * Math.sin(Math.PI * startAngle / 180);
      const x2 = center + radius * Math.cos(Math.PI * endAngle / 180);
      const y2 = center + radius * Math.sin(Math.PI * endAngle / 180);
      
      // Generate path string
      const largeArcFlag = angle > 180 ? 1 : 0;
      const path = `M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2} Z`;
      
      const segment = (
        <path
          key={category.name}
          d={path}
          fill={category.color}
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="1"
          className="transition-all duration-200 hover:opacity-80"
        >
          <title>{category.name}: ${category.total.toFixed(2)} ({category.percentage.toFixed(1)}%)</title>
        </path>
      );
      
      startAngle += angle;
      return segment;
    });
  };

  const getCategoryIcon = (categoryName) => {
    switch (categoryName) {
      case 'Housing':
        return <Home size={16} />;
      case 'Utilities':
        return <Zap size={16} />;
      case 'Insurance':
        return <Shield size={16} />;
      case 'Transportation':
        return <Car size={16} />;
      case 'Subscriptions':
        return <Smartphone size={16} />;
      case 'Debt':
        return <CreditCard size={16} />;
      case 'Healthcare':
        return <Stethoscope size={16} />;
      case 'Education':
        return <GraduationCap size={16} />;
      default:
        return <Package size={16} />;
    }
  };

  return (
    <div className="glass-panel">
      <h3 className="text-lg font-semibold text-primary mb-4">Expense Distribution</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="flex items-center justify-center">
          <svg width="160" height="160" viewBox="0 0 160 160">
            {generatePieChart()}
          </svg>
        </div>

        {/* Category List */}
        <div className="space-y-3">
          {categoryData.map(category => (
            <div key={category.name} className="flex items-center justify-between p-2 rounded hover:bg-white/5">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                <div className="flex items-center space-x-2">
                  <span className="text-white/70">{getCategoryIcon(category.name)}</span>
                  <span className="text-sm">{category.name}</span>
                </div>
              </div>
              <div className="text-right">
                <PrivacyWrapper>
                  <div className="text-sm font-medium">${category.total.toFixed(2)}</div>
                  <div className="text-xs text-white/50">{category.percentage.toFixed(1)}%</div>
                </PrivacyWrapper>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/70">Total Fixed Expenses</span>
          <PrivacyWrapper>
            <span className="text-lg font-bold">${totalAmount.toFixed(2)}</span>
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

import { ChevronDown, ChevronRight, Package, Plus } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

import { formatCurrency } from '../../utils/accountUtils';
import { getCategoryFromMap } from '../../utils/categoryUtils';
import CategoryDropZone from '../CategoryDropZone';

import ExpenseMobileView from './ExpenseMobileView';
import ExpenseTableBody from './ExpenseTableBody';

/**
 * Component that displays a group of expenses for a specific category
 * Handles category header, collapse/expand, and renders appropriate view
 */
const ExpenseCategoryGroup = ({
  categoryName,
  categoryExpenses,
  categoryMap,
  collapsedCategories,
  setCollapsedCategories,
  getCategoryTotal,
  paycheckService,
  paycheckDates,
  accounts,
  creditCards,
  newExpenseId,
  updatingExpenseId,
  onMarkAsPaid,
  onDuplicate,
  onDelete,
  onUpdateExpense,
  onEditRecurring,
  onExpenseAdded,
  activeId,
}) => {
  // State for quick add functionality
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Get category icon from database
  const getCategoryIcon = categoryName => {
    const category = getCategoryFromMap(categoryMap, categoryName);
    if (category?.icon) {
      return <span className='text-lg'>{category.icon}</span>;
    }

    // Fallback to default icon
    return <Package size={20} className='text-gray-300' />;
  };

  // Get category display name
  const getCategoryDisplayName = categoryName => {
    return categoryName === 'Uncategorized'
      ? 'Uncategorized Expenses'
      : `${categoryName} Expenses`;
  };

  // Get category color from categoryMap
  const getCategoryColor = categoryName => {
    const category = getCategoryFromMap(categoryMap, categoryName);
    return category?.color || '#6B7280';
  };

  const isCollapsed = collapsedCategories.has(categoryName);
  const categoryTotal = getCategoryTotal(categoryExpenses);
  const paidCount = categoryExpenses.filter(
    expense =>
      (expense.paidAmount || 0) >= expense.amount && expense.amount > 0,
  ).length;
  const totalCount = categoryExpenses.length;

  const toggleCollapse = () => {
    const newCollapsed = new Set(collapsedCategories);
    if (isCollapsed) {
      newCollapsed.delete(categoryName);
    } else {
      newCollapsed.add(categoryName);
    }
    setCollapsedCategories(newCollapsed);
  };

  const handleShowQuickAdd = e => {
    e.stopPropagation(); // Prevent triggering collapse
    setShowQuickAdd(true);

    // Expand category if it's collapsed
    if (isCollapsed) {
      const newCollapsed = new Set(collapsedCategories);
      newCollapsed.delete(categoryName);
      setCollapsedCategories(newCollapsed);
    }
  };

  const handleCloseQuickAdd = () => {
    setShowQuickAdd(false);
  };

  const handleExpenseAdded = newExpenseId => {
    // Call parent callback to refresh data
    if (onExpenseAdded) {
      onExpenseAdded(newExpenseId);
    }

    // Keep the quick add row open for adding more expenses
  };

  return (
    <div className='glass-panel' data-category={categoryName}>
      {/* Category Header */}
      <div
        className='flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors relative'
        onClick={toggleCollapse}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCollapse();
          }
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        role='button'
        tabIndex={0}
        aria-expanded={!isCollapsed}
      >
        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-2'>
            {isCollapsed ? (
              <ChevronRight size={20} className='text-white/70' />
            ) : (
              <ChevronDown size={20} className='text-white/70' />
            )}
            {getCategoryIcon(categoryName)}
          </div>
          <div>
            <h3 className='text-lg font-semibold text-white'>
              {getCategoryDisplayName(categoryName)}
            </h3>
            <div className='flex items-center gap-4 text-sm text-white/70'>
              <span>{totalCount} expenses</span>
              <span>{paidCount} paid</span>
              <span className='text-yellow-300'>
                {formatCurrency(categoryTotal)} remaining
              </span>
            </div>
          </div>
        </div>

        <div className='flex items-center gap-4'>
          {/* Progress indicator */}
          <div className='flex items-center gap-2'>
            <div className='w-16 h-2 bg-white/10 rounded-full overflow-hidden'>
              <div
                className='h-full bg-green-400 transition-transform duration-300'
                style={{
                  width: '100%',
                  transform: `scaleX(${(totalCount > 0 ? (paidCount / totalCount) * 100 : 0) / 100})`,
                  transformOrigin: 'left',
                }}
              />
            </div>
            <span className='text-xs text-white/60'>
              {totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0}%
            </span>
          </div>

          {/* Category color indicator */}
          <div
            className='w-4 h-4 rounded-full border border-white/20'
            style={{ backgroundColor: getCategoryColor(categoryName) }}
          />

          {/* Quick Add Button - appears on hover */}
          <button
            onClick={handleShowQuickAdd}
            className={`p-2 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300
              hover:bg-blue-500/30 hover:text-blue-200 transition-all duration-300 ease-out
              ${
                isHovering
                  ? 'opacity-100 scale-100 translate-x-0'
                  : 'opacity-0 scale-95 translate-x-2 pointer-events-none'
              }`}
            title={`Add new ${categoryName} expense`}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Expenses Display for this category */}
      {!isCollapsed && (
        <>
          {/* Desktop Table View */}
          <ExpenseTableBody
            categoryExpenses={categoryExpenses}
            paycheckService={paycheckService}
            paycheckDates={paycheckDates}
            accounts={accounts}
            creditCards={creditCards}
            newExpenseId={newExpenseId}
            updatingExpenseId={updatingExpenseId}
            onMarkAsPaid={onMarkAsPaid}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onUpdateExpense={onUpdateExpense}
            onEditRecurring={onEditRecurring}
            categoryName={categoryName}
            showQuickAdd={showQuickAdd}
            onQuickAddClose={handleCloseQuickAdd}
            onExpenseAdded={handleExpenseAdded}
          />

          {/* Mobile Card View */}
          <ExpenseMobileView
            categoryExpenses={categoryExpenses}
            paycheckService={paycheckService}
            paycheckDates={paycheckDates}
            accounts={accounts}
            creditCards={creditCards}
            newExpenseId={newExpenseId}
            updatingExpenseId={updatingExpenseId}
            onMarkAsPaid={onMarkAsPaid}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onUpdateExpense={onUpdateExpense}
            onEditRecurring={onEditRecurring}
          />

          {/* Drop Zone for drag and drop */}
          <CategoryDropZone
            categoryName={categoryName}
            getCategoryDisplayName={getCategoryDisplayName}
            activeId={activeId}
          />
        </>
      )}
    </div>
  );
};

ExpenseCategoryGroup.propTypes = {
  categoryName: PropTypes.string.isRequired,
  categoryExpenses: PropTypes.arrayOf(PropTypes.object).isRequired,
  categoryMap: PropTypes.object.isRequired,
  collapsedCategories: PropTypes.instanceOf(Set).isRequired,
  setCollapsedCategories: PropTypes.func.isRequired,
  getCategoryTotal: PropTypes.func.isRequired,
  paycheckService: PropTypes.object.isRequired,
  paycheckDates: PropTypes.object.isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  creditCards: PropTypes.arrayOf(PropTypes.object).isRequired,
  newExpenseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  updatingExpenseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onMarkAsPaid: PropTypes.func.isRequired,
  onDuplicate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onUpdateExpense: PropTypes.func.isRequired,
  onEditRecurring: PropTypes.func.isRequired,
  onExpenseAdded: PropTypes.func.isRequired,
  activeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default ExpenseCategoryGroup;

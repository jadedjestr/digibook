import {
  ChevronDown,
  ChevronRight,
  Home,
  Zap,
  Shield,
  Car,
  Smartphone,
  CreditCard,
  Stethoscope,
  GraduationCap,
  Package,
} from 'lucide-react';
import React from 'react';

import { formatCurrency } from '../../utils/accountUtils';
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
  categories,
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
  activeId,
}) => {
  // Get category icon
  const getCategoryIcon = categoryName => {
    switch (categoryName) {
      case 'Housing':
        return <Home size={20} className='text-blue-300' />;
      case 'Utilities':
        return <Zap size={20} className='text-green-300' />;
      case 'Insurance':
        return <Shield size={20} className='text-yellow-300' />;
      case 'Transportation':
        return <Car size={20} className='text-purple-300' />;
      case 'Subscriptions':
        return <Smartphone size={20} className='text-pink-300' />;
      case 'Debt':
        return <CreditCard size={20} className='text-red-300' />;
      case 'Healthcare':
        return <Stethoscope size={20} className='text-cyan-300' />;
      case 'Education':
        return <GraduationCap size={20} className='text-lime-300' />;
      default:
        return <Package size={20} className='text-gray-300' />;
    }
  };

  // Get category display name
  const getCategoryDisplayName = categoryName => {
    return categoryName === 'Uncategorized'
      ? 'Uncategorized Expenses'
      : `${categoryName} Expenses`;
  };

  // Get category color from categories data
  const getCategoryColor = categoryName => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.color || '#6B7280';
  };

  const isCollapsed = collapsedCategories.has(categoryName);
  const categoryTotal = getCategoryTotal(categoryExpenses);
  const paidCount = categoryExpenses.filter(
    expense => expense.status === 'paid'
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

  return (
    <div className='glass-panel'>
      {/* Category Header */}
      <div
        className='flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors'
        onClick={toggleCollapse}
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
                className='h-full bg-green-400 transition-all duration-300'
                style={{
                  width: `${totalCount > 0 ? (paidCount / totalCount) * 100 : 0}%`,
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

export default ExpenseCategoryGroup;

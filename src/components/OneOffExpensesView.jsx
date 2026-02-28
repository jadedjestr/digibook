import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Trash2,
  RefreshCw,
  Calendar as CalendarIcon,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useMemo, useState, useEffect } from 'react';

import { dbHelpers } from '../db/database-clean';
import { createTemplate } from '../services/recurringExpenseService';
import { formatCurrency } from '../utils/accountUtils';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

import RecurringExpenseModal from './RecurringExpenseModal';
import StatusBadge from './StatusBadge';

const OneOffExpensesView = ({
  expenses,
  paycheckService,
  paycheckDates,
  accounts,
  creditCards,
  onMarkAsPaid,
  onDelete,
  onUpdateExpense,
  onReloadExpenses,
}) => {
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const [selectedExpenses, setSelectedExpenses] = useState(new Set());
  const [showBulkDateModal, setShowBulkDateModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [bulkDateValue, setBulkDateValue] = useState('');

  // Filter to only future one-offs
  const futureOneOffs = useMemo(() => {
    const today = DateUtils.today();
    return expenses.filter(
      expense =>
        (!expense.recurringTemplateId ||
          expense.recurringTemplateId === null) &&
        expense.dueDate >= today,
    );
  }, [expenses]);

  // Group by month
  const expensesByMonth = useMemo(() => {
    const groups = {};
    futureOneOffs.forEach(expense => {
      const date = DateUtils.parseDate(expense.dueDate);
      if (!date) return;

      const year = date.getFullYear();
      const month = date.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      if (!groups[monthKey]) {
        groups[monthKey] = {
          label: monthLabel,
          expenses: [],
        };
      }
      groups[monthKey].expenses.push(expense);
    });

    // Sort expenses within each month by due date
    Object.values(groups).forEach(group => {
      group.expenses.sort((a, b) => {
        const dateA = DateUtils.parseDate(a.dueDate);
        const dateB = DateUtils.parseDate(b.dueDate);
        return dateA - dateB;
      });
    });

    return groups;
  }, [futureOneOffs]);

  const monthKeys = Object.keys(expensesByMonth).sort();

  const toggleMonth = monthKey => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  // Expand first month by default
  useEffect(() => {
    if (monthKeys.length > 0 && expandedMonths.size === 0) {
      setExpandedMonths(new Set([monthKeys[0]]));
    }
  }, [monthKeys, expandedMonths.size]);

  // Toggle expense selection
  const toggleExpenseSelection = expenseId => {
    setSelectedExpenses(prev => {
      const next = new Set(prev);
      if (next.has(expenseId)) {
        next.delete(expenseId);
      } else {
        next.add(expenseId);
      }
      return next;
    });
  };

  // Select all expenses
  const selectAll = () => {
    setSelectedExpenses(new Set(futureOneOffs.map(e => e.id)));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedExpenses(new Set());
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedExpenses.size === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedExpenses.size} expense(s)?`,
      )
    ) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedExpenses).map(id =>
        onDelete(id),
      );
      const deleteCount = selectedExpenses.size;
      await Promise.all(deletePromises);
      setSelectedExpenses(new Set());
      notify.success(`Deleted ${deleteCount} expense(s)`);

      // Reload expenses to reflect the changes
      if (onReloadExpenses) {
        await onReloadExpenses();
      }
    } catch (error) {
      logger.error('Error bulk deleting expenses:', error);
      notify.error('Failed to delete some expenses');
    }
  };

  // Bulk date update
  const handleBulkDateUpdate = async () => {
    if (selectedExpenses.size === 0 || !bulkDateValue) return;

    try {
      const updatePromises = Array.from(selectedExpenses).map(id =>
        onUpdateExpense(id, { dueDate: bulkDateValue }),
      );
      const updateCount = selectedExpenses.size;
      await Promise.all(updatePromises);
      setSelectedExpenses(new Set());
      setShowBulkDateModal(false);
      setBulkDateValue('');
      notify.success(`Updated ${updateCount} expense(s)`);

      // Reload expenses to reflect the changes
      if (onReloadExpenses) {
        await onReloadExpenses();
      }
    } catch (error) {
      logger.error('Error bulk updating dates:', error);
      notify.error('Failed to update some expenses');
    }
  };

  // Bulk convert to recurring
  const handleBulkConvert = async recurringData => {
    if (selectedExpenses.size === 0) return;

    const selectedCount = selectedExpenses.size;

    try {
      const convertPromises = Array.from(selectedExpenses).map(async id => {
        const expense = futureOneOffs.find(e => e.id === id);
        if (!expense) return;

        const templateId = await createTemplate({
          name: expense.name,
          baseAmount: expense.amount,
          frequency: recurringData.frequency || 'monthly',
          intervalValue: recurringData.intervalValue || 1,
          intervalUnit: recurringData.intervalUnit || 'months',
          startDate: recurringData.startDate || expense.dueDate,
          nextDueDate: recurringData.startDate || expense.dueDate,
          endDate: recurringData.endDate || null,
          category: expense.category,
          accountId: expense.accountId || null,
          creditCardId: expense.creditCardId || null,
          targetCreditCardId: expense.targetCreditCardId || null, // For credit card payments
          notes: expense.notes || '',
          isVariableAmount: expense.isVariableAmount || false,
        });

        // Link the expense to the template
        await dbHelpers.updateFixedExpenseV4(id, {
          recurringTemplateId: templateId,
        });
      });

      await Promise.all(convertPromises);
      setSelectedExpenses(new Set());
      setShowConvertModal(false);
      notify.success(`Converted ${selectedCount} expense(s) to recurring`);

      // Reload expenses to reflect the changes
      if (onReloadExpenses) {
        await onReloadExpenses();
      }
    } catch (error) {
      logger.error('Error bulk converting expenses:', error);
      notify.error('Failed to convert some expenses');
    }
  };

  if (futureOneOffs.length === 0) {
    return (
      <div className='text-center p-8'>
        <div className='text-white/70 mb-2'>No future one-off expenses</div>
        <p className='text-white/50 text-sm'>
          One-off expenses scheduled for future dates will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='glass-panel p-4 mb-4'>
        <div className='flex items-center justify-between mb-2'>
          <div>
            <h3 className='text-xl font-bold text-primary mb-2'>
              All Future One-Off Expenses
            </h3>
            <p className='text-white/70 text-sm'>
              {futureOneOffs.length} one-off expense
              {futureOneOffs.length !== 1 ? 's' : ''} scheduled
            </p>
          </div>
          <div className='flex items-center space-x-2'>
            {selectedExpenses.size > 0 && (
              <>
                <button
                  onClick={deselectAll}
                  className='px-3 py-1 text-sm glass-button'
                >
                  Deselect All
                </button>
                <button
                  onClick={selectAll}
                  className='px-3 py-1 text-sm glass-button'
                >
                  Select All
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedExpenses.size > 0 && (
          <div className='mt-4 pt-4 border-t border-white/10 flex items-center space-x-2 flex-wrap gap-2'>
            <span className='text-white/70 text-sm'>
              {selectedExpenses.size} selected
            </span>
            <button
              onClick={handleBulkDelete}
              className='px-3 py-1 text-sm bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-colors flex items-center space-x-1'
            >
              <Trash2 size={14} />
              <span>Delete Selected</span>
            </button>
            <button
              onClick={() => setShowBulkDateModal(true)}
              className='px-3 py-1 text-sm bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 transition-colors flex items-center space-x-1'
            >
              <CalendarIcon size={14} />
              <span>Bulk Date Update</span>
            </button>
            <button
              onClick={() => setShowConvertModal(true)}
              className='px-3 py-1 text-sm bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30 transition-colors flex items-center space-x-1'
            >
              <RefreshCw size={14} />
              <span>Convert to Recurring</span>
            </button>
          </div>
        )}
      </div>

      <div className='space-y-2'>
        {monthKeys.map(monthKey => {
          const monthData = expensesByMonth[monthKey];
          const isExpanded = expandedMonths.has(monthKey);

          return (
            <div key={monthKey} className='glass-panel'>
              <button
                onClick={() => toggleMonth(monthKey)}
                className='w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors'
              >
                <div className='flex items-center space-x-3'>
                  {isExpanded ? (
                    <ChevronDown size={20} className='text-white/70' />
                  ) : (
                    <ChevronRight size={20} className='text-white/70' />
                  )}
                  <Calendar size={20} className='text-primary' />
                  <div className='text-left'>
                    <div className='text-lg font-semibold text-primary'>
                      {monthData.label}
                    </div>
                    <div className='text-sm text-white/70'>
                      {monthData.expenses.length} expense
                      {monthData.expenses.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className='text-right'>
                  <div className='text-lg font-bold text-primary'>
                    {formatCurrency(
                      monthData.expenses.reduce(
                        (sum, e) =>
                          sum +
                          (e.amount - (e.paidAmount || 0) > 0
                            ? e.amount - (e.paidAmount || 0)
                            : 0),
                        0,
                      ),
                    )}
                  </div>
                  <div className='text-xs text-white/60'>Remaining</div>
                </div>
              </button>

              {isExpanded && (
                <div className='px-4 pb-4 space-y-2'>
                  {monthData.expenses.map(expense => {
                    const status = paycheckService.calculateExpenseStatus(
                      expense,
                      paycheckDates,
                    );
                    const account = accounts.find(
                      a => a.id === expense.accountId,
                    );
                    const creditCard = creditCards.find(
                      c => c.id === expense.creditCardId,
                    );
                    const paymentSource = (() => {
                      if (account) return account.name;
                      if (creditCard) return creditCard.name;
                      return 'Not set';
                    })();

                    return (
                      <div
                        key={expense.id}
                        className={`bg-white/5 rounded-lg p-4 border-l-2 border-l-purple-400/30 ${
                          selectedExpenses.has(expense.id)
                            ? 'ring-2 ring-blue-500/50'
                            : ''
                        }`}
                      >
                        <div className='flex items-start justify-between mb-2'>
                          <div className='flex items-center space-x-2 flex-1'>
                            <input
                              type='checkbox'
                              checked={selectedExpenses.has(expense.id)}
                              onChange={() =>
                                toggleExpenseSelection(expense.id)
                              }
                              className='w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50'
                            />
                            <div className='flex-1'>
                              <div className='flex items-center space-x-2 mb-1'>
                                <h4 className='text-primary font-semibold'>
                                  {expense.name}
                                </h4>
                                <span className='text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/30'>
                                  One-time
                                </span>
                              </div>
                              <div className='text-sm text-white/70'>
                                Due:{' '}
                                {DateUtils.formatShortDate(expense.dueDate)}
                              </div>
                              <div className='text-sm text-white/70'>
                                Source: {paymentSource}
                              </div>
                            </div>
                          </div>
                          <div className='text-right ml-4'>
                            <div className='text-lg font-bold text-primary mb-1'>
                              {formatCurrency(expense.amount)}
                            </div>
                            <StatusBadge status={status} />
                          </div>
                        </div>
                        <div className='flex items-center space-x-2 mt-3 pt-3 border-t border-white/10'>
                          <button
                            onClick={() => onMarkAsPaid(expense.id)}
                            className='px-3 py-1 text-sm bg-green-500/20 text-green-300 rounded hover:bg-green-500/30 transition-colors'
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const templateId = await createTemplate({
                                  name: expense.name,
                                  baseAmount: expense.amount,
                                  frequency: 'monthly',
                                  intervalValue: 1,
                                  intervalUnit: 'months',
                                  startDate: expense.dueDate,
                                  nextDueDate: expense.dueDate,
                                  endDate: null,
                                  category: expense.category,
                                  accountId: expense.accountId || null,
                                  creditCardId: expense.creditCardId || null,
                                  notes: expense.notes || '',
                                  isVariableAmount:
                                    expense.isVariableAmount || false,
                                });

                                await dbHelpers.updateFixedExpenseV4(
                                  expense.id,
                                  {
                                    recurringTemplateId: templateId,
                                  },
                                );

                                notify.success(
                                  'Converted to recurring expense',
                                );

                                // Reload expenses to reflect the change
                                if (onReloadExpenses) {
                                  await onReloadExpenses();
                                }
                              } catch (error) {
                                logger.error(
                                  'Error converting expense:',
                                  error,
                                );
                                notify.error('Failed to convert expense');
                              }
                            }}
                            className='px-3 py-1 text-sm bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30 transition-colors flex items-center space-x-1'
                          >
                            <RefreshCw size={14} />
                            <span>Convert to Recurring</span>
                          </button>
                          <button
                            onClick={() => onDelete(expense.id)}
                            className='px-3 py-1 text-sm bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-colors'
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bulk Date Update Modal */}
      {showBulkDateModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='glass-panel p-6 max-w-md mx-4'>
            <h3 className='text-lg font-semibold text-white mb-4'>
              Bulk Date Update
            </h3>
            <div className='space-y-4'>
              <div>
                <label
                  htmlFor='bulk-due-date'
                  className='block text-white/70 text-sm mb-2'
                >
                  New Due Date
                </label>
                <input
                  id='bulk-due-date'
                  type='date'
                  value={bulkDateValue}
                  onChange={e => setBulkDateValue(e.target.value)}
                  className='w-full glass-input'
                />
              </div>
              <div className='flex gap-3'>
                <button
                  onClick={() => {
                    setShowBulkDateModal(false);
                    setBulkDateValue('');
                  }}
                  className='flex-1 px-4 py-2 glass-button'
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDateUpdate}
                  disabled={!bulkDateValue}
                  className='flex-1 px-4 py-2 glass-button glass-button--primary disabled:opacity-50'
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Recurring Modal */}
      {showConvertModal && (
        <RecurringExpenseModal
          isOpen={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          mode='create'
          onSave={handleBulkConvert}
          accounts={accounts}
          creditCards={creditCards}
        />
      )}
    </div>
  );
};

OneOffExpensesView.propTypes = {
  expenses: PropTypes.arrayOf(PropTypes.object).isRequired,
  paycheckService: PropTypes.object.isRequired,
  paycheckDates: PropTypes.object.isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  creditCards: PropTypes.arrayOf(PropTypes.object).isRequired,
  onMarkAsPaid: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onUpdateExpense: PropTypes.func.isRequired,
  onReloadExpenses: PropTypes.func.isRequired,
};

export default OneOffExpensesView;

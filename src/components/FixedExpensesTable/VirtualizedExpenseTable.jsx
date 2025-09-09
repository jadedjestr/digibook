import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useMemo } from 'react';

import DraggableExpenseRow from '../DraggableExpenseRow';

/**
 * Virtualized table component for displaying large lists of expenses efficiently
 * Uses @tanstack/react-virtual for performance optimization
 */
const VirtualizedExpenseTable = ({
  categoryExpenses,
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
  parentRef,
}) => {
  // Create virtualizer for the expense list
  const virtualizer = useVirtualizer({
    count: categoryExpenses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above and below viewport
  });

  // Memoize the virtual items to prevent unnecessary recalculations
  const virtualItems = useMemo(
    () => virtualizer.getVirtualItems(),
    [virtualizer, categoryExpenses.length]
  );

  return (
    <div className='hidden lg:block'>
      <table className='glass-table'>
        <thead>
          <tr>
            <th>Name</th>
            <th>Due Date</th>
            <th>Amount</th>
            <th>Account</th>
            <th>Paid Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <SortableContext
            items={categoryExpenses.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            {/* Virtual container */}
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualItems.map(virtualItem => {
                const expense = categoryExpenses[virtualItem.index];
                const status = paycheckService.calculateExpenseStatus(
                  expense,
                  paycheckDates
                );

                // Find account in both regular accounts and credit cards
                let account = creditCards.find(
                  card => card.id === expense.accountId
                );
                if (!account) {
                  account = accounts.find(acc => acc.id === expense.accountId);
                }

                const isNewExpense = newExpenseId === expense.id;

                return (
                  <div
                    key={expense.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <DraggableExpenseRow
                      expense={expense}
                      status={status}
                      account={account}
                      isNewExpense={isNewExpense}
                      isUpdating={updatingExpenseId === expense.id}
                      onMarkAsPaid={onMarkAsPaid}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                      onUpdateExpense={onUpdateExpense}
                      accounts={accounts}
                      creditCards={creditCards}
                    />
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </tbody>
      </table>
    </div>
  );
};

export default VirtualizedExpenseTable;

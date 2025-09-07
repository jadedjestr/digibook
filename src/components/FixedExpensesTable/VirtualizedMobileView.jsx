import React, { useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import MobileExpenseCard from '../MobileExpenseCard';

/**
 * Virtualized mobile view component for displaying large lists of expenses efficiently
 * Uses @tanstack/react-virtual for performance optimization on mobile devices
 */
const VirtualizedMobileView = ({
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
    estimateSize: () => 120, // Estimated card height in pixels (larger than table rows)
    overscan: 3, // Render 3 extra items above and below viewport
  });

  // Memoize the virtual items to prevent unnecessary recalculations
  const virtualItems = useMemo(() => virtualizer.getVirtualItems(), [
    virtualizer,
    categoryExpenses.length,
  ]);

  return (
    <div className="lg:hidden">
      {/* Virtual container */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const expense = categoryExpenses[virtualItem.index];
          const status = paycheckService.calculateExpenseStatus(expense, paycheckDates);
          
          // Find account in both regular accounts and credit cards
          let account = creditCards.find(card => card.id === expense.accountId);
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
                padding: '0 1rem', // Add padding for mobile cards
              }}
            >
              <MobileExpenseCard
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
    </div>
  );
};

export default VirtualizedMobileView;

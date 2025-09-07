import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import DraggableExpenseRow from '../DraggableExpenseRow';

/**
 * Desktop table view component for displaying expenses
 * Handles the table structure and sortable context for drag and drop
 */
const ExpenseTableBody = ({
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
}) => {
  return (
    <div className="hidden lg:block">
      <table className="glass-table">
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
            {categoryExpenses.map((expense) => {
              const status = paycheckService.calculateExpenseStatus(expense, paycheckDates);
              
              // Find account in both regular accounts and credit cards
              let account = creditCards.find(card => card.id === expense.accountId);
              if (!account) {
                account = accounts.find(acc => acc.id === expense.accountId);
              }
              
              const isNewExpense = newExpenseId === expense.id;

              return (
                <DraggableExpenseRow
                  key={expense.id}
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
              );
            })}
          </SortableContext>
        </tbody>
      </table>
    </div>
  );
};

export default ExpenseTableBody;

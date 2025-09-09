import React from 'react';

import MobileExpenseCard from '../MobileExpenseCard';

/**
 * Mobile card view component for displaying expenses
 * Renders expense cards optimized for mobile devices
 */
const ExpenseMobileView = ({
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
    <div className='lg:hidden space-y-4 p-4'>
      {categoryExpenses.map(expense => {
        const status = paycheckService.calculateExpenseStatus(
          expense,
          paycheckDates
        );

        // Find account in both regular accounts and credit cards
        let account = creditCards.find(card => card.id === expense.accountId);
        if (!account) {
          account = accounts.find(acc => acc.id === expense.accountId);
        }

        const isNewExpense = newExpenseId === expense.id;

        return (
          <MobileExpenseCard
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
    </div>
  );
};

export default ExpenseMobileView;

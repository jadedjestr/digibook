import PropTypes from 'prop-types';

import { findPaymentSource } from '../../utils/expenseUtils';
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
  onEditRecurring,
}) => {
  return (
    <div className='lg:hidden space-y-4 p-4'>
      {categoryExpenses.map(expense => {
        const status = paycheckService.calculateExpenseStatus(
          expense,
          paycheckDates,
        );

        // Find payment source using V4 format utility (no legacy fallback)
        const account = findPaymentSource(expense, accounts, creditCards);

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
            onEditRecurring={onEditRecurring}
            accounts={accounts}
            creditCards={creditCards}
          />
        );
      })}
    </div>
  );
};

ExpenseMobileView.propTypes = {
  categoryExpenses: PropTypes.arrayOf(PropTypes.object).isRequired,
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
};

export default ExpenseMobileView;

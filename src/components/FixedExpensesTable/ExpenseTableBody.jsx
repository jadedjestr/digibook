import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import PropTypes from 'prop-types';

import { findPaymentSource } from '../../utils/expenseUtils';
import DraggableExpenseRow from '../DraggableExpenseRow';

import QuickAddRow from './QuickAddRow';

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
  onEditRecurring,

  // Quick add props
  categoryName,
  showQuickAdd,
  onQuickAddClose,
  onExpenseAdded,
}) => {
  return (
    <div className='hidden lg:block'>
      <table className='glass-table'>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Due Date</th>
            <th>Amount</th>
            <th>Payment Source</th>
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
            {categoryExpenses.map(expense => {
              const status = paycheckService.calculateExpenseStatus(
                expense,
                paycheckDates,
              );

              // Find payment source using V4 format utility (no legacy fallback)
              const account = findPaymentSource(expense, accounts, creditCards);

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
                  onEditRecurring={onEditRecurring}
                  accounts={accounts}
                  creditCards={creditCards}
                />
              );
            })}

            {/* Quick Add Row */}
            <QuickAddRow
              categoryName={categoryName}
              accounts={accounts}
              creditCards={creditCards}
              onExpenseAdded={onExpenseAdded}
              onClose={onQuickAddClose}
              isVisible={showQuickAdd}
            />
          </SortableContext>
        </tbody>
      </table>
    </div>
  );
};

ExpenseTableBody.propTypes = {
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
  categoryName: PropTypes.string.isRequired,
  showQuickAdd: PropTypes.bool.isRequired,
  onQuickAddClose: PropTypes.func.isRequired,
  onExpenseAdded: PropTypes.func.isRequired,
};

export default ExpenseTableBody;

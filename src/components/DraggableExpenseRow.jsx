import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import { Check, Copy, Trash2, RotateCcw } from 'lucide-react';
import StatusBadge from './StatusBadge';
import AccountSelector from './AccountSelector';
import InlineEdit from './InlineEdit';
import PrivacyWrapper from './PrivacyWrapper';

const DraggableExpenseRow = ({
  expense,
  status,
  account,
  isNewExpense,
  isUpdating = false,
  onMarkAsPaid,
  onDuplicate,
  onDelete,
  onUpdateExpense,
  accounts,
  creditCards = [],
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: expense.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 999 : undefined,
  };

  const DragOverlay = () => {
    if (!isDragging) return null;

    return createPortal(
      <div
        className="fixed pointer-events-none glass-panel bg-white/10 shadow-2xl rounded-lg border border-white/20 drag-overlay"
        style={{
          width: '100%',
          maxWidth: '800px',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'float 2s ease-in-out infinite',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg" />
        <div className="relative">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-blue-500/20 rounded-full text-blue-300 text-xs font-medium">
            Moving Expense
          </div>
          <table className="w-full">
            <tbody>
              <tr className="bg-white/5">
                <td className="p-3 font-medium">
                  <div className="flex items-center space-x-2">
                    <span>{expense.name}</span>
                    {expense.isAutoCreated && (
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full border border-blue-500/30">
                        Auto
                      </span>
                    )}
                    {expense.isManuallyMapped && (
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full border border-green-500/30">
                        Linked
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">{expense.dueDate}</td>
                <td className="p-3 text-green-300">${expense.amount}</td>
                <td className="p-3">
                  <div className="flex items-center space-x-2">
                    <div className="animate-pulse w-2 h-2 rounded-full bg-blue-400" />
                    <div className="animate-pulse w-2 h-2 rounded-full bg-blue-400" style={{ animationDelay: '0.2s' }} />
                    <div className="animate-pulse w-2 h-2 rounded-full bg-blue-400" style={{ animationDelay: '0.4s' }} />
                  </div>
                </td>
                <td className="p-3">${expense.paidAmount}</td>
                <td className="p-3"><StatusBadge status={status} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <>
      <tr
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`transition-all duration-1000 ${
          isNewExpense ? 'new-expense-animation' : ''
        } ${isDragging ? 'bg-white/5' : ''} hover:bg-white/5 ${
          isUpdating ? 'bg-blue-500/10 border-l-4 border-l-blue-400' : ''
        }`}
        data-updating={isUpdating}
        data-expense-id={expense.id}
      >
        <td>
          <div className="flex items-center space-x-2">
            <InlineEdit
              value={expense.name}
              expense={expense}
              fieldName="name"
              onSave={(value) => onUpdateExpense(expense.id, { name: value })}
            />
            {expense.isAutoCreated && (
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full border border-blue-500/30">
                Auto
              </span>
            )}
            {expense.isManuallyMapped && (
              <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full border border-green-500/30">
                Linked
              </span>
            )}
          </div>
        </td>
        <td>
          <InlineEdit
            value={expense.dueDate}
            expense={expense}
            fieldName="dueDate"
            type="date"
            onSave={(value) => onUpdateExpense(expense.id, { dueDate: value })}
          />
        </td>
        <td>
          <InlineEdit
            value={expense.amount}
            expense={expense}
            fieldName="amount"
            type="number"
            onSave={(value) => onUpdateExpense(expense.id, { amount: parseFloat(value) })}
          />
        </td>
        <td>
          <div className="relative">
            <AccountSelector
              value={expense.accountId}
              onSave={(accountId) => {
                console.log(`DraggableExpenseRow: Account changed for expense ${expense.id} from ${expense.accountId} to ${accountId}`);
                console.log(`DraggableExpenseRow: Calling onUpdateExpense with accountId: ${accountId}`);
                onUpdateExpense(expense.id, { accountId });
              }}
              accounts={accounts}
              creditCards={creditCards}
            />
            {isUpdating && (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 rounded">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
              </div>
            )}
          </div>
        </td>
        <td>
          <InlineEdit
            value={expense.paidAmount}
            expense={expense}
            fieldName="paidAmount"
            type="number"
            onSave={(value) => onUpdateExpense(expense.id, { paidAmount: parseFloat(value) })}
          />
        </td>
        <td>
          <StatusBadge status={status} />
        </td>
        <td>
          <div className="flex space-x-2">
            {status !== 'Paid' && (
              <button
                onClick={() => onMarkAsPaid(expense)}
                className="p-1 text-green-300 hover:text-green-200"
                title="Mark as paid"
              >
                <Check size={16} />
              </button>
            )}
            {status === 'Paid' && (
              <button
                onClick={() => onUpdateExpense(expense.id, { paidAmount: 0 })}
                className="p-1 text-yellow-300 hover:text-yellow-200"
                title="Mark as unpaid"
              >
                <RotateCcw size={16} />
              </button>
            )}
            <button
              onClick={() => onDuplicate(expense)}
              className="p-1 text-blue-300 hover:text-blue-200"
              title="Duplicate expense"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={() => onDelete(expense.id)}
              className="p-1 text-red-300 hover:text-red-200"
              title="Delete expense"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      </tr>
      <DragOverlay />
    </>
  );
};

export default DraggableExpenseRow;

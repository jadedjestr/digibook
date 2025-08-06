import React, { useState, useRef, useEffect } from 'react'
import { logger } from "../utils/logger";;
import { Plus, Trash2, Check, Edit3, X } from 'lucide-react'
import StatusBadge from './StatusBadge'
import AccountSelector from './AccountSelector'
import AddExpensePanel from './AddExpensePanel'
import { dbHelpers } from '../db/database'
import { PaycheckService } from '../services/paycheckService'
import { DateUtils } from '../utils/dateUtils'

const FixedExpensesTable = ({ 
  expenses, 
  accounts, 
  paycheckSettings, 
  onDataChange,
  isPanelOpen,
  setIsPanelOpen
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [categories, setCategories] = useState([]);

  const paycheckService = new PaycheckService(paycheckSettings);
  const paycheckDates = paycheckService.calculatePaycheckDates();

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await dbHelpers.getCategories();
        setCategories(categoriesData);
      } catch (error) {
        logger.error('Error loading categories:', error);
      }
    };
    
    loadCategories();
  }, []);



  const handleUpdateExpense = async (id, updates) => {
    try {
      logger.debug(`Updating expense with ID: ${id}`, updates);
      await dbHelpers.updateFixedExpense(id, updates);
      setEditingId(null);
      setEditingField(null);
      onDataChange();
    } catch (error) {
      logger.error("Error updating expense:", error);
      alert('Failed to update expense. Please try again.');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
      await dbHelpers.deleteFixedExpense(id);
      onDataChange();
    } catch (error) {
      logger.error("Error deleting expense:", error);
      alert('Failed to delete expense. Please try again.');
    }
  };

  const handleMarkAsPaid = async (expense) => {
    try {
      await dbHelpers.updateFixedExpense(expense.id, { 
        paidAmount: expense.amount 
      });
      
      // Deduct from account balance
      const account = accounts.find(acc => acc.id === expense.accountId);
      if (account) {
        await dbHelpers.updateAccount(expense.accountId, {
          currentBalance: account.currentBalance - expense.amount
        });
      }
      
      onDataChange();
    } catch (error) {
      logger.error("Error marking as paid:", error);
      alert('Failed to mark as paid. Please try again.');
    }
  };

  const InlineEdit = ({ value, onSave, type = 'text', expense = null, fieldName = null }) => {
    const [editValue, setEditValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    // Update editValue when value prop changes
    useEffect(() => {
      setEditValue(value);
    }, [value]);

    const handleSave = () => {
      logger.debug(`Saving value: ${editValue} for field: ${fieldName}`);
      if (expense && fieldName) {
        // Parse number values properly for decimal amounts
        const valueToSave = type === 'number' ? parseFloat(editValue) || 0 : editValue;
        handleUpdateExpense(expense.id, { [fieldName]: valueToSave });
      } else {
        onSave(editValue);
      }
      setIsEditing(false);
    };

    const handleCancel = () => {
      setEditValue(value);
      setIsEditing(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    // Focus input when editing starts
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        if (type === 'text') {
          inputRef.current.select();
        }
      }
    }, [isEditing, type]);

    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          {type === 'number' ? (
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={(e) => {
                const value = e.target.value;
                // Allow empty string and valid numbers, including incomplete decimals
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setEditValue(value);
                }
              }}
              onKeyDown={handleKeyDown}
              className="glass-input text-sm w-20"
              step="0.01"
              min="0"
            />
          ) : type === 'date' ? (
            <input
              ref={inputRef}
              type="date"
              value={editValue}
              onChange={(e) => {
                logger.debug("Date input changed:", e.target.value);
                setEditValue(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              className="glass-input text-sm w-32"
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="glass-input text-sm w-full"
            />
          )}
          <button
            onClick={handleSave}
            className="p-1 text-green-300 hover:text-green-200"
            title="Save (Enter)"
          >
            <Check size={14} />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 text-red-300 hover:text-red-200"
            title="Cancel (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      );
    }

    const formatDisplayValue = (val, type) => {
      if (type === 'number') {
        return `$${parseFloat(val).toFixed(2)}`;
      } else if (type === 'date') {
        if (!val) return '';
        return DateUtils.formatDisplayDate(val);
      }
      return val;
    };

    return (
      <div 
        className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors"
        onClick={() => setIsEditing(true)}
      >
        {formatDisplayValue(value, type)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Add Expense Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Fixed Expenses</h2>
        <button
          onClick={() => setIsPanelOpen(true)}
          className="glass-button flex items-center space-x-2"
        >
          <Plus size={16} />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Expenses Table */}
      <div className="glass-panel overflow-x-auto">
        <table className="w-full glass-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Account</th>
              <th>Category</th>
              <th>Paid Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => {
              const status = paycheckService.calculateExpenseStatus(expense, paycheckDates);
              const account = accounts.find(acc => acc.id === expense.accountId);
              
              return (
                <tr key={expense.id}>
                  <td>
                    <InlineEdit
                      value={expense.name}
                      expense={expense}
                      fieldName="name"
                    />
                  </td>
                  <td>
                    <InlineEdit
                      value={expense.dueDate}
                      expense={expense}
                      fieldName="dueDate"
                      type="date"
                    />
                  </td>
                  <td>
                    <InlineEdit
                      value={expense.amount}
                      expense={expense}
                      fieldName="amount"
                      type="number"
                    />
                  </td>
                  <td>
                    <AccountSelector
                      value={expense.accountId}
                      onSave={(accountId) => handleUpdateExpense(expense.id, { accountId })}
                      accounts={accounts}
                    />
                  </td>
                  <td>
                    <select
                      value={expense.category || ''}
                      onChange={(e) => handleUpdateExpense(expense.id, { category: e.target.value })}
                      className="w-full px-3 py-2 glass-input rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-white/40 transition-all duration-200 text-white text-sm"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <InlineEdit
                      value={expense.paidAmount}
                      expense={expense}
                      fieldName="paidAmount"
                      type="number"
                    />
                  </td>
                  <td>
                    <StatusBadge status={status} />
                  </td>
                  <td>
                    <div className="flex space-x-2">
                      {status !== 'Paid' && (
                        <button
                          onClick={() => handleMarkAsPaid(expense)}
                          className="p-1 text-green-300 hover:text-green-200"
                          title="Mark as paid"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-1 text-red-300 hover:text-red-200"
                        title="Delete expense"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {expenses.length === 0 && (
          <div className="text-center py-8 text-secondary">
            No fixed expenses yet. Add your first expense to get started.
          </div>
        )}
      </div>

      {/* Add Expense Panel */}
      <AddExpensePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        accounts={accounts}
        onDataChange={onDataChange}
      />
    </div>
  );
};

export default FixedExpensesTable; 
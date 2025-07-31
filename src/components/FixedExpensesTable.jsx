import React, { useState } from 'react';
import { Plus, Trash2, Check, Edit3, X } from 'lucide-react';
import StatusBadge from './StatusBadge';
import AccountSelector from './AccountSelector';
import { dbHelpers } from '../db/database';
import { PaycheckService } from '../services/paycheckService';

const FixedExpensesTable = ({ 
  expenses, 
  accounts, 
  paycheckSettings, 
  onDataChange 
}) => {
  console.log('FixedExpensesTable received accounts:', accounts);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [newExpense, setNewExpense] = useState({
    name: '',
    dueDate: '',
    amount: 0,
    accountId: '',
    paidAmount: 0
  });

  const paycheckService = new PaycheckService(paycheckSettings);
  const paycheckDates = paycheckService.calculatePaycheckDates();

  const validateExpense = (expense) => {
    const errors = {};
    if (!expense.name.trim()) errors.name = 'Name is required';
    if (!expense.dueDate) errors.dueDate = 'Due date is required';
    if (expense.amount <= 0) errors.amount = 'Amount must be greater than 0';
    if (!expense.accountId) errors.accountId = 'Account is required';
    if (expense.paidAmount < 0) errors.paidAmount = 'Paid amount cannot be negative';
    if (expense.paidAmount > expense.amount) errors.paidAmount = 'Paid amount cannot exceed total amount';
    return errors;
  };

  const handleAddExpense = async () => {
    const errors = validateExpense(newExpense);
    if (Object.keys(errors).length > 0) {
      alert('Please fix the following errors:\n' + Object.values(errors).join('\n'));
      return;
    }

    try {
      await dbHelpers.addFixedExpense(newExpense);
      setNewExpense({ name: '', dueDate: '', amount: 0, accountId: '', paidAmount: 0 });
      setIsAddingExpense(false);
      onDataChange();
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Failed to add expense. Please try again.');
    }
  };

  const handleUpdateExpense = async (id, updates) => {
    try {
      await dbHelpers.updateFixedExpense(id, updates);
      setEditingId(null);
      setEditingField(null);
      onDataChange();
    } catch (error) {
      console.error('Error updating expense:', error);
      alert('Failed to update expense. Please try again.');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
      await dbHelpers.deleteFixedExpense(id);
      onDataChange();
    } catch (error) {
      console.error('Error deleting expense:', error);
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
      console.error('Error marking as paid:', error);
      alert('Failed to mark as paid. Please try again.');
    }
  };

  const InlineEdit = ({ value, onSave, type = 'text', expense = null, fieldName = null }) => {
    const [editValue, setEditValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = () => {
      if (expense && fieldName) {
        handleUpdateExpense(expense.id, { [fieldName]: editValue });
      } else {
        onSave(editValue);
      }
      setIsEditing(false);
    };

    const handleCancel = () => {
      setEditValue(value);
      setIsEditing(false);
    };

    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          {type === 'number' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
              className="glass-input text-sm w-20"
              step="0.01"
              min="0"
            />
          ) : type === 'date' ? (
            <input
              type="date"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="glass-input text-sm w-32"
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="glass-input text-sm w-full"
            />
          )}
          <button
            onClick={handleSave}
            className="p-1 text-green-300 hover:text-green-200"
          >
            <Check size={14} />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 text-red-300 hover:text-red-200"
          >
            <X size={14} />
          </button>
        </div>
      );
    }

    return (
      <div 
        className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors"
        onClick={() => setIsEditing(true)}
      >
        {type === 'number' ? `$${parseFloat(value).toFixed(2)}` : value}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Add Expense Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Fixed Expenses</h2>
        <button
          onClick={() => setIsAddingExpense(true)}
          className="glass-button flex items-center space-x-2"
        >
          <Plus size={16} />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Add Expense Form */}
      {isAddingExpense && (
        <div className="glass-panel">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Expense name"
              value={newExpense.name}
              onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
              className="glass-input"
            />
            <input
              type="date"
              value={newExpense.dueDate}
              onChange={(e) => setNewExpense({ ...newExpense, dueDate: e.target.value })}
              className="glass-input"
            />
            <input
              type="number"
              placeholder="Amount"
              value={newExpense.amount}
              onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
              className="glass-input"
              step="0.01"
              min="0"
            />
            <AccountSelector
              value={newExpense.accountId}
              onSave={(accountId) => setNewExpense({ ...newExpense, accountId })}
              accounts={accounts}
              isEditing={true}
            />
            <div className="flex space-x-2">
              <button
                onClick={handleAddExpense}
                className="glass-button flex-1"
              >
                Add
              </button>
              <button
                onClick={() => setIsAddingExpense(false)}
                className="glass-button bg-red-500/20 text-red-300 hover:bg-red-500/30"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="glass-panel overflow-x-auto">
        <table className="w-full glass-table">
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
    </div>
  );
};

export default FixedExpensesTable; 
import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications.jsx';
import { dbHelpers } from '../db/database-clean';

const CategoryDeletionModal = ({
  isOpen,
  onClose,
  categoryToDelete,
  affectedItems,
  onCategoryDeleted,
}) => {
  const [categories, setCategories] = useState([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [individualAssignments, setIndividualAssignments] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      initializeIndividualAssignments();
    }
  }, [isOpen, affectedItems]);

  const loadCategories = async () => {
    try {
      const categoriesData = await dbHelpers.getCategories();
      // Filter out the category being deleted
      const availableCategories = categoriesData.filter(cat => cat.name !== categoryToDelete.name);
      setCategories(availableCategories);
    } catch (error) {
      logger.error('Error loading categories:', error);
    }
  };

  const initializeIndividualAssignments = () => {
    const assignments = {};

    // Initialize fixed expenses
    affectedItems.fixedExpenses.forEach(expense => {
      assignments[`expense-${expense.id}`] = '';
    });

    // Initialize pending transactions
    affectedItems.pendingTransactions.forEach(transaction => {
      assignments[`transaction-${transaction.id}`] = '';
    });

    setIndividualAssignments(assignments);
  };

  const handleBulkReassign = async () => {
    if (!bulkCategory) return;

    setIsProcessing(true);
    try {
      await dbHelpers.reassignCategoryItems(categoryToDelete.name, bulkCategory, affectedItems);
      await dbHelpers.deleteCategory(categoryToDelete.id);
      onCategoryDeleted();
      onClose();
      logger.success('Category deleted and items reassigned successfully');
      notify.success('Category deleted and items reassigned successfully');
    } catch (error) {
      logger.error('Error during bulk reassignment:', error);
      notify.error('Failed to reassign items. Please try again.', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleIndividualReassign = async () => {
    // Check if all items have been assigned
    const allAssigned = Object.values(individualAssignments).every(assignment => assignment !== '');
    if (!allAssigned) {
      notify.warning('Please assign all items to a category before proceeding.');
      return;
    }

    setIsProcessing(true);
    try {
      // Process individual reassignments
      for (const [key, newCategory] of Object.entries(individualAssignments)) {
        if (key.startsWith('expense-')) {
          const expenseId = key.replace('expense-', '');
          const expense = affectedItems.fixedExpenses.find(e => e.id === parseInt(expenseId));
          if (expense) {
            await dbHelpers.updateFixedExpense(expense.id, { category: newCategory });
          }
        } else if (key.startsWith('transaction-')) {
          const transactionId = key.replace('transaction-', '');
          const transaction = affectedItems.pendingTransactions.find(t => t.id === parseInt(transactionId));
          if (transaction) {
            await dbHelpers.updatePendingTransaction(transaction.id, { category: newCategory });
          }
        }
      }

      // Delete the category
      await dbHelpers.deleteCategory(categoryToDelete.id);
      onCategoryDeleted();
      onClose();
      logger.success('Category deleted and items individually reassigned successfully');
      notify.success('Category deleted and items individually reassigned successfully');
    } catch (error) {
      logger.error('Error during individual reassignment:', error);
      notify.error('Failed to reassign items. Please try again.', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalAffectedItems = affectedItems.fixedExpenses.length + affectedItems.pendingTransactions.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-panel max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="text-red-400" size={24} />
            <h3 className="text-xl font-semibold text-primary">Delete Category</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded"
            disabled={isProcessing}
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Warning Message */}
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-300">
            You are about to delete <strong>"{categoryToDelete.name}"</strong>.
            This will affect <strong>{totalAffectedItems} items</strong>.
          </p>
        </div>

        {/* Bulk Reassign Section */}
        <div className="mb-6">
          <h4 className="text-lg font-medium text-primary mb-4">Bulk Reassign All Items</h4>
          <div className="flex items-center space-x-4">
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="glass-input flex-1"
              disabled={isProcessing}
            >
              <option value="">Select a category...</option>
              {categories.map(category => (
                <option key={category.id} value={category.name}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkReassign}
              disabled={!bulkCategory || isProcessing}
              className="glass-button px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : 'Bulk Reassign'}
            </button>
          </div>
        </div>

        {/* Individual Reassign Section */}
        <div className="mb-6">
          <h4 className="text-lg font-medium text-primary mb-4">Individual Reassignment</h4>

          {/* Fixed Expenses */}
          {affectedItems.fixedExpenses.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-secondary mb-2">Fixed Expenses ({affectedItems.fixedExpenses.length})</h5>
              <div className="space-y-2">
                {affectedItems.fixedExpenses.map(expense => (
                  <div key={expense.id} className="flex items-center space-x-3 p-3 glass-card">
                    <span className="flex-1 text-sm">{expense.name}</span>
                    <select
                      value={individualAssignments[`expense-${expense.id}`] || ''}
                      onChange={(e) => setIndividualAssignments({
                        ...individualAssignments,
                        [`expense-${expense.id}`]: e.target.value,
                      })}
                      className="glass-input text-sm"
                      disabled={isProcessing}
                    >
                      <option value="">Select category...</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.name}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Transactions */}
          {affectedItems.pendingTransactions.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-secondary mb-2">Pending Transactions ({affectedItems.pendingTransactions.length})</h5>
              <div className="space-y-2">
                {affectedItems.pendingTransactions.map(transaction => (
                  <div key={transaction.id} className="flex items-center space-x-3 p-3 glass-card">
                    <span className="flex-1 text-sm">{transaction.description}</span>
                    <select
                      value={individualAssignments[`transaction-${transaction.id}`] || ''}
                      onChange={(e) => setIndividualAssignments({
                        ...individualAssignments,
                        [`transaction-${transaction.id}`]: e.target.value,
                      })}
                      className="glass-input text-sm"
                      disabled={isProcessing}
                    >
                      <option value="">Select category...</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.name}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleIndividualReassign}
            disabled={isProcessing}
            className="glass-button w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Confirm Individual Reassignment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryDeletionModal;

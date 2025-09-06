import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy } from 'lucide-react';
import { logger } from '../utils/logger';
import { dbHelpers } from '../db/database';

const ExpensePreview = React.memo(({ formData, numCopies }) => (
  <div className="glass-card bg-white/5">
    <div className="text-sm text-secondary">
      Will create {numCopies} expense(s) with:
    </div>
    <div className="text-sm text-primary space-y-1 mt-2">
      <div>Name: {formData.name}</div>
      <div>Amount: ${formData.amount}</div>
      <div>Paid Amount: ${formData.paidAmount}</div>
      <div>Due Date: {formData.dueDate}</div>
      <div>Category: {formData.category}</div>
      <div>Status: {formData.status}</div>
    </div>
  </div>
));

const DuplicateExpenseModal = ({ expense, onClose, onDuplicate }) => {
  const [numCopies, setNumCopies] = useState(1);
  const [categories, setCategories] = useState([]);

  // Memoize category options to prevent unnecessary re-renders
  const categoryOptions = useMemo(() => (
    categories.map(category => (
      <option key={category.id} value={category.name}>
        {category.name}
      </option>
    ))
  ), [categories]);

  const [formData, setFormData] = useState({
    name: expense.name,
    amount: expense.amount,
    dueDate: expense.dueDate,
    category: expense.category,
    accountId: expense.accountId,
    status: expense.status,
    paidAmount: expense.status === 'paid' ? expense.amount : 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create array of duplicates
      const duplicates = Array(numCopies).fill().map(() => {
        // Create a clean object with only the fields we want
        return {
          name: formData.name,
          amount: parseFloat(formData.amount),
          dueDate: formData.dueDate,
          category: formData.category,
          accountId: formData.accountId,
          status: formData.status,
          paidAmount: formData.status === 'paid' ? parseFloat(formData.amount) : 0,
          createdAt: new Date().toISOString(),
        };
      });

      await onDuplicate(duplicates);
      logger.success(`Created ${numCopies} duplicate expense(s)`);
      onClose();
    } catch (error) {
      logger.error('Error duplicating expenses:', error);
      alert('Failed to duplicate expenses: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-panel w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Copy size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-primary">Duplicate Expense</h2>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Original Expense Info */}
          <div>
            <label className="text-sm font-medium text-secondary">Original Expense</label>
            <div className="mt-1 text-primary">{expense.name}</div>
          </div>

          {/* Number of Copies Slider */}
          <div>
            <label className="text-sm font-medium text-secondary">Number of Copies</label>
            <div className="mt-2 space-y-2">
              <input
                type="range"
                min="1"
                max="10"
                value={numCopies}
                onChange={(e) => setNumCopies(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-sm text-secondary">
                <span className="text-primary font-medium">{numCopies}</span>
                <span>10</span>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-secondary">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="glass-input mt-1 w-full"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-secondary">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  className="glass-input mt-1 w-full"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-secondary">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate?.split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="glass-input mt-1 w-full"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-secondary">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="glass-input mt-1 w-full"
                  required
                >
                  <option value="">Select Category</option>
                  {categoryOptions}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setFormData({
                      ...formData,
                      status: newStatus,
                      paidAmount: newStatus === 'paid' ? formData.amount : 0,
                    });
                  }}
                  className="glass-input mt-1 w-full"
                  required
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-sm font-medium text-secondary mb-2">Preview</h3>
            <ExpensePreview formData={formData} numCopies={numCopies} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="glass-button"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`glass-button bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 flex items-center space-x-2 ${
                isSubmitting ? 'glass-loading' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Create Duplicates</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DuplicateExpenseModal;

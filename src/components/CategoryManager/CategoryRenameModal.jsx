import { X, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

import { notify } from '../../utils/notifications.jsx';

const CategoryRenameModal = ({
  isOpen,
  onClose,
  category: _category,
  oldName,
  newName,
  affectedItems,
  onRename,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const totalAffectedItems =
    affectedItems.fixedExpenses.length +
    affectedItems.pendingTransactions.length;

  const handleRename = async () => {
    setIsProcessing(true);
    try {
      await onRename();
      notify.success(
        `Category renamed from "${oldName}" to "${newName}". Updated ${totalAffectedItems} items.`,
      );
      onClose();
    } catch (error) {
      notify.error('Failed to rename category. Please try again.', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50'>
      <div className='glass-panel max-w-2xl w-full mx-4'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center space-x-3'>
            <AlertTriangle className='text-yellow-400' size={24} />
            <h3 className='text-xl font-semibold text-primary'>
              Rename Category
            </h3>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-white/10 rounded'
            disabled={isProcessing}
          >
            <X size={20} className='text-white' />
          </button>
        </div>

        {/* Warning Message */}
        <div className='mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg'>
          <p className='text-yellow-300 mb-2'>
            You are about to rename <strong>&quot;{oldName}&quot;</strong> to{' '}
            <strong>&quot;{newName}&quot;</strong>.
          </p>
          {totalAffectedItems > 0 && (
            <p className='text-yellow-300'>
              This will update <strong>{totalAffectedItems} items</strong> that
              reference this category:
            </p>
          )}
        </div>

        {/* Affected Items Summary */}
        {totalAffectedItems > 0 && (
          <div className='mb-6 space-y-3'>
            {affectedItems.fixedExpenses.length > 0 && (
              <div className='p-3 glass-card'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-secondary'>Fixed Expenses</span>
                  <span className='text-sm font-medium text-primary'>
                    {affectedItems.fixedExpenses.length}
                  </span>
                </div>
              </div>
            )}

            {affectedItems.pendingTransactions.length > 0 && (
              <div className='p-3 glass-card'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-secondary'>
                    Pending Transactions
                  </span>
                  <span className='text-sm font-medium text-primary'>
                    {affectedItems.pendingTransactions.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {totalAffectedItems === 0 && (
          <div className='mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg'>
            <p className='text-blue-300'>
              This category is not currently used by any expenses or
              transactions. The rename will only update the category name.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className='flex items-center justify-end space-x-3'>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className='glass-button px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            Cancel
          </button>
          <button
            onClick={handleRename}
            disabled={isProcessing}
            className='glass-button glass-button--primary px-6 py-2 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isProcessing ? (
              <>
                <Loader className='animate-spin' size={16} />
                <span>Renaming...</span>
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                <span>Update All References</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

CategoryRenameModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  category: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
  }),
  oldName: PropTypes.string.isRequired,
  newName: PropTypes.string.isRequired,
  affectedItems: PropTypes.shape({
    fixedExpenses: PropTypes.arrayOf(PropTypes.object),
    pendingTransactions: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  onRename: PropTypes.func.isRequired,
};

export default CategoryRenameModal;

import { AlertTriangle, Landmark } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';

import { dbHelpers } from '../db/database-clean';
import { formatCurrency } from '../utils/accountUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

const LoanDeletionModal = ({ isOpen, loan, onClose, onDelete }) => {
  const [linkedExpenses, setLinkedExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Unlike a credit card, a loan is never a spendable funding source, so
  // there's no "reassign to another loan" case worth offering as a
  // default - unlinking is the sensible recommendation here.
  const [deletionOption, setDeletionOption] = useState('unlink'); // 'unlink', 'delete'

  const loadLinkedExpenses = useCallback(async () => {
    if (!loan?.id) return;

    setIsLoading(true);
    try {
      const expenses = await dbHelpers.getFixedExpenses();
      const linked = expenses.filter(
        expense =>
          expense.accountId === loan.id || expense.targetLoanId === loan.id,
      );
      setLinkedExpenses(linked);
    } catch (error) {
      logger.error('Error loading linked expenses:', error);
      notify.error('Failed to load linked expenses');
    } finally {
      setIsLoading(false);
    }
  }, [loan?.id]);

  useEffect(() => {
    if (isOpen && loan?.id) {
      loadLinkedExpenses();
    }
  }, [isOpen, loan?.id, loadLinkedExpenses]);

  const handleDelete = async () => {
    if (!loan) return;

    setIsProcessing(true);
    try {
      if (deletionOption === 'unlink') {
        for (const expense of linkedExpenses) {
          const updateData = {};
          if (expense.accountId === loan.id) {
            updateData.accountId = null;
          }
          if (expense.targetLoanId === loan.id) {
            updateData.targetLoanId = null;
          }
          await dbHelpers.updateFixedExpenseV4(expense.id, updateData, {
            skipPaymentSourceValidation: true,
          });
          logger.info(`Unlinked expense ${expense.id} from loan`);
        }
      }

      // If deletionOption === 'delete', leave expenses as-is.

      await dbHelpers.deleteLoan(loan.id);

      notify.success(`Loan "${loan.name}" deleted successfully`);
      onDelete(loan.id);
      onClose();
    } catch (error) {
      logger.error('Error during loan deletion:', error);
      notify.error('Failed to delete loan');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !loan?.id) return null;

  return (
    <div className='fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4'>
      <div className='glass-panel max-w-2xl w-full max-h-[90vh] overflow-y-auto'>
        <div className='p-6'>
          {/* Header */}
          <div className='flex items-start space-x-3 mb-6'>
            <AlertTriangle className='w-6 h-6 text-orange-400 mt-1 flex-shrink-0' />
            <div>
              <h2 className='text-xl font-semibold text-white mb-2'>
                Delete Loan: {loan.name}
              </h2>
              <p className='text-white/70'>
                {linkedExpenses.length > 0
                  ? `This loan has ${linkedExpenses.length} linked fixed expense${linkedExpenses.length !== 1 ? 's' : ''}. Choose how to handle them before deletion.`
                  : 'This loan has no linked fixed expenses. You can safely delete it.'}
              </p>
            </div>
          </div>

          {/* Deletion Options */}
          {linkedExpenses.length > 0 && (
            <div className='space-y-4 mb-6'>
              <h3 className='text-lg font-medium text-white'>
                Deletion Options:
              </h3>

              <div className='space-y-3'>
                <label
                  className='flex items-start space-x-3 cursor-pointer'
                  aria-label='Unlink from all expenses'
                >
                  <input
                    type='radio'
                    name='loanDeletionOption'
                    value='unlink'
                    checked={deletionOption === 'unlink'}
                    onChange={e => setDeletionOption(e.target.value)}
                    className='mt-1'
                  />
                  <div>
                    <div className='text-white font-medium'>
                      Unlink from All Expenses (recommended)
                    </div>
                    <div className='text-white/60 text-sm'>
                      Remove the loan link from every linked expense
                      (they&apos;ll need manual cleanup or reassignment later)
                    </div>
                  </div>
                </label>

                <label
                  className='flex items-start space-x-3 cursor-pointer'
                  aria-label='Delete loan and leave expenses linked'
                >
                  <input
                    type='radio'
                    name='loanDeletionOption'
                    value='delete'
                    checked={deletionOption === 'delete'}
                    onChange={e => setDeletionOption(e.target.value)}
                    className='mt-1'
                  />
                  <div>
                    <div className='text-white font-medium'>Delete Anyway</div>
                    <div className='text-white/60 text-sm'>
                      Delete the loan and leave expenses with an invalid loan
                      reference (not recommended)
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Linked Expenses */}
          {linkedExpenses.length > 0 && (
            <div className='mb-6'>
              <h3 className='text-lg font-medium text-white mb-4'>
                Linked Fixed Expenses ({linkedExpenses.length})
              </h3>

              {isLoading ? (
                <div className='text-center py-4'>
                  <div className='text-white/60'>
                    Loading linked expenses...
                  </div>
                </div>
              ) : (
                <div className='space-y-3 max-h-60 overflow-y-auto'>
                  {linkedExpenses.map(expense => (
                    <div
                      key={expense.id}
                      className='bg-white/5 border border-white/10 rounded-lg p-4'
                    >
                      <div className='flex items-center justify-between'>
                        <div>
                          <div className='font-medium text-white'>
                            {expense.name}
                          </div>
                          <div className='text-sm text-white/60'>
                            {formatCurrency(expense.amount)} •{' '}
                            {expense.category}
                          </div>
                        </div>
                        <div className='flex items-center space-x-2 text-orange-400'>
                          <Landmark size={16} />
                          <span className='text-sm'>Currently linked</span>
                        </div>
                      </div>

                      {deletionOption === 'unlink' && (
                        <div className='text-sm text-orange-300 mt-2'>
                          ⚠️ This expense will be unlinked from the loan
                        </div>
                      )}

                      {deletionOption === 'delete' && (
                        <div className='text-sm text-red-300 mt-2'>
                          ⚠️ This expense will have an invalid loan reference
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className='flex justify-end space-x-3'>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className='px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isProcessing}
              className='px-4 py-2 glass-button glass-button--danger
                       disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isProcessing ? 'Processing...' : 'Delete Loan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

LoanDeletionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  loan: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

LoanDeletionModal.defaultProps = {
  loan: null,
};

export default LoanDeletionModal;

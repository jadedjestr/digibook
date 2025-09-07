import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CreditCard, ExternalLink, ArrowRight } from 'lucide-react';
import { dbHelpers } from '../db/database';
import { logger } from '../utils/logger';
import { formatCurrency } from '../utils/accountUtils';
import { notify } from '../utils/notifications';
import AccountSelector from './AccountSelector';

const CreditCardDeletionModal = ({ 
  isOpen, 
  creditCard, 
  onClose, 
  onDelete, 
  accounts = [], 
  creditCards = [] 
}) => {
  const [linkedExpenses, setLinkedExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reassignmentMap, setReassignmentMap] = useState({});
  const [deletionOption, setDeletionOption] = useState('reassign'); // 'reassign', 'unlink', 'delete'

  const loadLinkedExpenses = useCallback(async () => {
    if (!creditCard?.id) return;
    
    setIsLoading(true);
    try {
      const expenses = await dbHelpers.getFixedExpenses();
      const linked = expenses.filter(expense => expense.accountId === creditCard.id);
      setLinkedExpenses(linked);
      
      // Initialize reassignment map
      const initialMap = {};
      linked.forEach(expense => {
        initialMap[expense.id] = null; // null means no reassignment yet
      });
      setReassignmentMap(initialMap);
    } catch (error) {
      logger.error('Error loading linked expenses:', error);
      notify.error('Failed to load linked expenses');
    } finally {
      setIsLoading(false);
    }
  }, [creditCard?.id]);

  useEffect(() => {
    if (isOpen && creditCard?.id) {
      loadLinkedExpenses();
    }
  }, [isOpen, creditCard?.id, loadLinkedExpenses]);

  const handleReassignmentChange = (expenseId, newAccountId) => {
    setReassignmentMap(prev => ({
      ...prev,
      [expenseId]: newAccountId
    }));
  };

  const handleDelete = async () => {
    if (!creditCard) return;

    setIsProcessing(true);
    try {
      if (deletionOption === 'reassign') {
        // Reassign all expenses to new accounts
        for (const [expenseId, newAccountId] of Object.entries(reassignmentMap)) {
          if (newAccountId) {
            await dbHelpers.updateFixedExpense(parseInt(expenseId), { 
              accountId: newAccountId 
            });
            logger.info(`Reassigned expense ${expenseId} to account ${newAccountId}`);
          }
        }
      } else if (deletionOption === 'unlink') {
        // Remove account mapping from all expenses (set to null)
        for (const expenseId of Object.keys(reassignmentMap)) {
          await dbHelpers.updateFixedExpense(parseInt(expenseId), { 
            accountId: null 
          });
          logger.info(`Unlinked expense ${expenseId} from credit card`);
        }
      }
      // If deletionOption === 'delete', we don't need to do anything with expenses

      // Now delete the credit card
      await dbHelpers.deleteCreditCard(creditCard.id);
      
      notify.success(`Credit card "${creditCard.name}" deleted successfully`);
      onDelete(creditCard.id);
      onClose();
    } catch (error) {
      logger.error('Error during credit card deletion:', error);
      notify.error('Failed to delete credit card');
    } finally {
      setIsProcessing(false);
    }
  };

  const getUnassignedCount = () => {
    return Object.values(reassignmentMap).filter(accountId => !accountId).length;
  };

  const canProceed = () => {
    // If no linked expenses, can always proceed
    if (linkedExpenses.length === 0) {
      return true;
    }
    
    if (deletionOption === 'reassign') {
      return getUnassignedCount() === 0;
    }
    return true; // 'unlink' and 'delete' options don't require reassignments
  };

  if (!isOpen || !creditCard?.id) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-panel max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start space-x-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-orange-400 mt-1 flex-shrink-0" />
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Delete Credit Card: {creditCard.name}
              </h2>
              <p className="text-white/70">
                {linkedExpenses.length > 0 
                  ? `This credit card has ${linkedExpenses.length} linked fixed expense${linkedExpenses.length !== 1 ? 's' : ''}. Choose how to handle them before deletion.`
                  : 'This credit card has no linked fixed expenses. You can safely delete it.'
                }
              </p>
            </div>
          </div>

          {/* Deletion Options */}
          {linkedExpenses.length > 0 && (
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-medium text-white">Deletion Options:</h3>
            
            <div className="space-y-3">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="deletionOption"
                  value="reassign"
                  checked={deletionOption === 'reassign'}
                  onChange={(e) => setDeletionOption(e.target.value)}
                  className="mt-1"
                />
                <div>
                  <div className="text-white font-medium">Reassign to Other Accounts</div>
                  <div className="text-white/60 text-sm">
                    Move all linked expenses to different accounts (recommended)
                  </div>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="deletionOption"
                  value="unlink"
                  checked={deletionOption === 'unlink'}
                  onChange={(e) => setDeletionOption(e.target.value)}
                  className="mt-1"
                />
                <div>
                  <div className="text-white font-medium">Unlink from All Accounts</div>
                  <div className="text-white/60 text-sm">
                    Remove account mapping from all expenses (they'll need manual reassignment later)
                  </div>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="deletionOption"
                  value="delete"
                  checked={deletionOption === 'delete'}
                  onChange={(e) => setDeletionOption(e.target.value)}
                  className="mt-1"
                />
                <div>
                  <div className="text-white font-medium">Delete Anyway</div>
                  <div className="text-white/60 text-sm">
                    Delete credit card and leave expenses with invalid account references (not recommended)
                  </div>
                </div>
              </label>
            </div>
            </div>
          )}

          {/* Linked Expenses */}
          {linkedExpenses.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-4">
                Linked Fixed Expenses ({linkedExpenses.length})
              </h3>
              
              {isLoading ? (
                <div className="text-center py-4">
                  <div className="text-white/60">Loading linked expenses...</div>
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {linkedExpenses.map(expense => (
                    <div 
                      key={expense.id} 
                      className="bg-white/5 border border-white/10 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium text-white">{expense.name}</div>
                          <div className="text-sm text-white/60">
                            {formatCurrency(expense.amount)} • {expense.category}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-orange-400">
                          <CreditCard size={16} />
                          <span className="text-sm">Currently linked</span>
                        </div>
                      </div>

                      {deletionOption === 'reassign' && (
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-white/60">Reassign to:</span>
                          <div className="flex-1">
                            <AccountSelector
                              value={reassignmentMap[expense.id]}
                              accounts={accounts}
                              creditCards={creditCards.filter(card => card.id !== creditCard.id)}
                              onSave={(accountId) => handleReassignmentChange(expense.id, accountId)}
                              showSaveCancel={false}
                            />
                          </div>
                          <ArrowRight size={16} className="text-white/40" />
                        </div>
                      )}

                      {deletionOption === 'unlink' && (
                        <div className="text-sm text-orange-300">
                          ⚠️ This expense will be unlinked from all accounts
                        </div>
                      )}

                      {deletionOption === 'delete' && (
                        <div className="text-sm text-red-300">
                          ⚠️ This expense will have an invalid account reference
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {linkedExpenses.length > 0 && deletionOption === 'reassign' && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <ExternalLink size={16} className="text-blue-400" />
                <span className="text-blue-400 font-medium">Reassignment Summary</span>
              </div>
              <div className="text-sm text-white/70">
                {getUnassignedCount() === 0 ? (
                  <span className="text-green-400">✅ All expenses will be reassigned</span>
                ) : (
                  <span className="text-orange-400">
                    ⚠️ {getUnassignedCount()} expense{getUnassignedCount() !== 1 ? 's' : ''} still need{getUnassignedCount() === 1 ? 's' : ''} reassignment
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isProcessing || !canProceed()}
              className="px-4 py-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 
                       disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Delete Credit Card'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditCardDeletionModal;

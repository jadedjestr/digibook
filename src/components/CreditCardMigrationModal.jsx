import { X, Check, AlertTriangle, Zap, Link, Search, Plus } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { dbHelpers } from '../db/database-clean';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

const CreditCardMigrationModal = ({ isOpen, onClose, onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('detect'); // 'detect', 'review', 'apply', 'complete'
  const [detectedMappings, setDetectedMappings] = useState([]);
  const [selectedMappings, setSelectedMappings] = useState([]);
  const [migrationResults, setMigrationResults] = useState(null);

  useEffect(() => {
    if (isOpen && step === 'detect') {
      runDetection();
    }
  }, [isOpen, step]);

  const runDetection = async () => {
    setIsLoading(true);
    try {
      const mappings = await dbHelpers.detectCreditCardExpenses();
      setDetectedMappings(mappings);

      // Auto-select high-confidence mappings
      const autoSelected = mappings.filter(mapping => mapping.confidence > 70);
      setSelectedMappings(autoSelected.map(m => m.expenseId));

      setStep('review');
    } catch (error) {
      logger.error('Error detecting credit card expenses:', error);
      notify.error('Failed to detect credit card expenses');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMapping = expenseId => {
    setSelectedMappings(prev =>
      prev.includes(expenseId)
        ? prev.filter(id => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  const applyMappings = async () => {
    setIsLoading(true);
    setStep('apply');

    try {
      // Get selected mappings
      const mappingsToApply = detectedMappings.filter(mapping =>
        selectedMappings.includes(mapping.expenseId)
      );

      // Apply mappings
      const results = await dbHelpers.applyExpenseMappings(mappingsToApply);

      // Clean up duplicates
      const duplicatesRemoved =
        await dbHelpers.cleanupDuplicateCreditCardExpenses();

      // Create missing expenses for credit cards that still don't have any linked expenses
      const missingExpensesCreated =
        await dbHelpers.createMissingCreditCardExpenses();

      setMigrationResults({
        ...results,
        duplicatesRemoved,
        missingExpensesCreated,
      });

      setStep('complete');

      const totalActions =
        results.appliedCount +
        duplicatesRemoved.length +
        missingExpensesCreated;
      notify.success(
        `Migration complete! Mapped ${results.appliedCount} expenses, removed ${duplicatesRemoved.length} duplicates, and created ${missingExpensesCreated} missing expenses`
      );
    } catch (error) {
      logger.error('Error applying mappings:', error);
      notify.error('Failed to apply mappings');
      setStep('review');
    } finally {
      setIsLoading(false);
    }
  };

  const getConfidenceColor = confidence => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getConfidenceLabel = confidence => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    return 'Low';
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='bg-gray-800/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 w-full max-w-4xl max-h-[90vh] flex flex-col'>
        {/* Header */}
        <div className='flex justify-between items-center p-6 border-b border-white/10'>
          <div className='flex items-center space-x-3'>
            <div className='w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center'>
              <Link className='w-5 h-5 text-blue-400' />
            </div>
            <div>
              <h2 className='text-xl font-semibold text-white'>
                Credit Card Migration
              </h2>
              <p className='text-sm text-gray-400'>
                Link existing expenses to credit card accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-white transition-colors'
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 p-6 overflow-y-auto min-h-0'>
          {step === 'detect' && (
            <div className='text-center py-12'>
              <div className='animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4' />
              <p className='text-white'>Detecting credit card expenses...</p>
            </div>
          )}

          {step === 'review' && (
            <div className='space-y-4'>
              <div className='bg-blue-500/10 border border-blue-500/20 rounded-lg p-4'>
                <div className='flex items-start space-x-3'>
                  <Search className='w-5 h-5 text-blue-400 mt-0.5' />
                  <div>
                    <h3 className='font-medium text-white mb-1'>
                      Detection Results
                    </h3>
                    <p className='text-sm text-gray-300'>
                      Found {detectedMappings.length} potential credit card
                      expense mappings. Review and select which ones to apply.
                    </p>
                  </div>
                </div>
              </div>

              {detectedMappings.length === 0 ? (
                <div className='text-center py-8'>
                  <p className='text-gray-400'>
                    No potential credit card mappings found.
                  </p>
                </div>
              ) : (
                <div className='space-y-2'>
                  {detectedMappings.map(mapping => (
                    <div
                      key={`${mapping.expenseId}-${mapping.creditCardId}`}
                      className={`border rounded-lg p-3 transition-all cursor-pointer ${
                        selectedMappings.includes(mapping.expenseId)
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                      onClick={() => toggleMapping(mapping.expenseId)}
                    >
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center space-x-3'>
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              selectedMappings.includes(mapping.expenseId)
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-500'
                            }`}
                          >
                            {selectedMappings.includes(mapping.expenseId) && (
                              <Check size={12} className='text-white' />
                            )}
                          </div>
                          <div>
                            <div className='text-white font-medium'>
                              {mapping.expenseName}
                            </div>
                            <div className='text-sm text-gray-400'>
                              Map to:{' '}
                              <span className='text-blue-300'>
                                {mapping.creditCardName}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className='text-right'>
                          <div
                            className={`text-sm font-medium ${getConfidenceColor(mapping.confidence)}`}
                          >
                            {getConfidenceLabel(mapping.confidence)} (
                            {mapping.confidence}%)
                          </div>
                          <div className='text-xs text-gray-500'>
                            {mapping.suggestedAction}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'apply' && (
            <div className='text-center py-12'>
              <div className='animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4' />
              <p className='text-white'>
                Applying mappings, cleaning up duplicates, and creating missing
                expenses...
              </p>
            </div>
          )}

          {step === 'complete' && migrationResults && (
            <div className='space-y-6'>
              <div className='bg-green-500/10 border border-green-500/20 rounded-lg p-4'>
                <div className='flex items-start space-x-3'>
                  <Check className='w-5 h-5 text-green-400 mt-0.5' />
                  <div>
                    <h3 className='font-medium text-white mb-1'>
                      Migration Complete!
                    </h3>
                    <p className='text-sm text-gray-300'>
                      Successfully mapped {migrationResults.appliedCount}{' '}
                      expenses, removed{' '}
                      {migrationResults.duplicatesRemoved.length} duplicates,
                      and created {migrationResults.missingExpensesCreated || 0}{' '}
                      missing expenses.
                    </p>
                  </div>
                </div>
              </div>

              {migrationResults.missingExpensesCreated > 0 && (
                <div className='bg-blue-500/10 border border-blue-500/20 rounded-lg p-4'>
                  <div className='flex items-start space-x-3'>
                    <Plus className='w-5 h-5 text-blue-400 mt-0.5' />
                    <div>
                      <h4 className='font-medium text-white mb-1'>
                        Missing Expenses Created
                      </h4>
                      <p className='text-sm text-gray-300'>
                        Created {migrationResults.missingExpensesCreated} new
                        fixed expenses for credit cards that didn't have any.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {migrationResults.results.length > 0 && (
                <div className='space-y-3'>
                  <h4 className='font-medium text-white'>Applied Mappings:</h4>
                  {migrationResults.results.map((result, index) => (
                    <div key={index} className='bg-white/5 rounded-lg p-3'>
                      <div className='flex items-center justify-between'>
                        <div>
                          <div className='text-white text-sm'>
                            {result.expenseName}
                          </div>
                          <div className='text-gray-400 text-xs'>
                            → {result.creditCardName}
                          </div>
                        </div>
                        <div
                          className={`text-xs ${result.success ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {result.success ? 'Success' : 'Failed'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='flex justify-between items-center p-6 border-t border-white/10 bg-gray-800/95 backdrop-blur-md'>
          <div className='text-sm text-gray-400'>
            {step === 'review' &&
              `${selectedMappings.length} of ${detectedMappings.length} selected`}
          </div>
          <div className='flex space-x-3'>
            {step !== 'complete' && (
              <button
                onClick={onClose}
                className='px-4 py-2 text-gray-400 hover:text-white transition-colors'
              >
                Cancel
              </button>
            )}
            {step === 'review' && (
              <button
                onClick={applyMappings}
                disabled={isLoading}
                className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {selectedMappings.length === 0
                  ? 'Create Missing Expenses'
                  : `Apply ${selectedMappings.length} Mappings`}
              </button>
            )}
            {step === 'complete' && (
              <button
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className='px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors'
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditCardMigrationModal;

import { Download, Upload, Trash2, Shield } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { dbHelpers } from '../../db/database-clean';
import { dataManager } from '../../services/dataManager';
import { DateUtils } from '../../utils/dateUtils';
import { exportJSONData } from '../../utils/exportUtils';
import { logger } from '../../utils/logger';

const buildDedupeKey = (dateString, expense) =>
  `${dateString || ''}|${expense.name || ''}|${expense.category || ''}|${
    expense.amount || ''
  }`;

const DataManagementCard = ({
  onDataChange,
  reloadExpenses,
  globalCategories,
  fixedExpenses,
  startCurrent,
  setPendingFutureCheck,
  shouldShowFuturePrompt,
  onFuturePromptDismissed,
}) => {
  const [importFile, setImportFile] = useState(null);
  const [importType, setImportType] = useState('json');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [showFutureGenPrompt, setShowFutureGenPrompt] = useState(false);
  const [selectedHorizon, setSelectedHorizon] = useState(3);

  useEffect(() => {
    if (shouldShowFuturePrompt) {
      setShowFutureGenPrompt(true);
    }
  }, [shouldShowFuturePrompt]);

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const result = await exportJSONData(setImportProgress);
      if (!result.success) {
        alert(`Error exporting data: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error exporting JSON:', error);
      alert(`Error exporting data: ${error.message}`);
    } finally {
      setIsExporting(false);
      setImportProgress('');
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const files = await dataManager.exportData('csv', setImportProgress);

      files.forEach(({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      logger.success('CSV data exported successfully');
    } catch (error) {
      logger.error('Error exporting CSV:', error);
      alert(`Error exporting data: ${error.message}`);
    } finally {
      setIsExporting(false);
      setImportProgress('');
    }
  };

  const handleExportCreditCardsCSV = async () => {
    setIsExporting(true);
    try {
      const { blob, filename } =
        await dataManager.exportCreditCardsCSV(setImportProgress);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logger.success('Credit card data exported successfully');
    } catch (error) {
      logger.error('Error exporting credit cards CSV:', error);
      alert(`Error exporting credit cards: ${error.message}`);
    } finally {
      setIsExporting(false);
      setImportProgress('');
    }
  };

  const handleImportFile = event => {
    const file = event.target.files[0];
    if (file) {
      setImportFile(file);
      setImportProgress('');
    }
  };

  const refreshAfterDbReplace = async () => {
    globalCategories.invalidateCache();
    await onDataChange();
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      if (
        confirm(
          'This will overwrite all existing data. A backup will be created automatically. Are you sure?',
        )
      ) {
        await dataManager.importData(importFile, setImportProgress);

        await refreshAfterDbReplace();
        setPendingFutureCheck(true);
        setImportFile(null);
        alert('Data imported successfully');
      }
    } catch (error) {
      logger.error('Error importing data:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearAllData = async () => {
    if (
      confirm(
        'This will clear all data from all tables. A backup will be created automatically. Are you sure?',
      )
    ) {
      try {
        setImportProgress('Creating backup...');
        await dataManager.clearAllData();

        await refreshAfterDbReplace();
        setImportProgress('All data cleared successfully!');
        setTimeout(() => setImportProgress(''), 3000);
        alert(
          'All data cleared successfully. Default categories have been restored.',
        );
      } catch (error) {
        logger.error('Error clearing all data:', error);
        alert(`Failed to clear data: ${error.message}`);
        setImportProgress('');
      }
    }
  };

  const handleRestoreFromBackup = async () => {
    if (
      confirm('This will restore your data from the last backup. Are you sure?')
    ) {
      try {
        setImportProgress('Finding latest backup...');
        const backup = await dataManager.backupManager.getLatestBackup();
        if (!backup) {
          throw new Error('No backup found');
        }

        setImportProgress('Restoring backup...');
        await dataManager.backupManager.restoreBackup(backup.key);

        await refreshAfterDbReplace();
        setImportProgress('Backup restored successfully!');
        setTimeout(() => setImportProgress(''), 3000);
        alert('Data restored from backup successfully');
      } catch (error) {
        logger.error('Error restoring from backup:', error);
        alert(`Failed to restore backup: ${error.message}`);
        setImportProgress('');
      }
    }
  };

  const handleGenerateFutureExpenses = async () => {
    try {
      const horizon = Math.min(Math.max(selectedHorizon, 1), 6);
      const { preGenerateOccurrences, createTemplate } = await import(
        '../../services/recurringExpenseService'
      );

      const existingKeys = new Set(
        (fixedExpenses || []).map(exp => buildDedupeKey(exp.dueDate, exp)),
      );

      const isCurrentMonthExpense = expense => {
        const parsed = DateUtils.parseDate(expense.dueDate);
        if (!parsed) return false;
        return (
          parsed.getFullYear() === startCurrent.getFullYear() &&
          parsed.getMonth() === startCurrent.getMonth()
        );
      };

      const getFutureDates = dueDate => {
        const base = DateUtils.parseDate(dueDate);
        if (!base) return [];
        const dates = [];
        for (let i = 1; i <= horizon; i++) {
          const d = new Date(base);
          d.setMonth(d.getMonth() + i);
          dates.push(DateUtils.formatDate(d));
        }
        return dates;
      };

      for (const expense of fixedExpenses || []) {
        if (!isCurrentMonthExpense(expense)) continue;

        const futureDates = getFutureDates(expense.dueDate);
        const needsGeneration = futureDates.some(
          date => !existingKeys.has(buildDedupeKey(date, expense)),
        );
        if (!needsGeneration) continue;

        if (expense.recurringTemplateId) {
          await preGenerateOccurrences(expense.recurringTemplateId, horizon);
        } else {
          const parsedDue = DateUtils.parseDate(expense.dueDate);
          const startFrom =
            parsedDue != null
              ? (() => {
                  const d = new Date(parsedDue);
                  d.setMonth(d.getMonth() + 1);
                  return DateUtils.formatDate(d);
                })()
              : DateUtils.today();

          const templateId = await createTemplate({
            name: expense.name,
            baseAmount: expense.amount,
            frequency: 'monthly',
            intervalValue: 1,
            intervalUnit: 'months',
            startDate: startFrom,
            nextDueDate: startFrom,
            endDate: null,
            category: expense.category,
            accountId: expense.accountId || null,
            creditCardId: expense.creditCardId || null,
            targetCreditCardId: expense.targetCreditCardId || null,
            notes: expense.notes || '',
            isVariableAmount: expense.isVariableAmount || false,
          });

          try {
            await dbHelpers.updateFixedExpenseV4(expense.id, {
              recurringTemplateId: templateId,
            });
          } catch (linkError) {
            logger.warn(
              'Could not link expense to new template (continuing generation):',
              linkError,
            );
          }

          await preGenerateOccurrences(templateId, horizon);
        }

        futureDates.forEach(date =>
          existingKeys.add(buildDedupeKey(date, expense)),
        );
      }

      await reloadExpenses();
      setShowFutureGenPrompt(false);
      onFuturePromptDismissed?.();
    } catch (error) {
      logger.error('Error generating future expenses:', error);
      alert(`Failed to generate future expenses: ${error.message}`);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Export Section */}
      <div>
        <h4 className='text-primary font-medium mb-3'>Export Data</h4>
        <div className='flex space-x-3 flex-wrap gap-2'>
          <button
            onClick={handleExportJSON}
            disabled={isExporting}
            className={`glass-button flex items-center space-x-2 ${isExporting ? 'glass-loading' : ''}`}
          >
            {isExporting ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Export JSON</span>
              </>
            )}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className={`glass-button flex items-center space-x-2 ${isExporting ? 'glass-loading' : ''}`}
          >
            {isExporting ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Export CSV</span>
              </>
            )}
          </button>
          <button
            onClick={handleExportCreditCardsCSV}
            disabled={isExporting}
            className={`glass-button flex items-center space-x-2 ${isExporting ? 'glass-loading' : ''}`}
          >
            {isExporting ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Export Credit Cards CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div>
        <h4 className='text-primary font-medium mb-3'>Import Data</h4>
        {/* Type inferred from file extension (.json or .csv), not the dropdown. */}
        <div className='space-y-3'>
          <div className='flex space-x-3'>
            <select
              value={importType}
              onChange={e => setImportType(e.target.value)}
              className='glass-input'
            >
              <option value='json'>JSON</option>
              <option value='csv'>CSV</option>
            </select>
            <input
              type='file'
              accept={importType === 'json' ? '.json' : '.csv'}
              onChange={handleImportFile}
              className='glass-input'
            />
          </div>
          {importFile && (
            <div className='space-y-3'>
              <div className='flex items-center space-x-3'>
                <span className='text-secondary text-sm'>
                  Selected: {importFile.name}
                </span>
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className={`glass-button flex items-center space-x-2 ${isImporting ? 'glass-loading' : ''}`}
                >
                  {isImporting ? (
                    <>
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>Import</span>
                    </>
                  )}
                </button>
              </div>
              {importProgress && (
                <div className='text-sm text-blue-300 bg-blue-500/20 rounded-lg px-3 py-2'>
                  {importProgress}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showFutureGenPrompt && (
        <div className='glass-panel p-4 space-y-3'>
          <h5 className='text-primary font-semibold'>
            No future fixed expenses detected
          </h5>
          <p className='text-secondary text-sm'>
            Generate upcoming months from this month&apos;s fixed expenses? This
            will create or reuse recurring templates and populate future months,
            skipping duplicates.
          </p>
          <div className='flex items-center space-x-2'>
            {[1, 3, 6].map(value => (
              <button
                key={value}
                onClick={() => setSelectedHorizon(value)}
                className={`glass-button glass-button--sm ${
                  selectedHorizon === value ? 'glass-button--primary' : ''
                }`}
              >
                {value} {value === 1 ? 'month' : 'months'}
              </button>
            ))}
          </div>
          <div className='flex space-x-3'>
            <button
              onClick={handleGenerateFutureExpenses}
              className='glass-button glass-button--primary flex-1'
            >
              Generate
            </button>
            <button
              onClick={() => {
                setShowFutureGenPrompt(false);
                onFuturePromptDismissed?.();
              }}
              className='glass-button flex-1'
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Clear Data Section */}
      <div>
        <h4 className='text-primary font-medium mb-3'>Clear Data</h4>
        <div className='space-y-3'>
          <p className='text-secondary text-sm'>
            Clear all data from all tables. A backup will be created
            automatically.
          </p>
          <button
            onClick={handleClearAllData}
            className='glass-button glass-button--danger flex items-center space-x-2'
          >
            <Trash2 size={16} />
            <span>Clear All Data</span>
          </button>
        </div>
      </div>

      {/* Backup Recovery Section */}
      <div>
        <h4 className='text-primary font-medium mb-3'>Backup Recovery</h4>
        <div className='space-y-3'>
          <p className='text-secondary text-sm'>
            If an import failed or you need to restore from a backup created
            before import.
          </p>
          <button
            onClick={handleRestoreFromBackup}
            className='glass-button glass-button--secondary flex items-center space-x-2'
          >
            <Shield size={16} />
            <span>Restore from Backup</span>
          </button>
        </div>
      </div>
    </div>
  );
};

DataManagementCard.propTypes = {
  onDataChange: PropTypes.func.isRequired,
  reloadExpenses: PropTypes.func.isRequired,
  globalCategories: PropTypes.object.isRequired,
  fixedExpenses: PropTypes.array,
  startCurrent: PropTypes.object.isRequired,
  setPendingFutureCheck: PropTypes.func.isRequired,
  shouldShowFuturePrompt: PropTypes.bool,
  onFuturePromptDismissed: PropTypes.func,
};

export default DataManagementCard;

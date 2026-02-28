import {
  Download,
  Upload,
  Eye,
  Trash2,
  Lock,
  Shield,
  Database,
  DollarSign,
  Settings as SettingsIcon,
  RefreshCw,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo } from 'react';

import CategoryManager from '../components/CategoryManager';
import CollapsibleCardGroup from '../components/CollapsibleCardGroup';
import PaycheckManager from '../components/PaycheckManager';
import RecurringTemplatesManager from '../components/RecurringTemplatesManager';
import { useGlobalCategories } from '../contexts/GlobalCategoryContext';
import { dbHelpers } from '../db/database-clean';
import { dataManager } from '../services/dataManager';
import { useAppStore } from '../stores/useAppStore';
import { DateUtils } from '../utils/dateUtils';
import { exportJSONData } from '../utils/exportUtils';
import { logger } from '../utils/logger';

const Settings = ({ onDataChange }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importType, setImportType] = useState('json');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Global categories service for cache invalidation
  const globalCategories = useGlobalCategories();
  const { fixedExpenses, reloadCategories, reloadExpenses } = useAppStore();
  const [showFutureGenPrompt, setShowFutureGenPrompt] = useState(false);
  const [selectedHorizon, setSelectedHorizon] = useState(3);
  const [pendingFutureCheck, setPendingFutureCheck] = useState(false);

  const { currentMonthHasData, nextMonthHasData, startCurrent } =
    useMemo(() => {
      const today = new Date();
      const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const currentEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const nextStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

      const isInRange = (dateString, start, end) => {
        const parsed = DateUtils.parseDate(dateString);
        if (!parsed) return false;
        return parsed >= start && parsed <= end;
      };

      const hasCurrent = (fixedExpenses || []).some(expense =>
        isInRange(expense.dueDate, currentStart, currentEnd),
      );
      const hasNext = (fixedExpenses || []).some(expense =>
        isInRange(expense.dueDate, nextStart, nextEnd),
      );

      return {
        currentMonthHasData: hasCurrent,
        nextMonthHasData: hasNext,
        startCurrent: currentStart,
      };
    }, [fixedExpenses]);

  useEffect(() => {
    const initializeSettings = async () => {
      try {
        logger.debug('Settings page initializing...');
        logger.debug('Settings: Starting initialization...');

        // Test basic functionality first
        logger.debug('Settings: Testing basic state...');

        // Test database connection with schema fix
        logger.debug('Settings: Testing database connection...');
        try {
          await loadAuditLogs();
        } catch (dbError) {
          if (
            dbError.message.includes('ConstraintError') ||
            dbError.message.includes('DatabaseClosedError') ||
            dbError.message.includes('already exists')
          ) {
            logger.debug(
              'Settings: Database schema issue detected, attempting reset...',
            );
            await dbHelpers.deleteDatabase();
            await loadAuditLogs();
          } else {
            throw dbError;
          }
        }

        logger.debug('Settings: Initialization successful');
        setIsLoading(false);
        logger.debug('Settings page loaded successfully');
      } catch (error) {
        logger.error('Settings: Error during initialization:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, []);

  useEffect(() => {
    if (!pendingFutureCheck) return;

    if (currentMonthHasData && !nextMonthHasData) {
      setShowFutureGenPrompt(true);
    }

    setPendingFutureCheck(false);
  }, [pendingFutureCheck, currentMonthHasData, nextMonthHasData]);

  const loadAuditLogs = async () => {
    try {
      const logs = await dataManager.getAuditLogs();
      setAuditLogs(logs);
    } catch (error) {
      logger.error('Error loading audit logs:', error);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const files = await dataManager.exportData('csv', setImportProgress);

      // Download each file
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

  const handleImportFile = event => {
    const file = event.target.files[0];
    if (file) {
      setImportFile(file);
      setImportProgress('');
    }
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

        // Invalidate category cache after import to ensure fresh data
        globalCategories.invalidateCache();

        onDataChange();
        await reloadExpenses();
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

  const handleClearAuditLogs = async () => {
    if (confirm('Are you sure you want to clear all audit logs?')) {
      try {
        await dataManager.clearAuditLogs();
        loadAuditLogs();
        alert('Audit logs cleared');
      } catch (error) {
        logger.error('Error clearing audit logs:', error);
        alert(`Error clearing audit logs: ${error.message}`);
      }
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

        // Invalidate category cache after clearing data
        globalCategories.invalidateCache();

        setImportProgress('All data cleared successfully!');
        onDataChange();
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

        // Invalidate category cache after backup restore
        globalCategories.invalidateCache();

        setImportProgress('Backup restored successfully!');
        onDataChange();
        setTimeout(() => setImportProgress(''), 3000);
        alert('Data restored from backup successfully');
      } catch (error) {
        logger.error('Error restoring from backup:', error);
        alert(`Failed to restore backup: ${error.message}`);
        setImportProgress('');
      }
    }
  };

  const formatTimestamp = timestamp => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionIcon = actionType => {
    switch (actionType) {
      case 'CREATE':
        return '➕';
      case 'UPDATE':
        return '✏️';
      case 'DELETE':
        return '🗑️';
      case 'COMPLETE':
        return '✅';
      default:
        return '📝';
    }
  };

  const buildDedupeKey = (dateString, expense) =>
    `${dateString || ''}|${expense.name || ''}|${expense.category || ''}|${
      expense.amount || ''
    }`;

  const handleGenerateFutureExpenses = async () => {
    try {
      const horizon = Math.min(Math.max(selectedHorizon, 1), 6);
      const { preGenerateOccurrences, createTemplate } = await import(
        '../services/recurringExpenseService'
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
          // Create a template starting next month to avoid current-month duplicate
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
            targetCreditCardId: expense.targetCreditCardId || null, // For credit card payments
            notes: expense.notes || '',
            isVariableAmount: expense.isVariableAmount || false,
          });

          // Link the existing expense to the new template for lineage
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
    } catch (error) {
      logger.error('Error generating future expenses:', error);
      alert(`Failed to generate future expenses: ${error.message}`);
    }
  };

  const getEntityIcon = entityType => {
    switch (entityType) {
      case 'account':
        return '🏦';
      case 'pendingTransaction':
        return '⏳';
      case 'fixedExpense':
        return '📅';
      default:
        return '📄';
    }
  };

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='text-center py-8'>
          <div className='glass-loading' />
          <p className='text-white/70 mt-4'>Loading Settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='space-y-6'>
        <div className='text-center py-8'>
          <h2 className='text-xl font-semibold text-red-400 mb-4'>
            Settings Error
          </h2>
          <p className='text-white/70 mb-4'>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className='glass-button'
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className='space-y-6'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-primary text-shadow-lg'>
              Settings
            </h1>
            <p className='text-secondary'>Manage your data and preferences</p>
          </div>
        </div>

        {/* Collapsible Settings Cards */}
        <CollapsibleCardGroup
          cards={[
            {
              title: 'Paycheck Management',
              icon: DollarSign,
              content: <PaycheckManager onDataChange={onDataChange} />,
            },
            {
              title: 'Data Management',
              icon: Database,
              content: (
                <div className='space-y-6'>
                  {/* Export Section */}
                  <div>
                    <h4 className='text-primary font-medium mb-3'>
                      Export Data
                    </h4>
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
                    <h4 className='text-primary font-medium mb-3'>
                      Import Data
                    </h4>
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
                        Generate upcoming months from this month&apos;s fixed
                        expenses? This will create or reuse recurring templates
                        and populate future months, skipping duplicates.
                      </p>
                      <div className='flex items-center space-x-2'>
                        {[1, 3, 6].map(value => (
                          <button
                            key={value}
                            onClick={() => setSelectedHorizon(value)}
                            className={`glass-button glass-button--sm ${
                              selectedHorizon === value
                                ? 'glass-button--primary'
                                : ''
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
                          onClick={() => setShowFutureGenPrompt(false)}
                          className='glass-button flex-1'
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Clear Data Section */}
                  <div>
                    <h4 className='text-primary font-medium mb-3'>
                      Clear Data
                    </h4>
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
                    <h4 className='text-primary font-medium mb-3'>
                      Backup Recovery
                    </h4>
                    <div className='space-y-3'>
                      <p className='text-secondary text-sm'>
                        If an import failed or you need to restore from a backup
                        created before import.
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
              ),
            },
            {
              title: 'Category Management',
              icon: SettingsIcon,
              content: (
                <div className='category-manager-wrapper'>
                  <CategoryManager
                    onDataChange={async () => {
                      await reloadCategories(); // Targeted reload of categories
                      onDataChange(); // Maintain existing full reload behavior
                    }}
                  />
                </div>
              ),
            },
            {
              title: 'Recurring Templates Management',
              icon: RefreshCw,
              content: <RecurringTemplatesManager />,
            },
            {
              title: 'Audit Log',
              icon: Eye,
              content: (
                <div className='space-y-4'>
                  <div className='flex space-x-2'>
                    <button
                      onClick={() => setShowAuditLogs(!showAuditLogs)}
                      className='glass-button flex items-center space-x-2'
                    >
                      <Eye size={16} />
                      <span>{showAuditLogs ? 'Hide' : 'Show'}</span>
                    </button>
                    <button
                      onClick={handleClearAuditLogs}
                      className='glass-button glass-button--danger flex items-center space-x-2'
                    >
                      <Trash2 size={16} />
                      <span>Clear</span>
                    </button>
                  </div>

                  {showAuditLogs && (
                    <div className='max-h-96 overflow-y-auto'>
                      {auditLogs.length === 0 ? (
                        <div className='empty-state'>
                          <div className='empty-state-icon'>📝</div>
                          <h3 className='text-lg font-semibold text-primary mb-2'>
                            No audit logs yet
                          </h3>
                          <p className='text-secondary'>
                            Actions will be logged here as you use the app
                          </p>
                        </div>
                      ) : (
                        <div className='space-y-2'>
                          {auditLogs.map(log => (
                            <div
                              key={log.id}
                              className='bg-white/5 rounded-lg p-3 backdrop-blur-sm'
                            >
                              <div className='flex items-center justify-between mb-1'>
                                <div className='flex items-center space-x-2'>
                                  <span>{getActionIcon(log.actionType)}</span>
                                  <span>{getEntityIcon(log.entityType)}</span>
                                  <span className='text-primary font-medium'>
                                    {log.actionType} {log.entityType}
                                  </span>
                                </div>
                                <span className='text-muted text-xs'>
                                  {formatTimestamp(log.timestamp)}
                                </span>
                              </div>
                              {log.details && (
                                <div className='text-secondary text-sm bg-white/5 rounded p-2 mt-2'>
                                  <pre className='whitespace-pre-wrap text-xs'>
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ),
            },
            {
              title: 'Privacy & Security',
              icon: Shield,
              content: (
                <div className='space-y-4'>
                  <div className='flex items-center justify-between p-3 bg-white/5 rounded-lg'>
                    <div>
                      <h4 className='text-primary font-medium'>PIN Lock</h4>
                      <p className='text-secondary text-sm'>
                        Secure your financial data with a local PIN
                      </p>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Lock size={20} className='text-muted' />
                      <span className='text-secondary'>Enabled</span>
                    </div>
                  </div>

                  <div className='flex items-center justify-between p-3 bg-white/5 rounded-lg'>
                    <div>
                      <h4 className='text-primary font-medium'>Data Storage</h4>
                      <p className='text-secondary text-sm'>
                        All data is stored locally in your browser
                      </p>
                    </div>
                    <span className='text-green-400 text-sm'>✓ Local Only</span>
                  </div>
                </div>
              ),
            },
          ]}
          exclusive={true}
        />
      </div>
    );
  } catch (error) {
    logger.error('Settings: Rendering error:', error);
    return (
      <div className='space-y-6'>
        <div className='text-center py-8'>
          <h2 className='text-xl font-semibold text-red-400 mb-4'>
            Rendering Error
          </h2>
          <p className='text-white/70 mb-4'>
            An error occurred while rendering the Settings page.
          </p>
          <p className='text-white/50 text-sm mb-4'>{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className='glass-button'
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
};

Settings.propTypes = {
  onDataChange: PropTypes.func.isRequired,
};

export default Settings;

import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { Download, Upload, Eye, Trash2, Lock, Shield, Database, DollarSign, Settings as SettingsIcon } from 'lucide-react';
import { dataManager } from '../services/dataManager';
import PaycheckManager from '../components/PaycheckManager';
import CategoryManager from '../components/CategoryManager';
import CollapsibleCardGroup from '../components/CollapsibleCardGroup';

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

  useEffect(() => {
    const initializeSettings = async () => {
      try {
        logger.debug('Settings page initializing...');
        console.log('Settings: Starting initialization...');

        // Test basic functionality first
        console.log('Settings: Testing basic state...');

        // Test database connection with schema fix
        console.log('Settings: Testing database connection...');
        try {
          await loadAuditLogs();
        } catch (dbError) {
          if (dbError.message.includes('ConstraintError') ||
              dbError.message.includes('DatabaseClosedError') ||
              dbError.message.includes('already exists')) {
            console.log('Settings: Database schema issue detected, attempting reset...');
            await dbHelpers.deleteDatabase();
            await loadAuditLogs();
          } else {
            throw dbError;
          }
        }

        console.log('Settings: Initialization successful');
        setIsLoading(false);
        logger.debug('Settings page loaded successfully');
      } catch (error) {
        console.error('Settings: Error during initialization:', error);
        logger.error('Error initializing Settings page:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, []);

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
      alert('Error exporting data: ' + error.message);
    } finally {
      setIsExporting(false);
      setImportProgress('');
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const { blob, filename } = await dataManager.exportData('json', setImportProgress);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logger.success('Data exported successfully');
    } catch (error) {
      logger.error('Error exporting JSON:', error);
      alert('Error exporting data: ' + error.message);
    } finally {
      setIsExporting(false);
      setImportProgress('');
    }
  };

  const handleImportFile = (event) => {
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
      if (confirm('This will overwrite all existing data. A backup will be created automatically. Are you sure?')) {
        await dataManager.importData(importFile, setImportProgress);
        onDataChange();
        setImportFile(null);
        alert('Data imported successfully');
      }
    } catch (error) {
      logger.error('Error importing data:', error);
      alert('Import failed: ' + error.message);
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
        alert('Error clearing audit logs: ' + error.message);
      }
    }
  };

  const handleClearAllData = async () => {
    if (confirm('This will clear all data from all tables. A backup will be created automatically. Are you sure?')) {
      try {
        setImportProgress('Creating backup...');
        await dataManager.clearAllData();
        setImportProgress('All data cleared successfully!');
        onDataChange();
        setTimeout(() => setImportProgress(''), 3000);
        alert('All data cleared successfully. Default categories have been restored.');
      } catch (error) {
        logger.error('Error clearing all data:', error);
        alert('Failed to clear data: ' + error.message);
        setImportProgress('');
      }
    }
  };

  const handleRestoreFromBackup = async () => {
    if (confirm('This will restore your data from the last backup. Are you sure?')) {
      try {
        setImportProgress('Finding latest backup...');
        const backup = await dataManager.backupManager.getLatestBackup();
        if (!backup) {
          throw new Error('No backup found');
        }

        setImportProgress('Restoring backup...');
        await dataManager.backupManager.restoreBackup(backup.key);

        setImportProgress('Backup restored successfully!');
        onDataChange();
        setTimeout(() => setImportProgress(''), 3000);
        alert('Data restored from backup successfully');
      } catch (error) {
        logger.error('Error restoring from backup:', error);
        alert('Failed to restore backup: ' + error.message);
        setImportProgress('');
      }
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionIcon = (actionType) => {
    switch (actionType) {
    case 'CREATE': return '➕';
    case 'UPDATE': return '✏️';
    case 'DELETE': return '🗑️';
    case 'COMPLETE': return '✅';
    default: return '📝';
    }
  };

  const getEntityIcon = (entityType) => {
    switch (entityType) {
    case 'account': return '🏦';
    case 'pendingTransaction': return '⏳';
    case 'fixedExpense': return '📅';
    default: return '📄';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="glass-loading" />
          <p className="text-white/70 mt-4">Loading Settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold text-red-400 mb-4">Settings Error</h2>
          <p className="text-white/70 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="glass-button"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary text-shadow-lg">Settings</h1>
            <p className="text-secondary">Manage your data and preferences</p>
          </div>
        </div>

        {/* Collapsible Settings Cards */}
        <CollapsibleCardGroup
          cards={[
            {
              title: "Paycheck Management",
              icon: DollarSign,
              content: <PaycheckManager onDataChange={onDataChange} />
            },
            {
              title: "Data Management",
              icon: Database,
              content: (
                <div className="space-y-6">
                  {/* Export Section */}
                  <div>
                    <h4 className="text-primary font-medium mb-3">Export Data</h4>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleExportJSON}
                        disabled={isExporting}
                        className={`glass-button flex items-center space-x-2 ${isExporting ? 'glass-loading' : ''}`}
                      >
                        {isExporting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            <span>Exporting...</span>
                          </>
                        ) : (
                          <>
                            <Download size={16} />
                            <span>Export CSV</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Import Section */}
                  <div>
                    <h4 className="text-primary font-medium mb-3">Import Data</h4>
                    <div className="space-y-3">
                      <div className="flex space-x-3">
                        <select
                          value={importType}
                          onChange={(e) => setImportType(e.target.value)}
                          className="glass-input"
                        >
                          <option value="json">JSON</option>
                          <option value="csv">CSV</option>
                        </select>
                        <input
                          type="file"
                          accept={importType === 'json' ? '.json' : '.csv'}
                          onChange={handleImportFile}
                          className="glass-input"
                        />
                      </div>
                      {importFile && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <span className="text-secondary text-sm">
                            Selected: {importFile.name}
                            </span>
                            <button
                              onClick={handleImport}
                              disabled={isImporting}
                              className={`glass-button flex items-center space-x-2 ${isImporting ? 'glass-loading' : ''}`}
                            >
                              {isImporting ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
                            <div className="text-sm text-blue-300 bg-blue-500/20 rounded-lg px-3 py-2">
                              {importProgress}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clear Data Section */}
                  <div>
                    <h4 className="text-primary font-medium mb-3">Clear Data</h4>
                    <div className="space-y-3">
                      <p className="text-secondary text-sm">
                      Clear all data from all tables. A backup will be created automatically.
                      </p>
                      <button
                        onClick={handleClearAllData}
                        className="glass-button bg-red-500/20 hover:bg-red-500/30 text-red-300 flex items-center space-x-2"
                      >
                        <Trash2 size={16} />
                        <span>Clear All Data</span>
                      </button>
                    </div>
                  </div>

                  {/* Backup Recovery Section */}
                  <div>
                    <h4 className="text-primary font-medium mb-3">Backup Recovery</h4>
                    <div className="space-y-3">
                      <p className="text-secondary text-sm">
                      If an import failed or you need to restore from a backup created before import.
                      </p>
                      <button
                        onClick={handleRestoreFromBackup}
                        className="glass-button bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300"
                      >
                        <Shield size={16} />
                        <span>Restore from Backup</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            },
            {
              title: "Category Management",
              icon: SettingsIcon,
              content: (
                <div className="category-manager-wrapper">
                  <CategoryManager onDataChange={onDataChange} />
                </div>
              )
            },
            {
              title: "Audit Log",
              icon: Eye,
              content: (
                <div className="space-y-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowAuditLogs(!showAuditLogs)}
                      className="glass-button flex items-center space-x-2"
                    >
                      <Eye size={16} />
                      <span>{showAuditLogs ? 'Hide' : 'Show'}</span>
                    </button>
                    <button
                      onClick={handleClearAuditLogs}
                      className="glass-button bg-red-500/20 hover:bg-red-500/30 flex items-center space-x-2"
                    >
                      <Trash2 size={16} />
                      <span>Clear</span>
                    </button>
                  </div>

                  {showAuditLogs && (
                    <div className="max-h-96 overflow-y-auto">
                      {auditLogs.length === 0 ? (
                        <div className="empty-state">
                          <div className="empty-state-icon">📝</div>
                          <h3 className="text-lg font-semibold text-primary mb-2">No audit logs yet</h3>
                          <p className="text-secondary">Actions will be logged here as you use the app</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {auditLogs.map((log) => (
                            <div key={log.id} className="bg-white/5 rounded-lg p-3 backdrop-blur-sm">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-2">
                                  <span>{getActionIcon(log.actionType)}</span>
                                  <span>{getEntityIcon(log.entityType)}</span>
                                  <span className="text-primary font-medium">
                                    {log.actionType} {log.entityType}
                                  </span>
                                </div>
                                <span className="text-muted text-xs">
                                  {formatTimestamp(log.timestamp)}
                                </span>
                              </div>
                              {log.details && (
                                <div className="text-secondary text-sm bg-white/5 rounded p-2 mt-2">
                                  <pre className="whitespace-pre-wrap text-xs">
                                    {JSON.stringify(JSON.parse(log.details), null, 2)}
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
              )
            },
            {
              title: "Privacy & Security",
              icon: Shield,
              content: (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <h4 className="text-primary font-medium">PIN Lock</h4>
                      <p className="text-secondary text-sm">
                      Secure your financial data with a local PIN
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Lock size={20} className="text-muted" />
                      <span className="text-secondary">Enabled</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <h4 className="text-primary font-medium">Data Storage</h4>
                      <p className="text-secondary text-sm">
                      All data is stored locally in your browser
                      </p>
                    </div>
                    <span className="text-green-400 text-sm">✓ Local Only</span>
                  </div>
                </div>
              )
            }
          ]}
          exclusive={true}
        />
      </div>
    );
  } catch (error) {
    console.error('Settings: Rendering error:', error);
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold text-red-400 mb-4">Rendering Error</h2>
          <p className="text-white/70 mb-4">An error occurred while rendering the Settings page.</p>
          <p className="text-white/50 text-sm mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="glass-button"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
};

export default Settings;

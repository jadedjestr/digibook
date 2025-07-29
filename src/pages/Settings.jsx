import React, { useState, useEffect } from 'react';
import { Download, Upload, Eye, Trash2, Lock, Shield, Database } from 'lucide-react';
import { dbHelpers } from '../db/database';
import Papa from 'papaparse';

const Settings = ({ onDataChange }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importType, setImportType] = useState('json');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      const logs = await dbHelpers.getAuditLogs();
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const data = await dbHelpers.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `digibook_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Error exporting data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const data = await dbHelpers.exportData();
      
      // Export each table as separate CSV
      const tables = ['accounts', 'pendingTransactions', 'fixedExpenses', 'auditLogs'];
      
      tables.forEach(tableName => {
        if (data[tableName] && data[tableName].length > 0) {
          const csv = Papa.unparse(data[tableName]);
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${tableName}_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      let data;
      
      if (importType === 'json') {
        const text = await importFile.text();
        data = JSON.parse(text);
      } else {
        // CSV import - for now, we'll handle accounts only
        const text = await importFile.text();
        const result = Papa.parse(text, { header: true });
        data = { accounts: result.data };
      }

      if (confirm('This will overwrite all existing data. Are you sure?')) {
        await dbHelpers.importData(data);
        onDataChange();
        setImportFile(null);
        alert('Data imported successfully');
      }
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Error importing data. Please check the file format.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearAuditLogs = async () => {
    if (confirm('Are you sure you want to clear all audit logs?')) {
      try {
        await dbHelpers.clearAuditLogs();
        loadAuditLogs();
        alert('Audit logs cleared');
      } catch (error) {
        console.error('Error clearing audit logs:', error);
        alert('Error clearing audit logs');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary text-shadow-lg">Settings</h1>
          <p className="text-secondary">Manage your data and preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import/Export Section */}
        <div className="glass-panel">
          <div className="flex items-center space-x-2 mb-4">
            <Database size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-primary">Data Management</h3>
          </div>
          
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
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Audit Logs Section */}
        <div className="glass-panel">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Eye size={20} className="text-primary" />
              <h3 className="text-lg font-semibold text-primary">Audit Log</h3>
            </div>
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
      </div>

      {/* Privacy Section */}
      <div className="glass-panel">
        <div className="flex items-center space-x-2 mb-4">
          <Shield size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-primary">Privacy & Security</h3>
        </div>
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
      </div>
    </div>
  );
};

export default Settings; 
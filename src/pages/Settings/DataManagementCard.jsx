import { Download, Upload, Trash2, RotateCcw } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { dbHelpers } from '../../db/database-clean';
import { dataManager } from '../../services/dataManager';
import { exportJSONData } from '../../utils/exportUtils';
import { logger } from '../../utils/logger';

const DataManagementCard = ({ onDataChange, globalCategories }) => {
  const [importFile, setImportFile] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [lastExportDate, setLastExportDate] = useState(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [backupList, setBackupList] = useState([]);
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [date, list] = await Promise.all([
          dbHelpers.getLastExportDate(),
          dataManager.backupManager.listBackups(),
        ]);
        setLastExportDate(date);
        setBackupList(list || []);
      } catch (err) {
        logger.warn('Failed to load export/backup info:', err);
      }
    };
    load();
  }, []);

  const showNudge =
    !nudgeDismissed &&
    (lastExportDate === null ||
      (Date.now() - new Date(lastExportDate).getTime()) /
        (24 * 60 * 60 * 1000) >
        30);
  const lastExportLabel =
    lastExportDate === null
      ? 'never'
      : (() => {
          const days = Math.floor(
            (Date.now() - new Date(lastExportDate).getTime()) /
              (24 * 60 * 60 * 1000),
          );
          return days === 0 ? 'today' : `${days} days ago`;
        })();

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const result = await exportJSONData(setImportProgress);
      if (result.success) {
        setLastExportDate(new Date().toISOString());
      } else {
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
      const isJson = importFile.name.toLowerCase().endsWith('.json');
      const confirmMessage = isJson
        ? 'This will overwrite all existing data. A backup will be created automatically. Are you sure?'
        : 'This will merge into the matching table only — your other data will not be affected. A backup will be created automatically. Are you sure?';
      if (confirm(confirmMessage)) {
        const result = await dataManager.importData(
          importFile,
          setImportProgress,
        );

        await refreshAfterDbReplace();
        setImportFile(null);

        const skipped = result?.skipped ?? [];
        if (skipped.length > 0) {
          const detail = skipped
            .slice(0, 10)
            .map(s => `  line ${s.line}: ${s.field} (${s.reason})`)
            .join('\n');
          const more =
            skipped.length > 10 ? `\n  ...and ${skipped.length - 10} more` : '';
          alert(
            `Data imported, but ${skipped.length} row(s) were skipped because ` +
              `an amount could not be read:\n\n${detail}${more}\n\n` +
              'Fix those rows and re-import to add them.',
          );
        } else {
          alert('Data imported successfully');
        }
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

  const handleRestoreFromBackup = async backup => {
    if (!backup || restoringId) return;

    if (
      confirm(
        `This will restore your data from the backup created ${formatBackupTimestamp(backup.timestamp)} (${backup.reason}). A backup of your current data will be made first. Are you sure?`,
      )
    ) {
      setRestoringId(backup.id);
      try {
        setImportProgress('Restoring backup...');
        await dataManager.backupManager.restoreBackup(backup.id);

        await refreshAfterDbReplace();
        const list = await dataManager.backupManager.listBackups();
        setBackupList(list || []);
        setImportProgress('Backup restored successfully!');
        setTimeout(() => setImportProgress(''), 3000);
        alert('Data restored from backup successfully');
      } catch (error) {
        logger.error('Error restoring from backup:', error);
        alert(`Failed to restore backup: ${error.message}`);
        setImportProgress('');
      } finally {
        setRestoringId(null);
      }
    }
  };

  const formatBackupTimestamp = ts =>
    ts
      ? new Date(ts).toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : '—';

  return (
    <div className='space-y-6'>
      {showNudge && (
        <div className='glass-panel p-4 space-y-3 border border-amber-500/30'>
          <p className='text-secondary text-sm'>
            Your last file export was {lastExportLabel}. We recommend exporting
            a backup file regularly to protect your data.
          </p>
          <div className='flex flex-wrap gap-2'>
            <button
              onClick={handleExportJSON}
              disabled={isExporting}
              className='glass-button glass-button--primary flex items-center space-x-2'
            >
              <Download size={16} />
              <span>Export Now</span>
            </button>
            <button
              onClick={() => setNudgeDismissed(true)}
              className='glass-button flex items-center space-x-2'
            >
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      )}

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
        <div className='space-y-3'>
          <div className='flex space-x-3'>
            <input
              type='file'
              accept='.json,.csv'
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
            {backupList.length === 0
              ? 'No backups stored yet. Backups are created automatically before import or clear.'
              : `${backupList.length} backup${backupList.length === 1 ? '' : 's'} stored.`}
          </p>
          <p className='text-secondary text-sm'>
            If an import failed or you need to restore from a backup created
            before import, choose one below.
          </p>
          {backupList.length > 0 && (
            <div className='max-h-[320px] overflow-y-auto'>
              <div className='space-y-2'>
                {backupList.map(backup => (
                  <div
                    key={backup.id}
                    className='glass-card p-3 flex items-center justify-between gap-3'
                  >
                    <div>
                      <p className='text-primary text-sm font-medium'>
                        {formatBackupTimestamp(backup.timestamp)}
                      </p>
                      <p className='text-secondary text-xs'>{backup.reason}</p>
                    </div>
                    <button
                      onClick={() => handleRestoreFromBackup(backup)}
                      disabled={restoringId !== null}
                      className='glass-button glass-button--sm glass-button--secondary flex items-center space-x-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {restoringId === backup.id ? (
                        <>
                          <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-white' />
                          <span>Restoring...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw size={14} />
                          <span>Restore</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

DataManagementCard.propTypes = {
  onDataChange: PropTypes.func.isRequired,
  globalCategories: PropTypes.object.isRequired,
};

export default DataManagementCard;

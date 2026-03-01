import { Eye, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

import { dataManager } from '../../services/dataManager';
import { logger } from '../../utils/logger';

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

const AuditLogCard = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  const loadAuditLogs = async () => {
    try {
      const logs = await dataManager.getAuditLogs();
      setAuditLogs(logs);
    } catch (error) {
      logger.error('Error loading audit logs:', error);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

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

  return (
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
  );
};

export default AuditLogCard;

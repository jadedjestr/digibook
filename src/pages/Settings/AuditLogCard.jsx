import { Trash2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

import { dataManager } from '../../services/dataManager';
import { logger } from '../../utils/logger';
import { notify, showConfirmation } from '../../utils/notifications.jsx';

const formatTimestampDisplay = timestamp => {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime()))
    return typeof timestamp === 'string' ? timestamp : 'Invalid date';
  const now = new Date();
  const diffMs = now - d;
  const diffHours = diffMs / (60 * 60 * 1000);
  if (diffHours >= 0 && diffHours < 24) {
    if (diffHours < 1) {
      const mins = Math.round(diffMs / (60 * 1000));
      return mins <= 1 ? 'Just now' : `${mins} minutes ago`;
    }
    const hours = Math.round(diffHours);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  return d.toLocaleString();
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
    case 'COMPLETE_TRANSACTION':
      return '✅';
    case 'PAYMENT':
      return '💳';
    default:
      return '📝';
  }
};

const getEntityIcon = entityType => {
  switch (entityType) {
    case 'account':
      return '🏦';
    case 'pendingTransaction':
    case 'PendingTransaction':
      return '⏳';
    case 'fixedExpense':
      return '📅';
    case 'creditCard':
      return '💳';
    case 'creditCardPayment':
      return '💸';
    default:
      return '📄';
  }
};

const formatDetails = log => {
  if (!log.details || typeof log.details !== 'object') return null;
  const d = log.details;
  const fmt = (n, prefix = '$') =>
    typeof n === 'number'
      ? `${prefix}${Number(n).toLocaleString()}`
      : String(n ?? '');

  if (
    log.actionType === 'COMPLETE_TRANSACTION' &&
    log.entityType === 'PendingTransaction'
  ) {
    return `Completed transaction of ${fmt(d.amount)} (${d.description ?? ''}) — ${d.category ?? ''}. Balance: ${fmt(d.previousBalance)} → ${fmt(d.newBalance)}`;
  }
  if (log.actionType === 'PAYMENT' && log.entityType === 'creditCardPayment') {
    return `Credit card payment of ${fmt(d.amount)}. Account balance: ${fmt(d.newAccountBalance)}. Card balance: ${fmt(d.newCreditCardBalance)}.`;
  }
  if (log.actionType === 'PAYMENT' && log.entityType === 'account') {
    return `Account payment of ${fmt(d.amount)}. New balance: ${fmt(d.newBalance)}.`;
  }
  if (log.actionType === 'PAYMENT' && log.entityType === 'creditCard') {
    return `Credit card charge of ${fmt(d.amount)}. New balance: ${fmt(d.newBalance)}.`;
  }

  const lines = Object.entries(d)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `${label}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;
    });
  return lines.join('\n');
};

const AuditLogCard = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('All Actions');
  const [timeRangeFilter, setTimeRangeFilter] = useState('All Time');

  const filteredLogs = useMemo(() => {
    let list = auditLogs;
    const term = (searchTerm || '').trim().toLowerCase();
    if (term) {
      list = list.filter(
        log =>
          (log.actionType || '').toLowerCase().includes(term) ||
          (log.entityType || '').toLowerCase().includes(term) ||
          JSON.stringify(log.details || {})
            .toLowerCase()
            .includes(term),
      );
    }
    if (actionTypeFilter && actionTypeFilter !== 'All Actions') {
      list = list.filter(log => log.actionType === actionTypeFilter);
    }
    if (timeRangeFilter && timeRangeFilter !== 'All Time') {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const oneDayMs = 24 * 60 * 60 * 1000;
      const sevenDaysMs = 7 * oneDayMs;
      const thirtyDaysMs = 30 * oneDayMs;
      const sevenDaysAgo = now.getTime() - sevenDaysMs;
      const thirtyDaysAgo = now.getTime() - thirtyDaysMs;
      list = list.filter(log => {
        const d = new Date(log.timestamp);
        if (Number.isNaN(d.getTime())) return false;
        if (timeRangeFilter === 'Today')
          return (
            d >= todayStart && d < new Date(todayStart.getTime() + oneDayMs)
          );
        if (timeRangeFilter === 'Last 7 Days')
          return d >= new Date(sevenDaysAgo);
        if (timeRangeFilter === 'Last 30 Days')
          return d >= new Date(thirtyDaysAgo);
        return true;
      });
    }
    return list;
  }, [auditLogs, searchTerm, actionTypeFilter, timeRangeFilter]);

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
    const confirmed = await showConfirmation(
      'Are you sure you want to clear all audit logs? This cannot be undone.',
    );
    if (!confirmed) return;
    try {
      await dataManager.clearAuditLogs();
      loadAuditLogs();
      notify.success('Audit logs cleared');
    } catch (error) {
      logger.error('Error clearing audit logs:', error);
      notify.error(`Error clearing audit logs: ${error.message}`);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            type='text'
            placeholder='Search logs…'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='glass-input flex-1 min-w-[120px]'
          />
          <select
            value={actionTypeFilter}
            onChange={e => setActionTypeFilter(e.target.value)}
            className='glass-input min-w-[140px]'
          >
            <option value='All Actions'>All Actions</option>
            <option value='CREATE'>CREATE</option>
            <option value='UPDATE'>UPDATE</option>
            <option value='DELETE'>DELETE</option>
            <option value='PAYMENT'>PAYMENT</option>
            <option value='COMPLETE_TRANSACTION'>COMPLETE_TRANSACTION</option>
          </select>
          <select
            value={timeRangeFilter}
            onChange={e => setTimeRangeFilter(e.target.value)}
            className='glass-input min-w-[120px]'
          >
            <option value='All Time'>All Time</option>
            <option value='Today'>Today</option>
            <option value='Last 7 Days'>Last 7 Days</option>
            <option value='Last 30 Days'>Last 30 Days</option>
          </select>
        </div>
        <button
          onClick={handleClearAuditLogs}
          className='glass-button glass-button--danger flex items-center space-x-2'
        >
          <Trash2 size={16} />
          <span>Clear</span>
        </button>
      </div>

      <div className='text-right text-secondary text-xs'>
        {searchTerm ||
        actionTypeFilter !== 'All Actions' ||
        timeRangeFilter !== 'All Time'
          ? `Showing ${filteredLogs.length} of ${auditLogs.length} logs`
          : `Showing all ${auditLogs.length} logs`}
      </div>

      <div className='max-h-[600px] overflow-y-auto'>
        {auditLogs.length === 0 && (
          <div className='empty-state'>
            <div className='empty-state-icon'>📝</div>
            <h3 className='text-lg font-semibold text-primary mb-2'>
              No audit logs yet
            </h3>
            <p className='text-secondary'>
              Actions will be logged here as you use the app
            </p>
          </div>
        )}
        {auditLogs.length > 0 && filteredLogs.length === 0 && (
          <p className='text-secondary text-sm py-4'>
            No logs match your filters.
          </p>
        )}
        {auditLogs.length > 0 && filteredLogs.length > 0 && (
          <div className='space-y-2'>
            {filteredLogs.map(log => (
              <div key={log.id} className='glass-card p-3'>
                <div className='flex items-center justify-between mb-1'>
                  <div className='flex items-center space-x-2'>
                    <span>{getActionIcon(log.actionType)}</span>
                    <span>{getEntityIcon(log.entityType)}</span>
                    <span className='text-primary font-medium'>
                      {log.actionType} {log.entityType}
                    </span>
                  </div>
                  <span className='text-muted text-xs'>
                    {formatTimestampDisplay(log.timestamp)}
                  </span>
                </div>
                {log.details && formatDetails(log) && (
                  <div className='text-secondary text-sm mt-2 whitespace-pre-wrap'>
                    {formatDetails(log)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogCard;

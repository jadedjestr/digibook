import React from 'react';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { useFinanceCalculations } from '../services/financeService';
import PrivacyWrapper from './PrivacyWrapper';
import { usePrivacy } from '../contexts/PrivacyContext';

const Sidebar = ({
  navigation,
  currentPage,
  onPageChange,
  onToggleLock,
  isLocked,
  accounts,
  pendingTransactions,
}) => {
  const {
    getDefaultAccount,
    getDefaultAccountProjectedBalance,
  } = useFinanceCalculations(accounts, pendingTransactions);
  const { isHidden, toggleHidden } = usePrivacy();

  const defaultAccount = getDefaultAccount;
  const projectedBalance = getDefaultAccountProjectedBalance;

  return (
    <div className="glass-sidebar">
      {/* Header */}
      <div className="p-6 border-b border-white/20">
        <h1 className="text-2xl font-bold text-primary text-shadow-lg mb-1">Digibook</h1>
        <p className="text-secondary text-sm">Personal Finance Tracker</p>
      </div>

      {/* Summary Cards */}
      <div className="p-4 space-y-4">
        {/* Liquid Cash */}
        {defaultAccount && (
          <div className="glass-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-secondary">Liquid Cash</span>
              {defaultAccount.isDefault && (
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full backdrop-blur-sm">
                  Default
                </span>
              )}
            </div>
            <div className={`balance-display ${
              projectedBalance < defaultAccount.currentBalance ? 'warning' : ''
            }`}>
              <PrivacyWrapper>
                ${projectedBalance.toFixed(2)}
              </PrivacyWrapper>
            </div>
            <div className="text-xs text-muted mt-1">
              {defaultAccount.name} • Projected
            </div>
          </div>
        )}


      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onPageChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 glass-focus ${
                    isActive
                      ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm'
                      : 'text-secondary hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Privacy and Lock Buttons */}
      <div className="p-4 border-t border-white/20 space-y-2">
        <button
          onClick={toggleHidden}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 glass-focus text-secondary hover:bg-white/10 hover:text-white"
        >
          {isHidden ? <EyeOff size={20} /> : <Eye size={20} />}
          <span className="font-medium">{isHidden ? 'Show Values' : 'Hide Values'}</span>
        </button>
        <button
          onClick={onToggleLock}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 glass-focus text-secondary hover:bg-white/10 hover:text-white"
        >
          {isLocked ? <Unlock size={20} /> : <Lock size={20} />}
          <span className="font-medium">{isLocked ? 'Unlock' : 'Lock'}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

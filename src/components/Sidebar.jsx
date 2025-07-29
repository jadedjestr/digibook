import React from 'react';
import { Lock, Unlock } from 'lucide-react';

const Sidebar = ({ 
  navigation, 
  currentPage, 
  onPageChange, 
  onToggleLock, 
  isLocked,
  defaultAccount,
  liquidBalance,
  pendingTransactions
}) => {
  // Calculate projected balance for default account
  const getProjectedBalance = () => {
    if (!defaultAccount) return 0;
    
    const pendingForAccount = pendingTransactions
      .filter(t => t.accountId === defaultAccount.id)
      .reduce((sum, t) => sum + t.amount, 0);
    
    return defaultAccount.currentBalance - pendingForAccount;
  };

  const projectedBalance = getProjectedBalance();

  return (
    <div className="glass-sidebar">
      {/* Header */}
      <div className="p-6 border-b border-white/20">
        <h1 className="text-2xl font-bold text-primary text-shadow-lg mb-1">Digibook</h1>
        <p className="text-secondary text-sm">Personal Finance Tracker</p>
      </div>

      {/* Summary Cards */}
      <div className="p-4 space-y-4">
        {/* Default Account Projected Balance */}
        {defaultAccount && (
          <div className="glass-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-secondary">Default Account</span>
              {defaultAccount.isDefault && (
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full backdrop-blur-sm">
                  Default
                </span>
              )}
            </div>
            <div className={`balance-display ${
              projectedBalance < defaultAccount.currentBalance ? 'warning' : ''
            }`}>
              ${projectedBalance.toFixed(2)}
            </div>
            <div className="text-xs text-muted mt-1">
              {defaultAccount.name} • Projected
            </div>
          </div>
        )}

        {/* Liquid Balance */}
        <div className="glass-card">
          <div className="text-sm font-medium text-secondary mb-3">Liquid Balance</div>
          <div className="balance-display">
            ${liquidBalance.toFixed(2)}
          </div>
          <div className="text-xs text-muted mt-1">
            Across all accounts
          </div>
        </div>
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

      {/* Lock Button */}
      <div className="p-4 border-t border-white/20">
        <button
          onClick={onToggleLock}
          className="w-full glass-button flex items-center justify-center space-x-2"
        >
          {isLocked ? <Unlock size={20} /> : <Lock size={20} />}
          <span>{isLocked ? 'Unlock' : 'Lock'}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar; 
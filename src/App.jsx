import React, { useState, useEffect } from 'react';
import { Wallet, Clock, Calendar, Settings, Lock, Unlock } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Accounts from './pages/Accounts';
import PendingTransactions from './pages/PendingTransactions';
import FixedExpenses from './pages/FixedExpenses';
import SettingsPage from './pages/Settings';
import PINLock from './components/PINLock';
import { dbHelpers } from './db/database';

function App() {
  const [currentPage, setCurrentPage] = useState('accounts');
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState(() => {
    return localStorage.getItem('digibook_pin') || '';
  });
  const [accounts, setAccounts] = useState([]);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [defaultAccount, setDefaultAccount] = useState(null);
  const [liquidBalance, setLiquidBalance] = useState(0);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Calculate liquid balance whenever accounts change
  useEffect(() => {
    const total = accounts.reduce((sum, account) => sum + account.currentBalance, 0);
    setLiquidBalance(total);
  }, [accounts]);

  const loadData = async () => {
    try {
      // Fix database schema first
      await dbHelpers.fixDatabaseSchema();
      
      const [accountsData, transactionsData, defaultAccountData] = await Promise.all([
        dbHelpers.getAccounts(),
        dbHelpers.getPendingTransactions(),
        dbHelpers.getDefaultAccount()
      ]);
      
      // Ensure there's a default account
      await dbHelpers.ensureDefaultAccount();
      
      setAccounts(accountsData);
      setPendingTransactions(transactionsData);
      setDefaultAccount(defaultAccountData);
    } catch (error) {
      console.error('Error loading data:', error);
      // Set empty arrays if there's an error
      setAccounts([]);
      setPendingTransactions([]);
      setDefaultAccount(null);
    }
  };

  const handlePINChange = (newPin) => {
    setPin(newPin);
    localStorage.setItem('digibook_pin', newPin);
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  const handleDataChange = () => {
    loadData();
  };

  const navigation = [
    { id: 'accounts', name: 'Accounts', icon: Wallet },
    { id: 'pending', name: 'Pending Transactions', icon: Clock },
    { id: 'expenses', name: 'Fixed Expenses', icon: Calendar },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'accounts':
        return <Accounts accounts={accounts} onDataChange={handleDataChange} />;
      case 'pending':
        return <PendingTransactions 
          pendingTransactions={pendingTransactions} 
          accounts={accounts}
          onDataChange={handleDataChange} 
        />;
      case 'expenses':
        return <FixedExpenses onDataChange={handleDataChange} />;
      case 'settings':
        return <SettingsPage onDataChange={handleDataChange} />;
      default:
        return <Accounts accounts={accounts} onDataChange={handleDataChange} />;
    }
  };

  // Show PIN lock if no PIN is set or if app is locked
  if (!pin || isLocked) {
    return (
      <PINLock 
        pin={pin} 
        onUnlock={() => setIsLocked(false)}
        onPINChange={handlePINChange}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <Sidebar
        navigation={navigation}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onToggleLock={toggleLock}
        isLocked={isLocked}
        defaultAccount={defaultAccount}
        liquidBalance={liquidBalance}
        pendingTransactions={pendingTransactions}
      />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App; 
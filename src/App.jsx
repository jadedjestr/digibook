import { logger } from "./utils/logger";
import React, { useState, useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Wallet, Clock, Calendar, Settings, Lock, Unlock, CreditCard } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Accounts from './pages/Accounts';
import PendingTransactions from './pages/PendingTransactions';
import FixedExpenses from './pages/FixedExpenses';
import SettingsPage from './pages/Settings';
import CreditCards from './pages/CreditCards';
import PINLock from './components/PINLock';
import { dbHelpers } from './db/database';
import { PrivacyProvider } from './contexts/PrivacyContext';

function App() {
  const [currentPage, setCurrentPage] = useState('accounts');
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState(() => {
    return localStorage.getItem('digibook_pin') || '';
  });
  const [accounts, setAccounts] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [defaultAccount, setDefaultAccount] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Fix database schema first
      await dbHelpers.fixDatabaseSchema();
      
      const [accountsData, creditCardsData, transactionsData, defaultAccountData] = await Promise.all([
        dbHelpers.getAccounts(),
        dbHelpers.getCreditCards(),
        dbHelpers.getPendingTransactions(),
        dbHelpers.getDefaultAccount()
      ]);
      
      // Ensure there's a default account
      await dbHelpers.ensureDefaultAccount();
      
      setAccounts(accountsData);
      setCreditCards(creditCardsData);
      setPendingTransactions(transactionsData);
      setDefaultAccount(defaultAccountData);
    } catch (error) {
      logger.error('Error loading data:', error);
      // Set empty arrays if there's an error
      setAccounts([]);
      setCreditCards([]);
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
    { id: 'creditCards', name: 'Credit Cards', icon: CreditCard },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'accounts':
        return <Accounts accounts={accounts} pendingTransactions={pendingTransactions} onDataChange={handleDataChange} />;
      case 'pending':
        return <PendingTransactions 
          pendingTransactions={pendingTransactions} 
          accounts={accounts}
          onDataChange={handleDataChange} 
        />;
      case 'expenses':
        return <FixedExpenses 
          accounts={accounts} 
          creditCards={creditCards}
          pendingTransactions={pendingTransactions}
          onDataChange={handleDataChange}
          isPanelOpen={isPanelOpen}
          setIsPanelOpen={setIsPanelOpen}
        />;
      case 'creditCards':
        return <CreditCards onDataChange={handleDataChange} />;
      case 'settings':
        return <SettingsPage onDataChange={handleDataChange} />;
      default:
        return <Accounts accounts={accounts} pendingTransactions={pendingTransactions} onDataChange={handleDataChange} />;
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
    <PrivacyProvider>
      <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
        <Sidebar
          navigation={navigation}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onToggleLock={toggleLock}
          isLocked={isLocked}
          accounts={accounts}
          pendingTransactions={pendingTransactions}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {renderPage()}
          </div>
        </main>
      </div>
    </PrivacyProvider>
  );
}

export default App;

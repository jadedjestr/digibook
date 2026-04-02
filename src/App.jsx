import {
  BarChart3,
  Calendar,
  Clock,
  CreditCard,
  Settings,
  Wallet,
} from 'lucide-react';
import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import PerformanceDashboard from './components/PerformanceDashboard';
import PINLock from './components/PINLock';
import Sidebar from './components/Sidebar';
import { GlobalCategoryProvider } from './contexts/GlobalCategoryContext';
import { PrivacyProvider } from './contexts/PrivacyContext';
import SettingsPage from './pages/Settings';
import {
  useAccounts,
  useCreditCards,
  useCurrentPage,
  useLoadData,
  usePendingTransactions,
} from './stores/useAppStore';
import { securePINStorage } from './utils/crypto';
import { exportJSONData } from './utils/exportUtils';
import { logger } from './utils/logger';
import { notify } from './utils/notifications';

// Lazy load pages for better performance
const Accounts = lazy(() => import('./pages/Accounts'));
const PendingTransactions = lazy(() => import('./pages/PendingTransactions'));
const FixedExpenses = lazy(() => import('./pages/FixedExpenses'));
const CreditCards = lazy(() => import('./pages/CreditCards'));
const Insights = lazy(() => import('./pages/Insights'));

function App() {
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [isLoadingPIN, setIsLoadingPIN] = useState(true);
  const isExportingRef = useRef(false);

  // Use Zustand store for global state
  const accounts = useAccounts();
  const creditCards = useCreditCards();
  const currentPage = useCurrentPage();
  const pendingTransactions = usePendingTransactions();
  const loadData = useLoadData();

  // Load PIN securely on mount
  useEffect(() => {
    const loadPIN = async () => {
      try {
        const storedPIN = await securePINStorage.getPIN();
        setPin(storedPIN);
      } catch (error) {
        logger.error('Error loading PIN:', error);
        setPin('');
      } finally {
        setIsLoadingPIN(false);
      }
    };

    loadPIN();
  }, []);

  // Load data on mount
  useEffect(() => {
    if (!isLoadingPIN) {
      loadData();
    }
  }, [loadData, isLoadingPIN]);

  // Global keyboard shortcut for export JSON (Cmd+E / Ctrl+E)
  useEffect(() => {
    // Don't set up shortcut if app is locked or PIN is loading
    if (isLoadingPIN || !pin || isLocked) {
      return;
    }

    const handleKeyDown = event => {
      // Cmd+E on Mac, Ctrl+E on Windows/Linux
      if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
        // Don't trigger if user is typing in an input field
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable);

        if (isInputFocused) {
          return;
        }

        // Prevent default browser behavior
        event.preventDefault();

        // Prevent multiple simultaneous exports
        if (isExportingRef.current) {
          return;
        }

        isExportingRef.current = true;
        notify.info('Exporting data...');

        exportJSONData()
          .then(result => {
            if (result.success) {
              notify.success('Data exported successfully');
            } else {
              notify.error(`Export failed: ${result.error}`);
            }
          })
          .catch(error => {
            notify.error('Error exporting data', error);
          })
          .finally(() => {
            isExportingRef.current = false;
          });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoadingPIN, pin, isLocked]);

  const handlePINChange = async newPin => {
    try {
      await securePINStorage.setPIN(newPin);
      setPin(newPin);
      logger.success('PIN updated securely');
    } catch (error) {
      logger.error('Error updating PIN:', error);

      // Still update the state for UI consistency
      setPin(newPin);
    }
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  const navigation = [
    { id: 'accounts', name: 'Accounts', icon: Wallet },
    { id: 'pending', name: 'Pending Transactions', icon: Clock },
    { id: 'expenses', name: 'Fixed Expenses', icon: Calendar },
    { id: 'creditCards', name: 'Credit Cards', icon: CreditCard },
    { id: 'insights', name: 'Insights', icon: BarChart3 },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'accounts':
        return <Accounts />;
      case 'pending':
        return (
          <PendingTransactions
            accounts={accounts}
            onDataChange={loadData}
            pendingTransactions={pendingTransactions}
          />
        );
      case 'expenses':
        return <FixedExpenses />;
      case 'creditCards':
        return (
          <CreditCards
            accounts={accounts}
            creditCards={creditCards}
            onDataChange={loadData}
          />
        );
      case 'insights':
        return (
          <Insights
            accounts={accounts}
            creditCards={creditCards}
            onDataChange={loadData}
          />
        );
      case 'settings':
        return <SettingsPage onDataChange={loadData} />;
      default:
        return <Accounts />;
    }
  };

  // Show loading spinner while PIN is being loaded
  if (isLoadingPIN) {
    return (
      <div className='flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
        <LoadingSpinner />
      </div>
    );
  }

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
    <ErrorBoundary>
      <PrivacyProvider>
        <GlobalCategoryProvider>
          <div className='flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
            <ToastContainer
              position='top-right'
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme='dark'
            />
            <Sidebar
              navigation={navigation}
              onToggleLock={toggleLock}
              isLocked={isLocked}
            />
            <main className='flex-1 overflow-auto lg:ml-0'>
              <div className='p-4 lg:p-6 pt-4 lg:pt-6'>
                <Suspense fallback={<LoadingSpinner />}>
                  <div key={currentPage} className='page-transition'>
                    {renderPage()}
                  </div>
                </Suspense>
              </div>
            </main>
          </div>
        </GlobalCategoryProvider>
      </PrivacyProvider>

      {/* Performance Dashboard (Development Only) */}
      <PerformanceDashboard />
    </ErrorBoundary>
  );
}

export default App;

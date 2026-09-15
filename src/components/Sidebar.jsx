import { Lock, Unlock, Eye, EyeOff, Menu, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';

import { usePrivacy } from '../contexts/PrivacyContext';
import { useFinanceCalculations } from '../services/financeService';
import {
  useAccounts,
  useCurrentPage,
  useCreditCards,
  usePendingTransactions,
  useSetCurrentPage,
} from '../stores/useAppStore';
import { formatCurrency } from '../utils/accountUtils';

import PrivacyWrapper from './PrivacyWrapper';

/*
 * Mobile hamburger menu button.
 *
 * Offset by the safe-area inset rather than a bare top-4. Installed to the
 * home screen the app runs standalone with a translucent status bar, so the
 * viewport starts at the physical top of the screen — a fixed 1rem put this
 * button underneath the clock, where the status bar composited over its
 * backdrop-blur and washed it out. env() is 0 in a browser tab and on
 * desktop, so it stays exactly where it was there.
 *
 * Written as an arbitrary utility rather than a CSS class because a Tailwind
 * utility overrides a base-layer rule — the mistake that silently discarded
 * the first safe-area padding attempt.
 */
const MobileMenuButton = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => (
  <button
    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
    className='lg:hidden fixed top-[calc(1rem+env(safe-area-inset-top))] left-4 z-50 glass-button p-3'
    aria-label='Toggle menu'
  >
    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
  </button>
);

MobileMenuButton.propTypes = {
  isMobileMenuOpen: PropTypes.bool.isRequired,
  setIsMobileMenuOpen: PropTypes.func.isRequired,
};

// Mobile overlay backdrop
const MobileOverlay = ({ isMobileMenuOpen, setIsMobileMenuOpen }) =>
  isMobileMenuOpen && (
    <div
      className='lg:hidden fixed inset-0 bg-black/60 z-40'
      onClick={() => setIsMobileMenuOpen(false)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsMobileMenuOpen(false);
        }
      }}
      role='button'
      tabIndex={0}
      aria-label='Close menu'
    />
  );

MobileOverlay.propTypes = {
  isMobileMenuOpen: PropTypes.bool.isRequired,
  setIsMobileMenuOpen: PropTypes.func.isRequired,
};

// Sidebar content
const SidebarContent = ({
  defaultAccount,
  projectedBalance,
  navigation,
  currentPage,
  handlePageChange,
  toggleHidden,
  isHidden,
  onToggleLock,
  isLocked,
}) => (
  <div className='glass-sidebar mobile-sidebar'>
    {/* Header */}
    <div className='p-6 border-b border-white/20'>
      <h1 className='text-2xl font-bold text-primary text-shadow-lg mb-1'>
        Digibook
      </h1>
      <p className='text-secondary text-sm'>Personal Finance Tracker</p>
    </div>

    {/* Summary Cards */}
    <div className='p-4 space-y-4'>
      {/* Liquid Cash */}
      {defaultAccount && (
        <div className='glass-card'>
          <div className='flex items-center justify-between mb-3'>
            <span className='text-sm font-medium text-secondary'>
              Liquid Cash
            </span>
            {defaultAccount.isDefault && (
              <span className='text-xs badge-info px-2 py-1 rounded-full'>
                Default
              </span>
            )}
          </div>
          <div
            className={`balance-display ${
              projectedBalance < defaultAccount.currentBalance ? 'warning' : ''
            }`}
          >
            <PrivacyWrapper>{formatCurrency(projectedBalance)}</PrivacyWrapper>
          </div>
          <div className='text-xs text-muted mt-1'>
            {defaultAccount.name} • Projected
          </div>
        </div>
      )}
    </div>

    {/* Navigation */}
    <nav className='flex-1 p-4'>
      <ul className='space-y-2'>
        {navigation.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <li key={item.id}>
              <button
                onClick={() => handlePageChange(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 glass-focus ${
                  isActive
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-secondary hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className='font-medium'>{item.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>

    {/* Privacy and Lock Buttons */}
    <div className='p-4 border-t border-white/20 space-y-2'>
      <button
        onClick={toggleHidden}
        className='w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 glass-focus text-secondary hover:bg-white/10 hover:text-white'
      >
        {isHidden ? <EyeOff size={20} /> : <Eye size={20} />}
        <span className='font-medium'>
          {isHidden ? 'Show Values' : 'Hide Values'}
        </span>
      </button>
      <button
        onClick={onToggleLock}
        className='w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 glass-focus text-secondary hover:bg-white/10 hover:text-white'
      >
        {isLocked ? <Unlock size={20} /> : <Lock size={20} />}
        <span className='font-medium'>{isLocked ? 'Unlock' : 'Lock'}</span>
      </button>
    </div>
  </div>
);

SidebarContent.propTypes = {
  defaultAccount: PropTypes.shape({
    isDefault: PropTypes.bool,
    currentBalance: PropTypes.number,
    name: PropTypes.string,
  }),
  projectedBalance: PropTypes.number,
  navigation: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      icon: PropTypes.elementType.isRequired,
    }),
  ).isRequired,
  currentPage: PropTypes.string.isRequired,
  handlePageChange: PropTypes.func.isRequired,
  toggleHidden: PropTypes.func.isRequired,
  isHidden: PropTypes.bool.isRequired,
  onToggleLock: PropTypes.func.isRequired,
  isLocked: PropTypes.bool.isRequired,
};

SidebarContent.defaultProps = {
  defaultAccount: null,
  projectedBalance: 0,
};

const Sidebar = ({ navigation, onToggleLock, isLocked }) => {
  // Use Zustand store for data
  const currentPage = useCurrentPage();
  const accounts = useAccounts();
  const pendingTransactions = usePendingTransactions();
  const creditCards = useCreditCards();
  const setCurrentPage = useSetCurrentPage();
  const { getDefaultAccount, getDefaultAccountProjectedBalance } =
    useFinanceCalculations(accounts, pendingTransactions, creditCards);
  const { isHidden, toggleHidden } = usePrivacy();

  const defaultAccount = getDefaultAccount;
  const projectedBalance = getDefaultAccountProjectedBalance;

  // Mobile sidebar state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when page changes
  useEffect(() => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  }, [currentPage, isMobile]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (isMobileMenuOpen && !event.target.closest('.mobile-sidebar')) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobileMenuOpen]);

  const handlePageChange = useCallback(
    pageId => {
      setCurrentPage(pageId);
      if (isMobile) {
        setIsMobileMenuOpen(false);
      }
    },
    [setCurrentPage, isMobile],
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <MobileMenuButton
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Mobile Overlay */}
      <MobileOverlay
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Desktop Sidebar */}
      <div className='hidden lg:block'>
        <SidebarContent
          defaultAccount={defaultAccount}
          projectedBalance={projectedBalance}
          navigation={navigation}
          currentPage={currentPage}
          handlePageChange={handlePageChange}
          toggleHidden={toggleHidden}
          isHidden={isHidden}
          onToggleLock={onToggleLock}
          isLocked={isLocked}
        />
      </div>

      {/* Mobile Sidebar. top-0/h-full so the panel's own surface still reaches
          the screen edges; the padding keeps its contents out of the status
          bar and home indicator. */}
      <div
        className={`
        lg:hidden fixed top-0 left-0 h-full z-50 transform transition-transform
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          transitionDuration: '250ms',
        }}
      >
        <SidebarContent
          defaultAccount={defaultAccount}
          projectedBalance={projectedBalance}
          navigation={navigation}
          currentPage={currentPage}
          handlePageChange={handlePageChange}
          toggleHidden={toggleHidden}
          isHidden={isHidden}
          onToggleLock={onToggleLock}
          isLocked={isLocked}
        />
      </div>
    </>
  );
};

Sidebar.propTypes = {
  navigation: PropTypes.arrayOf(PropTypes.object).isRequired,
  onToggleLock: PropTypes.func.isRequired,
  isLocked: PropTypes.bool.isRequired,
};

export default Sidebar;

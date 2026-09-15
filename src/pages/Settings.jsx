import {
  Eye,
  Lock,
  Shield,
  Database,
  DollarSign,
  Settings as SettingsIcon,
  RefreshCw,
  Palette,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useCallback } from 'react';

import CategoryManager from '../components/CategoryManager';
import CollapsibleCardGroup from '../components/CollapsibleCardGroup';
import PaycheckManager from '../components/PaycheckManager';
import RecurringTemplatesManager from '../components/RecurringTemplatesManager';
import { useGlobalCategories } from '../contexts/GlobalCategoryContext';
import { dbHelpers } from '../db/database-clean';
import { dataManager } from '../services/dataManager';
import { useReloadCategories } from '../stores/useAppStore';
import { logger } from '../utils/logger';

import AppearanceCard from './Settings/AppearanceCard';
import AuditLogCard from './Settings/AuditLogCard';
import DataManagementCard from './Settings/DataManagementCard';

const Settings = ({ onDataChange }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const globalCategories = useGlobalCategories();
  const reloadCategories = useReloadCategories();

  const handleCategoryDataChange = useCallback(async () => {
    await reloadCategories();
    onDataChange();
  }, [reloadCategories, onDataChange]);

  useEffect(() => {
    const initializeSettings = async () => {
      try {
        logger.debug('Settings page initializing...');
        logger.debug('Settings: Starting initialization...');

        // Test basic functionality first
        logger.debug('Settings: Testing basic state...');

        // Test database connection with schema fix
        logger.debug('Settings: Testing database connection...');
        try {
          await dataManager.getAuditLogs();
        } catch (dbError) {
          if (
            dbError.message.includes('ConstraintError') ||
            dbError.message.includes('DatabaseClosedError') ||
            dbError.message.includes('already exists')
          ) {
            logger.debug(
              'Settings: Database schema issue detected, attempting reset...',
            );
            await dbHelpers.deleteDatabase();
            await dataManager.getAuditLogs();
          } else {
            throw dbError;
          }
        }

        logger.debug('Settings: Initialization successful');
        setIsLoading(false);
        logger.debug('Settings page loaded successfully');
      } catch (error) {
        logger.error('Settings: Error during initialization:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, []);

  const cards = useMemo(
    () => [
      {
        title: 'Appearance',
        icon: Palette,
        content: <AppearanceCard />,
      },
      {
        title: 'Paycheck Management',
        icon: DollarSign,
        content: <PaycheckManager onDataChange={onDataChange} />,
      },
      {
        title: 'Data Management',
        icon: Database,
        content: (
          <DataManagementCard
            onDataChange={onDataChange}
            globalCategories={globalCategories}
          />
        ),
      },
      {
        title: 'Category Management',
        icon: SettingsIcon,
        content: (
          <div className='category-manager-wrapper'>
            <CategoryManager onDataChange={handleCategoryDataChange} />
          </div>
        ),
      },
      {
        title: 'Recurring Templates Management',
        icon: RefreshCw,
        content: <RecurringTemplatesManager />,
      },
      {
        title: 'Audit Log',
        icon: Eye,
        content: <AuditLogCard />,
      },
      {
        title: 'Privacy & Security',
        icon: Shield,
        content: (
          <div className='space-y-4'>
            <div className='flex items-center justify-between p-3 bg-white/5 rounded-lg'>
              <div>
                <h4 className='text-primary font-medium'>PIN Lock</h4>
                <p className='text-secondary text-sm'>
                  Secure your financial data with a local PIN
                </p>
              </div>
              <div className='flex items-center space-x-2'>
                <Lock size={20} className='text-muted' />
                <span className='text-secondary'>Enabled</span>
              </div>
            </div>

            <div className='flex items-center justify-between p-3 bg-white/5 rounded-lg'>
              <div>
                <h4 className='text-primary font-medium'>Data Storage</h4>
                <p className='text-secondary text-sm'>
                  All data is stored locally in your browser
                </p>
              </div>
              <span className='text-green-400 text-sm'>✓ Local Only</span>
            </div>
          </div>
        ),
      },
    ],
    [onDataChange, handleCategoryDataChange, globalCategories],
  );

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='text-center py-8'>
          <div className='glass-loading' />
          <p className='text-white/70 mt-4'>Loading Settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='space-y-6'>
        <div className='text-center py-8'>
          <h2 className='text-xl font-semibold text-red-400 mb-4'>
            Settings Error
          </h2>
          <p className='text-white/70 mb-4'>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className='glass-button'
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className='space-y-6'>
        {/* Header */}
        <div className='flex items-center justify-between pl-14 lg:pl-0'>
          <div>
            <h1 className='text-3xl font-bold text-primary text-shadow-lg'>
              Settings
            </h1>
            <p className='text-secondary'>Manage your data and preferences</p>
          </div>
        </div>

        {/* Collapsible Settings Cards */}
        <CollapsibleCardGroup cards={cards} exclusive={true} />
      </div>
    );
  } catch (error) {
    logger.error('Settings: Rendering error:', error);
    return (
      <div className='space-y-6'>
        <div className='text-center py-8'>
          <h2 className='text-xl font-semibold text-red-400 mb-4'>
            Rendering Error
          </h2>
          <p className='text-white/70 mb-4'>
            An error occurred while rendering the Settings page.
          </p>
          <p className='text-white/50 text-sm mb-4'>{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className='glass-button'
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
};

Settings.propTypes = {
  onDataChange: PropTypes.func.isRequired,
};

export default Settings;

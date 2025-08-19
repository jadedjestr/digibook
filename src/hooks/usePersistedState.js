import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { dbHelpers } from '../db/database';

/**
 * Enhanced hook for persisting UI state with hybrid localStorage + IndexedDB approach
 * 
 * Strategy:
 * 1. Load: localStorage (fast) → IndexedDB (comprehensive) → defaultValue
 * 2. Save: State → localStorage (immediate) → IndexedDB (async backup)
 * 3. Sync: IndexedDB wins on conflicts, localStorage for speed
 */
export const usePersistedState = (key, defaultValue, component = 'fixedExpenses') => {
  const [state, setState] = useState(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        console.log(`🔄 Loading preferences for ${key}...`);
        
        // Step 1: Try localStorage first (fast, synchronous)
        let value = defaultValue;
        try {
          const localValue = localStorage.getItem(`ui_${component}_${key}`);
          if (localValue !== null) {
            value = JSON.parse(localValue);
            console.log(`📦 Loaded from localStorage:`, value);
          }
        } catch (localError) {
          console.warn(`⚠️ localStorage read failed for ${key}:`, localError);
        }

        // Step 2: Try IndexedDB (comprehensive, but async)
        try {
          const dbPrefs = await dbHelpers.getUserPreferences(component);
          if (dbPrefs && dbPrefs[key] !== undefined) {
            value = dbPrefs[key];
            console.log(`🗄️ Loaded from IndexedDB:`, value);
            
            // Sync localStorage with IndexedDB value
            try {
              localStorage.setItem(`ui_${component}_${key}`, JSON.stringify(value));
            } catch (syncError) {
              console.warn(`⚠️ localStorage sync failed:`, syncError);
            }
          }
        } catch (dbError) {
          console.warn(`⚠️ IndexedDB read failed for ${key}:`, dbError);
        }

        // Handle special types (Set, Date, etc.)
        if ((key === 'collapsedCategories' || key === 'manualOverrides') && Array.isArray(value)) {
          value = new Set(value);
        }

        setState(value);
        setIsLoaded(true);
        console.log(`✅ Preferences loaded for ${key}:`, value);
        
      } catch (error) {
        console.error(`❌ Failed to load preferences for ${key}:`, error);
        setError(error.message);
        setState(defaultValue);
        setIsLoaded(true);
      }
    };

    loadPreferences();
  }, [key, component, defaultValue]);

  // Save preferences with hybrid approach
  const updateState = useCallback(async (newValue) => {
    try {
      console.log(`💾 Saving preference ${key}:`, newValue);
      
      // Update local state immediately
      setState(newValue);

      // Step 1: Save to localStorage immediately (for fast retrieval)
      try {
        let valueToStore = newValue;
        
        // Handle special types
        if (newValue instanceof Set) {
          valueToStore = Array.from(newValue);
        }
        
        localStorage.setItem(`ui_${component}_${key}`, JSON.stringify(valueToStore));
        console.log(`📦 Saved to localStorage successfully`);
      } catch (localError) {
        console.warn(`⚠️ localStorage save failed for ${key}:`, localError);
      }

      // Step 2: Save to IndexedDB asynchronously (for persistence)
      try {
        const currentPrefs = await dbHelpers.getUserPreferences(component) || {};
        
        let valueForDB = newValue;
        if (newValue instanceof Set) {
          valueForDB = Array.from(newValue);
        }
        
        const updatedPrefs = {
          ...currentPrefs,
          [key]: valueForDB
        };
        
        await dbHelpers.updateUserPreferences(updatedPrefs, component);
        console.log(`🗄️ Saved to IndexedDB successfully`);
      } catch (dbError) {
        console.warn(`⚠️ IndexedDB save failed for ${key}:`, dbError);
        // Don't throw - localStorage save already succeeded
      }
      
    } catch (error) {
      console.error(`❌ Failed to save preference ${key}:`, error);
      setError(error.message);
      // Don't revert state - user action should still take effect locally
    }
  }, [key, component]);

  // Clear preferences (useful for testing/reset)
  const clearState = useCallback(async () => {
    try {
      setState(defaultValue);
      localStorage.removeItem(`ui_${component}_${key}`);
      
      const currentPrefs = await dbHelpers.getUserPreferences(component) || {};
      delete currentPrefs[key];
      await dbHelpers.updateUserPreferences(currentPrefs, component);
      
      console.log(`🗑️ Cleared preference ${key}`);
    } catch (error) {
      console.error(`❌ Failed to clear preference ${key}:`, error);
    }
  }, [key, component, defaultValue]);

  return {
    value: state,
    setValue: updateState,
    clearValue: clearState,
    isLoaded,
    error
  };
};

// Convenience hooks for common preferences
export const useCollapsedCategories = () => {
  return usePersistedState('collapsedCategories', new Set(), 'fixedExpenses');
};

export const useSortPreference = () => {
  return usePersistedState('sortBy', 'dueDate', 'fixedExpenses');
};

export const useAutoCollapsePreference = () => {
  return usePersistedState('autoCollapseEnabled', true, 'fixedExpenses');
};

export const useShowOnlyUnpaidPreference = () => {
  return usePersistedState('showOnlyUnpaid', false, 'fixedExpenses');
};

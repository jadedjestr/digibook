import PropTypes from 'prop-types';
import { createContext, useContext, useState, useEffect, useMemo } from 'react';

const PrivacyContext = createContext(undefined);

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};

export const PrivacyProvider = ({ children }) => {
  const [isHidden, setIsHidden] = useState(false);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = event => {
      // Cmd+Shift+H on Mac, Ctrl+Shift+H on Windows/Linux
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key === 'h'
      ) {
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

        event.preventDefault();
        setIsHidden(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const value = useMemo(
    () => ({
      isHidden,
      setIsHidden,
      toggleHidden: () => setIsHidden(prev => !prev),
    }),
    [isHidden],
  );

  return (
    <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
  );
};

PrivacyProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

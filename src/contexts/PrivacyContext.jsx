import React, { createContext, useContext, useState, useEffect } from 'react';

const PrivacyContext = createContext();

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};

export const PrivacyProvider = ({ children }) => {
  const [isHidden, setIsHidden] = useState(false);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Cmd+H on Mac, Ctrl+H on Windows/Linux
      if ((event.metaKey || event.ctrlKey) && event.key === 'h') {
        event.preventDefault();
        setIsHidden(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const value = {
    isHidden,
    setIsHidden,
    toggleHidden: () => setIsHidden(prev => !prev)
  };

  return (
    <PrivacyContext.Provider value={value}>
      {children}
    </PrivacyContext.Provider>
  );
}; 
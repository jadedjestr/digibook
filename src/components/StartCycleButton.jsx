import React from 'react';
import { RefreshCw } from 'lucide-react';

const StartCycleButton = ({ onClick, disabled = false, className = '' }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`glass-button flex items-center space-x-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
      } ${className}`}
    >
      <RefreshCw size={16} />
      <span>🔄 Start New Cycle</span>
    </button>
  );
};

export default StartCycleButton; 
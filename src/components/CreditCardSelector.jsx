import React, { useState, useRef, useEffect } from 'react';
import { CreditCard, ChevronDown, Check, X } from 'lucide-react';
import { logger } from '../utils/logger';
import { formatCurrency } from '../utils/accountUtils';

const CreditCardSelector = ({ 
  value, 
  onSave, 
  creditCards = [], 
  disabled = false,
  className = "glass-input text-sm w-full"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value);
  const dropdownRef = useRef(null);

  // Update selectedValue when value prop changes
  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (creditCardId) => {
    setSelectedValue(creditCardId);
    setIsOpen(false);
    onSave(creditCardId);
    logger.debug(`Credit card selected: ${creditCardId}`);
  };

  const getSelectedCreditCard = () => {
    if (!selectedValue) return null;
    return creditCards.find(card => card.id === selectedValue);
  };

  const selectedCard = getSelectedCreditCard();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`${className} flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center space-x-2">
          <CreditCard size={14} className="text-purple-300" />
          <span className="text-white">
            {selectedCard ? (
              <span className="flex items-center space-x-1">
                <span>💳</span>
                <span>{selectedCard.name}</span>
              </span>
            ) : (
              <span className="text-white/60">No credit card</span>
            )}
          </span>
        </div>
        <ChevronDown 
          size={14} 
          className={`text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 glass-panel border border-white/20 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          <div className="p-1">
            {/* No credit card option */}
            <button
              onClick={() => handleSelect(null)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                selectedValue === null 
                  ? 'bg-purple-500/20 text-purple-300' 
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className="text-white/60">No credit card</span>
                {selectedValue === null && <Check size={12} className="text-purple-300" />}
              </div>
            </button>

            {/* Credit card options */}
            {creditCards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleSelect(card.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedValue === card.id 
                    ? 'bg-purple-500/20 text-purple-300' 
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span>💳</span>
                    <span>{card.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-white/60">
                      {formatCurrency(card.balance)} / {formatCurrency(card.creditLimit)}
                    </span>
                    {selectedValue === card.id && <Check size={12} className="text-purple-300" />}
                  </div>
                </div>
              </button>
            ))}

            {creditCards.length === 0 && (
              <div className="px-3 py-2 text-sm text-white/60">
                No credit cards available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditCardSelector;

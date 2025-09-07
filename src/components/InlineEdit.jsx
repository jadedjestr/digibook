import React, { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { logger } from '../utils/logger';
import { DateUtils } from '../utils/dateUtils';
import PrivacyWrapper from './PrivacyWrapper';
import { formatCurrency } from '../utils/accountUtils';

const InlineEdit = ({ value, onSave, type = 'text' }) => {
  const [editValue, setEditValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    // Parse number values properly for decimal amounts
    const valueToSave = type === 'number' ? parseFloat(editValue) || 0 : editValue;
    onSave(valueToSave);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text') {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2">
        {type === 'number' ? (
          <input
            ref={inputRef}
            type="number"
            value={editValue}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string and valid numbers, including incomplete decimals
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setEditValue(value);
              }
            }}
            onKeyDown={handleKeyDown}
            className="glass-input text-sm w-20"
            step="0.01"
            min="0"
          />
        ) : type === 'date' ? (
          <input
            ref={inputRef}
            type="date"
            value={editValue}
            onChange={(e) => {
              logger.debug('Date input changed:', e.target.value);
              setEditValue(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            className="glass-input text-sm w-32"
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="glass-input text-sm w-full"
          />
        )}
        <button
          onClick={handleSave}
          className="p-1 text-green-300 hover:text-green-200"
          title="Save (Enter)"
        >
          <Check size={14} />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-red-300 hover:text-red-200"
          title="Cancel (Esc)"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  const formatDisplayValue = (val, type) => {
    if (type === 'number') {
      return (
        <PrivacyWrapper>
          {formatCurrency(parseFloat(val))}
        </PrivacyWrapper>
      );
    } else if (type === 'date') {
      if (!val) return '';
      return DateUtils.formatDisplayDate(val);
    }
    return val;
  };

  return (
    <div
      className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors"
      onClick={() => setIsEditing(true)}
    >
      {formatDisplayValue(value, type)}
    </div>
  );
};

export default InlineEdit;

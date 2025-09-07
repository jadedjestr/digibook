import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { securePINStorage } from '../utils/crypto';

const PINLock = ({ pin, onUnlock, onPINChange }) => {
  const [enteredPIN, setEnteredPIN] = useState('');
  const [showPIN, setShowPIN] = useState(false);
  const [isSettingPIN, setIsSettingPIN] = useState(!pin);
  const [confirmPIN, setConfirmPIN] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isSettingPIN && !pin) {
      setError('');
    }
  }, [isSettingPIN, pin]);

  const handlePINSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isSettingPIN) {
        if (enteredPIN.length < 4) {
          setError('PIN must be at least 4 digits');
          return;
        }
        if (enteredPIN !== confirmPIN) {
          setError('PINs do not match');
          return;
        }
        
        // Store PIN securely
        const success = await securePINStorage.setPIN(enteredPIN);
        if (success) {
          onPINChange(enteredPIN);
          setIsSettingPIN(false);
          setEnteredPIN('');
          setConfirmPIN('');
          setError('');
        } else {
          setError('Failed to store PIN securely. Please try again.');
        }
      } else {
        if (enteredPIN === pin) {
          onUnlock();
          setEnteredPIN('');
          setError('');
        } else {
          setError('Incorrect PIN');
          setEnteredPIN('');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handlePINSubmit();
    }
  };

  const resetPIN = () => {
    setIsSettingPIN(true);
    setEnteredPIN('');
    setConfirmPIN('');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-panel max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4 backdrop-blur-sm">
            <Shield size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-primary text-shadow-lg mb-2">
            {isSettingPIN ? 'Set PIN' : 'Enter PIN'}
          </h2>
          <p className="text-secondary">
            {isSettingPIN
              ? 'Create a 4-digit PIN to secure your data'
              : 'Enter your PIN to unlock Digibook'
            }
          </p>
        </div>

        <div className="space-y-4">
          {/* PIN Input */}
          <div className="relative">
            <input
              type={showPIN ? 'text' : 'password'}
              value={enteredPIN}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setEnteredPIN(value);
                setError('');
              }}
              onKeyPress={handleKeyPress}
              placeholder={isSettingPIN ? 'Enter new PIN' : 'Enter PIN'}
              className="glass-input w-full text-center text-2xl tracking-widest glass-focus"
              autoFocus
              disabled={isSubmitting}
            />
            <button
              onClick={() => setShowPIN(!showPIN)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              {showPIN ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Confirm PIN (only when setting) */}
          {isSettingPIN && (
            <div className="relative">
              <input
                type={showPIN ? 'text' : 'password'}
                value={confirmPIN}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setConfirmPIN(value);
                  setError('');
                }}
                onKeyPress={handleKeyPress}
                placeholder="Confirm PIN"
                className="glass-input w-full text-center text-2xl tracking-widest glass-focus"
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-3 text-center">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handlePINSubmit}
              disabled={isSubmitting}
              className={`flex-1 glass-button flex items-center justify-center space-x-2 ${isSubmitting ? 'glass-loading' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Lock size={16} />
                  <span>{isSettingPIN ? 'Set PIN' : 'Unlock'}</span>
                </>
              )}
            </button>

            {!isSettingPIN && pin && (
              <button
                onClick={resetPIN}
                disabled={isSubmitting}
                className="glass-button bg-red-500/20 hover:bg-red-500/30"
              >
                Reset PIN
              </button>
            )}
          </div>

          {/* PIN Dots */}
          <div className="flex justify-center space-x-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  enteredPIN.length > i ? 'bg-primary' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PINLock;

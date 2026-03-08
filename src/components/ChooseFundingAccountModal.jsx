import { CreditCard, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { formatCurrency } from '../utils/accountUtils';

const ChooseFundingAccountModal = ({
  isOpen,
  cardName,
  cardId: _cardId,
  accounts,
  defaultAccountId,
  onConfirm,
  onUseDefault,
  onCancel,
  isLoading = false,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(
    () => defaultAccountId || (accounts.length > 0 ? accounts[0].id : null),
  );

  useEffect(() => {
    if (isOpen && accounts.length > 0) {
      setSelectedAccountId(
        defaultAccountId && accounts.some(a => a.id === defaultAccountId)
          ? defaultAccountId
          : accounts[0].id,
      );
    }
  }, [isOpen, accounts, defaultAccountId]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedAccountId != null) {
      onConfirm(selectedAccountId);
    }
  };

  const showUseDefault =
    defaultAccountId != null &&
    accounts.some(a => a.id === defaultAccountId) &&
    accounts.length >= 2;

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4'>
      <div
        className='absolute inset-0 bg-black/60 backdrop-blur-sm'
        onClick={onCancel}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        role='button'
        tabIndex={0}
        aria-label='Close modal'
      />

      <div className='relative w-full max-w-md mx-auto glass-panel glass-surface glass-surface--elevated'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <div className='p-2 rounded-lg bg-amber-500/20 text-amber-300'>
              <CreditCard size={20} />
            </div>
            <h3 className='text-lg font-semibold text-primary'>
              Choose funding account
            </h3>
          </div>
          <button
            onClick={onCancel}
            className='p-1 text-white/50 hover:text-white transition-colors'
            aria-label='Close'
          >
            <X size={20} />
          </button>
        </div>

        <p className='text-secondary text-sm mb-4'>
          Which account will pay{' '}
          <strong className='text-primary'>{cardName}</strong>?
        </p>

        <div className='mb-6'>
          <label
            htmlFor='funding-account-select'
            className='block text-primary font-medium mb-1 text-sm'
          >
            Funding account
          </label>
          <select
            id='funding-account-select'
            value={selectedAccountId ?? ''}
            onChange={e =>
              setSelectedAccountId(
                e.target.value ? parseInt(e.target.value, 10) : null,
              )
            }
            disabled={isLoading}
            className='glass-input w-full'
            aria-label='Select account to pay this credit card'
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name} — {acc.type} (
                {formatCurrency(acc.currentBalance ?? 0)})
              </option>
            ))}
          </select>
        </div>

        <div className='flex flex-col sm:flex-row gap-3 justify-end'>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className='glass-button glass-button--secondary order-last sm:order-none'
          >
            Cancel
          </button>
          {showUseDefault && (
            <button
              onClick={onUseDefault}
              disabled={isLoading}
              className='glass-button glass-button--secondary'
            >
              Use default account
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={isLoading || selectedAccountId == null}
            className='glass-button glass-button--primary flex items-center justify-center gap-2'
          >
            {isLoading ? (
              <>
                <div
                  className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'
                  aria-hidden
                />
                <span>Creating payment schedule…</span>
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

ChooseFundingAccountModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  cardName: PropTypes.string.isRequired,
  cardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  accounts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      currentBalance: PropTypes.number,
    }),
  ).isRequired,
  defaultAccountId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onConfirm: PropTypes.func.isRequired,
  onUseDefault: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

ChooseFundingAccountModal.defaultProps = {
  defaultAccountId: null,
  isLoading: false,
};

export default ChooseFundingAccountModal;

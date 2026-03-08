import { AlertTriangle, CreditCard, CheckCircle, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

const MissingExpensesModal = ({ isOpen, cards, onConfirm, onSkip }) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleConfirm = async () => {
    setIsCreating(true);
    try {
      await onConfirm();
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen || !cards?.length) return null;

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='glass-panel w-full max-w-md'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <div className='p-2 rounded-lg bg-amber-500/20 text-amber-300'>
              <AlertTriangle size={20} />
            </div>
            <h3 className='text-lg font-semibold text-primary'>
              Missing Payment Expenses
            </h3>
          </div>
          <button
            onClick={onSkip}
            className='p-1 text-white/50 hover:text-white transition-colors'
          >
            <X size={20} />
          </button>
        </div>

        <p className='text-secondary text-sm mb-4'>
          The following credit cards don&apos;t have payment expenses in your
          Fixed Expenses table yet. Create them now so payments are tracked
          automatically.
        </p>

        <div className='space-y-2 mb-6'>
          {cards.map(card => (
            <div
              key={card.id}
              className='flex items-center gap-3 p-3 rounded-lg bg-white/5'
            >
              <CreditCard size={16} className='text-purple-300 flex-shrink-0' />
              <span className='text-white text-sm'>{card.name}</span>
            </div>
          ))}
        </div>

        <div className='flex justify-end gap-3'>
          <button
            onClick={onSkip}
            className='glass-button glass-button--danger'
          >
            Skip
          </button>
          <button
            onClick={handleConfirm}
            disabled={isCreating}
            className={`glass-button flex items-center gap-2 ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isCreating ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                <span>Create Expenses</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

MissingExpensesModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
  onConfirm: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
};

MissingExpensesModal.defaultProps = {
  cards: [],
};

export default MissingExpensesModal;

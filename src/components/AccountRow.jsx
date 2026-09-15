import { Star, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';

import { useSwipeToReveal } from '../hooks/useSwipeToReveal';
import { formatCurrency } from '../utils/accountUtils';

import InlineEdit from './InlineEdit';
import PrivacyWrapper from './PrivacyWrapper';

// Keep in sync with .glass-row-list-item-swipe-rail's width in index.css.
const SWIPE_RAIL_WIDTH = 72;

const AccountRow = ({
  account,
  projectedBalance,
  onUpdateAccount,
  onSetDefault,
  onDelete,
}) => {
  const isProjectedDown = projectedBalance < account.currentBalance;
  const { offset, openDirection, isDragging, bind, close } = useSwipeToReveal({
    railWidth: SWIPE_RAIL_WIDTH,
  });

  let rowClass = 'glass-row-list-item glass-row-list-item--swipeable';
  if (account.isDefault) rowClass += ' glass-row-list-item--accent';

  let trackClass = 'glass-row-list-item-track';
  if (isDragging) trackClass += ' glass-row-list-item-track--dragging';

  return (
    <div className={rowClass}>
      <div
        ref={bind.ref}
        onTouchStart={bind.onTouchStart}
        onTouchEnd={bind.onTouchEnd}
        className={trackClass}
        style={{ transform: `translateX(${offset - SWIPE_RAIL_WIDTH}px)` }}
      >
        <button
          type='button'
          onClick={() => {
            onSetDefault(account.id);
            close();
          }}
          className='glass-row-list-item-swipe-rail glass-row-list-item-swipe-rail--left text-yellow-400'
          title='Set as Default'
          tabIndex={openDirection === 'left' ? 0 : -1}
          aria-hidden={openDirection !== 'left'}
        >
          <Star size={18} fill='currentColor' />
        </button>

        <div className='glass-row-list-item-content'>
          <div className='glass-row-list-item-main'>
            <InlineEdit
              value={account.name}
              onSave={name =>
                onUpdateAccount(account.id, { name }, account.updatedAt)
              }
              showEditIcon
            />
            {account.isDefault && (
              <span className='glass-row-list-badge'>Default</span>
            )}
          </div>

          <div className='glass-row-list-stats'>
            <div className='glass-row-list-stat'>
              <span className='glass-row-list-stat-label'>Current</span>
              <span className='glass-row-list-stat-value'>
                <InlineEdit
                  value={account.currentBalance}
                  onSave={currentBalance =>
                    onUpdateAccount(
                      account.id,
                      { currentBalance },
                      account.updatedAt,
                    )
                  }
                  type='number'
                  showEditIcon
                />
              </span>
            </div>

            <div className='glass-row-list-stat'>
              <span className='glass-row-list-stat-label'>Projected</span>
              <span
                className={`glass-row-list-stat-value ${
                  isProjectedDown ? 'text-yellow-400' : ''
                }`}
              >
                <PrivacyWrapper>
                  {formatCurrency(projectedBalance)}
                </PrivacyWrapper>
              </span>
            </div>

            <div className='glass-row-list-actions'>
              <button
                type='button'
                onClick={() => onSetDefault(account.id)}
                className={`glass-row-list-icon-btn ${
                  account.isDefault
                    ? 'text-yellow-400 bg-yellow-500/20'
                    : 'text-muted hover:text-white hover:bg-white/10'
                }`}
                title={account.isDefault ? 'Default Account' : 'Set as Default'}
              >
                <Star
                  size={16}
                  fill={account.isDefault ? 'currentColor' : 'none'}
                />
              </button>
              <button
                type='button'
                onClick={() => onDelete(account.id)}
                className='glass-row-list-icon-btn text-red-400 hover:text-red-300 hover:bg-red-500/20'
                title='Delete Account'
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>

        <button
          type='button'
          onClick={() => onDelete(account.id)}
          className='glass-row-list-item-swipe-rail glass-row-list-item-swipe-rail--right text-red-400'
          title='Delete Account'
          tabIndex={openDirection === 'right' ? 0 : -1}
          aria-hidden={openDirection !== 'right'}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};

AccountRow.propTypes = {
  account: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string.isRequired,
    currentBalance: PropTypes.number.isRequired,
    isDefault: PropTypes.bool,
    updatedAt: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.instanceOf(Date),
    ]),
  }).isRequired,
  projectedBalance: PropTypes.number.isRequired,
  onUpdateAccount: PropTypes.func.isRequired,
  onSetDefault: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default AccountRow;

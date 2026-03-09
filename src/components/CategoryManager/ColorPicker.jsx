import { Check } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const ColorPicker = ({
  id,
  value,
  onChange,
  colorOptions = [],
  showHexInput = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  const currentOption = colorOptions.find(
    opt => opt.hex && opt.hex.toLowerCase() === (value || '').toLowerCase(),
  );
  const displayLabel = currentOption ? currentOption.name : value || '';

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = event => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = event => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleHexChange = hex => {
    const normalized = hex.startsWith('#') ? hex : `#${hex}`;
    // eslint-disable-next-line wrap-regex -- slash in regex disambiguated by test()
    if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      onChange(normalized);
    }
  };

  const triggerRect = triggerRef.current?.getBoundingClientRect();
  const panelStyle =
    triggerRect && isOpen
      ? {
          position: 'absolute',
          top: triggerRect.bottom + window.scrollY + 4,
          left: triggerRect.left + window.scrollX,
          zIndex: 999999,
        }
      : null;

  const Panel = () =>
    panelStyle ? (
      <div
        ref={panelRef}
        className='glass-panel border border-white/10 p-4 rounded-lg shadow-xl animate-in slide-in-from-top-2 duration-200 min-w-[280px]'
        style={panelStyle}
      >
        <div className='grid grid-cols-8 gap-2'>
          {colorOptions.map(opt => (
            <button
              key={opt.id}
              type='button'
              onClick={() => {
                onChange(opt.hex);
                setIsOpen(false);
              }}
              className='w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all hover:ring-2 hover:ring-white/40'
              style={{ backgroundColor: opt.hex }}
              title={opt.name}
            >
              {value && value.toLowerCase() === opt.hex.toLowerCase() ? (
                <Check size={14} className='text-white drop-shadow' />
              ) : null}
            </button>
          ))}
        </div>
        {showHexInput && (
          <div className='mt-3'>
            <input
              type='text'
              placeholder='#RRGGBB'
              defaultValue={value || ''}
              onChange={e => handleHexChange(e.target.value)}
              className='glass-input w-full text-sm py-1.5 px-2'
            />
          </div>
        )}
      </div>
    ) : null;

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type='button'
        onClick={() => setIsOpen(prev => !prev)}
        className='glass-input w-full flex items-center gap-2 min-h-[40px]'
      >
        <span
          className='w-6 h-6 rounded-full shrink-0 ring-1 ring-white/20'
          style={{ backgroundColor: value || '#3B82F6' }}
        />
        <span className='text-sm text-white/90 truncate'>{displayLabel}</span>
      </button>

      {isOpen && createPortal(<Panel />, document.body)}
    </>
  );
};

ColorPicker.propTypes = {
  id: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  colorOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      hex: PropTypes.string,
      swatch: PropTypes.node,
    }),
  ),
  showHexInput: PropTypes.bool,
};

ColorPicker.defaultProps = {
  id: undefined,
  value: '',
  colorOptions: [],
  showHexInput: true,
};

export default ColorPicker;

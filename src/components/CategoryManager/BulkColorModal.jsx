import PropTypes from 'prop-types';
import { useState } from 'react';

import ColorPicker from './ColorPicker';

const BulkColorModal = ({
  isOpen,
  onClose,
  selectedCount,
  onApply,
  colorOptions = [],
}) => {
  const [selectedColor, setSelectedColor] = useState('#3B82F6');

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(selectedColor);
    onClose();
  };

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50'>
      <div className='glass-panel max-w-md w-full mx-4 border border-white/10 p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold text-primary'>
            Change color for {selectedCount} categor
            {selectedCount !== 1 ? 'ies' : 'y'}
          </h3>
          <button
            type='button'
            onClick={onClose}
            className='p-1 hover:bg-white/10 rounded text-white/70 hover:text-white'
          >
            ×
          </button>
        </div>
        <div className='space-y-4'>
          <ColorPicker
            value={selectedColor}
            onChange={setSelectedColor}
            colorOptions={colorOptions}
            showHexInput={false}
          />
          <div className='flex justify-end gap-2'>
            <button type='button' onClick={onClose} className='glass-button'>
              Cancel
            </button>
            <button
              type='button'
              onClick={handleApply}
              className='glass-button bg-blue-500/80 hover:bg-blue-500'
            >
              Apply to {selectedCount} categor
              {selectedCount !== 1 ? 'ies' : 'y'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

BulkColorModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  selectedCount: PropTypes.number.isRequired,
  onApply: PropTypes.func.isRequired,
  colorOptions: PropTypes.arrayOf(PropTypes.object),
};

BulkColorModal.defaultProps = {
  colorOptions: [],
};

export default BulkColorModal;

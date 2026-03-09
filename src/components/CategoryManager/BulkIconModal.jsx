import { Search } from 'lucide-react';
import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';

const BulkIconModal = ({
  isOpen,
  onClose,
  selectedCount,
  onApply,
  iconCategories = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return iconCategories;
    const term = searchTerm.toLowerCase();
    return iconCategories
      .map(category => ({
        ...category,
        icons: (category.icons || []).filter(
          icon =>
            icon.toLowerCase().includes(term) ||
            (category.name || '').toLowerCase().includes(term),
        ),
      }))
      .filter(category => category.icons.length > 0);
  }, [iconCategories, searchTerm]);

  if (!isOpen) return null;

  const handleSelectIcon = icon => {
    onApply(icon);
    onClose();
  };

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50'>
      <div className='glass-panel max-w-2xl w-full mx-4 border border-white/10 overflow-hidden flex flex-col max-h-[85vh]'>
        <div className='flex items-center justify-between p-4 border-b border-white/10 shrink-0'>
          <h3 className='text-lg font-semibold text-primary'>
            Change icon for {selectedCount} categor
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
        <div className='p-4 border-b border-white/10'>
          <div className='relative'>
            <Search
              size={16}
              className='absolute left-3 top-1/2 -translate-y-1/2 text-white/40'
            />
            <input
              type='text'
              placeholder='Search icons...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='glass-input w-full pl-9'
            />
          </div>
        </div>
        <div className='p-4 overflow-y-auto custom-scrollbar flex-1'>
          {filteredCategories.map(category => (
            <div key={category.name} className='mb-6 last:mb-0'>
              <h4 className='text-sm font-medium text-white/60 mb-3'>
                {category.name}
              </h4>
              <div className='grid grid-cols-8 gap-2'>
                {(category.icons || []).map(icon => (
                  <button
                    key={icon}
                    type='button'
                    onClick={() => handleSelectIcon(icon)}
                    className='aspect-square flex items-center justify-center rounded-lg text-2xl hover:bg-white/10 transition-all duration-150'
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <div className='text-center py-8 text-white/40'>
              No icons found for &quot;{searchTerm}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

BulkIconModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  selectedCount: PropTypes.number.isRequired,
  onApply: PropTypes.func.isRequired,
  iconCategories: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      icons: PropTypes.arrayOf(PropTypes.string),
    }),
  ),
};

BulkIconModal.defaultProps = {
  iconCategories: [],
};

export default BulkIconModal;

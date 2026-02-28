import { Edit3, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';

const CategoryCard = ({
  category,
  onEdit,
  onDelete,
  isSelected = false,
  onSelect,
}) => {
  return (
    <div
      className={`glass-card relative cursor-pointer transition-all duration-200 hover:scale-105 ${
        isSelected ? 'ring-2 ring-blue-400 bg-blue-500/20' : ''
      }`}
      style={{
        borderLeft: `4px solid ${category.color}`,
        minHeight: '80px',
      }}
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div
          className='absolute top-2 left-2 z-10'
          onClick={e => {
            e.stopPropagation();
            onSelect();
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onSelect();
            }
          }}
          role='button'
          tabIndex={0}
          aria-label='Select category'
        >
          <input
            type='checkbox'
            checked={isSelected}
            onChange={e => {
              e.stopPropagation();
              onSelect();
            }}
            onClick={e => e.stopPropagation()}
            className='w-4 h-4 rounded border-white/20 bg-transparent cursor-pointer accent-blue-500'
          />
        </div>
      )}

      {/* Category Content */}
      <div className='flex flex-col items-center justify-center text-center p-2'>
        <div
          className='w-8 h-8 rounded-full flex items-center justify-center text-lg mb-2'
          style={{
            backgroundColor: `${category.color}20`,
            color: category.color,
          }}
        >
          {category.icon}
        </div>
        <div className='flex items-center gap-1'>
          <h4 className='text-primary font-medium text-sm truncate'>
            {category.name}
          </h4>
          {category.isDefault && (
            <span className='text-xs badge-info px-1.5 py-0.5 rounded-full backdrop-blur-sm flex-shrink-0'>
              Default
            </span>
          )}
        </div>
      </div>

      {/* Hover Actions */}
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2'>
        <button
          onClick={e => {
            e.stopPropagation();
            onEdit(category);
          }}
          className='p-2 hover:bg-white/20 rounded-full text-blue-400 hover:text-blue-300 transition-colors'
          title='Edit category'
        >
          <Edit3 size={14} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            onDelete(category);
          }}
          className='p-2 hover:bg-white/20 rounded-full text-red-400 hover:text-red-300 transition-colors'
          title='Delete category'
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

CategoryCard.propTypes = {
  category: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    color: PropTypes.string,
    icon: PropTypes.string,
    isDefault: PropTypes.bool,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func,
};

CategoryCard.defaultProps = {
  isSelected: false,
  onSelect: undefined,
};

export default CategoryCard;

import { Edit3, GripVertical, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';

const CategoryCard = ({
  category,
  onEdit,
  onDelete,
  isSelected = false,
  onSelect,
  showDragHandle = false,
  dragHandleProps,
  categoryUsageStats,
}) => {
  const usageCount =
    categoryUsageStats && category.name
      ? (() => {
          const stats = categoryUsageStats.get(category.name);
          if (!stats) return 0;
          return (stats.expenseCount || 0) + (stats.transactionCount || 0);
        })()
      : undefined;

  return (
    <div
      className={`glass-card relative cursor-pointer transition-all duration-200 hover:scale-105 overflow-hidden ${
        isSelected ? 'ring-2 ring-blue-400 bg-blue-500/20' : ''
      }`}
      style={{ minHeight: '110px' }}
    >
      {/* Colored band */}
      <div
        className='h-12 flex items-center justify-center text-2xl'
        style={{
          backgroundColor: category.color || '#3B82F6',
          opacity: 0.85,
          borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
        }}
      >
        {category.icon}
      </div>

      {/* Selection Checkbox */}
      {onSelect && (
        <div
          className='absolute top-14 left-2 z-10'
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

      {/* Below band: name, badge, usage */}
      <div className='flex flex-col items-center justify-center text-center p-2 pt-1'>
        <div className='flex items-center gap-1 flex-wrap justify-center'>
          <h4 className='text-primary font-medium text-sm truncate'>
            {category.name}
          </h4>
          {category.isDefault && (
            <span className='text-xs badge-info px-1.5 py-0.5 rounded-full backdrop-blur-sm flex-shrink-0'>
              Default
            </span>
          )}
        </div>
        {usageCount !== undefined && (
          <p className='text-xs text-white/60 mt-0.5'>
            {usageCount} expense{usageCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Hover Actions */}
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2'>
        {showDragHandle && dragHandleProps && (
          <span
            className='absolute top-2 right-2 p-1.5 cursor-grab active:cursor-grabbing rounded text-white/60 hover:text-white hover:bg-white/20'
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
          >
            <GripVertical size={14} />
          </span>
        )}
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
  showDragHandle: PropTypes.bool,
  dragHandleProps: PropTypes.shape({
    attributes: PropTypes.object,
    listeners: PropTypes.object,
  }),
  categoryUsageStats: PropTypes.instanceOf(Map),
};

CategoryCard.defaultProps = {
  isSelected: false,
  onSelect: undefined,
  showDragHandle: false,
  dragHandleProps: undefined,
  categoryUsageStats: undefined,
};

export default CategoryCard;

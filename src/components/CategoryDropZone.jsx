import { useDroppable } from '@dnd-kit/core';
import PropTypes from 'prop-types';

const CategoryDropZone = ({
  categoryName,
  getCategoryDisplayName,
  activeId,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `dropzone-${categoryName}`,
    data: {
      category: categoryName,
      type: 'category-dropzone',
    },
  });

  const dropZoneClass = (() => {
    if (isOver && activeId)
      return 'border-blue-500 bg-blue-500/20 dropzone-pulse scale-105';
    if (activeId)
      return 'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/15 hover:scale-[1.02]';
    return 'border-white/10';
  })();

  return (
    <div
      ref={setNodeRef}
      className={`h-16 w-full mt-2 rounded transition-all duration-300 border-2 border-dashed ${dropZoneClass}`}
      style={{
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {activeId && (
        <div className='flex items-center justify-center h-full text-blue-300 text-sm'>
          {isOver ? (
            <span className='animate-pulse'>
              Release to move to {getCategoryDisplayName(categoryName)}
            </span>
          ) : (
            <span>Drop to move to {getCategoryDisplayName(categoryName)}</span>
          )}
        </div>
      )}
    </div>
  );
};

CategoryDropZone.propTypes = {
  categoryName: PropTypes.string.isRequired,
  getCategoryDisplayName: PropTypes.func.isRequired,
  activeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default CategoryDropZone;

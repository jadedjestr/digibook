import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import PropTypes from 'prop-types';

import CategoryCard from './CategoryCard';

function SortableCategoryCard({
  category,
  onEdit,
  onDelete,
  isSelected,
  onSelectCategory,
  categoryUsageStats,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-80 z-10' : ''}
    >
      <CategoryCard
        category={category}
        onEdit={onEdit}
        onDelete={onDelete}
        isSelected={isSelected}
        onSelect={
          onSelectCategory ? () => onSelectCategory(category.id) : undefined
        }
        showDragHandle
        dragHandleProps={{ attributes, listeners }}
        categoryUsageStats={categoryUsageStats}
      />
    </div>
  );
}

SortableCategoryCard.propTypes = {
  category: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isSelected: PropTypes.bool,
  onSelectCategory: PropTypes.func,
  categoryUsageStats: PropTypes.instanceOf(Map),
};

const CategoryGrid = ({
  categories,
  onEdit,
  onDelete,
  selectedCategories = new Set(),
  onSelectCategory,
  sortBy,
  onReorder,
  categoryUsageStats,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = event => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const orderedIds = categories.map(c => c.id);
    const oldIndex = orderedIds.indexOf(active.id);
    const newIndex = orderedIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...orderedIds];
    reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, active.id);
    onReorder?.(reordered);
  };

  if (categories.length === 0) {
    return (
      <div className='text-center py-8 text-secondary'>
        <p>No categories found. Add your first category to get started.</p>
      </div>
    );
  }

  const gridClasses = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';

  if (sortBy === 'custom' && onReorder) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categories.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={gridClasses}>
            {categories.map(category => (
              <SortableCategoryCard
                key={category.id}
                category={category}
                onEdit={onEdit}
                onDelete={onDelete}
                isSelected={selectedCategories.has(category.id)}
                onSelectCategory={onSelectCategory}
                categoryUsageStats={categoryUsageStats}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  return (
    <div className={gridClasses}>
      {categories.map(category => (
        <CategoryCard
          key={category.id}
          category={category}
          onEdit={onEdit}
          onDelete={onDelete}
          isSelected={selectedCategories.has(category.id)}
          onSelect={
            onSelectCategory ? () => onSelectCategory(category.id) : undefined
          }
          categoryUsageStats={categoryUsageStats}
        />
      ))}
    </div>
  );
};

CategoryGrid.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.object).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  selectedCategories: PropTypes.instanceOf(Set),
  onSelectCategory: PropTypes.func,
  sortBy: PropTypes.string,
  onReorder: PropTypes.func,
  categoryUsageStats: PropTypes.instanceOf(Map),
};

CategoryGrid.defaultProps = {
  selectedCategories: new Set(),
  onSelectCategory: undefined,
  sortBy: 'name',
  onReorder: undefined,
  categoryUsageStats: undefined,
};

export default CategoryGrid;

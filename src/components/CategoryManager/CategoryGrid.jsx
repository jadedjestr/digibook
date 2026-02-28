import PropTypes from 'prop-types';

import CategoryCard from './CategoryCard';

const CategoryGrid = ({
  categories,
  onEdit,
  onDelete,
  selectedCategories = new Set(),
  onSelectCategory,
}) => {
  if (categories.length === 0) {
    return (
      <div className='text-center py-8 text-secondary'>
        <p>No categories found. Add your first category to get started.</p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'>
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
};

CategoryGrid.defaultProps = {
  selectedCategories: new Set(),
  onSelectCategory: undefined,
};

export default CategoryGrid;

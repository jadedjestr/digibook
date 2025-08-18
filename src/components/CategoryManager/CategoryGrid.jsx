import React from 'react';
import CategoryCard from './CategoryCard';

const CategoryGrid = ({ categories, onEdit, onDelete }) => {
  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-secondary">
        <p>No categories found. Add your first category to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default CategoryGrid;

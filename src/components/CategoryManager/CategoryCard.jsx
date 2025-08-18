import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';

const CategoryCard = ({ category, onEdit, onDelete }) => {
  return (
    <div 
      className="glass-card relative cursor-pointer transition-all duration-200 hover:scale-105"
      style={{ 
        borderLeft: `4px solid ${category.color}`,
        minHeight: '80px'
      }}
    >
      {/* Category Content */}
      <div className="flex flex-col items-center justify-center text-center p-2">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-lg mb-2"
          style={{ 
            backgroundColor: category.color + '20', 
            color: category.color 
          }}
        >
          {category.icon}
        </div>
        <h4 className="text-primary font-medium text-sm truncate w-full">
          {category.name}
        </h4>
      </div>

      {/* Hover Actions */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(category);
          }}
          className="p-2 hover:bg-white/20 rounded-full text-blue-400 hover:text-blue-300 transition-colors"
          title="Edit category"
        >
          <Edit3 size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(category);
          }}
          className="p-2 hover:bg-white/20 rounded-full text-red-400 hover:text-red-300 transition-colors"
          title="Delete category"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default CategoryCard;

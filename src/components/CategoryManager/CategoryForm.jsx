import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import IconSelector from '../IconSelector';
import { validateCategory } from '../../utils/validation';
import { notify } from '../../utils/notifications.jsx';

const CategoryForm = ({ 
  mode = 'add', 
  initialData = { name: '', color: '#3B82F6', icon: '📦' },
  onSave,
  onCancel,
  existingCategories = [],
  colorOptions,
  iconCategories = []
}) => {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    const sanitized = { ...formData, name: (formData.name || '').trim() };
    const validation = validateCategory(sanitized, existingCategories, mode === 'edit' ? initialData.id : null);
    setErrors(validation.errors);
    
    if (!validation.isValid) {
      notify.error('Please fix the errors before saving');
      return;
    }

    onSave(sanitized);
  };

  return (
    <div className="glass-panel border border-white/20 overflow-visible">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-primary font-medium">
          {mode === 'add' ? 'Add New Category' : 'Edit Category'}
        </h4>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-white/10 rounded"
        >
          <X size={16} className="text-white" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-visible">
        {/* Name Input */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Name</label>
          <div className="space-y-1">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`glass-input w-full ${errors.name ? 'border-red-500' : ''}`}
              placeholder="Category name"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>
        </div>

        {/* Icon Selector */}
        <div className="overflow-visible">
          <label className="block text-sm font-medium text-white mb-2">Icon</label>
          <div className="relative">
            <IconSelector
              value={formData.icon}
              onChange={(icon) => handleChange('icon', icon)}
              categories={iconCategories}
            />
          </div>
          {errors.icon && (
            <p className="text-sm text-red-500 mt-1">{errors.icon}</p>
          )}
        </div>

        {/* Color Selector */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Color</label>
          <select
            value={formData.color}
            onChange={(e) => handleChange('color', e.target.value)}
            className={`glass-input w-full ${errors.color ? 'border-red-500' : ''}`}
          >
            {colorOptions.map(color => (
              <option key={color.id} value={color.hex} style={{ backgroundColor: color.hex }}>
                {color.swatch} {color.name}
              </option>
            ))}
          </select>
          {errors.color && (
            <p className="text-sm text-red-500 mt-1">{errors.color}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex items-end">
          <button
            onClick={handleSubmit}
            className="glass-button flex items-center space-x-2 w-full"
          >
            <Save size={16} />
            <span>{mode === 'add' ? 'Add Category' : 'Update Category'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryForm;

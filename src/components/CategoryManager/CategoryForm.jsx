import { Save, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { notify } from '../../utils/notifications.jsx';
import { validateCategoryName } from '../../utils/validation';
import IconSelector from '../IconSelector';

const CategoryForm = ({
  mode = 'add',
  initialData = { name: '', color: '#3B82F6', icon: '📦' },
  onSave,
  onCancel,
  existingCategories = [],
  colorOptions,
  iconCategories = [],
  isDefault = false,
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

    // When editing, exclude the current category name from duplicate check
    const excludeName = mode === 'edit' ? initialData.name : null;
    const validation = validateCategoryName(
      sanitized.name,
      existingCategories,
      excludeName,
    );

    if (!validation.isValid) {
      setErrors({ name: validation.error });
      notify.error('Please fix the errors before saving');
      return;
    }

    setErrors({});

    onSave(sanitized);
  };

  return (
    <div className='glass-panel border border-white/20 overflow-visible'>
      <div className='flex items-center justify-between mb-4'>
        <h4 className='text-primary font-medium'>
          {mode === 'add' ? 'Add New Category' : 'Edit Category'}
        </h4>
        <button onClick={onCancel} className='p-1 hover:bg-white/10 rounded'>
          <X size={16} className='text-white' />
        </button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-4 gap-4 overflow-visible'>
        {/* Name Input */}
        <div>
          <label className='block text-sm font-medium text-white mb-2'>
            Name
            {isDefault && (
              <span className='text-xs text-white/50 ml-2'>
                (Default category names cannot be changed)
              </span>
            )}
          </label>
          <div className='space-y-1'>
            <input
              type='text'
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              disabled={isDefault && mode === 'edit'}
              className={`glass-input w-full ${
                errors.name ? 'border-red-500' : ''
              } ${isDefault && mode === 'edit' ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder='Category name'
              title={
                isDefault && mode === 'edit'
                  ? 'Default category names cannot be changed'
                  : ''
              }
            />
            {errors.name && (
              <p className='text-sm text-red-500'>{errors.name}</p>
            )}
          </div>
        </div>

        {/* Icon Selector */}
        <label className='overflow-visible block'>
          <span className='block text-sm font-medium text-white mb-2'>
            Icon
          </span>
          <div className='relative'>
            <IconSelector
              value={formData.icon}
              onChange={icon => handleChange('icon', icon)}
              categories={iconCategories}
            />
          </div>
          {errors.icon && (
            <p className='text-sm text-red-500 mt-1'>{errors.icon}</p>
          )}
        </label>

        {/* Color Selector */}
        <div>
          <label
            htmlFor='category-form-color'
            className='block text-sm font-medium text-white mb-2'
          >
            Color
          </label>
          <select
            id='category-form-color'
            value={formData.color}
            onChange={e => handleChange('color', e.target.value)}
            className={`glass-input w-full ${errors.color ? 'border-red-500' : ''}`}
          >
            {colorOptions.map(color => (
              <option
                key={color.id}
                value={color.hex}
                style={{ backgroundColor: color.hex }}
              >
                {color.swatch} {color.name}
              </option>
            ))}
          </select>
          {errors.color && (
            <p className='text-sm text-red-500 mt-1'>{errors.color}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className='flex items-end'>
          <button
            onClick={handleSubmit}
            className='glass-button flex items-center space-x-2 w-full'
          >
            <Save size={16} />
            <span>{mode === 'add' ? 'Add Category' : 'Update Category'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

CategoryForm.propTypes = {
  mode: PropTypes.oneOf(['add', 'edit']),
  initialData: PropTypes.shape({
    name: PropTypes.string,
    color: PropTypes.string,
    icon: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  existingCategories: PropTypes.arrayOf(PropTypes.object),
  colorOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      hex: PropTypes.string,
      name: PropTypes.string,
      swatch: PropTypes.node,
    }),
  ).isRequired,
  iconCategories: PropTypes.arrayOf(PropTypes.object),
  isDefault: PropTypes.bool,
};

CategoryForm.defaultProps = {
  mode: 'add',
  initialData: { name: '', color: '#3B82F6', icon: '📦' },
  existingCategories: [],
  iconCategories: [],
  isDefault: false,
};

export default CategoryForm;

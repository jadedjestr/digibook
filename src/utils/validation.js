export const validateCategory = (category, existingCategories = [], excludeId = null) => {
  const errors = {};

  // Name validation
  const trimmedName = (category.name || '').trim();
  if (!trimmedName) {
    errors.name = 'Category name is required';
  } else if (trimmedName.length < 2) {
    errors.name = 'Category name must be at least 2 characters';
  } else if (trimmedName.length > 30) {
    errors.name = 'Category name must be less than 30 characters';
  }

  // Check for duplicate names
  const isDuplicate = existingCategories.some(
    existingCat => 
      existingCat.name.toLowerCase() === trimmedName.toLowerCase() &&
      existingCat.id !== excludeId
  );
  if (isDuplicate) {
    errors.name = 'A category with this name already exists';
  }

  // Icon validation
  if (!category.icon) {
    errors.icon = 'Please select an icon';
  }

  // Color validation
  if (!category.color) {
    errors.color = 'Please select a color';
  } else if (!/^#[0-9A-F]{6}$/i.test(category.color)) {
    errors.color = 'Invalid color format';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

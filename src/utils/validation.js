/**
 * Comprehensive validation utilities for Digibook
 * Provides secure input validation and sanitization
 */

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// PIN validation (4-6 digits)
const PIN_REGEX = /^\d{4,6}$/;

// Currency amount validation (positive numbers with up to 2 decimal places)
const CURRENCY_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Sanitize string input to prevent XSS
 */
export const sanitizeString = input => {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 1000); // Limit length
};

/**
 * Validate and sanitize account name
 */
export const validateAccountName = name => {
  const sanitized = sanitizeString(name);

  if (!sanitized) {
    return { isValid: false, error: 'Account name is required' };
  }

  if (sanitized.length < 2) {
    return {
      isValid: false,
      error: 'Account name must be at least 2 characters',
    };
  }

  if (sanitized.length > 50) {
    return {
      isValid: false,
      error: 'Account name must be less than 50 characters',
    };
  }

  return { isValid: true, value: sanitized };
};

/**
 * Validate currency amount
 */
export const validateAmount = amount => {
  // Convert to string for validation
  const amountStr = String(amount).trim();

  if (!amountStr) {
    return { isValid: false, error: 'Amount is required' };
  }

  // Remove currency symbols and commas
  const cleanAmount = amountStr.replace(/[$,]/g, '');

  if (!CURRENCY_REGEX.test(cleanAmount)) {
    return {
      isValid: false,
      error: 'Please enter a valid amount (e.g., 10.50)',
    };
  }

  const numericAmount = parseFloat(cleanAmount);

  if (numericAmount <= 0) {
    return { isValid: false, error: 'Amount must be greater than 0' };
  }

  if (numericAmount > 999999.99) {
    return { isValid: false, error: 'Amount must be less than $1,000,000' };
  }

  return { isValid: true, value: numericAmount };
};

/**
 * Validate PIN
 */
export const validatePIN = pin => {
  const sanitized = sanitizeString(pin);

  if (!sanitized) {
    return { isValid: false, error: 'PIN is required' };
  }

  if (!PIN_REGEX.test(sanitized)) {
    return { isValid: false, error: 'PIN must be 4-6 digits' };
  }

  return { isValid: true, value: sanitized };
};

/**
 * Validate transaction description
 */
export const validateDescription = description => {
  const sanitized = sanitizeString(description);

  if (!sanitized) {
    return { isValid: false, error: 'Description is required' };
  }

  if (sanitized.length < 3) {
    return {
      isValid: false,
      error: 'Description must be at least 3 characters',
    };
  }

  if (sanitized.length > 200) {
    return {
      isValid: false,
      error: 'Description must be less than 200 characters',
    };
  }

  return { isValid: true, value: sanitized };
};

/**
 * Validate date input
 */
export const validateDate = date => {
  if (!date) {
    return { isValid: false, error: 'Date is required' };
  }

  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    return { isValid: false, error: 'Please enter a valid date' };
  }

  // Check if date is not too far in the past (more than 10 years)
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  if (dateObj < tenYearsAgo) {
    return {
      isValid: false,
      error: 'Date cannot be more than 10 years in the past',
    };
  }

  // Check if date is not too far in the future (more than 10 years)
  const tenYearsFromNow = new Date();
  tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10);

  if (dateObj > tenYearsFromNow) {
    return {
      isValid: false,
      error: 'Date cannot be more than 10 years in the future',
    };
  }

  return { isValid: true, value: dateObj.toISOString().split('T')[0] };
};

/**
 * Validate category name
 */
export const validateCategoryName = (name, existingCategories = []) => {
  const sanitized = sanitizeString(name);

  if (!sanitized) {
    return { isValid: false, error: 'Category name is required' };
  }

  if (sanitized.length < 2) {
    return {
      isValid: false,
      error: 'Category name must be at least 2 characters',
    };
  }

  if (sanitized.length > 30) {
    return {
      isValid: false,
      error: 'Category name must be less than 30 characters',
    };
  }

  // Check for duplicates (case-insensitive)
  const isDuplicate = existingCategories.some(
    category => category.name.toLowerCase() === sanitized.toLowerCase()
  );

  if (isDuplicate) {
    return {
      isValid: false,
      error: 'A category with this name already exists',
    };
  }

  return { isValid: true, value: sanitized };
};

/**
 * Validate account type
 */
export const validateAccountType = type => {
  const validTypes = ['checking', 'savings', 'investment', 'other'];

  if (!type) {
    return { isValid: false, error: 'Account type is required' };
  }

  if (!validTypes.includes(type)) {
    return { isValid: false, error: 'Please select a valid account type' };
  }

  return { isValid: true, value: type };
};

/**
 * Validate credit card data
 */
export const validateCreditCard = cardData => {
  const errors = {};

  // Validate name
  const nameValidation = validateAccountName(cardData.name);
  if (!nameValidation.isValid) {
    errors.name = nameValidation.error;
  }

  // Validate credit limit
  const limitValidation = validateAmount(cardData.creditLimit);
  if (!limitValidation.isValid) {
    errors.creditLimit = limitValidation.error;
  }

  // Validate interest rate (0-100%)
  const rate = parseFloat(cardData.interestRate);
  if (isNaN(rate) || rate < 0 || rate > 100) {
    errors.interestRate = 'Interest rate must be between 0 and 100%';
  }

  // Validate due date
  const dueDateValidation = validateDate(cardData.dueDate);
  if (!dueDateValidation.isValid) {
    errors.dueDate = dueDateValidation.error;
  }

  // Validate minimum payment
  const minPaymentValidation = validateAmount(cardData.minimumPayment);
  if (!minPaymentValidation.isValid) {
    errors.minimumPayment = minPaymentValidation.error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      name: nameValidation.isValid ? nameValidation.value : cardData.name,
      creditLimit: limitValidation.isValid
        ? limitValidation.value
        : cardData.creditLimit,
      interestRate: rate,
      dueDate: dueDateValidation.isValid
        ? dueDateValidation.value
        : cardData.dueDate,
      minimumPayment: minPaymentValidation.isValid
        ? minPaymentValidation.value
        : cardData.minimumPayment,
    },
  };
};

/**
 * Validate form data generically
 */
export const validateForm = (data, rules) => {
  const errors = {};
  const sanitizedData = {};

  Object.keys(rules).forEach(field => {
    const rule = rules[field];
    const value = data[field];

    let validation;

    switch (rule.type) {
      case 'string':
        validation = validateAccountName(value);
        break;
      case 'amount':
        validation = validateAmount(value);
        break;
      case 'date':
        validation = validateDate(value);
        break;
      case 'description':
        validation = validateDescription(value);
        break;
      case 'pin':
        validation = validatePIN(value);
        break;
      default:
        validation = { isValid: true, value };
    }

    if (!validation.isValid) {
      errors[field] = validation.error;
    } else {
      sanitizedData[field] = validation.value;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData,
  };
};

/**
 * Sanitize object for safe storage/transmission
 */
export const sanitizeObject = obj => {
  const sanitized = {};

  Object.keys(obj).forEach(key => {
    const value = obj[key];

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'number') {
      sanitized[key] = isNaN(value) ? 0 : value;
    } else if (typeof value === 'boolean') {
      sanitized[key] = Boolean(value);
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'object'
          ? sanitizeObject(item)
          : sanitizeString(String(item))
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
};

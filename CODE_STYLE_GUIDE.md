# Digibook Code Style Guide

## 📋 **Overview**

This guide establishes consistent coding standards for the Digibook project to ensure maintainability, readability, and team collaboration.

## 🎯 **General Principles**

1. **Consistency**: Follow established patterns throughout the codebase
2. **Readability**: Code should be self-documenting and easy to understand
3. **Maintainability**: Write code that's easy to modify and extend
4. **Performance**: Consider performance implications of coding decisions
5. **Accessibility**: Ensure all code meets accessibility standards

## 📝 **Naming Conventions**

### **Components**
- **PascalCase** for React components: `AccountSelector`, `FixedExpensesTable`
- **Descriptive names** that indicate purpose: `PayDateCountdownCard`, `CategoryExpenseSummary`

### **Functions & Variables**
- **camelCase** for functions and variables: `handleExpenseUpdate`, `isLoading`
- **Descriptive names** that indicate action or state: `validateAccountName`, `calculateProjectedBalance`

### **Constants**
- **UPPER_SNAKE_CASE** for constants: `DEFAULT_PAGE_SIZE`, `MAX_RETRY_ATTEMPTS`
- **Descriptive names** that indicate purpose: `PAGINATION_CONFIG`, `ERROR_TYPES`

### **Files & Directories**
- **kebab-case** for files: `account-selector.jsx`, `fixed-expenses-table.jsx`
- **PascalCase** for component directories: `CategoryManager/`, `FixedExpensesTable/`

## 🏗️ **Component Structure**

### **Component Organization**
```jsx
// 1. Imports (grouped and ordered)
import React from 'react';
import { useState, useEffect } from 'react';

import { Button } from 'lucide-react';

import { useAppStore } from '../stores/useAppStore';
import { logger } from '../utils/logger';

// 2. Component definition
const ComponentName = ({ prop1, prop2 }) => {
  // 3. State declarations
  const [localState, setLocalState] = useState(null);
  
  // 4. Custom hooks
  const { data, loading } = useCustomHook();
  
  // 5. Event handlers
  const handleEvent = () => {
    // Implementation
  };
  
  // 6. Effects
  useEffect(() => {
    // Effect logic
  }, [dependency]);
  
  // 7. Render
  return (
    <div>
      {/* JSX content */}
    </div>
  );
};

// 8. PropTypes (if not using TypeScript)
ComponentName.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number,
};

// 9. Default props
ComponentName.defaultProps = {
  prop2: 0,
};

// 10. Export
export default ComponentName;
```

## 🎨 **Code Formatting**

### **Indentation & Spacing**
- **2 spaces** for indentation (no tabs)
- **Single quotes** for strings
- **Trailing commas** in multiline objects/arrays
- **Semicolons** at end of statements

### **Line Length**
- **Maximum 80 characters** per line
- Break long lines at logical points
- Use template literals for long strings

### **Function Spacing**
```jsx
// ✅ Good
const handleClick = () => {
  // Implementation
};

// ❌ Bad
const handleClick =() => {
  // Implementation
};
```

## 🔧 **React Best Practices**

### **Hooks Usage**
```jsx
// ✅ Good - Custom hooks for complex logic
const { expenses, loading, error } = useExpenseOperations();

// ✅ Good - useState for simple state
const [isOpen, setIsOpen] = useState(false);

// ✅ Good - useEffect with proper dependencies
useEffect(() => {
  fetchData();
}, [dependency]);
```

### **Event Handlers**
```jsx
// ✅ Good - Descriptive names
const handleExpenseUpdate = (expenseId, updates) => {
  // Implementation
};

// ✅ Good - Arrow functions for simple handlers
<button onClick={() => setIsOpen(true)}>
  Open
</button>
```

### **Conditional Rendering**
```jsx
// ✅ Good - Early returns for complex conditions
if (!data) {
  return <LoadingSpinner />;
}

if (error) {
  return <ErrorMessage error={error} />;
}

return <DataDisplay data={data} />;
```

## 🎯 **Error Handling**

### **Error Boundaries**
```jsx
// ✅ Good - Specific error boundaries
<ExpenseTableErrorBoundary>
  <ExpenseTable />
</ExpenseTableErrorBoundary>
```

### **Error Handling in Functions**
```jsx
// ✅ Good - Consistent error handling
const updateExpense = async (expenseId, updates) => {
  try {
    const result = await db.expenses.update(expenseId, updates);
    logger.debug('Expense updated successfully', { expenseId, updates });
    return result;
  } catch (error) {
    logger.error('Failed to update expense', { expenseId, updates, error });
    throw error;
  }
};
```

## 📊 **State Management**

### **Zustand Store Usage**
```jsx
// ✅ Good - Use selectors for specific data
const { expenses, addExpense } = useAppStore(
  (state) => ({
    expenses: state.expenses,
    addExpense: state.addExpense,
  })
);

// ✅ Good - Custom hooks for complex operations
const { createExpense, updateExpense } = useExpenseOperations();
```

## 🧪 **Testing Standards**

### **Test Structure**
```jsx
// ✅ Good - Descriptive test names
describe('ExpenseTable', () => {
  it('should display expenses in correct order', () => {
    // Test implementation
  });
  
  it('should handle empty expense list gracefully', () => {
    // Test implementation
  });
});
```

### **Mock Usage**
```jsx
// ✅ Good - Comprehensive mocks
const mockExpense = {
  id: '1',
  description: 'Test Expense',
  amount: 100,
  date: '2024-01-01',
};
```

## 🚀 **Performance Guidelines**

### **Memoization**
```jsx
// ✅ Good - Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return calculateComplexValue(data);
}, [data]);

// ✅ Good - Memoize callbacks
const handleClick = useCallback(() => {
  // Handler logic
}, [dependency]);
```

### **Virtual Scrolling**
```jsx
// ✅ Good - Use virtual scrolling for large lists
<VirtualizedExpenseTable
  items={expenses}
  itemHeight={60}
  renderItem={({ item }) => <ExpenseRow expense={item} />}
/>
```

## 🔒 **Security Guidelines**

### **Input Validation**
```jsx
// ✅ Good - Validate all inputs
const validateExpense = (expense) => {
  const errors = {};
  
  if (!expense.description?.trim()) {
    errors.description = 'Description is required';
  }
  
  if (expense.amount <= 0) {
    errors.amount = 'Amount must be positive';
  }
  
  return errors;
};
```

### **XSS Prevention**
```jsx
// ✅ Good - Sanitize user input
const sanitizeInput = (input) => {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};
```

## 📚 **Documentation Standards**

### **JSDoc Comments**
```jsx
/**
 * Calculates the projected balance for a given account
 * @param {Object} account - The account object
 * @param {Array} expenses - Array of expenses
 * @param {Date} endDate - The end date for calculation
 * @returns {number} The projected balance
 */
const calculateProjectedBalance = (account, expenses, endDate) => {
  // Implementation
};
```

### **Component Documentation**
```jsx
/**
 * ExpenseTable - Displays a list of expenses with sorting and filtering
 * 
 * @param {Array} expenses - Array of expense objects
 * @param {Function} onExpenseUpdate - Callback for expense updates
 * @param {boolean} isLoading - Loading state
 */
const ExpenseTable = ({ expenses, onExpenseUpdate, isLoading }) => {
  // Implementation
};
```

## 🎨 **CSS & Styling**

### **Tailwind Classes**
```jsx
// ✅ Good - Consistent class ordering
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
  <span className="text-lg font-semibold text-gray-900">
    {title}
  </span>
  <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
    Action
  </button>
</div>
```

### **Custom CSS**
```css
/* ✅ Good - BEM methodology for custom classes */
.expense-table {
  /* Base styles */
}

.expense-table__header {
  /* Header styles */
}

.expense-table__row--selected {
  /* Selected row styles */
}
```

## 🔍 **Code Review Checklist**

### **Before Submitting**
- [ ] Code follows naming conventions
- [ ] Functions are properly documented
- [ ] Error handling is implemented
- [ ] Tests are written and passing
- [ ] Performance implications considered
- [ ] Accessibility requirements met
- [ ] No console.log statements (use logger)
- [ ] No unused variables or imports
- [ ] Proper import ordering
- [ ] Consistent formatting

### **Review Focus Areas**
- [ ] Code readability and maintainability
- [ ] Performance implications
- [ ] Security considerations
- [ ] Test coverage
- [ ] Documentation completeness
- [ ] Error handling robustness

## 🚀 **Getting Started**

1. **Install Prettier**: `npm run format` to format code
2. **Run ESLint**: `npm run lint` to check for issues
3. **Fix Issues**: `npm run lint:fix` to auto-fix issues
4. **Run Tests**: `npm run test` to ensure tests pass
5. **Quality Check**: `npm run quality` for full quality check

## 📖 **Resources**

- [React Best Practices](https://react.dev/learn)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

*This guide is a living document and should be updated as the project evolves.*

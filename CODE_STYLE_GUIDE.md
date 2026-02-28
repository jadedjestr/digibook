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
// ✅ Good - Use virtual scrolling for large lists (when needed)
// Note: Virtual scrolling is not currently implemented in Fixed Expenses.
// Consider implementing if expense lists exceed 100+ items per category.
// Example implementation would use @tanstack/react-virtual:
// const virtualizer = useVirtualizer({
//   count: items.length,
//   getScrollElement: () => parentRef.current,
//   estimateSize: () => 60,
// });
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

### **60/30/10 Color Rule**

The design system follows the 60/30/10 color rule:
- **60%**: Dominant color (background) - `--color-dominant-base`
- **30%**: Secondary color (glass surfaces) - `--color-secondary-*`
- **10%**: Accent color (primary actions) - `--color-accent-*`

**Always use color tokens, never hardcode colors.**

### **Button Styling**

```jsx
// ✅ Good - Use button variants
<button className="glass-button glass-button--primary">Save</button>
<button className="glass-button glass-button--secondary">Cancel</button>
<button className="glass-button glass-button--danger">Delete</button>
<button className="glass-button glass-button--filter active">Sort</button>

// ❌ Bad - Inline color classes
<button className="glass-button bg-blue-500/20 text-blue-300">Save</button>
<button className="glass-button bg-red-500/20 text-red-300">Delete</button>
```

**Button Usage Rules:**
- Primary actions → `glass-button--primary`
- Secondary actions → `glass-button--secondary`
- Destructive actions → `glass-button--danger`
- Filter/sort controls → `glass-button--filter` with `active` class when selected

### **Glass Surface Usage**

```jsx
// ✅ Good - Use glass system classes
<div className="glass-card">Content</div>
<div className="glass-panel">Content</div>
<div className="glass-surface glass-surface--interactive">Interactive</div>

// ✅ Good - Use utility classes for common patterns
<div className="glass-secondary">Secondary surface</div>
<div className="glass-interactive">Interactive surface</div>

// ❌ Bad - Direct Tailwind glass styles
<div className="bg-white/10 backdrop-blur-sm">Content</div>
<div className="bg-white/20">Content</div>
```

**Glass Surface Rules:**
- Use `glass-card`, `glass-panel`, or `glass-container` for surfaces
- Use `glass-surface--interactive` for clickable surfaces
- Use utility classes (`glass-secondary`, `glass-interactive`) for common patterns
- Never use direct `bg-white/X` or `backdrop-blur-X` classes

### **Status Colors**

```jsx
// ✅ Good - Status colors only in badges/alerts
<StatusBadge status="Paid" />
<div className="badge-danger">Error</div>
<ErrorDisplay severity="critical" />

// ❌ Bad - Status colors in buttons (except danger)
<button className="glass-button bg-green-500/20">Save</button>
```

**Status Color Rules:**
- Use status colors (green, yellow, red, orange) ONLY in:
  - StatusBadge component
  - ErrorDisplay component
  - Status indicators (small badges)
  - Alert messages
- Never use status colors in primary/secondary buttons (except `glass-button--danger`)
- Never use status colors for icons or large backgrounds

### **Color Token Usage**

```jsx
// ✅ Good - Use CSS custom properties
<div style={{ background: 'var(--color-accent-light)' }}>Content</div>

// ❌ Bad - Hardcoded colors
<div style={{ background: 'rgba(59, 130, 246, 0.2)' }}>Content</div>
```

## 🎨 **CSS & Styling (Legacy)**

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
- [ ] No console.log statements (use logger). Enforced by ESLint; only `src/utils/logger.js` may use console.
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

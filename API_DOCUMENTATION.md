# Digibook API Documentation

## 📋 **Overview**

This document provides comprehensive API documentation for all public functions, hooks, and services in the Digibook application.

## 🏗️ **Architecture**

### **Service Layer**
- **Database Service**: IndexedDB operations via Dexie
- **Finance Service**: Financial calculations and business logic
- **Data Manager**: Data synchronization and management
- **Category Cache**: Category management and caching

### **State Management**
- **Zustand Store**: Global application state
- **Custom Hooks**: Business logic abstraction
- **Context Providers**: Component-level state sharing

## 🗄️ **Database API**

### **Database Helpers (`src/db/database-clean.js`)**

#### **Account Operations**
```javascript
/**
 * Create a new account
 * @param {Object} accountData - Account information
 * @param {string} accountData.name - Account name
 * @param {number} accountData.balance - Initial balance
 * @param {string} accountData.type - Account type
 * @returns {Promise<number>} Account ID
 */
await dbHelpers.createAccount(accountData);

/**
 * Get all accounts
 * @returns {Promise<Array>} Array of account objects
 */
const accounts = await dbHelpers.getAccounts();

/**
 * Update account information
 * @param {number} accountId - Account ID
 * @param {Object} updates - Account updates
 * @returns {Promise<number>} Number of updated records
 */
await dbHelpers.updateAccount(accountId, updates);

/**
 * Delete an account
 * @param {number} accountId - Account ID
 * @returns {Promise<number>} Number of deleted records
 */
await dbHelpers.deleteAccount(accountId);
```

#### **Expense Operations**
```javascript
/**
 * Create a new expense
 * @param {Object} expenseData - Expense information
 * @param {string} expenseData.description - Expense description
 * @param {number} expenseData.amount - Expense amount
 * @param {string} expenseData.category - Expense category
 * @param {Date} expenseData.date - Expense date
 * @param {number} expenseData.accountId - Associated account ID
 * @returns {Promise<number>} Expense ID
 */
await dbHelpers.createExpense(expenseData);

/**
 * Get expenses with filtering and pagination
 * @param {Object} filters - Filter options
 * @param {number} filters.accountId - Filter by account
 * @param {string} filters.category - Filter by category
 * @param {Date} filters.startDate - Start date filter
 * @param {Date} filters.endDate - End date filter
 * @param {number} filters.page - Page number
 * @param {number} filters.pageSize - Items per page
 * @returns {Promise<Object>} Paginated expense results
 */
const expenses = await dbHelpers.getExpenses(filters);

/**
 * Update expense information
 * @param {number} expenseId - Expense ID
 * @param {Object} updates - Expense updates
 * @returns {Promise<number>} Number of updated records
 */
await dbHelpers.updateExpense(expenseId, updates);

/**
 * Delete an expense
 * @param {number} expenseId - Expense ID
 * @returns {Promise<number>} Number of deleted records
 */
await dbHelpers.deleteExpense(expenseId);
```

#### **Credit Card Operations**
```javascript
/**
 * Create a new credit card
 * @param {Object} cardData - Credit card information
 * @param {string} cardData.name - Card name
 * @param {number} cardData.limit - Credit limit
 * @param {number} cardData.balance - Current balance
 * @param {number} cardData.minPayment - Minimum payment
 * @param {Date} cardData.dueDate - Due date
 * @returns {Promise<number>} Credit card ID
 */
await dbHelpers.createCreditCard(cardData);

/**
 * Get all credit cards
 * @returns {Promise<Array>} Array of credit card objects
 */
const creditCards = await dbHelpers.getCreditCards();

/**
 * Update credit card information
 * @param {number} cardId - Credit card ID
 * @param {Object} updates - Credit card updates
 * @returns {Promise<number>} Number of updated records
 */
await dbHelpers.updateCreditCard(cardId, updates);

/**
 * Delete a credit card
 * @param {number} cardId - Credit card ID
 * @returns {Promise<number>} Number of deleted records
 */
await dbHelpers.deleteCreditCard(cardId);
```

## 🎣 **Custom Hooks API**

### **useExpenseOperations (`src/hooks/useExpenseOperations.js`)**

```javascript
/**
 * Custom hook for managing expense operations with optimistic updates
 *
 * @returns {Object} Expense operations object
 * @returns {Function} returns.createExpense - Create a new expense
 * @returns {Function} returns.updateExpense - Update an existing expense
 * @returns {Function} returns.deleteExpense - Delete an expense
 * @returns {Function} returns.duplicateExpense - Duplicate an expense
 * @returns {Function} returns.moveExpense - Move expense between accounts
 * @returns {Function} returns.bulkUpdateExpenses - Update multiple expenses
 */
const {
  createExpense,
  updateExpense,
  deleteExpense,
  duplicateExpense,
  moveExpense,
  bulkUpdateExpenses
} = useExpenseOperations();

// Usage examples
await createExpense({
  description: 'Groceries',
  amount: 150.00,
  category: 'Food',
  date: new Date(),
  accountId: 1
});

await updateExpense(expenseId, { amount: 175.00 });

await deleteExpense(expenseId);

await duplicateExpense(expenseId, { date: new Date() });

await moveExpense(expenseId, newAccountId);

await bulkUpdateExpenses([
  { id: 1, category: 'Food' },
  { id: 2, category: 'Transportation' }
]);
```

### **useAccountOperations (`src/hooks/useAccountOperations.js`)**

```javascript
/**
 * Custom hook for managing account operations
 *
 * @returns {Object} Account operations object
 * @returns {Function} returns.createAccount - Create a new account
 * @returns {Function} returns.updateAccount - Update an existing account
 * @returns {Function} returns.deleteAccount - Delete an account
 * @returns {Function} returns.getAccountById - Get account by ID
 * @returns {Function} returns.getAccountBalance - Get account balance
 * @returns {Function} returns.transferBetweenAccounts - Transfer between accounts
 */
const {
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountById,
  getAccountBalance,
  transferBetweenAccounts
} = useAccountOperations();

// Usage examples
await createAccount({
  name: 'Checking Account',
  balance: 1000.00,
  type: 'checking'
});

await updateAccount(accountId, { name: 'Premium Checking' });

await deleteAccount(accountId);

const account = await getAccountById(accountId);

const balance = await getAccountBalance(accountId);

await transferBetweenAccounts(fromAccountId, toAccountId, amount);
```

### **useMemoizedCalculations (`src/hooks/useMemoizedCalculations.js`)**

```javascript
/**
 * Custom hook for memoized financial calculations
 *
 * @returns {Object} Calculation results
 * @returns {Object} returns.expenseTotals - Expense totals by category
 * @returns {Object} returns.accountBalances - Account balance summaries
 * @returns {Object} returns.monthlyTrends - Monthly spending trends
 * @returns {Object} returns.budgetAnalysis - Budget vs actual analysis
 */
const {
  expenseTotals,
  accountBalances,
  monthlyTrends,
  budgetAnalysis
} = useMemoizedCalculations(expenses, accounts, creditCards);
```

### **usePerformanceMonitor (`src/hooks/usePerformanceMonitor.js`)**

```javascript
/**
 * Custom hook for performance monitoring
 *
 * @returns {Object} Performance monitoring utilities
 * @returns {Function} returns.startTimer - Start performance timer
 * @returns {Function} returns.endTimer - End performance timer
 * @returns {Function} returns.getMetrics - Get performance metrics
 * @returns {Function} returns.logPerformance - Log performance data
 */
const {
  startTimer,
  endTimer,
  getMetrics,
  logPerformance
} = usePerformanceMonitor();

// Usage
const timerId = startTimer('expense-calculation');
// ... perform operation
const duration = endTimer(timerId);
logPerformance('expense-calculation', duration);
```

## 🏪 **Store API (Zustand)**

### **useAppStore (`src/stores/useAppStore.js`)**

```javascript
/**
 * Global application state store
 *
 * @returns {Object} Store state and actions
 * @returns {Array} returns.accounts - All accounts
 * @returns {Array} returns.fixedExpenses - All expenses
 * @returns {Array} returns.creditCards - All credit cards
 * @returns {Function} returns.addAccount - Add new account
 * @returns {Function} returns.updateAccount - Update account
 * @returns {Function} returns.deleteAccount - Delete account
 * @returns {Function} returns.addExpense - Add new expense
 * @returns {Function} returns.updateExpense - Update expense
 * @returns {Function} returns.deleteExpense - Delete expense
 * @returns {Function} returns.reloadAccounts - Reload accounts from database
 * @returns {Function} returns.reloadExpenses - Reload expenses from database
 */
const {
  accounts,
  fixedExpenses,
  creditCards,
  addAccount,
  updateAccount,
  deleteAccount,
  addExpense,
  updateExpense,
  deleteExpense,
  reloadAccounts,
  reloadExpenses
} = useAppStore();

// Usage examples
const newAccount = await addAccount({
  name: 'Savings Account',
  balance: 5000.00,
  type: 'savings'
});

await updateAccount(accountId, { balance: 5500.00 });

await deleteAccount(accountId);

await reloadAccounts();
await reloadExpenses();
```

## 🛠️ **Utility Functions API**

### **Error Handler (`src/utils/errorHandler.js`)**

```javascript
/**
 * Centralized error handling utility
 *
 * @class ErrorHandler
 */
const errorHandler = new ErrorHandler();

/**
 * Handle and categorize errors with comprehensive logging
 * @param {Error} error - The error to handle
 * @param {Object} context - Additional context about where the error occurred
 * @param {string} context.component - Name of the component where error occurred
 * @param {string} context.action - Action being performed when error occurred
 * @param {string} context.userId - ID of the user (if applicable)
 * @param {Object} options - Handling options
 * @param {boolean} options.showNotification - Whether to show user notification
 * @param {boolean} options.attemptRecovery - Whether to attempt automatic recovery
 * @returns {Object} Error information object with categorization and severity
 */
const errorInfo = errorHandler.handle(error, context, options);

// Usage
try {
  await riskyOperation();
} catch (error) {
  errorHandler.handle(error, {
    component: 'ExpenseTable',
    action: 'updateExpense',
    userId: currentUser.id
  }, {
    showNotification: true,
    attemptRecovery: false
  });
}
```

### **Validation (`src/utils/validation.js`)**

```javascript
/**
 * Validate account name
 * @param {string} name - Account name to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the name is valid
 * @returns {string} returns.error - Error message if invalid
 */
const result = validateAccountName('My Account');

/**
 * Validate expense amount
 * @param {number} amount - Amount to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the amount is valid
 * @returns {string} returns.error - Error message if invalid
 */
const result = validateAmount(150.50);

/**
 * Validate PIN
 * @param {string} pin - PIN to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the PIN is valid
 * @returns {string} returns.error - Error message if invalid
 */
const result = validatePIN('1234');

/**
 * Validate expense description
 * @param {string} description - Description to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the description is valid
 * @returns {string} returns.error - Error message if invalid
 */
const result = validateDescription('Grocery shopping');

/**
 * Validate date
 * @param {Date} date - Date to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the date is valid
 * @returns {string} returns.error - Error message if invalid
 */
const result = validateDate(new Date());

/**
 * Validate category name
 * @param {string} name - Category name to validate
 * @param {Array} existingCategories - Existing category names
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the category name is valid
 * @returns {string} returns.error - Error message if invalid
 */
const result = validateCategoryName('Food', existingCategories);

/**
 * Validate expense type
 * @param {string} type - Expense type to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the type is valid
 * @returns {string} returns.error - Error message if invalid
 */
const result = validateExpenseType('fixed');

/**
 * Validate credit card data
 * @param {Object} cardData - Credit card data to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the data is valid
 * @returns {Object} returns.errors - Validation errors by field
 */
const result = validateCreditCard(cardData);

/**
 * Sanitize object data
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitized = sanitizeObject(userInput);
```

### **Date Utilities (`src/utils/dateUtils.js`)**

```javascript
/**
 * Format date for display
 * @param {Date} date - Date to format
 * @param {string} format - Format string
 * @returns {string} Formatted date string
 */
const formatted = formatDate(new Date(), 'MM/DD/YYYY');

/**
 * Get start of month
 * @param {Date} date - Date to get start of month for
 * @returns {Date} Start of month date
 */
const startOfMonth = getStartOfMonth(new Date());

/**
 * Get end of month
 * @param {Date} date - Date to get end of month for
 * @returns {Date} End of month date
 */
const endOfMonth = getEndOfMonth(new Date());

/**
 * Add days to date
 * @param {Date} date - Base date
 * @param {number} days - Number of days to add
 * @returns {Date} New date with days added
 */
const newDate = addDays(new Date(), 7);

/**
 * Get days between dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Number of days between dates
 */
const daysBetween = getDaysBetween(startDate, endDate);

/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {boolean} Whether the date is today
 */
const isToday = isDateToday(new Date());

/**
 * Check if date is this week
 * @param {Date} date - Date to check
 * @returns {boolean} Whether the date is this week
 */
const isThisWeek = isDateThisWeek(new Date());

/**
 * Check if date is this month
 * @param {Date} date - Date to check
 * @returns {boolean} Whether the date is this month
 */
const isThisMonth = isDateThisMonth(new Date());

/**
 * Get relative time string
 * @param {Date} date - Date to get relative time for
 * @returns {string} Relative time string (e.g., "2 days ago")
 */
const relativeTime = getRelativeTime(new Date());

/**
 * Parse date string
 * @param {string} dateString - Date string to parse
 * @returns {Date} Parsed date object
 */
const parsedDate = parseDate('2024-01-15');
```

### **Account Utilities (`src/utils/accountUtils.js`)**

```javascript
/**
 * Calculate account balance
 * @param {Object} account - Account object
 * @param {Array} expenses - Array of expenses
 * @returns {number} Calculated balance
 */
const balance = calculateAccountBalance(account, expenses);

/**
 * Get account summary
 * @param {Object} account - Account object
 * @param {Array} expenses - Array of expenses
 * @returns {Object} Account summary
 * @returns {number} returns.balance - Current balance
 * @returns {number} returns.totalIncome - Total income
 * @returns {number} returns.totalExpenses - Total expenses
 * @returns {number} returns.netChange - Net change
 */
const summary = getAccountSummary(account, expenses);

/**
 * Format account balance
 * @param {number} balance - Balance to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted balance string
 */
const formatted = formatAccountBalance(1500.75, 'USD');

/**
 * Get account type display name
 * @param {string} type - Account type
 * @returns {string} Display name for account type
 */
const displayName = getAccountTypeDisplayName('checking');

/**
 * Validate account data
 * @param {Object} accountData - Account data to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.isValid - Whether the data is valid
 * @returns {Object} returns.errors - Validation errors by field
 */
const result = validateAccountData(accountData);
```

## 🔐 **Security API**

### **Crypto Utilities (`src/utils/crypto.js`)**

```javascript
/**
 * Encrypt data using Web Crypto API
 * @param {string} data - Data to encrypt
 * @param {string} password - Encryption password
 * @returns {Promise<string>} Encrypted data
 */
const encrypted = await encryptData('sensitive data', 'password');

/**
 * Decrypt data using Web Crypto API
 * @param {string} encryptedData - Encrypted data
 * @param {string} password - Decryption password
 * @returns {Promise<string>} Decrypted data
 */
const decrypted = await decryptData(encrypted, 'password');

/**
 * Hash data using SHA-256
 * @param {string} data - Data to hash
 * @returns {Promise<string>} Hashed data
 */
const hashed = await hashData('data to hash');

/**
 * Generate secure random string
 * @param {number} length - Length of random string
 * @returns {string} Random string
 */
const randomString = generateRandomString(32);

/**
 * Generate secure random bytes
 * @param {number} length - Length of random bytes
 * @returns {Uint8Array} Random bytes
 */
const randomBytes = generateRandomBytes(16);

/**
 * Derive key from password
 * @param {string} password - Password to derive key from
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>} Derived key
 */
const key = await deriveKeyFromPassword('password', salt);

/**
 * Verify data integrity
 * @param {string} data - Data to verify
 * @param {string} hash - Expected hash
 * @returns {Promise<boolean>} Whether the data is valid
 */
const isValid = await verifyDataIntegrity(data, hash);
```

## 📊 **Performance API**

### **Pagination (`src/utils/pagination.js`)**

```javascript
/**
 * Paginate data with offset-based pagination
 * @param {Function} queryFunction - Function to query data
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Items per page
 * @param {...any} args - Additional arguments for query function
 * @returns {Promise<Object>} Paginated results
 * @returns {Array} returns.data - Array of items
 * @returns {number} returns.total - Total number of items
 * @returns {number} returns.page - Current page
 * @returns {number} returns.pageSize - Items per page
 * @returns {number} returns.totalPages - Total number of pages
 * @returns {boolean} returns.hasNext - Whether there's a next page
 * @returns {boolean} returns.hasPrev - Whether there's a previous page
 */
const result = await paginateData(queryFunction, page, pageSize, ...args);

/**
 * Paginate data with cursor-based pagination
 * @param {Function} queryFunction - Function to query data
 * @param {string} lastId - Last item ID for cursor
 * @param {number} pageSize - Items per page
 * @param {...any} args - Additional arguments for query function
 * @returns {Promise<Object>} Paginated results
 * @returns {Array} returns.data - Array of items
 * @returns {string} returns.lastId - Last item ID
 * @returns {boolean} returns.hasMore - Whether there are more items
 */
const result = await paginateDataCursor(queryFunction, lastId, pageSize, ...args);

/**
 * Search data with pagination
 * @param {Function} searchFunction - Function to search data
 * @param {string} query - Search query
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Items per page
 * @param {...any} args - Additional arguments for search function
 * @returns {Promise<Object>} Search results with pagination
 */
const result = await searchData(searchFunction, query, page, pageSize, ...args);

/**
 * Process data in batches
 * @param {Array} data - Data to process
 * @param {Function} processFunction - Function to process each batch
 * @param {number} batchSize - Size of each batch
 * @returns {Promise<Array>} Processed results
 */
const results = await processDataInBatches(data, processFunction, batchSize);

/**
 * Get pagination info
 * @param {number} total - Total number of items
 * @param {number} page - Current page
 * @param {number} pageSize - Items per page
 * @returns {Object} Pagination information
 */
const info = getPaginationInfo(total, page, pageSize);

/**
 * Monitor pagination performance
 * @param {string} operation - Operation name
 * @param {Function} operationFunction - Function to monitor
 * @returns {Promise<any>} Operation result
 */
const result = await monitorPaginationPerformance('expense-query', operationFunction);
```

## 🎨 **Component API**

### **Error Boundary (`src/components/ErrorBoundary.jsx`)**

```jsx
/**
 * Error boundary component for catching and handling errors
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {Function} props.onError - Error callback function
 * @param {React.Component} props.fallback - Fallback component to render on error
 * @returns {React.Component} Error boundary component
 */
<ErrorBoundary onError={handleError} fallback={ErrorFallback}>
  <YourComponent />
</ErrorBoundary>
```

### **Loading Spinner (`src/components/LoadingSpinner.jsx`)**

```jsx
/**
 * Loading spinner component
 *
 * @param {Object} props - Component props
 * @param {string} props.size - Size of spinner (sm, md, lg)
 * @param {string} props.color - Color of spinner
 * @param {string} props.message - Loading message
 * @returns {React.Component} Loading spinner component
 */
<LoadingSpinner size="md" color="blue" message="Loading expenses..." />
```

### **Status Badge (`src/components/StatusBadge.jsx`)**

```jsx
/**
 * Status badge component
 *
 * @param {Object} props - Component props
 * @param {string} props.status - Status value
 * @param {string} props.variant - Badge variant (success, warning, error, info)
 * @param {string} props.size - Badge size (sm, md, lg)
 * @returns {React.Component} Status badge component
 */
<StatusBadge status="active" variant="success" size="md" />
```

---

*This API documentation is automatically generated and should be updated with each code change.*

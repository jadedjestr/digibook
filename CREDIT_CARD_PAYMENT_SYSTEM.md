# Credit Card Payment System Documentation

## Overview

The Digibook app implements a sophisticated two-field credit card payment system that accurately simulates real-world financial transactions. This system distinguishes between **funding sources** (where money comes from) and **payment targets** (where money goes to), providing clear separation between regular expenses and credit card debt payments.

## Core Concepts

### Payment Types

The system handles three distinct payment scenarios:

1. **Credit Card Payments** - Transfers from checking/savings to pay down credit card debt
2. **Regular Expenses (Cash)** - Payments from checking/savings accounts
3. **Regular Expenses (Credit)** - Charges to credit cards (increases debt)

### Two-Field System

For **Credit Card Payment** category expenses, the system uses two explicit fields:
- `accountId` - The funding source (checking/savings account)
- `targetCreditCardId` - The target credit card to pay down

For all other expenses, only `accountId` is used (can be checking, savings, or credit card).

## Database Schema

### Version 3 Schema Changes

```sql
-- Fixed Expenses Table (Version 3)
fixedExpenses: {
  id: auto-increment,
  name: string,
  dueDate: date,
  amount: number,
  accountId: number,           -- Funding source for payments OR account for regular expenses
  targetCreditCardId: number,  -- Target credit card (only for Credit Card Payment category)
  category: string,
  paidAmount: number,
  status: string,
  // ... other fields
}
```

### Migration Path

- **Version 1**: Original schema
- **Version 2**: Added recurring expenses (`recurringTemplateId`)
- **Version 3**: Added two-field credit card payments (`targetCreditCardId`)

## User Workflow

### 1. Account Setup
```
User creates checking/savings accounts
└── At least one checking account becomes the default funding source
```

### 2. Credit Card Addition
```
User goes to Credit Cards tab
└── Adds new credit card (name, balance, limit, due date, etc.)
    └── System automatically calls createMissingCreditCardExpenses()
        └── Creates payment expense with two-field system:
            ├── accountId: defaultAccount.id (funding source)
            ├── targetCreditCardId: card.id (payment target)
            └── category: "Credit Card Payment"
```

### 3. Expense Creation

#### Credit Card Payments
```
User selects "Credit Card Payment" category
├── UI shows: "Pay FROM (Funding Account)" - restricted to checking/savings
├── UI shows: "Pay TO (Target Credit Card)" - shows credit cards with debt amounts
└── Saves with both accountId and targetCreditCardId
```

#### Regular Expenses
```
User selects any other category
├── UI shows: "Account" - allows all account types
└── Saves with only accountId (can be checking, savings, or credit card)
```

## Payment Logic Implementation

### File: `src/hooks/useExpenseOperations.js`

```javascript
// Three distinct payment scenarios
if (expense.category === 'Credit Card Payment') {
  // A. Credit Card Payment: checking/savings → credit card
  decreaseAccountBalance(accountId);           // Money leaves funding account
  decreaseCreditCardBalance(targetCreditCardId); // Debt goes down

} else if (isCheckingSavingsAccount(accountId)) {
  // B. Regular expense from checking/savings
  decreaseAccountBalance(accountId);           // Money leaves account

} else if (isCreditCardAccount(accountId)) {
  // C. Regular expense charged to credit card
  increaseCreditCardBalance(accountId);        // Debt increases
}
```

### Financial Logic

| Scenario | Account Type | Payment Effect | Real-World Equivalent |
|----------|-------------|----------------|---------------------|
| Credit Card Payment | Checking → Credit Card | -Checking, -Credit Card Debt | Writing check to pay credit card |
| Subscription (Cash) | Checking | -Checking | Paying Netflix from checking |
| Subscription (Credit) | Credit Card | +Credit Card Debt | Charging Netflix to credit card |

## UI Components

### AddExpensePanel.jsx
- **Conditional Rendering**: Shows two fields for "Credit Card Payment", one field for others
- **Smart Labels**: "Pay FROM" vs "Pay TO" for credit card payments
- **Validation**: Ensures both fields are filled for credit card payments

### AccountSelector.jsx
- **Intelligent Filtering**: Restricts options based on `isCreditCardPayment` prop
- **Consistent Logic**: Same behavior in desktop tables and mobile cards

### DraggableExpenseRow.jsx & MobileExpenseCard.jsx
- **Category Detection**: `isCreditCardPayment={expense.category === 'Credit Card Payment'}`
- **Proper Restrictions**: Only checking/savings for credit card payments

## Auto-Creation Logic

### File: `src/db/database-clean.js`

```javascript
async createMissingCreditCardExpenses() {
  // Find default checking account as funding source
  const defaultAccount = accounts.find(acc => acc.isDefault) ||
                        accounts.find(acc => acc.type === 'checking') ||
                        accounts[0];

  for (const card of creditCards) {
    // Check if payment expense already exists
    const hasPaymentExpense = expenses.some(
      expense => expense.category === 'Credit Card Payment' &&
                expense.targetCreditCardId === card.id
    );

    if (!hasPaymentExpense) {
      // Create proper two-field payment expense
      await db.fixedExpenses.add({
        name: `${card.name} Payment`,
        accountId: defaultAccount.id,        // Funding source
        targetCreditCardId: card.id,         // Payment target
        category: 'Credit Card Payment',     // Proper category
        amount: card.minimumPayment || Math.max(card.balance * 0.02, 25),
        // ... other fields
      });
    }
  }
}
```

## Key Files

### Core Implementation
- `src/hooks/useExpenseOperations.js` - Payment processing logic
- `src/components/AddExpensePanel.jsx` - Conditional UI for expense creation
- `src/db/database-clean.js` - Database schema and auto-creation logic

### UI Components
- `src/components/AccountSelector.jsx` - Smart account filtering
- `src/components/DraggableExpenseRow.jsx` - Desktop table rows
- `src/components/MobileExpenseCard.jsx` - Mobile expense cards

### Supporting Files
- `src/utils/accountUtils.js` - Account handling utilities
- `src/services/financeService.js` - Financial calculations

## Validation & Error Handling

### Form Validation
```javascript
// For credit card payments, validate both fields
if (isCreditCardPayment && !formData.targetCreditCardId) {
  newErrors.targetCreditCardId = 'Target credit card is required';
}
```

### Database Integrity
- Foreign key relationships maintained
- Graceful handling of missing accounts
- Audit logging for all transactions

## Testing Scenarios

### Critical Test Cases
1. **Create Credit Card Payment** - Verify two-field UI appears
2. **Create Regular Subscription** - Verify single-field UI
3. **Payment Processing** - Verify correct balance updates
4. **Auto-Creation** - Verify new credit cards create payment expenses
5. **Backward Compatibility** - Verify existing expenses continue working

### Expected Behaviors
- Credit card payments decrease both funding account and credit card debt
- Regular expenses on credit cards increase debt
- Regular expenses from checking decrease balance
- Auto-created expenses use proper two-field system

## Future Enhancements

### Potential Improvements
1. **Enhanced Table Display** - Show both funding source and target for credit card payments
2. **Payment Scheduling** - Automatic payment scheduling based on due dates
3. **Multi-Card Payments** - Split payments across multiple credit cards
4. **Payment History** - Detailed transaction history with both accounts

### Extension Points
- Additional payment types (bank transfers, etc.)
- Multiple funding sources for single payment
- Payment optimization suggestions
- Integration with external banking APIs

## Troubleshooting

### Common Issues
1. **Multiple Accounts Selected** - Ensure `isCreditCardPayment` parameter is passed to `AccountSelector`
2. **Incorrect Balance Updates** - Verify expense category is exactly "Credit Card Payment"
3. **Auto-Creation Fails** - Ensure at least one checking/savings account exists
4. **UI Not Updating** - Check that `formData.category` triggers conditional rendering

### Debug Points
- Check `expense.category === 'Credit Card Payment'` logic
- Verify `targetCreditCardId` is populated for payment expenses
- Ensure `accountId` points to funding source, not target
- Validate proper database schema version (3)

## Conclusion

This two-field credit card payment system provides a robust, accurate simulation of real-world financial transactions while maintaining an intuitive user interface. The clear separation of concerns between funding sources and payment targets eliminates confusion and ensures proper financial tracking.

The system is designed for extensibility and maintains backward compatibility, making it suitable for production use while providing a foundation for future enhancements.

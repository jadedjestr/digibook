# AccountSelector Component

A standardized component for selecting accounts and credit cards across the application.

## Props

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `number \| string \| null` | The currently selected account ID |
| `onSave` | `function` | Callback function called when an account is selected |
| `accounts` | `Array<Account>` | Array of regular accounts (checking, savings) |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `creditCards` | `Array<CreditCard>` | `[]` | Array of credit cards |
| `isEditing` | `boolean` | `false` | Whether the component is in editing mode |
| `isCreditCardPayment` | `boolean` | `false` | Whether this is for credit card payments (restricts to regular accounts) |
| `showSaveCancel` | `boolean` | `true` | Whether to show save/cancel buttons in editing mode |
| `onEdit` | `function` | `null` | Callback when entering edit mode |
| `onCancel` | `function` | `null` | Callback when canceling edit mode |

## Data Types

### Account
```typescript
interface Account {
  id: number | string;
  name: string;
  currentBalance?: number;
  type?: string;
  isDefault?: boolean;
}
```

### CreditCard
```typescript
interface CreditCard {
  id: number | string;
  name: string;
  balance: number;
  creditLimit?: number;
  interestRate?: number;
  dueDate?: string;
  statementClosingDate?: string;
  minimumPayment?: number;
  createdAt?: string;
}
```

## Usage Examples

### Basic Usage (DraggableExpenseRow)
```jsx
<AccountSelector
  value={expense.accountId}
  onSave={(accountId) => onUpdateExpense(expense.id, { accountId })}
  accounts={accounts}
  creditCards={creditCards}
  isCreditCardPayment={expense.category === 'Credit Card Payment'}
/>
```

### Editing Mode (MobileExpenseCard)
```jsx
<AccountSelector
  value={editValue}
  onSave={setEditValue}
  accounts={accounts}
  creditCards={creditCards}
  isEditing={true}
  showSaveCancel={false}
/>
```

### Credit Card Payment (Restricted to Regular Accounts)
```jsx
<AccountSelector
  value={paymentAccountId}
  onSave={setPaymentAccountId}
  accounts={accounts}
  creditCards={[]} // Not needed for credit card payments
  isCreditCardPayment={true}
/>
```

## ID Mapping

The component handles ID mapping automatically:

- **Regular Accounts**: Use their database ID directly
- **Credit Cards**: 
  - Display ID: `cc-{originalId}` (e.g., `"cc-3"`)
  - Database ID: `originalId` (e.g., `3`)

## Utility Functions

The component uses utility functions from `../utils/accountUtils`:

- `createAccountMapping()` - Creates standardized account array
- `findSelectedAccount()` - Finds account by ID
- `getAccountIdToSave()` - Gets correct ID for database
- `isAccountSelected()` - Checks if account is selected
- `formatAccountBalance()` - Formats balance for display

## Migration Guide

### From Old Prop Names
```jsx
// OLD (BROKEN)
<AccountSelector
  selectedAccountId={value}
  onAccountChange={onSave}
  accounts={accounts}
  creditCards={creditCards}
/>

// NEW (CORRECT)
<AccountSelector
  value={value}
  onSave={onSave}
  accounts={accounts}
  creditCards={creditCards}
/>
```

## Error Handling

The component includes built-in error handling:

- Null/undefined checks for props
- Fallback values for missing data
- Type validation for callbacks
- Graceful degradation on errors

## Performance

- Memoized calculations (Phase 3)
- Optimized re-renders
- Efficient ID mapping
- Minimal DOM updates

## Accessibility

- Keyboard navigation support
- ARIA labels and roles
- Screen reader compatibility
- Focus management

## Testing

The component is fully tested with:

- Unit tests for utility functions
- Integration tests for usage patterns
- E2E tests for critical flows
- Performance regression tests

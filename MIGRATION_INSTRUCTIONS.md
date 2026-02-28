# V4 Format Migration Instructions

## Automatic Migration (Recommended)

The migration runs automatically when the app loads. To trigger it:

### Development Build
1. Stop your dev server (Ctrl+C)
2. Restart: `npm run dev`
3. The migration will run automatically on app load
4. Check browser console for migration logs

### Production Build
1. Build: `npm run build`
2. Serve the build
3. Open the app - migration runs on first load
4. Check browser console for migration logs

## Manual Migration (Immediate)

If you want to run the migration right now without restarting:

### In Browser Console

1. Open browser console (F12 or Cmd+Option+I)
2. Paste and run:

```javascript
// Get dbHelpers (works when running the app via Vite dev server)
const { dbHelpers } = await import('/src/db/database-clean.js');

// Run audit first
const audit = await dbHelpers.auditExpenseFormat();
console.log('Audit Results:', audit.summary);

// Run migration if needed
if (audit.summary.accountIdMatchesCreditCard > 0) {
  const result = await dbHelpers.migrateExpensesToV4Format();
  console.log('Migration Results:', result.summary);

  // Verify
  const verify = await dbHelpers.auditExpenseFormat();
  console.log('Verification:', verify.summary);
} else {
  console.log('✅ No migration needed - all expenses are in V4 format!');
}
```

## What the Migration Does

1. **Finds** expenses where `accountId` contains a credit card ID (legacy format)
2. **Moves** the credit card ID from `accountId` to `creditCardId`
3. **Sets** `accountId` to `null` for those expenses
4. **Preserves** all other expense data
5. **Logs** detailed results

## Migration Safety

- ✅ Non-destructive (only moves data, doesn't delete)
- ✅ Preserves all expense data
- ✅ Can be run multiple times safely
- ✅ Won't break if no migration is needed
- ✅ Non-blocking (app continues loading even if migration fails)

## Verification

After migration, verify with:

```javascript
const audit = await dbHelpers.auditExpenseFormat();
console.log('Remaining issues:', audit.summary);
// Should show 0 for accountIdMatchesCreditCard
```


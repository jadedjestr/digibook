/**
 * Standalone V4 Format Migration Script
 *
 * This script can be run in the browser console to manually trigger
 * the V4 format migration for expenses.
 *
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Or import and run: await runMigration()
 */

/* eslint-disable no-restricted-syntax, space-before-function-paren */

async function runMigration() {
  try {
    console.log('🔍 Starting V4 format migration...');

    // Import dbHelpers (adjust path if needed)
    const { dbHelpers } = await import('./src/db/database-clean.js');

    // First, audit the current state
    console.log('📊 Auditing expense format...');
    const auditReport = await dbHelpers.auditExpenseFormat();

    console.log('Audit Results:', {
      totalExpenses: auditReport.totalExpenses,
      issues: auditReport.summary,
    });

    if (auditReport.summary.accountIdMatchesCreditCard === 0) {
      console.log(
        '✅ No migration needed - all expenses are already in V4 format!',
      );
      return { migrated: 0, skipped: auditReport.totalExpenses };
    }

    // Run the migration
    console.log('🔄 Running migration...');
    const migrationReport = await dbHelpers.migrateExpensesToV4Format();

    console.log('Migration Results:', {
      total: migrationReport.summary.total,
      migrated: migrationReport.summary.migrated,
      failed: migrationReport.summary.failed,
      skipped: migrationReport.summary.skipped,
    });

    if (migrationReport.summary.migrated > 0) {
      console.log(
        `✅ Successfully migrated ${migrationReport.summary.migrated} expenses!`,
      );
    }

    if (migrationReport.summary.failed > 0) {
      console.warn(
        `⚠️ ${migrationReport.summary.failed} expenses failed to migrate. Check logs for details.`,
      );
    }

    // Re-audit to verify
    console.log('🔍 Verifying migration...');
    const verifyReport = await dbHelpers.auditExpenseFormat();

    if (verifyReport.summary.accountIdMatchesCreditCard === 0) {
      console.log('✅ Migration verified - all expenses are now in V4 format!');
    } else {
      console.warn(
        `⚠️ Some expenses still need migration: ${verifyReport.summary.accountIdMatchesCreditCard}`,
      );
    }

    return migrationReport.summary;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Auto-run if executed directly
if (typeof window !== 'undefined') {
  // Browser environment - expose function globally
  window.runMigration = runMigration;
  console.log('Migration script loaded. Run: await runMigration()');
} else {
  // Node environment
  runMigration()
    .then(result => {
      console.log('Migration completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

// Lives in its own module so every check against it (dataManager's import
// and backup gates, validatePortableLoans) reads the same number. A second,
// hard-coded copy in loanInterest.js once had to be found by a failing test
// when this was bumped.
// Export/import data-format version - distinct from the Dexie schema version
// in database-clean.js (this gates the JSON/backup file contract, not the
// IndexedDB structure). Review this whenever a schema change alters that
// contract (e.g. the V8 migration to UUID string ids, which this constant
// was never bumped for).
// 7 adds the `appearance` object (glass tint, ambient strength, ambient
// colours). It is additive and optional: a version 6 file imports fine and
// simply leaves the current theme alone.
// 8 adds `recurringResolutionLog` (Undo / Payment History for the recurring
// "resolve cycle" flow). It is additive and optional: a version 7 file
// imports fine and simply starts with no resolution history.
// 9 adds `loans` (installment-debt tracking, mirroring creditCards). It is
// additive and optional: a version 8 file imports fine and simply starts
// with no loans.
// 10 adds real-interest-tracking fields to `loans` (unpaidInterest,
// interestAccruedThrough, interestStateVersion, lastInterestOperation). It
// is additive and optional: a version 9 file imports fine and its loans
// simply stay untracked (interestAccruedThrough absent/null).
// 11 versions safe loan undo receipts; older clients must not rewrite them.
// 12 adds original-loan-terms fields to `loans` (originalLoanAmount,
// originalTermMonths, originalScheduledPayment, originalMaturityDate) - the
// contract actually signed, distinct from targetPayoffDate (a goal). It is
// additive and optional on import: a version 11 file's loans simply import
// without these fields, though the app requires them going forward for any
// *new* loan created after this version.
// 13 adds the credit-card equivalent to `creditCards`: `originalBalance`,
// `targetPayoffDate`, and intro-APR fields (`hasIntroApr`, `introApr`,
// `introAprEndDate`), driving a real amortized minimum payment the same way
// loans' targetPayoffDate does. Additive and optional on import: a version
// 12 file's credit cards simply import without these fields, though the app
// requires `originalBalance`/`targetPayoffDate`/`hasIntroApr` going forward
// for any *new* card created after this version.
// 14 adds `cardPayments` (extra credit-card payments recorded from the card)
// and `pendingTransactions.cardPaymentId` linking a not-yet-cleared one to its
// pending row. Additive and optional: a version 13 file imports fine and
// simply starts with no extra payments.
// 15 adds `loans[].customPaymentAmount` (a custom monthly loan payment,
// replacing the never-exposed template minimumPaymentOverride). Bumped so an
// older client refuses the file rather than importing it and silently
// dropping the custom amounts.
// 16 lets `cardPayments` rows pay a loan (`loanId`, with tracked-loan
// `loanBefore`/`loanAfter` snapshots for undo). Bumped so an older client
// refuses the file rather than failing on a row it can't read.
export const CURRENT_DATA_VERSION = 16;

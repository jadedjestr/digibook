# Digibook — Architecture Reference

**Companion to:** [PRD.md](PRD.md) — that document owns *what the product
should do and why*. This one owns *how it is built*.

**Status:** subordinate to the code. Where this document and the source
disagree, the source is right and this is a bug. It is a map, not a
contract.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Architecture Overview](#2-architecture-overview)
3. [Database Structure](#3-database-structure)
4. [Application Shell & Navigation](#4-application-shell--navigation)
5. [Services Layer](#5-services-layer)
6. [Custom Hooks](#6-custom-hooks)
7. [Context Providers](#7-context-providers)
8. [Component Inventory](#8-component-inventory)
9. [Utilities](#9-utilities)
10. [State Management](#10-state-management)
11. [Design System](#11-design-system)
12. [Data Management & Backup](#12-data-management--backup)
13. [Security & Privacy](#13-security--privacy)
14. [Performance Optimizations](#14-performance-optimizations)
15. [Testing Strategy](#15-testing-strategy)
16. [Deployment](#16-deployment)
17. [Developer Tooling & Code Quality](#17-developer-tooling--code-quality)
18. [Glossary](#18-glossary)

---

## 1. Tech Stack

### Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | 18.x | UI framework |
| `react-dom` | 18.x | DOM rendering |
| `dexie` | 3.x | IndexedDB wrapper (database ORM) |
| `zustand` | 5.x | Lightweight global state management |
| `lucide-react` | latest | Icon library |
| `papaparse` | 5.x | CSV import/export parsing |
| `react-toastify` | 11.x | Toast notification system |
| `recharts` | 2.x | Chart library (Insights page trends and breakdowns) |
| `@dnd-kit/core` | latest | Drag-and-drop primitives |
| `@dnd-kit/sortable` | latest | Sortable drag-and-drop |
| `@dnd-kit/utilities` | latest | Drag-and-drop utilities |

### Build & Development

| Tool | Purpose |
|---|---|
| Vite 7 | Build tool and dev server |
| `vite-plugin-pwa` | Generates the service worker and web app manifest wiring for offline support and installability (Workbox under the hood) |
| Tailwind CSS | Utility-first CSS framework with custom Liquid Glass theme |
| PostCSS + Autoprefixer | CSS post-processing |
| ESLint | JavaScript/JSX linting |
| Prettier | Code formatting |
| Husky | Git hooks (pre-commit, commit-msg) |
| lint-staged | Run linters on staged files only |
| Commitlint | Enforce conventional commit messages (type/scope/subject rules; see [Section 17](#17-developer-tooling--code-quality)) |

### Testing

| Tool | Purpose |
|---|---|
| Vitest | Test runner, split into two projects (see [Section 15](#15-testing-strategy)): jsdom unit tests, and real-browser Storybook story tests |
| React Testing Library | Component testing utilities |
| Playwright | Provides the real Chromium instance Vitest's browser-mode project renders Storybook stories in |
| fake-indexeddb | IndexedDB mock for jsdom unit tests |
| Storybook 9 | Component documentation and visual testing (`@storybook/addon-vitest` runs stories as tests) |

---

## 2. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                            │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     React Application                        │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌────────────────────────────────────────┐  │   │
│  │  │  Sidebar    │  │           Active Page                  │  │   │
│  │  │  (nav +     │  │  (lazy-loaded via React.lazy)          │  │   │
│  │  │   liquid    │  │                                        │  │   │
│  │  │   cash)     │  │  Accounts | PendingTransactions |      │  │   │
│  │  │             │  │  FixedExpenses | CreditCards |          │  │   │
│  │  │             │  │  Insights | Settings                    │  │   │
│  │  └────────────┘  └────────────────────────────────────────┘  │   │
│  │       │                          │                            │   │
│  │       ▼                          ▼                            │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │              Custom Hooks Layer                       │    │   │
│  │  │  useExpenseOperations | usePaycheckCalculations |     │    │   │
│  │  │  usePayCycleNudge                                      │    │   │
│  │  └───────────────────────┬──────────────────────────────┘    │   │
│  │                          │                                    │   │
│  │  ┌───────────────────────▼──────────────────────────────┐    │   │
│  │  │              Services Layer                           │    │   │
│  │  │  PaymentService | PaycheckService |                   │    │   │
│  │  │  RecurringExpenseService | DataManager |               │    │   │
│  │  │  financeService | categoryCache                        │    │   │
│  │  └───────────────────────┬──────────────────────────────┘    │   │
│  │                          │                                    │   │
│  │  ┌───────────────────────▼──────────────────────────────┐    │   │
│  │  │           Zustand Store (useAppStore)                  │    │   │
│  │  │  Global state: accounts, creditCards, fixedExpenses,   │    │   │
│  │  │  pendingTransactions, categories, paycheckSettings     │    │   │
│  │  │  UI state: currentPage, isPanelOpen (persisted)        │    │   │
│  │  └───────────────────────┬──────────────────────────────┘    │   │
│  │                          │                                    │   │
│  │  ┌───────────────────────▼──────────────────────────────┐    │   │
│  │  │          Database Layer (database-clean.js)            │    │   │
│  │  │  dbHelpers → Dexie.js → IndexedDB                     │    │   │
│  │  │  Schema V1-V8 | Atomic transactions | Audit logging    │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │        Service Worker (vite-plugin-pwa / Workbox)      │   │   │
│  │  │  Caches app shell assets for offline load + install    │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  localStorage: Zustand UI state, backups, PIN hash,           │   │
│  │                nudge dismissal state                          │   │
│  │  IndexedDB:    All financial data (DigibookDB_Fresh)          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **App boot:** `main.jsx` → `App.jsx` → load PIN from secure storage → if no PIN or locked, show `PINLock` → else `loadData()`.
2. **`loadData()`:** `initializeDatabase()` → `ensureDefaultData()` → `ensureDefaultAccount()` → run legacy accountId-format migration if needed → parallel fetch all tables into Zustand → background pre-generate recurring expenses (non-blocking).
3. **User action (e.g., mark expense as paid):** Component calls hook (e.g., `useExpenseOperations.markAsPaid`) → optimistic store update → `dbHelpers.applyExpensePaymentChangeAtomic()` → update expense + account/credit card balances in a single Dexie transaction → audit log → reload store slices.
4. **Navigation:** `Sidebar` calls `setCurrentPage(id)` → Zustand updates `currentPage` (persisted to localStorage) → `App.renderPage()` switch statement renders the matching lazy-loaded page.
5. **New record IDs:** every `dbHelpers` create path calls `generateId()` (`crypto.randomUUID()`) to assign the primary key *before* insert, rather than relying on Dexie's auto-increment — see [Section 3](#3-database-structure).

### Key Architectural Decisions

| Decision | Rationale |
|---|---|
| No React Router | Single-page app with 6 views; Zustand `currentPage` state is simpler and avoids URL management for a local-only app. |
| Lazy-loaded pages | `React.lazy()` + `Suspense` for all pages except Settings to reduce initial bundle size. |
| Dexie.js over raw IndexedDB | Provides a promise-based API, schema versioning, and transaction support that raw IndexedDB lacks. |
| Zustand over Redux/Context | Minimal boilerplate, built-in selectors that prevent unnecessary re-renders, and native `persist` middleware for UI state. |
| Optimistic updates | Instant UI feedback; reverts on DB error via `reloadExpenses()` / `reloadAccounts()`. |
| Service layer pattern | Business logic (payment routing, paycheck calculations, recurring generation) is decoupled from React components and database operations. |
| App-generated UUID primary keys (V8) | This is a single-user, local-only app with no existing installed base to migrate, so the schema bump to UUID string ids (instead of auto-increment integers) required no data backfill — it just changes what new records look like going forward. The main payoff is removing the risk of ID collisions if multi-device sync is ever built. |
| PWA via `vite-plugin-pwa` | Installability and offline app-shell loading were worth adding without touching the local-first data model — the service worker only caches static assets, not IndexedDB data. |

---

## 3. Database Structure

### Technology

- **Engine:** IndexedDB (browser-native)
- **ORM:** Dexie.js
- **Database Name:** `DigibookDB_Fresh`
- **Current Schema Version:** 10

### Schema Evolution

| Version | Change |
|---|---|
| V1 | Initial schema: accounts, expenses, categories, credit cards, paycheck settings, audit logs |
| V2 | Added `recurringExpenseTemplates` table and `recurringTemplateId` on `fixedExpenses` |
| V3 | Added `targetCreditCardId` on `fixedExpenses` for explicit credit card payment tracking |
| V4 | **Dual Foreign Key Architecture** — added `creditCardId` on `fixedExpenses`; expenses now use either `accountId` OR `creditCardId`, never both |
| V5 | `monthlyExpenseHistory` switched to a compound primary key `[expenseId+month+year]` to support upsert-by-period |
| V6 | Added `backups` table; added `lastExportDate` on `userPreferences` |
| V7 | Added `sortOrder` on `categories` for custom drag-and-drop ordering (existing categories backfilled alphabetically on upgrade) |
| V8 | **UUID migration** — all tables switched from auto-increment integer `id` to string UUID primary keys (assigned application-side via `generateId()` on every new record — the schema upgrade itself does no data backfill); added soft-delete support (`deletedAt`) and `updatedAt` timestamps on every table; added `categoryId` on `fixedExpenses`, `pendingTransactions`, and `recurringExpenseTemplates` |
| V9 | Added `incomeSources` table (expected paycheck: target account, expected amount, enabled flag, `lastGeneratedDate` high-water mark); added `incomeSourceId` on `pendingTransactions` so auto-generated payday rows can be traced back to their source |
| V10 | Added `recurringResolutionLog` table. Records every time a recurring cycle is resolved (Pay Full / Partial / Skip) so the cadence can advance immediately without pre-generating rows, and so Undo has an exact prior state to reverse to rather than re-deriving one from frequency math |

### Tables

#### `accounts`
Bank accounts (checking and savings).

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier (V8: migrated from auto-increment integer) |
| `name` | string | Yes | Account display name |
| `type` | string | Yes | `"checking"` or `"savings"` |
| `currentBalance` | number | Yes | Current balance in dollars |
| `isDefault` | boolean | Yes | Whether this is the default account shown in sidebar |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp (V8) |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

#### `creditCards`
Credit card accounts.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier (V8: migrated from auto-increment integer) |
| `name` | string | Yes | Card display name |
| `balance` | number | Yes | Current outstanding balance |
| `creditLimit` | number | Yes | Credit limit |
| `interestRate` | number | Yes | Annual interest rate (%) |
| `dueDate` | string | Yes | Next payment due date (YYYY-MM-DD) |
| `statementClosingDate` | string | Yes | Statement closing date (YYYY-MM-DD) |
| `minimumPayment` | number | Yes | Minimum monthly payment |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp (V8) |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

#### `fixedExpenses`
All bills and expenses. The core of the V4 dual foreign key model.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier (V8: migrated from auto-increment integer) |
| `name` | string | Yes | Expense name |
| `dueDate` | string | Yes | Due date (YYYY-MM-DD) |
| `amount` | number | Yes | Budget/expected amount |
| `accountId` | string \| null | Yes | Funding bank account (mutually exclusive with `creditCardId`) |
| `creditCardId` | string \| null | Yes | Credit card to charge (mutually exclusive with `accountId`) |
| `targetCreditCardId` | string \| null | Yes | For "Credit Card Payment" category only — the card being paid |
| `category` | string | Yes | Category name (e.g., "Utilities", "Credit Card Payment") |
| `categoryId` | string \| null | Yes | Category reference by id (V8, alongside legacy `category` name) |
| `paidAmount` | number | Yes | Amount paid so far |
| `status` | string | Yes | `"pending"`, `"paid"`, `"overdue"` |
| `recurringTemplateId` | string \| null | Yes | Link to recurring template that generated this expense |
| `overpaymentAmount` | number | Yes | Amount paid over budget |
| `overpaymentPercentage` | number | Yes | Overpayment as % of budget |
| `budgetSatisfied` | boolean | Yes | Whether budget amount was met |
| `significantOverpayment` | boolean | Yes | Flag for notable overpayments |
| `isAutoCreated` | boolean | Yes | Created automatically by recurring system |
| `isManuallyMapped` | boolean | Yes | Manually linked to credit card |
| `mappingConfidence` | number | Yes | Confidence score for auto-mapping |
| `mappedAt` | string | Yes | When mapping occurred |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp (V8) |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

**V4 Dual Foreign Key Rules:**

1. Regular expenses: Set either `accountId` (paid from bank) or `creditCardId` (charged to card). Never both.
2. Credit Card Payment expenses (category = "Credit Card Payment"):
   - `accountId` = the checking/savings account funding the payment (money goes out)
   - `targetCreditCardId` = the credit card being paid (balance goes down)
   - `creditCardId` must be null

#### `pendingTransactions`
Uncleared deposits, checks, and payments that affect projected balances.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier (V8: migrated from auto-increment integer) |
| `accountId` | string | Yes | Associated bank account |
| `amount` | number | Yes | Transaction amount (negative for expenses, positive for income) |
| `category` | string | Yes | Category name |
| `categoryId` | string \| null | Yes | Category reference by id (V8, alongside legacy `category` name) |
| `description` | string | Yes | Transaction description |
| `incomeSourceId` | string \| null | Yes | Set when the row was generated on payday from an income source (V9) |
| `completedAt` | ISO string \| null | No | When the user confirmed the money actually moved (V9) |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp (V8) |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

> **`completedAt` is not redundant with `deletedAt`.** Completing a transaction
> soft-deletes it — but so does sweeping an unconfirmed prediction when the
> income feature is switched off. Keyed off `deletedAt` alone the two are
> indistinguishable, so anything reading back real history (such as the income
> average) must require `completedAt`, or it will count money that never
> arrived. Rows completed before V9 lack it and are deliberately excluded:
> unknown history is treated as no history.

#### `categories`
User-defined expense categories with visual properties.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier (V8: migrated from auto-increment integer) |
| `name` | string | Yes | Category name |
| `color` | string | Yes | Hex color code |
| `icon` | string | Yes | Emoji or icon identifier |
| `isDefault` | boolean | Yes | Whether this is a system default |
| `sortOrder` | number | Yes | Custom display order (V7) |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp (V8) |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

**Default categories seeded on first run:** Utilities, Subscriptions, Insurance, Housing, Transportation, Food, Health, Entertainment, Credit Card Payment, and others.

#### `recurringExpenseTemplates`
Templates that auto-generate future expense instances.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier (V8: migrated from auto-increment integer) |
| `name` | string | Yes | Template name |
| `baseAmount` | number | Yes | Default amount for generated expenses |
| `frequency` | string | Yes | `"monthly"`, `"quarterly"`, `"biannually"`, `"annually"`, `"custom"` |
| `intervalValue` | number | Yes | Interval multiplier (e.g., 1 for every month) |
| `intervalUnit` | string | — | `"months"`, `"weeks"`, `"days"` |
| `startDate` | string | Yes | First occurrence date |
| `endDate` | string \| null | — | Optional end date |
| `lastGenerated` | string \| null | Yes | Date of last generated occurrence |
| `nextDueDate` | string | Yes | Next occurrence to generate |
| `category` | string | Yes | Category for generated expenses |
| `categoryId` | string \| null | Yes | Category reference by id (V8, alongside legacy `category` name) |
| `accountId` | string \| null | Yes | Default funding account |
| `creditCardId` | string \| null | — | Default credit card |
| `targetCreditCardId` | string \| null | — | For credit card payment templates |
| `notes` | string | Yes | Template notes |
| `isActive` | boolean | Yes | Whether template is active |
| `isVariableAmount` | boolean | Yes | Whether amount varies per occurrence |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

**Frequency note:** this table's own `frequency`/`intervalValue`/`intervalUnit` fields (monthly/quarterly/biannually/annually/custom) describe *how often a bill recurs* (e.g. a quarterly insurance premium) and are independent of the user's *paycheck* frequency described below in `paycheckSettings`.

#### `paycheckSettings`
Single-row table storing the user's pay schedule.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier (V8: migrated from auto-increment integer) |
| `lastPaycheckDate` | string | Yes | Date of last paycheck (YYYY-MM-DD) |
| `frequency` | string | Yes | `"weekly"`, `"biweekly"`, or `"monthly"` — see the `payFrequency.js` contract in [Section 9](#9-utilities) |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp (V8) |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

#### `userPreferences`
Per-component UI preferences.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier (V8: migrated from auto-increment integer) |
| `component` | string | Yes | Component identifier |
| `preferences` | object | Yes | JSON preferences blob |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `lastExportDate` | ISO string | Yes | Timestamp of last data export (V6) |
| `updatedAt` | ISO string | Yes | Last update timestamp (V8) |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

#### `monthlyExpenseHistory`
Historical tracking of budget vs. actual spending per expense per month.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `[expenseId+month+year]` | compound | PK | Compound primary key enabling upsert-by-period (V5) |
| `expenseId` | string | Yes | Associated fixed expense |
| `month` | number | Yes | Month (1-12) |
| `year` | number | Yes | Year |
| `budgetAmount` | number | Yes | Budgeted amount |
| `actualAmount` | number | Yes | Actual amount spent |
| `overpaymentAmount` | number | Yes | Amount over budget |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp (V8) |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

#### `auditLogs`
Comprehensive change-tracking for all data mutations.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier (V8: migrated from auto-increment integer) |
| `timestamp` | ISO string | Yes | When the action occurred |
| `actionType` | string | Yes | e.g., `"PAYMENT"`, `"CREATE"`, `"UPDATE"`, `"DELETE"`, `"COMPLETE_TRANSACTION"` |
| `entityType` | string | Yes | e.g., `"account"`, `"creditCard"`, `"creditCardPayment"`, `"fixedExpense"`, `"PendingTransaction"` |
| `entityId` | string | Yes | ID of the affected entity |
| `details` | object | Yes | JSON with action-specific data |
| `updatedAt` | ISO string | Yes | Last update timestamp (V8) |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

**Retention:** capped at 500 entries (`MAX_AUDIT_LOG_ENTRIES` in `database-clean.js`); oldest entries are pruned once the cap is exceeded.

#### `backups`
Metadata for locally-stored backup snapshots (added V6). Backup payloads themselves live in `localStorage`, keyed by these records' `id`/`timestamp`.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier |
| `reason` | string | Yes | What triggered the backup, e.g. `"pre-import"`, `"pre-clear"`, `"manual"` |
| `timestamp` | ISO string | Yes | When the backup was created |
| `version` | number | Yes | Schema version the backup was taken at |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp (V8) |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; null when active (V8) |

#### `incomeSources`
An expected paycheck (added V9). Stored as a list so a second source can be
added without a migration; the UI surfaces only one. Its schedule is inherited
from `paycheckSettings` rather than duplicated here.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier |
| `name` | string | No | Label used as the generated row's description |
| `accountId` | UUID string \| null | Yes | Which account the money lands in |
| `expectedAmount` | number | No | The user's own estimate. Never overwritten — a learned average from confirmed history takes precedence at generation time, but this stays the fallback |
| `isEnabled` | boolean | Yes | Ships false; the feature is opt-in because it writes records on the user's behalf |
| `lastGeneratedDate` | YYYY-MM-DD \| null | Yes | High-water mark, and the **sole** duplicate guard. It cannot be inferred from existing rows: a confirmed paycheck is soft-deleted and would vanish from any "dates already generated" set, causing it to be generated again |
| `createdAt` / `updatedAt` / `deletedAt` | ISO string | Yes | Standard timestamps |

#### `recurringResolutionLog`
Records every time a recurring template's current cycle is resolved — Pay
Full, Partial, or Skip (added V10). This is the source of truth for Undo and
Payment History, not a trace: it is written as a hard write inside the same
transaction as the payment/balance mutation and the cadence advance, so a
failure here aborts the whole resolution rather than leaving a silent gap.
Undoing a resolution (`dbHelpers.undoLastResolution`) reads a row's
`previous*` fields to reverse the template and expense back to their prior
state, then soft-deletes the row itself.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | UUID string | PK | Unique identifier |
| `templateId` | string | Yes | The recurring template whose cycle was resolved |
| `expenseId` | string | Yes | The materialized expense row this resolution paid, partially paid, or skipped |
| `adjustmentExpenseId` | string \| null | Yes | The Balance Due row spun off when `paidAmount` fell short of the cycle's committed amount, or null when the cycle was paid in full |
| `cycleDueDate` | string | Yes | The due date of the cycle that was resolved |
| `resolvedAt` | ISO string | Yes | When the resolution happened |
| `committedAmount` | number | No | The cycle's expected amount at resolution time |
| `paidAmount` | number | No | Amount actually paid now (0 for Skip) |
| `wasSkipped` | boolean | No | `paidAmount === 0` |
| `previousNextDueDate` | string \| null | No | The template's `nextDueDate` before this resolution advanced it; restored on Undo |
| `previousLastGenerated` | string \| null | No | The template's `lastGenerated` before this resolution; restored on Undo |
| `previousExpensePaidAmount` | number | No | The expense's `paidAmount` before this resolution; restored on Undo |
| `previousExpenseStatus` | string | No | The expense's `status` before this resolution; restored on Undo |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp |
| `deletedAt` | ISO string \| null | Yes | Soft-delete timestamp; set when the resolution is undone |

### Entity Relationships

```
accounts ──────────────┐
                       │ accountId
                       ▼
              fixedExpenses ◄──── recurringExpenseTemplates
                       │                (recurringTemplateId)
                       │ creditCardId
                       │ targetCreditCardId
                       ▼
              creditCards

pendingTransactions ──► accounts (accountId)
monthlyExpenseHistory ──► fixedExpenses (expenseId)
```

---

## 4. Application Shell & Navigation

### Entry Point

`src/main.jsx` → `ReactDOM.createRoot` with `React.StrictMode` → `<App />`.

### Boot Sequence

1. Load PIN from secure storage (`securePINStorage.getPIN()`)
2. If no PIN exists or app is locked → show `<PINLock />` (create/enter PIN)
3. Once unlocked → call `loadData()` → render main layout

### Provider Hierarchy

```
<ErrorBoundary>
  <PrivacyProvider>
    <GlobalCategoryProvider>
      <ToastContainer />
      <Sidebar />
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          {renderPage()}  // switch on currentPage, wrapped for page-transition animation
        </Suspense>
      </main>
    </GlobalCategoryProvider>
  </PrivacyProvider>
  <PerformanceDashboard />  // dev only
</ErrorBoundary>
```

### Navigation Structure

| Page ID | Display Name | Icon | Lazy Loaded |
|---|---|---|---|
| `accounts` | Accounts | Wallet | Yes |
| `pending` | Pending Transactions | Clock | Yes |
| `expenses` | Fixed Expenses | Calendar | Yes |
| `creditCards` | Credit Cards | CreditCard | Yes |
| `insights` | Insights | BarChart3 | Yes |
| `settings` | Settings | Settings | No |

Navigation is driven by `useAppStore.currentPage` (persisted to localStorage). The `Sidebar` component calls `setCurrentPage(id)` on click. There is no URL-based routing. Each page transition plays the `.page-transition` spring animation (see [Section 11](#11-design-system)).

### Sidebar Features

- **Liquid Cash card:** Shows the default account's projected balance (current balance + pending transactions)
- **Navigation items:** Icon + label, active state has glass highlight
- **Hide/Show values button:** Toggles privacy mode (Cmd+Shift+H shortcut)
- **Lock button:** Locks the app, requiring PIN re-entry
- **Responsive:** Desktop sidebar is fixed; mobile uses a hamburger menu with a spring-eased slide-in drawer and backdrop overlay

### Global Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Cmd+E / Ctrl+E | Export data as JSON |
| Cmd+Shift+H / Ctrl+Shift+H | Toggle privacy mode (hide/show values) |

---

## 5. Services Layer

### 5.1 PaymentService

**Path:** `src/services/paymentService.js`
**Pattern:** Class-based, instantiated with current accounts and credit cards

**Responsibility:** Describe and validate an expense's payment sources. It
does not move money — balance changes go through
`dbHelpers.applyExpensePaymentChangeAtomic`, which is transactional.

**Key Methods:**

| Method | Description |
|---|---|
| `getPaymentSourceDetails(expense)` | Returns display info for the payment source (name, type, balance, validity) |
| `getCreditCardPaymentDetails(expense)` | Returns both funding source and target card info for CC payment expenses |
| `validatePaymentSources(expense)` | Validates all referenced accounts/cards exist; checks for sufficient funds (warnings) |
| `validateCreditCardPaymentAmount(expense, amount)` | Enhanced validation: insufficient funds (error), overpayment (warning), zero balance (warning) |
| `generatePaymentSuggestions(creditCard, fundingAccount)` | Returns smart suggestions: minimum payment, full balance, 2x minimum, affordable max |

### 5.2 PaycheckService

**Path:** `src/services/paycheckService.js`
**Pattern:** Class-based, instantiated with paycheck settings

**Responsibility:** Calculate paycheck dates and determine expense payment statuses relative to the pay cycle, for whichever frequency the user has configured.

**Key Methods:**

| Method | Description |
|---|---|
| `calculatePaycheckDates()` | From `lastPaycheckDate` and `frequency`, calculates `nextPayDate` and `followingPayDate` via the shared pay-frequency contract (weekly = +7 days, biweekly = +14 days, monthly = +1 calendar month), advancing past today if needed |
| `calculateExpenseStatus(expense, paycheckDates)` | Returns one of: Paid, Partially Paid, Overdue, Pay This Week, Pay with Next Check, Pay with Following Check |
| `getStatusColor(status)` | Maps status to Tailwind color classes |
| `calculateSummaryTotals(expenses, paycheckDates)` | Aggregates remaining amounts by status bucket (this week, next check, overdue) |

The interval math itself (weekly/biweekly day-count advance, monthly calendar advance with day clamping) lives in `src/constants/payFrequency.js` as a single `PAY_FREQUENCIES` contract, so `PaycheckService` and the paycheck-anchor self-heal (§5.8) share one implementation instead of duplicating interval logic.

### 5.3 RecurringExpenseService

**Path:** `src/services/recurringExpenseService.js`
**Pattern:** Functional (exported async functions, no class)

**Responsibility:** Manage recurring expense templates. Each template's current cycle is materialized as a real expense lazily, one at a time — see `dbHelpers.materializeCurrentCycle`/`materializeDueTemplates` in `src/db/database-clean.js`, which own creation; this service no longer pre-generates rows in bulk. A cycle's cadence only ever advances when it's resolved (`dbHelpers.resolveCycle`), never on materialization. Exception: a template's *first* occurrence is materialized immediately at creation (via `materializeCurrentCycle`'s `allowFuture` option, used by `AddExpensePanel` and `createExpenseForCard`) when it falls within the current pay period, so it is actionable in the priority list and hero totals rather than existing only as a virtual calendar forecast.

A future cycle that hasn't materialized yet (and a past cycle that never did) can still be reasoned about without creating anything, via `dbHelpers.getVirtualLedger(templateId, rangeStart, rangeEnd)` — a thin DB-fetching wrapper around the pure `computeCycleStates` in `src/utils/virtualLedger.js` that classifies each cycle in range as `resolved`/`pending`/`virtual`. The Calendar's forecast (§6.2) and the past-month nudge's gap detection (§6.3) are both just filters over this same function's output.

**Key Functions:**

| Function | Description |
|---|---|
| `createTemplate(templateData)` | Creates a new recurring template |
| `updateTemplate(templateId, updates)` | Updates template properties |
| `deleteTemplate(templateId)` | Deletes a template |
| `getActiveTemplates()` | Returns all active templates |
| `getTemplatesDueForGeneration()` | Filters templates where `nextDueDate <= today` (currently unused by any caller — see note below) |
| `generateNextOccurrence(templateId, options)` | Thin wrapper over `dbHelpers.materializeCurrentCycle` — materializes the current cycle if it's due (or always, with `{ allowFuture: true }`) and doesn't already exist; does not advance `nextDueDate` |
| `autoGenerateDueExpenses()` | Batch-materializes all due templates via `generateNextOccurrence` (currently unused by any caller — see note below) |
| `convertFixedExpenseToRecurring(expenseId, recurringData)` | Converts a one-off expense into a recurring template |

`getTemplatesDueForGeneration` and `autoGenerateDueExpenses` predate this file's other callers being switched to `dbHelpers.materializeDueTemplates()` directly and are not currently invoked from anywhere in the app — flagged as a separate, small cleanup candidate, not touched as part of the lazy-generation change.

**Frequency Options (bill recurrence, not paycheck frequency):** monthly, quarterly (3mo), biannually (6mo), annually (12mo), custom

### 5.4 DataManager

**Path:** `src/services/dataManager.js`
**Pattern:** Singleton (`dataManager`)

**Responsibility:** Import/export, backup management, data validation.

**Key Features:**
- **Export JSON:** Complete database dump as a single JSON file with metadata
- **Export CSV:** Per-table CSV files generated via PapaParse
- **Export Credit Cards CSV:** Dedicated credit card export
- **Import JSON:** Full database replacement with V4 validation, V3→V4 migration, and automatic backup before overwrite
- **Import CSV:** Parse and import CSV data
- **Backup Manager:** Internal `BackupManager` class:
  - Stores backups in localStorage with SHA-256 checksums
  - Rotation policy: maximum 5 backups
  - Auto-backup before destructive operations (import, clear, restore)
  - Backup restoration with integrity verification
- **V3→V4 Migration:** Converts legacy `accountId` values like `"cc-1"` to `creditCardId: 1, accountId: null` (a data-shape migration, independent of the V8 UUID primary-key change)
- **Validation:** `validateExpenseDataV4()`, `validateImportedDataV4()`, `fixCommonExpenseIssues()`
- **Audit log access:** `getAuditLogs()` / `clearAuditLogs()` back the Settings Audit Log card

### 5.5 financeService

**Path:** `src/services/financeService.js`
**Pattern:** React hook (`useFinanceCalculations`)

**Responsibility:** Memoized financial calculations used across components.

**Returns:**

| Value | Description |
|---|---|
| `calculateProjectedBalance(accountId)` | Account balance + pending transactions |
| `calculateLiquidBalance` | Sum of all account balances |
| `getAccountProjectedBalances` | Map of accountId → projected balance |
| `getDefaultAccount` | The account with `isDefault: true` |
| `getDefaultAccountProjectedBalance` | Projected balance of the default account |
| `getAccountName(accountId)` | Looks up name in accounts, then credit cards |

### 5.6 categoryCache / categoryUsageCache

**Paths:** `src/services/categoryCache.js`, `src/services/categoryUsageCache.js`
**Pattern:** Singleton with TTL

- **categoryCache:** 30-second TTL, stale-while-revalidate, listener pattern for invalidation
- **categoryUsageCache:** 60-second TTL, per-category invalidation

### 5.7 Income generation

**Path:** `src/db/database-clean.js` (helpers on `dbHelpers`)

Turns an expected paycheck into a pending transaction on payday. It never
moves a balance — confirming the resulting row does, through the ordinary
`completePendingTransaction` path.

| Helper | Description |
|---|---|
| `getIncomeSources()` / `getPrimaryIncomeSource()` | Active sources; the UI surfaces only the first |
| `upsertIncomeSource(updates)` | Create or update the single source. Validates the amount through `parseMoneyInput` and that the target account exists |
| `generateDueIncome()` | Creates one pending row per payday that has passed. Returns `{ generated }` |
| `getLearnedIncomeAmount(sourceId)` | Average of the last three **confirmed** paychecks, or `null` below that. Takes precedence over the user's typed estimate at generation time; the typed figure is never overwritten |
| `sweepUnconfirmedIncome(sourceId)` | Removes predictions the user never acted on, leaving confirmed history alone |

Three things about `generateDueIncome` are deliberate and easy to undo by
accident:

- **It does not use `calculateNextPayDates`.** That function rolls forward past
  today by design, so it only ever reports *future* paydays and can never say
  one has already passed. Payday detection walks
  `advanceDueDateByFrequency` forward from `lastGeneratedDate` instead.
- **`lastGeneratedDate` is the only duplicate guard.** The recurring-expense
  generator dedupes against the set of dates it has already materialised, which
  cannot work here: a confirmed paycheck is soft-deleted and would vanish from
  that set, so it would be generated again.
- **Catch-up is capped**, so returning after a long absence doesn't flood the
  pending list with back-pay.

Runs on app load from `useAppStore.loadData` as a fire-and-forget task, beside
the recurring pre-generation, so a failure can never block startup.

### 5.8 Paycheck anchor self-heal (Safe Zone)

**Path:** `src/db/database-clean.js` (helper on `dbHelpers`)

Corrects a stale `paycheckSettings.lastPaycheckDate` without requiring the
user to do anything. Uses `getMostRecentImpliedPayDate` (`src/constants/payFrequency.js`,
[Section 9](#9-utilities)) to find the most recent payday the current anchor
implies, then compares it against the stored anchor.

| Helper | Description |
|---|---|
| `selfHealPaycheckAnchor()` | No-op (`{ advanced: false }`) when paycheck settings, `lastPaycheckDate`, or `frequency` are missing, or when the anchor is within 2 days of the implied payday (the "Safe Zone"). At 3+ days past, advances `lastPaycheckDate` via `updatePaycheckSettings`, writes a best-effort audit log entry (`SELF_HEAL_PAYCHECK_ANCHOR`), and returns `{ advanced: true, previousDate, newDate }` |

Runs from two places:
- `useAppStore.loadData()` — silent fire-and-forget, alongside the recurring-template and income-generation background tasks above; refreshes the store's `paycheckSettings` slice only if it advanced.
- `PaycheckManager.jsx`'s mount effect — awaited before loading paycheck settings into the editor; shows `notify.info(...)` only when the anchor actually moved.

This replaces the anchor-drift protection the now-removed Reset Cycle flow used to provide, with a self-correcting check instead of a manual bulk pay-cycle advance.

---

## 6. Custom Hooks

### 6.1 `useExpenseOperations`

**Path:** `src/hooks/useExpenseOperations.js`

The primary interface for all expense mutations. Wraps database operations with V4 validation, optimistic updates, payment processing, and error recovery.

**Returns:**

| Function | Description |
|---|---|
| `addExpense(data)` / `addExpenseV4(data)` | Create new expense with V4 validation |
| `updateExpense(id, updates)` / `updateExpenseV4(id, updates)` | Update with optimistic UI, V4 validation, self-healing for legacy data |
| `deleteExpense(id)` | Delete with optimistic removal |
| `duplicateExpense(original, overrides)` | Clone expense with reset payment status |
| `markAsPaid(id)` | Set `paidAmount` = `amount`, trigger balance updates — for a plain one-off expense (including a Balance Due); a recurring-template expense goes through `resolveCycle` instead |
| `resolveCycle(id, { paidAmount })` | Pay Full / Partial / Skip a recurring template's current cycle via `dbHelpers.resolveCycle` — advances the template's cadence immediately and may spin off a Balance Due. Used by `ResolveExpenseModal`, the unified "mark paid" UI |
| `getPaymentSourceInfo(expense)` | Display info for expense's funding source |
| `getCreditCardPaymentInfo(expense)` | Two-field display info for CC payment expenses |
| `validateExpensePaymentSources(expense)` | Validate referenced entities exist |
| `validateCreditCardPaymentAmount(expense, amount)` | Enhanced CC payment validation |
| `generatePaymentSuggestions(expense)` | Smart payment amount suggestions |

**Self-Healing:** When updating a Credit Card Payment expense, the hook auto-infers missing `targetCreditCardId` (by name matching) and missing `accountId` (falls back to default account).

### 6.2 `usePaycheckCalculations`

**Path:** `src/hooks/usePaycheckCalculations.js`

Memoized wrapper around `PaycheckService`. Only recalculates when `paycheckSettings` changes.

**Returns:** `{ paycheckService, paycheckDates }`

### 6.3 `usePayCycleNudge`

**Path:** `src/hooks/usePayCycleNudge.js`

Wraps the pure `getPayCycleNudge()` logic (`src/utils/payCycleNudgeLogic.js`) as a memoized hook for the Fixed Expenses Month view. Re-derives the active nudge (if any) from `fixedExpenses`, the viewed month, paycheck dates, and session/monthly dismissal state (`src/utils/nudgeDismissal.js`, backed by `sessionStorage`).

Also runs a separate async effect, keyed on `currentMonth`, that fetches last month's `dbHelpers.getVirtualLedger` per active template and keeps only its `virtual` cycles — cadences a template implies but that never became a real row (e.g. its `startDate` predates the first cycle that ever materialized). Fed into `getPayCycleNudge` as `virtualGapCycles`, merged into the `past_month` branch's unpaid count, so the nudge can catch a gap a real-row-only scan structurally cannot.

**Returns:** `{ nudge, dismiss }` — `nudge` is `null` or one of the `past_month` / `catch_up` shapes described in the Fixed Expenses view; `dismiss(dismissKey, dontShowAgainThisMonth)` records the dismissal and fires the optional `onNudgeDismissed` callback.

### 6.4 `usePersistedState`

**Path:** `src/hooks/usePersistedState.js`

Persists UI state to both localStorage and IndexedDB (userPreferences table).

### 6.5 `usePerformanceMonitor`

**Path:** `src/hooks/usePerformanceMonitor.js`

Dev-only hook that tracks render counts and timing for performance debugging.

---

## 7. Context Providers

### 7.1 PrivacyContext

**Path:** `src/contexts/PrivacyContext.jsx`

**Purpose:** Toggle visibility of sensitive financial values throughout the app.

**API:**
- `isHidden: boolean` — whether values are currently hidden
- `setIsHidden(bool)` — set visibility
- `toggleHidden()` — toggle visibility

**Keyboard Shortcut:** Cmd+Shift+H / Ctrl+Shift+H (does not trigger when input is focused)

**Consumer:** `<PrivacyWrapper>` component wraps any monetary display. When `isHidden` is true, it replaces content with `••••••`. Any component that renders one must have a `PrivacyProvider` ancestor — it throws if used outside one, which is guaranteed in the real app tree ([Section 4](#4-application-shell--navigation)) but is a common gap to catch in tests.

### 7.2 GlobalCategoryContext

**Path:** `src/contexts/GlobalCategoryContext.jsx`

**Purpose:** Centralized category CRUD with cache invalidation, accessible from any component.

**API:**

| Method | Description |
|---|---|
| `getCategories()` | Fetch categories (cached, 30s TTL) |
| `addCategory(data)` | Add category + invalidate cache + toast |
| `updateCategory(id, updates)` | Update + invalidate cache + toast |
| `deleteCategory(id)` | Delete + invalidate cache + toast |
| `reassignCategoryItems(oldName, newName, items)` | Bulk reassign expenses from one category to another |
| `getCategoryUsageStats(name)` | Get usage count for a category |
| `refreshCategories()` | Force cache invalidation and re-fetch |
| `invalidateCache()` | Invalidate without re-fetch (used during import) |

---

## 8. Component Inventory

### Layout & Shell

| Component | Path | Description |
|---|---|---|
| `App` | `src/App.jsx` | Root component: boot sequence, provider hierarchy, page router |
| `Sidebar` | `src/components/Sidebar.jsx` | Navigation, liquid cash card, privacy/lock buttons, responsive mobile drawer |
| `ErrorBoundary` | `src/components/ErrorBoundary.jsx` | Top-level React error boundary |
| `PINLock` | `src/components/PINLock.jsx` | PIN entry/creation screen |
| `LoadingSpinner` | `src/components/LoadingSpinner.jsx` | Loading indicator |
| `PerformanceDashboard` | `src/components/PerformanceDashboard.jsx` | Dev-only performance metrics overlay |

### Calendar System

| Component | Path | Description |
|---|---|---|
| `Calendar` | `src/components/Calendar/Calendar.jsx` | Main calendar container with month navigation. Takes a `virtualExpenses` prop (built by `FixedExpenses.jsx` via `dbHelpers.getVirtualLedger` per active template for the viewed month) and merges it into each day's real `monthExpenses`, so a not-yet-due cycle shows as a forecast entry |
| `CalendarGrid` | `src/components/Calendar/CalendarGrid.jsx` | 7-column grid layout |
| `CalendarDay` | `src/components/Calendar/CalendarDay.jsx` | Individual day cell with expense badges |
| `CalendarHeader` | `src/components/Calendar/CalendarHeader.jsx` | Day-of-week headers |
| `ExpenseBadge` | `src/components/Calendar/ExpenseBadge.jsx` | Expense indicator on calendar days (name/amount split); click opens `ResolveExpenseModal`. A virtual (forecast) entry — `expense.isVirtual`— renders dashed/muted via `expense-badge--virtual`, shows an estimated `~$` amount, and isn't clickable, since nothing real exists yet to resolve |
| `PayCycleNudgeBanner` | `src/components/Calendar/PayCycleNudgeBanner.jsx` | Renders the active pay-cycle nudge (see [Section 6.3](#63-usepaycyclenudge)) above the calendar |
| `PayCycleNudgeToast` | `src/components/Calendar/PayCycleNudgeToast.jsx` | Optional toast presentation of the same nudge |

### Fixed Expenses Priority List

Replaced the categorized-by-type table (and the donut chart, category
summary card, and upcoming-payments widget that sat alongside it) with a
single list sectioned Overdue → This week → Later, so the page answers "what
needs my attention, in order" directly instead of requiring the reader to
reconcile several same-weight widgets that each showed part of the answer.
See `src/services/paycheckService.js` for `getPaymentProgress()`/
`getTimingBucket()`, the two functions this reads directly rather than
re-deriving urgency itself.

| Component | Path | Description |
|---|---|---|
| `FixedExpensesHero` | `src/components/FixedExpensesHero.jsx` | The page's one hero number: what's due this week, with an overdue sub-line and a next-check context line |
| `PriorityExpenseList` | `src/components/PriorityExpenseList.jsx` | Buckets every unpaid/partially-paid expense into Overdue/This week/Later via `getPaymentProgress()`/`getTimingBucket()` |
| `PriorityExpenseRow` | `src/components/PriorityExpenseRow.jsx` | One list row: name, payment source, remaining amount, relative due date, Pay Now |
| `OneOffExpensesView` | `src/components/OneOffExpensesView.jsx` | Future one-off expenses list |

### Expense Modals & Panels

| Component | Path | Description |
|---|---|---|
| `AddExpensePanel` | `src/components/AddExpensePanel.jsx` | Slide-out panel for adding expenses |
| `ResolveExpenseModal` | `src/components/ResolveExpenseModal.jsx` | Unified Pay Full / Partial / Skip confirmation — replaces the old MarkAsPaidModal and Calendar/QuickActions. Branches internally: a recurring-template expense resolves via `resolveCycle` (Skip available, Partial hidden for a variable-amount template); a one-off (including a Balance Due) resolves via `updateExpenseV4`, Full/Partial only. Used by the priority list's Pay Now action and by clicking a calendar day's expense badge |
| `MissingExpensesModal` | `src/components/MissingExpensesModal.jsx` | Warns when a credit card has no linked payment expense; offers to create it |
| `RecurringExpenseModal` | `src/components/RecurringExpenseModal.jsx` | Convert expense to recurring template |
| `DuplicateExpenseModal` | `src/components/DuplicateExpenseModal.jsx` | Duplicate an expense with modifications |
| `RecurringTemplatesManager` | `src/components/RecurringTemplatesManager.jsx` | Templates CRUD, plus an Undo action per template (reverses its single most recent resolution via `dbHelpers.undoLastResolution`, blocked once the Balance Due it created has a payment on it) |

### Credit Card Components

| Component | Path | Description |
|---|---|---|
| `EnhancedCreditCard` | `src/components/EnhancedCreditCard.jsx` | Visual credit card component with stats; exposes a "change funding account" action alongside edit/delete |
| `CreditCardPaymentInput` | `src/components/CreditCardPaymentInput.jsx` | Specialized input for CC payment amounts |
| `ChooseFundingAccountModal` | `src/components/ChooseFundingAccountModal.jsx` | Picks which account funds a card's payment expense — used both when auto-creating a new card's payment (with a "use default" shortcut) and when changing an existing card's funding source |
| `CreateAccountModal` | `src/components/CreateAccountModal.jsx` | Inline "create an account" fallback inside the credit-card funding flow when no accounts exist yet |
| `CreditCardDeletionModal` | `src/components/CreditCardDeletionModal.jsx` | Enhanced deletion with expense reassignment |

### Category System

| Component | Path | Description |
|---|---|---|
| `CategoryManager/index` | `src/components/CategoryManager/index.jsx` | Main category management interface |
| `CategoryGrid` | `src/components/CategoryManager/CategoryGrid.jsx` | Grid layout of category cards |
| `CategoryCard` | `src/components/CategoryManager/CategoryCard.jsx` | Individual category display |
| `CategoryForm` | `src/components/CategoryManager/CategoryForm.jsx` | Add/edit category form |
| `CategoryContext` | `src/components/CategoryManager/CategoryContext.jsx` | Local context for CategoryManager |
| `ColorPicker` | `src/components/CategoryManager/ColorPicker.jsx` | Named swatch picker (portal-based popover) used by both single-category and bulk color editing |
| `BulkColorModal` | `src/components/CategoryManager/BulkColorModal.jsx` | Applies one color to every selected category |
| `BulkIconModal` | `src/components/CategoryManager/BulkIconModal.jsx` | Searchable, grouped emoji picker; applies one icon to every selected category |
| `CategoryRenameModal` | `src/components/CategoryManager/CategoryRenameModal.jsx` | Rename category modal |
| `CategoryManagerErrorBoundary` | `src/components/CategoryManager/CategoryManagerErrorBoundary.jsx` | Isolates Category Manager crashes from the rest of Settings |

### Summary & Insight Cards

| Component | Path | Description |
|---|---|---|
| `PayDateCountdownCard` | `src/components/PayDateCountdownCard.jsx` | Countdown to next paycheck |
| `ProjectedBalanceCard` | `src/components/ProjectedBalanceCard.jsx` | Discretionary balance after bills |
| `BudgetVsActualDashboard` | `src/components/BudgetVsActualDashboard.jsx` | Budget vs. actual comparison |
| `MonthlyTrends` | `src/components/MonthlyTrends.jsx` | 12-month trend visualization |
| `DebtPayoffCalculator` | `src/components/DebtPayoffCalculator.jsx` | Snowball/Avalanche calculator |
| `OverpaymentAnalysis` | `src/components/OverpaymentAnalysis.jsx` | Where spending exceeds budget |
| `CreditCardDebtTable` | `src/components/CreditCardDebtTable.jsx` | Credit card debt overview table |

### Empty States & Illustrations

| Component | Path | Description |
|---|---|---|
| `EmptyState` | `src/components/EmptyState.jsx` | Shared empty-state layout: illustration + title + optional subtitle + optional CTA button |
| `AccountsEmptyIllustration` | `src/components/illustrations/AccountsEmptyIllustration.jsx` | SVG illustration for the Accounts empty state |
| `CreditCardsEmptyIllustration` | `src/components/illustrations/CreditCardsEmptyIllustration.jsx` | SVG illustration for the Credit Cards empty state |
| `FixedExpensesEmptyIllustration` | `src/components/illustrations/FixedExpensesEmptyIllustration.jsx` | SVG illustration for the Fixed Expenses empty state |
| `PendingEmptyIllustration` | `src/components/illustrations/PendingEmptyIllustration.jsx` | SVG illustration for the Pending Transactions empty state |
| `DebtPayoffEmptyIllustration` | `src/components/illustrations/DebtPayoffEmptyIllustration.jsx` | SVG illustration for the Debt Payoff Calculator empty state |
| `MonthlyTrendsEmptyIllustration` | `src/components/illustrations/MonthlyTrendsEmptyIllustration.jsx` | SVG illustration for the Monthly Trends empty state |
| `OverpaymentEmptyIllustration` | `src/components/illustrations/OverpaymentEmptyIllustration.jsx` | SVG illustration for the Overpayment Analysis empty state |

### Shared UI Components

| Component | Path | Description |
|---|---|---|
| `InlineEdit` | `src/components/InlineEdit.jsx` | Click-to-edit text/number/date/select |
| `AccountRow` | `src/components/AccountRow.jsx` | One row in the Accounts page's checking/savings list: name, a "Default" badge, current/projected balance, set-default/delete actions |
| `PendingTransactionRow` | `src/components/PendingTransactionRow.jsx` | One row in the Pending Transactions list: description, an Account/Category/Date meta line, amount/projected balance, complete/delete actions |
| `CollapsibleCard` | `src/components/CollapsibleCard.jsx` | Expandable/collapsible card |
| `CollapsibleCardGroup` | `src/components/CollapsibleCardGroup.jsx` | Accordion group (exclusive mode) |
| `IconSelector` | `src/components/IconSelector.jsx` | Emoji/icon picker |
| `StatusBadge` | `src/components/StatusBadge.jsx` | Colored status pill |
| `AccountSelector` | `src/components/AccountSelector.jsx` | Account dropdown with smart filtering |
| `AccountSelectorErrorBoundary` | `src/components/AccountSelectorErrorBoundary.jsx` | Isolates `AccountSelector` crashes with a retry/reset UI |
| `AccountValidationAlert` | `src/components/AccountValidationAlert.jsx` | Flags fixed expenses pointing at a deleted account, with a link to fix them |
| `PaymentSourceSelector` | `src/components/PaymentSourceSelector.jsx` | Combined account/credit card selector |
| `PaycheckManager` | `src/components/PaycheckManager.jsx` | Paycheck settings editor (date + frequency); self-heals a stale pay-cycle anchor on mount and toasts if it advanced (§5.8) |
| `AppearanceCard` | `src/pages/Settings/AppearanceCard.jsx` | Glass transparency, ambient strength, and the ambient palette. Each control writes one CSS variable, so it re-tints the whole app live — including the card being adjusted |
| `PrivacyWrapper` | `src/components/PrivacyWrapper.jsx` | Conditionally hides content in privacy mode |

---

## 9. Utilities

### `dateUtils.js`

**Class:** `DateUtils` (static methods)

All dates in Digibook are stored and compared as `YYYY-MM-DD` strings, parsed in local timezone (never UTC).

| Method | Description |
|---|---|
| `parseDate(str)` | YYYY-MM-DD → `Date` object in local time |
| `formatDate(date)` | `Date` → YYYY-MM-DD string |
| `formatDisplayDate(str)` | → "Wednesday, Aug 6, 2025" |
| `formatShortDate(str)` | → "Aug 6, 2025" |
| `addDays(str, n)` | Add N days to a date string |
| `daysBetween(start, end)` | Days between two date strings |
| `today()` | Today as YYYY-MM-DD |
| `isPast(str)` | Is the date before today? |
| `isToday(str)` | Is the date today? |
| `isValidDate(str)` | Validates YYYY-MM-DD format and round-trips correctly |

### `payFrequency.js`

**Path:** `src/constants/payFrequency.js`

The single source of truth for pay-frequency interval math, shared by `PaycheckService` and the paycheck-anchor self-heal ([§5.8](#58-paycheck-anchor-self-heal-safe-zone)) so the logic isn't duplicated.

| Export | Description |
|---|---|
| `PAY_FREQUENCIES` | `{ weekly, biweekly, monthly }`, each with an `intervalDays` (or `null` for calendar-month), a display `label`, and an `advanceDueDate(dateString)` function |
| `DEFAULT_PAY_FREQUENCY` | `'biweekly'` |
| `VALID_PAY_FREQUENCIES` | `Object.keys(PAY_FREQUENCIES)` |
| `advanceDueDateByFrequency(dateString, frequency)` | Advances a single due date by one pay period for the given frequency |
| `calculateNextPayDates(lastPaycheckDate, frequency)` | Pure function returning `{ nextPayDate, followingPayDate, daysUntilNextPay, daysUntilFollowingPay }`, always rolled forward past today |
| `getMostRecentImpliedPayDate(lastPaycheckDate, frequency, referenceDate)` | Pure function that walks the anchor forward one pay period at a time (reusing each frequency's `advanceDueDate` step) to find the most recent implied payday on or before `referenceDate` (defaults to today); powers the paycheck-anchor self-heal ([§5.8](#58-paycheck-anchor-self-heal-safe-zone)) |

### `payCycleNudgeLogic.js` / `payCycleNudgeConfig.js` / `payCycleNudgeTypes.js`

**Paths:** `src/utils/payCycleNudgeLogic.js`, `src/utils/payCycleNudgeConfig.js`, `src/constants/payCycleNudgeTypes.js`

Pure logic behind the Pay Cycle Nudge feature (the Fixed Expenses view):

| Export | Description |
|---|---|
| `getPayCycleNudge(options)` | Priority-ordered decision function: past_month → catch_up, or `{ nudge: null }` |
| `getMonthKey` / `getLastMonthKey` | `YYYY-MM` helpers for month comparisons |
| `getExpensesInMonth(expenses, monthKey)` | Filters expenses due within a given month |
| `isUnpaidOrPartial(expense)` | `paidAmount < amount` |
| `isNearEndOfMonth(today, currentMonth, config)` | True within `config.daysNearEndOfMonth` (default 7) of month-end |
| `PAY_CYCLE_NUDGE_CONFIG` | Tunable thresholds (e.g. `daysNearEndOfMonth`) |
| `NUDGE_TYPES`, `NUDGE_DEFAULT_COPY` | Registry of nudge types and their default title/message/action copy |

### `nudgeDismissal.js`

**Path:** `src/utils/nudgeDismissal.js`

Tracks which nudges the user has dismissed, backed by `sessionStorage` (session-only) with an optional "don't show again this month" tier. Read by `usePayCycleNudge`.

### `validation.js`

Input sanitization and validation for all user-entered data.

| Function | Description |
|---|---|
| `sanitizeString(str)` | Trim and limit length |
| `validateAccountName(name)` | Non-empty, max length |
| `validateAmount(amount)` | Positive number |
| `validatePIN(pin)` | 4-digit numeric |
| `validateDescription(desc)` | Non-empty |
| `validateDate(date)` | Valid YYYY-MM-DD |
| `validateCategoryName(name)` | Non-empty, max length |
| `validateCreditCard(data)` | All required fields present and valid |
| `parseMoneyInput(raw, opts)` | **The money-parsing primitive.** Returns `{ok: true, value}` or `{ok: false, reason}` — never a bare number — so a caller has nothing to use unless parsing succeeded. Blank input is an error unless `allowEmpty` is passed. Stricter than `parseFloat`, which truncates `'12abc'` to `12`. |
| `moneyInputErrorMessage(reason)` | User-facing text for a `parseMoneyInput` failure |
| `MAX_MONEY_VALUE` | Upper bound (`1e12`) — billions are plausible, trillions mean something went wrong |

> **Rule:** every place that turns untrusted input into a money value must go
> through `parseMoneyInput`. The `parseFloat(x) || fallback` idiom is banned by
> an ESLint rule (see [Developer Tooling](#17-developer-tooling--code-quality))
> because it collapses "typed 0", "typed nothing" and "typed garbage" into one
> indistinguishable value, which silently zeroed a real account balance.
| `validateForm(fields)` | Batch validate multiple fields |
| `sanitizeObject(obj)` | Deep sanitize all string properties |

### `expenseValidation.js`

V4-specific expense validation.

| Function | Description |
|---|---|
| `validatePaymentSource(expense)` | Ensures exactly one of accountId/creditCardId is set |
| `validateCreditCardPayment(expense)` | Ensures CC payments have accountId + targetCreditCardId |
| `validatePaymentSourceIds(expense)` | Checks the referenced account/card ids are well-formed |
| `validateExpense(expense, options)` | Runs the applicable checks for an expense's shape |
| `isCreditCardPayment(expense)` | Checks if category is "Credit Card Payment" |
| `sanitizeExpenseData(expense)` | Normalises a **whole** expense: nulls the unused payment source, and nulls `targetCreditCardId` when the category is not a card payment |

> **`sanitizeExpenseData` must never be given a partial patch.** Its rules
> reason about a complete expense, so running it over `{paidAmount, status}` —
> where `category` is simply absent — fires the "not a card payment" rule and
> nulls `targetCreditCardId`, silently unlinking a paid bill from the card it
> paid and making that payment uncorrectable. Sanitize the merged record, then
> persist only the touched keys via `pickSanitizedUpdates`
> (`src/db/database-clean.js`).

### `accountUtils.js`

Account-related display and lookup helpers.

| Function | Description |
|---|---|
| `formatCurrency(amount)` | Formats number as `$1,234.56` |
| `createAccountMapping(accounts)` | Creates id→account Map |
| `findSelectedAccount(accounts, id)` | Find account by ID |
| `validateAccount(data)` | Validate account object |

### `categoryUtils.js`

| Function | Description |
|---|---|
| `createCategoryMap(categories)` | Creates a `Map<name, category>` for O(1) category lookups by name |

### `expenseUtils.js`

| Function | Description |
|---|---|
| `findPaymentSource(expense, accounts, creditCards)` | Resolves an expense's funding source under the V4 dual foreign key format |

### `creditCardUtils.js`

Credit card calculation helpers.

| Function | Description |
|---|---|
| `formatCreditCardBalance(balance)` | Display format |
| `calculateAvailableCredit(card)` | `creditLimit - balance` |
| `getDefaultMinimumPaymentAmount(card)` | Returns `minimumPayment` or 2% of balance |
| `getMinimumPaymentStatus(card)` | Status based on how payment compares to minimum |
| `calculateInterestSavings(card, extraPayment)` | Calculate interest saved by paying extra |

### `crypto.js`

Security utilities.

| Object | Description |
|---|---|
| `securePINStorage` | PIN hashing, storage, and verification using browser crypto API |
| `dataIntegrity` | Validate and sanitize account, expense, transaction, category data |
| `secureDataHandling` | Encrypt/decrypt data exports |

### `generateId.js`

| Function | Description |
|---|---|
| `generateId()` | `crypto.randomUUID()` — the primary-key generator used by every `dbHelpers` create path since the V8 UUID migration |

### `exportUtils.js`

| Function | Description |
|---|---|
| `exportJSONData(progressCallback)` | Full database export as downloadable JSON file |

### `appearance.js`

**Path:** `src/utils/appearance.js`

Glass transparency, ambient strength and ambient colours. Every reader is
synchronous, total, and has a default — nothing here throws, because it runs
before first paint.

| Function | Description |
|---|---|
| `getStoredTint()` / `setStoredTint(v)` | Glass transparency, 0–1, written to `--glass-tint` |
| `getStoredAmbient()` / `setStoredAmbient(v)` | Ambient ground strength, 0–1, written to `--ambient-strength` |
| `getStoredAmbientColors()` / `setStoredAmbientColors(c)` | The three hex stops, written to CSS as `R, G, B` triples |
| `matchPreset(colors)` | The matching preset id, or `null` for a custom palette |
| `getAppearanceSnapshot()` | The object the export carries |
| `applyAppearanceSnapshot(s)` | Applies a snapshot from a backup; each field validated independently |
| `applyStoredTint()` / `applyStoredAmbient()` / `applyStoredAmbientColors()` | Called once at startup from `src/main.jsx` |
| `AMBIENT_PRESETS` | Six named palettes; `AMBIENT_PRESETS[0]` is the default |

Two guards worth knowing, both learned the hard way:

- **A missing key must not read as 0.** `Number(null)` and `Number('')` are
  both `0`, which is finite — a naive numeric guard accepts an absent
  preference as a real value of zero, and a first run renders every panel
  fully transparent. `normalize()` rejects null and empty string explicitly.
- **A partial palette is rejected, not merged.** Blending two chosen colours
  with one from storage produces a combination the user never saw.

### `logger.js`

Structured logging with levels: `debug`, `info`, `warn`, `error`, `success`, `db`, `component`.

### `persistentStorage.js`

`requestPersistentStorage()` — asks the browser not to evict this origin's
storage, called once at startup from `src/main.jsx` and deliberately not
awaited.

Every financial record lives in IndexedDB on the device, and browsers treat
ordinary site storage as disposable: iOS Safari clears it after roughly seven
days without a visit for any site not added to the home screen. For this app
that is silent data loss rather than a cache miss.

It improves matters where granted and guarantees nothing — Chrome and Firefox
decide from engagement signals, and Safari rarely grants it outside an
installed web app. **Adding the app to the home screen remains the reliable fix
on iOS**, and the refusal path logs that advice.

### `errorHandler.js`

| Object | Description |
|---|---|
| `ErrorHandler` | Categorize errors by type and severity, generate user-friendly messages, suggest recovery actions |
| `createErrorBoundaryHandler` | Factory for React Error Boundary handlers |
| `createAsyncHandler` | Wraps async functions with error handling |
| `createValidationHandler` | Validation-specific error handler |

### `notifications.jsx`

| Function | Description |
|---|---|
| `notify.success(msg)` | Green toast |
| `notify.error(msg)` | Red toast |
| `notify.info(msg)` | Blue toast |
| `notify.warning(msg)` | Yellow toast |
| `showConfirmation(msg)` | Confirmation dialog |

---

## 10. State Management

### Primary Store: Zustand (`useAppStore`)

**Path:** `src/stores/useAppStore.js`

#### Data State (loaded from IndexedDB)

| Slice | Type | Source |
|---|---|---|
| `accounts` | `Array<Account>` | `dbHelpers.getAccounts()` |
| `creditCards` | `Array<CreditCard>` | `dbHelpers.getCreditCards()` |
| `pendingTransactions` | `Array<Transaction>` | `dbHelpers.getPendingTransactions()` |
| `fixedExpenses` | `Array<Expense>` | `dbHelpers.getFixedExpenses()` |
| `categories` | `Array<Category>` | `dbHelpers.getCategories()` |
| `paycheckSettings` | `Object \| null` | `dbHelpers.getPaycheckSettings()` |
| `incomeSources` | `Array` | `dbHelpers.getIncomeSources()` |
| `defaultAccount` | `Object \| null` | `dbHelpers.getDefaultAccount()` |

#### UI State (persisted to localStorage)

| Slice | Type | Default | Persisted |
|---|---|---|---|
| `currentPage` | `string` | `'accounts'` | Yes |
| `isPanelOpen` | `boolean` | `false` | Yes |
| `isLoading` | `boolean` | `false` | No |
| `error` | `string \| null` | `null` | No |
| `templatesLastUpdated` | `number \| null` | `null` | No |

#### Actions

**Data loading:**
- `loadData()` — Full initialization (DB init, migration, parallel fetch all tables)
- `reloadAccounts()` — Refresh accounts + credit cards + default account
- `reloadExpenses()` — Refresh expenses + categories
- `reloadTransactions()` — Refresh pending transactions
- `reloadPaycheckSettings()` — Refresh paycheck settings
- `reloadCategories()` — Refresh categories
- `reloadIncomeSources()` — Refresh income sources

**Optimistic mutations:**
- `updateExpense(id, updates)`, `addExpense(expense)`, `removeExpense(id)`
- `updateAccount(id, updates)`, `updateCreditCard(id, updates)`
- `addTransaction(txn)`, `removeTransaction(id)`

**UI actions:**
- `setCurrentPage(page)`, `togglePanel()`, `setPanelOpen(bool)`, `clearError()`

**Computed values:**
- `getAllAccountIds()` — Set of all account + credit card IDs
- `findAccountById(id)` — Searches both accounts and credit cards
- `getExpensesByCategory()` — Group expenses by category
- `getTotalRemaining()` — Sum of unpaid expense amounts

#### Selector Hooks

Every state slice and action has a dedicated selector hook (e.g., `useAccounts()`, `useLoadData()`, `useSetCurrentPage()`) to prevent unnecessary re-renders.

#### Persistence Strategy

Only `currentPage` and `isPanelOpen` are persisted to localStorage via Zustand's `persist` middleware. All financial data is loaded fresh from IndexedDB on every app boot. Pay-cycle-nudge dismissal state is tracked separately in `sessionStorage` (see [`nudgeDismissal.js`](#nudgedismissaljs)), not in this store.

---

## 11. Design System

### Liquid Glass

Digibook uses a custom "Liquid Glass" design system inspired by Apple's iOS glassmorphism aesthetic, implemented as a layered token system: a small Tailwind theme extension for the original glass utilities, plus a larger CSS custom-property system in `src/index.css` that most components actually draw from — glass surfaces, elevation, and animation are all driven by CSS variables rather than one-off values.

The system was refit to iOS 27's revision of Liquid Glass, which moved depth
from shadow spread to the edge of a surface. The three changes that matter
when reading the tokens below: elevation is **border-first**, surfaces take a
**flat fill** rather than a 135° gradient, and both answer to a user-facing
transparency control.

**Dark only.** `darkMode: 'class'` in `tailwind.config.js` with nothing adding
a `.dark` class, so every `dark:` variant is inert. Tailwind's unset default
is `media`, which wired those variants to the reader's OS preference and
rendered the app near-white-on-near-white on a device set to Light. Paint dark
values directly; do not reintroduce a `dark:` variant.

#### Palette Aliasing — read before adding a colour

The Tailwind colour words do not mean their names. `blue-*` resolves to ochre,
`gray`/`slate` to warm neutrals, `amber`/`orange` to yellow. They are aliases
kept so the ~640 existing colour utilities spread across ~58 component files
survived the refit without a sweeping cosmetic diff — the shape of change that
once put every modal behind its own backdrop for five months. **New markup
should use the semantic names** — `accent`, `ink`, `ink-soft`, `surface`,
`rule`.

Roles are what keep the UI readable, and they do not overlap:

| Role | Colour | Rule |
|---|---|---|
| Interactive | ochre `#e0915c` | Buttons, active nav, focus. **Never a status.** |
| Succeeded | green `#10b981` | Paid, on track |
| Caution | yellow `#eab308` | All warm alerts live here |
| Wrong | red `#ef4444` | Error, overdue, destructive |

The warm alert hues were collapsed into one yellow deliberately: an ochre
accent beside an orange warning made "you can press this" and "this bill is
late" the same colour.

Raw `rgba()` written in a stylesheet or a JSX inline style bypasses this
aliasing entirely, which is where the refit found its stragglers: the
calendar's stylesheet, the empty-state SVGs, chart fills, and a primary-button
gradient left running ochre to blue. Grep for the literal channel values, not
the class names, when a colour looks wrong.

#### Typography

Self-hosted via `@fontsource`, imported in `src/main.jsx`. Not linked from
Google: the app is local-first behind a service worker, where a third-party
webfont renders wrong offline and reveals usage on every cold load. Latin
subsets and used weights only — the unscoped entrypoints pull Cyrillic, Greek
and Vietnamese for 31 files and 992KB.

| Role | Face | Notes |
|---|---|---|
| Display | Bricolage Grotesque Variable | Headings. Figures are extremely proportional (a 2.2× width swing), so the heading rule sets `tabular-nums` |
| Body | IBM Plex Sans | Ships tabular figures **by default**, which is why money columns already align |
| Mono | IBM Plex Mono | Figures and labels where a mono texture is wanted |

#### Tailwind Theme Extensions

```javascript
colors: {
  glass: {
    50:  'rgba(255, 255, 255, 0.05)',
    100: 'rgba(255, 255, 255, 0.1)',
    200: 'rgba(255, 255, 255, 0.15)',
    300: 'rgba(255, 255, 255, 0.2)',
    400: 'rgba(255, 255, 255, 0.25)',
    500: 'rgba(255, 255, 255, 0.3)',
  },
}
backdropBlur: { glass: '14px' }
borderRadius: { glass: '24px' }
boxShadow: {
  glass:       '0 4px 20px rgba(0, 0, 0, 0.25)',
  'glass-light': '0 4px 20px rgba(255, 255, 255, 0.1)',
}
fontFamily: { display: [...], sans: [...], mono: [...] }
```

The `boxShadow` entries above are legacy: elevation now comes from the
`--glass-elevation-*` custom properties, not these.

#### CSS Custom Property Tokens (`src/index.css`)

| Token group | Examples | Purpose |
|---|---|---|
| Glass blur | `--glass-blur-light` (8px), `--glass-blur-medium` (14px), `--glass-blur-heavy` (20px) | Backdrop blur strength per surface |
| Glass opacity | `--glass-opacity-subtle` (0.03) through `--glass-opacity-heavy` (0.2) | Surface fill opacity scale |
| Glass border | `--glass-border-opacity`, `-hover`, `-focus` | Border opacity by interaction state |
| Elevation | `--glass-elevation-0` through `--glass-elevation-4` | **Border-first, not shadow spread.** Each level is a dark hairline just outside the surface (`--glass-edge-dark`), a short contact shadow, and a bright specular line just inside (`--glass-specular`). Levels separate by edge contrast and contact distance. The old presets were ambient shadows up to 64px, which vanish over busy or light content and made panels read as a sheen rather than a surface |
| Glass fill | `--glass-fill`, `--glass-tint` | Flat surface alpha, not a gradient. `--glass-tint` (0–1) is the user-facing transparency control; `--glass-fill` is the alpha it computes to, exposed so variants can sit further back — `.glass-table` takes roughly half, because tint that reads as glass on a 300px card is a wash across a 700px table |
| Ambient ground | `--ambient-top`, `--ambient-middle`, `--ambient-bottom`, `--ambient-strength` | Three colours (bare `R, G, B` triples so each gradient stop can take its own alpha) driving the five radial gradients in `.app-ambient`. Without something behind it, `backdrop-filter` blurs flat near-black and the glass is invisible |
| Safe areas | `.safe-area-padded`, `.app-shell` | `env(safe-area-inset-*)` padding on the scroll container, and `100dvh` rather than `100vh` — on iOS Safari `100vh` is the viewport with the toolbar collapsed, so a full-height shell sits partly behind it |
| Duration | `--duration-fast` (150ms), `--duration-snappy` (200ms), `--duration-normal` (300ms), `--duration-slow` (500ms) | Standard animation/transition durations |
| Easing | `--easing-standard`, `--easing-decelerate`, `--easing-accelerate`, `--easing-bounce` / `--easing-spring` (same curve, `cubic-bezier(0.34, 1.56, 0.64, 1)`) | Standard easing curves; the spring curve is used for anything that should feel "alive" (page transitions, modal entrances, the sidebar drawer) |

#### CSS Component Classes (defined in `index.css`)

| Class | Usage |
|---|---|
| `.glass-surface` | Base glass treatment that other glass classes build on: saturated backdrop blur, flat tinted fill driven by `--glass-fill`, a full 1px border, and border-first elevation. The border carries the depth here — it is not decoration |
| `.glass-card` | Content cards with backdrop blur |
| `.glass-panel` | Larger content panels |
| `.glass-sidebar` | Sidebar with fixed glass styling |
| `.glass-button` | Standard button with glass effect; `:active` scales to 0.97 on the fast duration for tactile press feedback |
| `.glass-button--primary` | Primary action button |
| `.glass-button--danger` | Destructive action button |
| `.glass-button--secondary` | Secondary action button |
| `.glass-button--filter` | Filter/sort toggle button |
| `.glass-input` | Form inputs with glass styling |
| `.glass-table` | Table with glass styling |
| `.glass-error` | Error state styling |
| `.glass-loading` | Loading state overlay |
| `.glass-focus` | Focus ring for accessibility |
| `.balance-display` | Large monetary value display |
| `.text-primary` / `.text-secondary` / `.text-muted` | Text color hierarchy |
| `.empty-state` / `.empty-state-icon` | Empty state container and icon slot (see also the dedicated `EmptyState` component, [Section 8](#8-component-inventory)) |

#### Animations

| Animation class | Keyframe / effect | Used for |
|---|---|---|
| `.page-transition` | `slideInUp`, snappy duration, spring easing | Route/page changes in the main content area |
| `.modal-panel-enter` | `slideIn`, 220ms, spring easing | Modal and slide-out panel entrances |
| `.glass-card-enter` | `fadeIn`, normal duration, staggered by up to 180ms across the first 4 children | Card grids appearing together (e.g. credit card grid, category grid) |
| `.glass-button:active` | `scale(0.97)`, fast duration | Button press feedback |
| `glassEntrance` keyframe | Bounce easing, staggered up to 0.4s | Glass surface entrance sequences |
| `slideInUp` / `fadeIn` / `scaleIn` keyframes | Decelerate/standard/bounce easing | General content and list entrance animations, several with a staggered variant |
| `progressFill` | Decelerate easing, 0.5s delay | Progress/utilization bars filling in after mount |
| `shimmer` / `glassPulse` | Continuous loop | Loading-state skeletons and subtle idle pulses |
| `prefers-reduced-motion` | — | All of the above are disabled (durations dropped to ~0) when the user has reduced-motion enabled |

#### Usage rules

The tokens above only hold together if components draw from them rather than
reaching for raw Tailwind. These rules are not lint-enforced, so they rely on
being known.

**Colour is spent 60/30/10.** 60% dominant background
(`--color-dominant-base`), 30% secondary glass surfaces
(`--color-secondary-*`), 10% accent for primary actions (`--color-accent-*`).
Always reference a token; never hardcode a colour value.

**Surfaces come from the glass system, not from Tailwind.** Use `glass-card`,
`glass-panel` or `glass-container`, and `glass-surface--interactive` for
clickable ones. Never apply `bg-white/X` or `backdrop-blur-X` directly — those
bypass the token system and drift out of step with everything around them.

**Buttons use variants, not inline colour:**

| Intent | Class |
|---|---|
| Primary action | `glass-button--primary` |
| Secondary action | `glass-button--secondary` |
| Destructive action | `glass-button--danger` |
| Filter / sort control | `glass-button--filter`, plus `active` when selected |

**Status colour is reserved for status.** Green, yellow, orange and red belong
in status badges, small indicators and alert messages only. They must not
appear on primary or secondary buttons (`glass-button--danger` is the single
exception), on icons, or as large background fills. Status colour that appears
decoratively stops carrying meaning where it matters.

#### Responsive Breakpoints

| Breakpoint | Usage |
|---|---|
| Mobile (< 1024px) | Hamburger menu, card-based layouts, stacked forms |
| Desktop (>= 1024px) | Fixed sidebar, table layouts, multi-column grids |

---

## 12. Data Management & Backup

### Export Formats

| Format | Scope | Method |
|---|---|---|
| JSON | Full database (all tables, `backups` excluded) | `exportJSONData()` or Cmd+E |
| CSV | Per-table files | `dataManager.exportData('csv')` |
| Credit Cards CSV | Credit cards table only | `dataManager.exportCreditCardsCSV()` |

#### Export format version

`CURRENT_DATA_VERSION` in `src/services/dataManager.js` gates the JSON file
contract. It is **not** the Dexie schema version — one governs what a file
looks like, the other what the database looks like — and it is currently **7**
(5 → 6 when `incomeSources` was added; 6 → 7 when `appearance` was).

Because transfer between devices is by file rather than sync, this is a
product-level compatibility requirement, not an implementation detail: a file
exported by a newer build must either import into an older one or fail with a
clear message, never corrupt it. **Review this constant whenever a schema
change alters what is exported.**

#### The `appearance` object — the one export member that is not a table

Appearance settings live in `localStorage`, not Dexie, because they must be
applied before first paint and a Dexie read is async. They still travel, as
one unit, so a backup opened on another device looks like the device it came
from:

```json
"appearance": {
  "glassTint": 0.35,
  "ambientStrength": 1,
  "ambientColors": { "top": "#3874e0", "middle": "#109679", "bottom": "#c67426" }
}
```

Three rules govern it, all in `src/utils/appearance.js`:

- **Applied only after the import transaction commits.** `localStorage` sits
  outside IndexedDB and cannot be rolled back, so writing it earlier would let
  a failed import silently restyle the app while changing none of the data.
- **Absent means untouched.** Every field is optional and validated
  independently, so a version 6 file — anything exported before this shipped —
  leaves the current theme exactly as it is.
- **Not validated by `validateImportData()`.** Deliberate: it is cosmetic, and
  failing an otherwise-good import of real financial data over a malformed
  colour would be the wrong trade.

The accepted cost, chosen explicitly: importing a backup to restore data also
replaces that device's theme.

#### Adding a table to the export

A new table must be added to every one of these or it is silently dropped from
backups: `dbHelpers.exportData()`, all three lists inside
`dbHelpers.importData()` (transaction scope, the `clear()` sequence, and the
`bulkPutChunked` sequence), `dbHelpers.clearDatabase()`,
`validateImportData()`'s optional-array list, `CSV_MONEY_FIELDS` in
`dataManager.js` if it holds money columns, and the test mock at
`src/db/__tests__/mock-database.js`.

### Import Flow

1. User selects JSON or CSV file
2. Confirmation dialog: JSON warns about a full data overwrite; CSV clarifies it merges into the matching table only, leaving other data untouched
3. Auto-backup created (IndexedDB `backups` table)
4. File parsed and validated (V4 format, data integrity)
5. V3→V4 migration applied if needed
6. Database updated atomically (single Dexie transaction): JSON fully replaces every table (`dbHelpers.importData()`); CSV upserts into the one table it detected from the file's headers, by id, without touching any other table (`dbHelpers.importSingleTable()`)
7. Category cache invalidated
8. Store reloaded from fresh database

### Backup System (BackupManager)

- **Storage:** IndexedDB `backups` table. A one-time startup migration drains any legacy localStorage backups into it.
- **Rotation:** Maximum 5 backups; oldest deleted when limit reached
- **Checksum:** SHA-256 integrity verification
- **Triggers:** Auto-created before import, clear, and restore operations
- **Restore:** User can manually restore from most recent backup via Settings
- A backup's stored snapshot never embeds prior backup history — `dbHelpers.exportData()` (used for both backups and manual JSON/CSV exports) excludes the `backups` table itself, so backup size no longer compounds across successive backups

### V3 → V4 Migration

Legacy data where `accountId` was a string like `"cc-1"` is automatically migrated:
- `accountId: "cc-1"` → `creditCardId: 1, accountId: null`
- Runs on app boot if V4-incompatible data is detected
- Non-blocking; failures are logged but don't prevent app load
- This is unrelated to the V8 UUID primary-key change ([Section 3](#3-database-structure)) — one migrates a data *shape*, the other changes what new *ids* look like.

---

## 13. Security & Privacy

### PIN Lock

- 4-digit PIN created on first launch
- Stored as a hash via `securePINStorage` (uses browser crypto API)
- App is locked on startup until PIN is entered
- Manual lock button in sidebar
- No PIN recovery — if forgotten, user must clear browser data

### Privacy Mode

- Toggle via sidebar button or Cmd+Shift+H
- All monetary values replaced with `••••••` when hidden
- Does not affect data — purely visual

### Data Privacy

- **Zero network calls** for financial data (no API, no analytics, no telemetry)
- All data stored in browser IndexedDB and localStorage
- The PWA service worker only caches static app-shell assets (JS/CSS/HTML/icons) for offline load — it never caches or transmits IndexedDB data
- Export encryption available via `secureDataHandling` (AES encryption for exported files)
- Data integrity validation on import via checksums

### Input Sanitization

All user inputs are sanitized before storage:
- String trimming and length limits
- HTML entity encoding
- Number validation
- Date format validation
- Object deep sanitization

---

## 14. Performance Optimizations

| Optimization | Location | Description |
|---|---|---|
| Lazy loading | `App.jsx` | All pages except Settings loaded via `React.lazy()` |
| Selector hooks | `useAppStore.js` | Each state slice has a dedicated hook to prevent unnecessary re-renders |
| Memoized bucketing | `PriorityExpenseList` | Overdue/This week/Later sections recomputed via `useMemo`, keyed on `[expenses, paycheckService, paycheckDates]` |
| Memoized service instances | `usePaycheckCalculations` | `PaycheckService` only reinstantiated when settings change |
| Category caching | `categoryCache.js` | 30s TTL with stale-while-revalidate |
| Optimistic updates | `useExpenseOperations` | UI updates immediately; DB writes async with rollback |
| Background pre-generation | `useAppStore.loadData()` | Recurring expense generation is non-blocking after initial load |
| Pending transaction Map | `Accounts.jsx` | Pre-computed `pendingByAccount` Map for O(1) per-account lookups |
| Offline asset caching | `vite-plugin-pwa` (Workbox) | Precaches the app shell so repeat loads (and offline loads) skip the network entirely |

---

## 15. Testing Strategy

### Vitest Project Split

`vitest.config.js` defines two projects under one config, each with its own environment and setup file:

| Project | Environment | Setup file | Covers |
|---|---|---|---|
| `unit` | jsdom | `src/test/setup.js` (fake-indexeddb, mocked `console`/`localStorage`) | `src/**/*.{test,spec}.{js,jsx}` |
| `storybook` | Real Chromium via Playwright, headless | `.storybook/vitest.setup.js` | Every `*.stories.{js,jsx}` file, run as an actual test via `@storybook/addon-vitest` |

The two projects intentionally do **not** share a setup file — the jsdom-oriented mocks in `src/test/setup.js` (e.g. `global.indexedDB`, `global.console`) don't apply to a real browser environment, so `setupFiles` is scoped to the `unit` project only.

### Unit Tests (Vitest + jsdom)

- **Location:** `src/**/*.test.js`, `src/**/*.spec.js`
- **Environment:** jsdom with `fake-indexeddb` for IndexedDB mocking
- **Focus:** Services, utilities, database helpers, custom hooks

### Component Tests (React Testing Library)

- **Focus:** Component rendering, user interactions, state changes
- **Pattern:** Render component → simulate user action → assert DOM changes
- Components that render `<PrivacyWrapper>` (e.g. `PriorityExpenseRow`, `FixedExpensesHero`) must be rendered inside a `<PrivacyProvider>` in tests, matching the real app's provider tree

### Visual / Story Tests (Storybook, real browser)

- **Location:** `src/stories/`
- **Framework:** Storybook 9, stories executed as Vitest tests in real Chromium via `@storybook/addon-vitest` + Playwright
- **Addons:** a11y (accessibility), docs, onboarding, vitest integration
- Requires the Playwright Chromium and Chromium-headless-shell browser binaries to be installed locally (`npx playwright install`) — without them, `npm run test:run` fails at the config level before any test runs

### Documentation Tests

`src/__tests__/docReferences.test.js` asserts that every `src/...` path named
in any markdown file at the repository root actually exists. Renaming or
deleting a module therefore fails the suite until the docs follow.

It is a ratchet, not a guarantee: it catches dead paths, renames and moves, and
cannot tell you that a paragraph is wrong or that a section is missing. That
narrow scope is deliberate — dead paths were the drift that actually occurred,
and the check found several nobody had noticed, including two that predated the
commit which added it.

### Conventions worth keeping

- **Assert what a write left alone, not only what it changed.** A suite of 261
  passing tests missed a payment silently unlinking an expense from its credit
  card, because every assertion checked the fields that were meant to move.
- **No wall-clock performance assertions.** Under a parallel suite they measure
  how busy the machine is, not how fast the code is, and can only be tuned to
  fail less often. Count renders or operations instead.
- **Prove a regression test fails against the old behaviour** before trusting
  it.

### Commands

| Command | Description |
|---|---|
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Single run of both Vitest projects |
| `npm run test:coverage` | Run with coverage report |
| `npm run test:ui` | Open Vitest UI |
| `npm run storybook` | Start Storybook dev server |

---

## 16. Deployment

**Live:** https://digibook-rose.vercel.app

Hosted on Vercel, linked to `jadedjestr/digibook` on GitHub. Every push to
`main` builds and deploys to production automatically — there is no separate
release step, so a broken commit is live within about a minute. Vercel keeps
previous deployments as rollback candidates.

| Setting | Value |
|---|---|
| Framework | Vite (auto-detected) |
| Build | `npm run build` |
| Output | `dist` |
| Production branch | `main` |

No server-side component and no environment variables: the deployment serves
static files only. **Financial data never reaches it** — everything lives in
the visitor's own browser, so opening the URL on a new device yields an empty
database and the PIN setup screen. That is also the quickest way to confirm a
build carries no data.

### PWA delivery

`vite-plugin-pwa` generates the service worker with `registerType: 'autoUpdate'`
and `cleanupOutdatedCaches`, so a new deployment replaces the cached shell
rather than serving a stale one. The manifest is hand-maintained at
`public/manifest.json` (hence `manifest: false` in the Vite config) and
declares `display: standalone`, which together with the Apple meta tags in
`index.html` is what makes home-screen installation work on iOS.

Navigation is React state rather than URL routing — the path never leaves `/` —
so no SPA rewrite rules are required.

---

## 17. Developer Tooling & Code Quality

### Code Style

- **ESLint:** `.eslintrc.cjs` with React, accessibility, and Prettier plugins; `npm run lint` runs with `--max-warnings 0`, so any warning fails the command, not just errors
- **Prettier:** Consistent formatting (config in `.prettierrc`)
- **Banned patterns (`no-restricted-syntax`):** `console.*` (use `logger`), and
  `parseFloat(x) || fallback` on any path — the latter because it cannot
  distinguish "the user typed 0" from "the user typed nothing", and shipped a
  bug that silently set a real account balance to $0. Use `parseMoneyInput`.
- **Commitlint:** Conventional commits enforced (`commitlint.config.cjs`) — type must be one of `feat`/`fix`/`docs`/`style`/`refactor`/`perf`/`test`/`chore`/`ci`/`build`/`revert`, and the type, scope, and subject must all be lower-case

### Git Hooks (Husky)

| Hook | Action |
|---|---|
| `pre-commit` | Runs lint-staged (ESLint `--fix` + Prettier on staged files) |
| `commit-msg` | Validates commit message format via commitlint |

### Quality Gate

```bash
npm run quality  # Runs: lint → format:check → test:run
```

### Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (network-accessible) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Run Prettier |
| `npm run format:check` | Check formatting |

---

## 18. Glossary

| Term | Definition |
|---|---|
| **Liquid Balance** | Sum of all bank account balances (excludes credit cards) |
| **Projected Balance** | Current balance + pending transactions |
| **Discretionary Balance** | Default account projected balance minus total remaining unpaid expenses |
| **Dual Foreign Key** | V4 architecture where expenses use either `accountId` or `creditCardId`, never both |
| **Credit Card Payment** | Special expense category where money moves from a bank account to a credit card |
| **Pay Cycle** | The period between two paychecks — 7, 14, or ~30 days depending on the user's configured pay frequency (weekly, biweekly, or monthly) |
| **Pay Cycle Nudge** | A priority-ordered banner/toast (past-month → catch-up) that proactively surfaces unpaid expenses on the Fixed Expenses Month view |
| **Recurring Template** | A template that auto-generates future expense instances on a schedule |
| **Optimistic Update** | Updating the UI immediately before the database confirms the write |
| **Glass Morphism** | Design style using backdrop blur and transparency for a frosted glass effect |
| **V4 Migration** | Automatic conversion of V3 data (where credit card IDs were stored as `"cc-N"` strings in accountId) to the V4 dual foreign key format |
| **V8 UUID Migration** | Schema change from auto-increment integer ids to app-generated `crypto.randomUUID()` string ids on every table, done without a data backfill since there was no existing installed base to migrate |
| **Self-Healing** | The system's ability to auto-infer missing data or auto-correct drift without user action (e.g., matching a Credit Card Payment to its target card by name; correcting a stale paycheck anchor, [§5.8](#58-paycheck-anchor-self-heal-safe-zone)) |
| **Pre-Generation** | Creating future expense instances from recurring templates up to N months ahead |
| **PWA (Progressive Web App)** | The installable, offline-capable delivery mode added via `vite-plugin-pwa` — caches the app shell only, never financial data |

# Digibook - Product Requirements Document

**Document Version:** 2.0
**Last Updated:** March 7, 2026
**Product Owner:** Adrian Garcia
**Status:** Live / Active Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Principles](#2-product-vision--principles)
3. [User Personas & Jobs to Be Done](#3-user-personas--jobs-to-be-done)
4. [Tech Stack](#4-tech-stack)
5. [Architecture Overview](#5-architecture-overview)
6. [Database Structure](#6-database-structure)
7. [Application Shell & Navigation](#7-application-shell--navigation)
8. [Feature Specifications by Page](#8-feature-specifications-by-page)
9. [Services Layer](#9-services-layer)
10. [Custom Hooks](#10-custom-hooks)
11. [Context Providers](#11-context-providers)
12. [Component Inventory](#12-component-inventory)
13. [Utilities](#13-utilities)
14. [State Management](#14-state-management)
15. [Design System](#15-design-system)
16. [Data Management & Backup](#16-data-management--backup)
17. [Security & Privacy](#17-security--privacy)
18. [Performance Optimizations](#18-performance-optimizations)
19. [Testing Strategy](#19-testing-strategy)
20. [Developer Tooling & Code Quality](#20-developer-tooling--code-quality)
21. [Glossary](#21-glossary)

---

## 1. Executive Summary

Digibook is a **local-first personal finance tracker** built as a single-page application that runs entirely in the browser. All financial data is stored client-side in **IndexedDB** — there is no backend server, no cloud sync, and no data ever leaves the user's device.

The app helps users:

- Track bank account balances (checking and savings)
- Manage credit card debt, utilization, and payments
- Plan and track fixed/recurring expenses against a paycheck cycle
- Visualize financial health through analytics and insights
- Import/export data for backup and portability

Digibook is designed for a single user who wants full control of their financial data with a modern, polished UI inspired by Apple's "Liquid Glass" design language.

---

## 2. Product Vision & Principles

### Vision

> A beautifully simple, privacy-first financial command center that gives you complete visibility into where your money goes — without ever sharing your data with anyone.

### Core Principles

| Principle | Description |
|---|---|
| **Local-First** | All data lives in the browser via IndexedDB. Zero network calls for data. |
| **Privacy by Design** | PIN lock, privacy mode to hide values, encrypted exports. No analytics or telemetry. |
| **Pay-Cycle Centric** | The expense management workflow is organized around biweekly paycheck cycles, not arbitrary calendar months. |
| **Dual Foreign Key Architecture** | Expenses can be funded from bank accounts OR charged to credit cards — never both. Credit card *payments* use a separate two-field system (funding account + target card). |
| **Optimistic Updates** | The UI updates immediately on user actions; database writes happen in the background with rollback on failure. |
| **Zero Configuration** | New users set a PIN, add an account, and are immediately productive. Default categories are seeded automatically. |

---

## 3. User Personas & Jobs to Be Done

### Primary Persona: Budget-Conscious Individual

A person who gets paid biweekly and wants to map every dollar of their paycheck to specific bills, track credit card debt, and know their projected balance after all obligations are met.

### Jobs to Be Done

1. **"When I get paid, I want to see which bills to pay this cycle so I never miss a due date."**
2. **"I want to know how much discretionary cash I have left after all bills are accounted for."**
3. **"I want to track my credit card debt and understand when I'll be debt-free."**
4. **"I want to record pending transactions (deposits, checks) to see my real projected balance."**
5. **"I want my financial data to stay on my device — no cloud, no third parties."**
6. **"I want to back up and restore my data easily."**

---

## 4. Tech Stack

### Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | 18.x | UI framework |
| `react-dom` | 18.x | DOM rendering |
| `dexie` | 4.x | IndexedDB wrapper (database ORM) |
| `zustand` | 5.x | Lightweight global state management |
| `lucide-react` | latest | Icon library |
| `papaparse` | 5.x | CSV import/export parsing |
| `react-toastify` | 11.x | Toast notification system |
| `@dnd-kit/core` | latest | Drag-and-drop primitives |
| `@dnd-kit/sortable` | latest | Sortable drag-and-drop |
| `@dnd-kit/utilities` | latest | Drag-and-drop utilities |

### Build & Development

| Tool | Purpose |
|---|---|
| Vite 7 | Build tool and dev server |
| Tailwind CSS | Utility-first CSS framework with custom Liquid Glass theme |
| PostCSS + Autoprefixer | CSS post-processing |
| ESLint | JavaScript/JSX linting |
| Prettier | Code formatting |
| Husky | Git hooks (pre-commit) |
| lint-staged | Run linters on staged files only |
| Commitlint | Enforce conventional commit messages |

### Testing

| Tool | Purpose |
|---|---|
| Vitest | Test runner (unit tests with jsdom environment) |
| React Testing Library | Component testing utilities |
| Playwright | Browser-based integration tests |
| fake-indexeddb | IndexedDB mock for unit tests |
| Storybook 9 | Component documentation and visual testing |

---

## 5. Architecture Overview

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
│  │  │  useExpenseOperations | useAccountOperations |        │    │   │
│  │  │  usePaycheckCalculations | useMemoizedCalculations    │    │   │
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
│  │  │  Schema V1-V4 | Atomic transactions | Audit logging    │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  localStorage: Zustand UI state, backups, PIN hash           │   │
│  │  IndexedDB:    All financial data (DigibookDB_Fresh)          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **App boot:** `main.jsx` → `App.jsx` → load PIN from secure storage → if no PIN or locked, show `PINLock` → else `loadData()`.
2. **`loadData()`:** `initializeDatabase()` → `ensureDefaultData()` → `ensureDefaultAccount()` → run V4 migration if needed → parallel fetch all 7 tables into Zustand → background pre-generate recurring expenses (non-blocking).
3. **User action (e.g., mark expense as paid):** Component calls hook (e.g., `useExpenseOperations.markAsPaid`) → optimistic store update → `dbHelpers.applyExpensePaymentChangeAtomic()` → update expense + account/credit card balances in a single Dexie transaction → audit log → reload store slices.
4. **Navigation:** `Sidebar` calls `setCurrentPage(id)` → Zustand updates `currentPage` (persisted to localStorage) → `App.renderPage()` switch statement renders the matching lazy-loaded page.

### Key Architectural Decisions

| Decision | Rationale |
|---|---|
| No React Router | Single-page app with 6 views; Zustand `currentPage` state is simpler and avoids URL management for a local-only app. |
| Lazy-loaded pages | `React.lazy()` + `Suspense` for all pages except Settings to reduce initial bundle size. |
| Dexie.js over raw IndexedDB | Provides a promise-based API, schema versioning, and transaction support that raw IndexedDB lacks. |
| Zustand over Redux/Context | Minimal boilerplate, built-in selectors that prevent unnecessary re-renders, and native `persist` middleware for UI state. |
| Optimistic updates | Instant UI feedback; reverts on DB error via `reloadExpenses()` / `reloadAccounts()`. |
| Service layer pattern | Business logic (payment routing, paycheck calculations, recurring generation) is decoupled from React components and database operations. |

---

## 6. Database Structure

### Technology

- **Engine:** IndexedDB (browser-native)
- **ORM:** Dexie.js
- **Database Name:** `DigibookDB_Fresh`
- **Current Schema Version:** 4

### Schema Evolution

| Version | Change |
|---|---|
| V1 | Initial schema: accounts, expenses, categories, credit cards, paycheck settings, audit logs |
| V2 | Added `recurringExpenseTemplates` table and `recurringTemplateId` on `fixedExpenses` |
| V3 | Added `targetCreditCardId` on `fixedExpenses` for explicit credit card payment tracking |
| V4 | **Dual Foreign Key Architecture** — added `creditCardId` on `fixedExpenses`; expenses now use either `accountId` OR `creditCardId`, never both |

### Tables

#### `accounts`
Bank accounts (checking and savings).

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | auto-increment | PK | Unique identifier |
| `name` | string | Yes | Account display name |
| `type` | string | Yes | `"checking"` or `"savings"` |
| `currentBalance` | number | Yes | Current balance in dollars |
| `isDefault` | boolean | Yes | Whether this is the default account shown in sidebar |
| `createdAt` | ISO string | Yes | Creation timestamp |

#### `creditCards`
Credit card accounts.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | auto-increment | PK | Unique identifier |
| `name` | string | Yes | Card display name |
| `balance` | number | Yes | Current outstanding balance |
| `creditLimit` | number | Yes | Credit limit |
| `interestRate` | number | Yes | Annual interest rate (%) |
| `dueDate` | string | Yes | Next payment due date (YYYY-MM-DD) |
| `statementClosingDate` | string | Yes | Statement closing date (YYYY-MM-DD) |
| `minimumPayment` | number | Yes | Minimum monthly payment |
| `createdAt` | ISO string | Yes | Creation timestamp |

#### `fixedExpenses`
All bills and expenses. The core of the V4 dual foreign key model.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | auto-increment | PK | Unique identifier |
| `name` | string | Yes | Expense name |
| `dueDate` | string | Yes | Due date (YYYY-MM-DD) |
| `amount` | number | Yes | Budget/expected amount |
| `accountId` | number \| null | Yes | Funding bank account (mutually exclusive with `creditCardId`) |
| `creditCardId` | number \| null | Yes | Credit card to charge (mutually exclusive with `accountId`) |
| `targetCreditCardId` | number \| null | Yes | For "Credit Card Payment" category only — the card being paid |
| `category` | string | Yes | Category name (e.g., "Utilities", "Credit Card Payment") |
| `paidAmount` | number | Yes | Amount paid so far |
| `status` | string | Yes | `"pending"`, `"paid"`, `"overdue"` |
| `recurringTemplateId` | number \| null | Yes | Link to recurring template that generated this expense |
| `overpaymentAmount` | number | Yes | Amount paid over budget |
| `overpaymentPercentage` | number | Yes | Overpayment as % of budget |
| `budgetSatisfied` | boolean | Yes | Whether budget amount was met |
| `significantOverpayment` | boolean | Yes | Flag for notable overpayments |
| `isAutoCreated` | boolean | Yes | Created automatically by recurring system |
| `isManuallyMapped` | boolean | Yes | Manually linked to credit card |
| `mappingConfidence` | number | Yes | Confidence score for auto-mapping |
| `mappedAt` | string | Yes | When mapping occurred |
| `createdAt` | ISO string | Yes | Creation timestamp |

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
| `id` | auto-increment | PK | Unique identifier |
| `accountId` | number | Yes | Associated bank account |
| `amount` | number | Yes | Transaction amount (negative for expenses, positive for income) |
| `category` | string | Yes | Category name |
| `description` | string | Yes | Transaction description |
| `createdAt` | ISO string | Yes | Creation timestamp |

#### `categories`
User-defined expense categories with visual properties.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | auto-increment | PK | Unique identifier |
| `name` | string | Yes | Category name |
| `color` | string | Yes | Hex color code |
| `icon` | string | Yes | Emoji or icon identifier |
| `isDefault` | boolean | Yes | Whether this is a system default |
| `createdAt` | ISO string | Yes | Creation timestamp |

**Default categories seeded on first run:** Utilities, Subscriptions, Insurance, Housing, Transportation, Food, Health, Entertainment, Credit Card Payment, and others.

#### `recurringExpenseTemplates`
Templates that auto-generate future expense instances.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | auto-increment | PK | Unique identifier |
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
| `accountId` | number \| null | Yes | Default funding account |
| `creditCardId` | number \| null | — | Default credit card |
| `targetCreditCardId` | number \| null | — | For credit card payment templates |
| `notes` | string | Yes | Template notes |
| `isActive` | boolean | Yes | Whether template is active |
| `isVariableAmount` | boolean | Yes | Whether amount varies per occurrence |
| `createdAt` | ISO string | Yes | Creation timestamp |
| `updatedAt` | ISO string | Yes | Last update timestamp |

#### `paycheckSettings`
Single-row table storing the user's pay schedule.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | auto-increment | PK | Unique identifier |
| `lastPaycheckDate` | string | Yes | Date of last paycheck (YYYY-MM-DD) |
| `frequency` | string | Yes | Currently only `"biweekly"` (14-day intervals) |
| `createdAt` | ISO string | Yes | Creation timestamp |

#### `userPreferences`
Per-component UI preferences.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | auto-increment | PK | Unique identifier |
| `component` | string | Yes | Component identifier |
| `preferences` | object | Yes | JSON preferences blob |
| `createdAt` | ISO string | Yes | Creation timestamp |

#### `monthlyExpenseHistory`
Historical tracking of budget vs. actual spending per expense per month.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | auto-increment | PK | Unique identifier |
| `expenseId` | number | Yes | Associated fixed expense |
| `month` | number | Yes | Month (1-12) |
| `year` | number | Yes | Year |
| `budgetAmount` | number | Yes | Budgeted amount |
| `actualAmount` | number | Yes | Actual amount spent |
| `overpaymentAmount` | number | Yes | Amount over budget |
| `createdAt` | ISO string | Yes | Creation timestamp |

#### `auditLogs`
Comprehensive change-tracking for all data mutations.

| Column | Type | Indexed | Description |
|---|---|---|---|
| `id` | auto-increment | PK | Unique identifier |
| `timestamp` | ISO string | Yes | When the action occurred |
| `actionType` | string | Yes | e.g., `"PAYMENT"`, `"CREATE"`, `"UPDATE"`, `"DELETE"` |
| `entityType` | string | Yes | e.g., `"account"`, `"creditCard"`, `"creditCardPayment"` |
| `entityId` | number | Yes | ID of the affected entity |
| `details` | object | Yes | JSON with action-specific data |

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

## 7. Application Shell & Navigation

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
          {renderPage()}  // switch on currentPage
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

Navigation is driven by `useAppStore.currentPage` (persisted to localStorage). The `Sidebar` component calls `setCurrentPage(id)` on click. There is no URL-based routing.

### Sidebar Features

- **Liquid Cash card:** Shows the default account's projected balance (current balance + pending transactions)
- **Navigation items:** Icon + label, active state has glass highlight
- **Hide/Show values button:** Toggles privacy mode (Cmd+Shift+H shortcut)
- **Lock button:** Locks the app, requiring PIN re-entry
- **Responsive:** Desktop sidebar is fixed; mobile uses a hamburger menu with slide-in drawer and backdrop overlay

### Global Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Cmd+E / Ctrl+E | Export data as JSON |
| Cmd+Shift+H / Ctrl+Shift+H | Toggle privacy mode (hide/show values) |

---

## 8. Feature Specifications by Page

### 8.1 Accounts Page

**Path:** `src/pages/Accounts.jsx`

**Purpose:** Manage bank accounts (checking and savings) and view aggregate balances.

**Features:**

- **Liquid Balance card:** Sum of all account `currentBalance` values across all accounts
- **Grouped account display:** Accounts organized by type (Checking Accounts, Savings Accounts) with type-specific icons
- **Add Account form:** Name, type (checking/savings dropdown), initial balance. Validates name is non-empty and balance is non-negative.
- **Inline editing:** Click on account name or balance to edit in-place via the `InlineEdit` component
- **Set Default Account:** Star icon to designate the primary account (shown in sidebar)
- **Delete Account:** With confirmation dialog
- **Projected Balance column:** Current balance + sum of pending transactions for that account. Highlighted in yellow when projected is lower than current.
- **Privacy wrapper:** All monetary values wrapped in `<PrivacyWrapper>` for privacy mode
- **Empty state:** Friendly illustration and "Add Your First Account" CTA when no accounts exist

### 8.2 Pending Transactions Page

**Path:** `src/pages/PendingTransactions.jsx`

**Purpose:** Track uncleared deposits, checks, and payments that haven't posted yet.

**Features:**

- **Add Transaction form:** Account selector, type toggle (expense/income), amount, category, description, date (defaults to today)
- **Amount sign logic:** Expenses stored as negative amounts; income as positive
- **Inline editing:** All fields (account, amount, category, description, date) are editable in-place
- **Projected Balance column:** Per-account projected balance reflecting all pending transactions
- **Complete transaction:** Check icon button — applies the transaction to the account balance
- **Delete transaction:** Trash icon with confirmation
- **Category selector:** Populated from the categories table
- **Empty state:** "No pending transactions" with illustrative icon and CTA

### 8.3 Fixed Expenses Page

**Path:** `src/pages/FixedExpenses.jsx`

**Purpose:** The core expense management view — plan, track, and pay bills within a paycheck cycle.

**Features:**

- **View Switcher:** Toggle between "Month View" (calendar-based) and "All Future One-Offs" (list of non-recurring future expenses)

#### Month View

- **Calendar Component** (`Calendar/Calendar.jsx`):
  - Full month calendar grid with expense badges on due dates
  - Color-coded badges by payment status (paid, unpaid, overdue)
  - Quick actions on click (mark paid, edit)
  - Upcoming Recurring Widget showing next scheduled expenses
  - Month navigation (previous/next/today)
  - Pay cycle reset button

- **Summary Cards** (3-column grid):
  - **PaySummaryCard:** Total due this cycle, paid vs. remaining, overdue amount
  - **PayDateCountdownCard:** Days until next paycheck, days until following paycheck
  - **ProjectedBalanceCard:** Discretionary spending amount (default account balance minus remaining expenses)

- **Category Expense Summary:** Visual breakdown by category with clickable segments that scroll to the corresponding table section

- **Fixed Expenses Table** (`FixedExpensesTable.jsx`):
  - Grouped by category with collapsible sections
  - Columns: Name, Due Date, Amount, Paid Amount, Status, Payment Source, Actions
  - Inline editing for all editable fields
  - Quick-add row for adding new expenses
  - Drag-and-drop reordering within categories (via @dnd-kit)
  - Status badges: Paid (green), Partially Paid (yellow), Overdue (red), Pay This Week (orange), Pay with Next Check (blue), Pay with Following Check (gray)
  - Payment source display: Shows which account or credit card funds each expense
  - Mobile responsive: Card-based layout on small screens

- **Pay Cycle Reset:** Modal confirmation that:
  1. Resets all expense `paidAmount` to 0 and `status` to "pending"
  2. Advances all due dates by one month
  3. Updates `lastPaycheckDate` to the next pay date

- **Pay Cycle Nudge (Month view):** A single non-intrusive banner (or optional toast) shown above the calendar when conditions are met. Priority order: (1) **Past month** — user has expenses from the previous calendar month that are not marked paid (e.g. after importing February data while in March); action: "Review [Month]" navigates to that month, or Dismiss. (2) **Catch-up** — near end of current month and current month has unpaid/partially paid expenses; action: "Mark as paid" (with confirmation), "Review" (scrolls to table), or Dismiss. (3) **Reset** — all current-month expenses are paid or overdue and next paycheck is in a new month (`shouldPromptReset`); action: "Start new cycle" opens the reset modal, or "Not yet". Dismissal can be session-only or "Don't show again this month". Implemented as S3 logic (`getPayCycleNudge`, `usePayCycleNudge`, `nudgeDismissal`) plus S2 UI (`PayCycleNudgeBanner`; optional `PayCycleNudgeToast`).

#### One-Off Expenses View
- Filtered list of future expenses without recurring templates
- Supports mark as paid, delete, and inline editing

### 8.4 Credit Cards Page

**Path:** `src/pages/CreditCards.jsx`

**Purpose:** Manage credit card accounts, track debt and utilization, and manage payment expenses.

**Features:**

- **Summary Dashboard** (4-column grid):
  - Total Debt
  - Total Credit Limit
  - Overall Utilization % (color-coded: green < 50%, yellow 50-70%, orange 70-90%, red > 90%)
  - Total Available Credit

- **Sorting Controls:** Sort cards by Name, Due Date (soonest first), Balance (highest first), or Utilization (highest first)

- **Credit Card Grid:** Responsive grid of `EnhancedCreditCard` components showing:
  - Card name and visual representation
  - Balance and credit limit
  - Utilization bar (color-coded)
  - Interest rate
  - Days until due date
  - Edit and delete actions

- **Add/Edit Modal:** Full-screen portal modal with fields:
  - Name, Current Balance, Credit Limit, Interest Rate (%), Due Date, Statement Closing Date (optional), Minimum Payment

- **Auto-create Payment Expenses:** When a new credit card is added, the system automatically creates a corresponding "Credit Card Payment" fixed expense (via `dbHelpers.createMissingCreditCardExpenses()`)

- **Smart Link Expenses** button: Opens `CreditCardMigrationModal` to automatically match orphaned expenses to credit cards based on name similarity

- **Credit Card Deletion Modal:** Enhanced deletion flow that:
  1. Shows linked expenses
  2. Offers to reassign expenses to another account/card
  3. Handles cascade deletion of linked expenses

- **Due Date Sync:** When a credit card's due date is updated, all linked "Credit Card Payment" expenses have their due dates automatically synced

- **Empty state:** Icon and CTA to add first credit card

### 8.5 Insights Page

**Path:** `src/pages/Insights.jsx`

**Purpose:** Financial analytics and budget intelligence.

**Features:**

- **Budget vs. Actual Dashboard** (`BudgetVsActualDashboard.jsx`):
  - Summary cards: Total Budgeted, Total Actual, Net Difference
  - Per-category breakdown showing budget vs. actual with difference highlighting

- **Credit Card Debt Table** (`CreditCardDebtTable.jsx`):
  - All credit cards with balance, limit, utilization %, interest rate, minimum payment
  - Total row with aggregate stats

- **Overpayment Analysis** (`OverpaymentAnalysis.jsx`):
  - Per-category analysis of where spending exceeds budget
  - Total overpayment amount

- **Debt Payoff Calculator** (`DebtPayoffCalculator.jsx`):
  - Supports **Snowball** (smallest balance first) and **Avalanche** (highest rate first) strategies
  - Input: Extra monthly payment amount
  - Output per card: Months to payoff, payoff date, total interest paid
  - Summary: Total months to debt-free, total interest cost

- **Monthly Trends** (`MonthlyTrends.jsx`):
  - Last 12 months of expense history
  - Budget vs. actual trend visualization

- **Refresh Data** button to reload all analytics data

### 8.6 Settings Page

**Path:** `src/pages/Settings.jsx`

**Purpose:** Application configuration, data management, and administrative tools.

**Layout:** Collapsible card group (accordion-style, exclusive — only one card open at a time).

#### Settings Cards

**1. Paycheck Management** (`PaycheckManager.jsx`)
- Set last paycheck date
- Set frequency (currently biweekly only)
- Displays calculated next and following pay dates

**2. Data Management** (`DataManagementCard.jsx`)
- **Export:** JSON (full backup), CSV (per-table files), Credit Cards CSV
- **Import:** JSON or CSV file upload with validation and overwrite confirmation
- **Future Expense Generation:** Prompt to auto-generate next 1/3/6 months of expenses from current month's data using recurring templates
- **Clear All Data:** Wipes all tables (auto-backup created first)
- **Restore from Backup:** Restores from most recent localStorage backup

**3. Category Management** (`CategoryManager/`)
- Grid of category cards showing name, color, icon, usage count
- Add new category (name, color picker, icon selector)
- Edit category (inline rename, color/icon change)
- Delete category with reassignment flow (choose target category for orphaned expenses)
- Drag-and-drop reordering

**4. Recurring Templates Management** (`RecurringTemplatesManager.jsx`)
- List of all recurring expense templates
- View frequency, next due date, amount, status
- Edit template properties
- Delete template
- Manual regeneration of future occurrences

**5. Audit Log** (`AuditLogCard.jsx`)
- Chronological list of all data mutations
- Shows action type, entity, timestamp, and details
- Clear audit log button

**6. Privacy & Security**
- PIN Lock status (always enabled)
- Data storage confirmation ("Local Only")

---

## 9. Services Layer

### 9.1 PaymentService

**Path:** `src/services/paymentService.js`
**Pattern:** Class-based, instantiated with current accounts and credit cards

**Responsibility:** Process all financial transactions through the V4 dual foreign key model.

**Key Methods:**

| Method | Description |
|---|---|
| `processExpensePayment(expense, newPaidAmount)` | Entry point — routes to credit card payment or regular expense payment based on category |
| `processCreditCardPayment(expense, paymentDifference)` | Two-field payment: decreases funding account balance + decreases target credit card balance + audit log |
| `processAccountPayment(expense, paymentDifference)` | Decreases bank account balance + audit log |
| `processCreditCardCharge(expense, paymentDifference)` | Increases credit card balance (adding debt) + audit log |
| `getPaymentSourceDetails(expense)` | Returns display info for the payment source (name, type, balance, validity) |
| `getCreditCardPaymentDetails(expense)` | Returns both funding source and target card info for CC payment expenses |
| `validatePaymentSources(expense)` | Validates all referenced accounts/cards exist; checks for sufficient funds (warnings) |
| `validateCreditCardPaymentAmount(expense, amount)` | Enhanced validation: insufficient funds (error), overpayment (warning), zero balance (warning) |
| `generatePaymentSuggestions(creditCard, fundingAccount)` | Returns smart suggestions: minimum payment, full balance, 2x minimum, affordable max |

### 9.2 PaycheckService

**Path:** `src/services/paycheckService.js`
**Pattern:** Class-based, instantiated with paycheck settings

**Responsibility:** Calculate paycheck dates and determine expense payment statuses relative to the pay cycle.

**Key Methods:**

| Method | Description |
|---|---|
| `calculatePaycheckDates()` | From `lastPaycheckDate`, calculates `nextPayDate` and `followingPayDate` (14-day intervals), advancing past today if needed |
| `calculateExpenseStatus(expense, paycheckDates)` | Returns one of: Paid, Partially Paid, Overdue, Pay This Week, Pay with Next Check, Pay with Following Check |
| `getStatusColor(status)` | Maps status to Tailwind color classes |
| `calculateSummaryTotals(expenses, paycheckDates)` | Aggregates remaining amounts by status bucket (this week, next check, overdue) |
| `shouldPromptReset(expenses, paycheckDates)` | Returns true when all expenses are paid/overdue AND next paycheck is in a new month |

### 9.3 RecurringExpenseService

**Path:** `src/services/recurringExpenseService.js`
**Pattern:** Functional (exported async functions, no class)

**Responsibility:** Manage recurring expense templates and auto-generate future expense instances.

**Key Functions:**

| Function | Description |
|---|---|
| `createTemplate(templateData)` | Creates a new recurring template |
| `updateTemplate(templateId, updates)` | Updates template properties |
| `deleteTemplate(templateId)` | Deletes a template |
| `getActiveTemplates()` | Returns all active templates |
| `getTemplatesDueForGeneration()` | Filters templates where `nextDueDate <= today` |
| `generateNextOccurrence(templateId)` | Creates the next expense instance and advances `nextDueDate` |
| `autoGenerateDueExpenses()` | Batch-generates all overdue occurrences |
| `preGenerateOccurrences(templateId, monthsAhead)` | Pre-generates up to N months of future expenses, skipping duplicates |
| `regenerateUnpaidOccurrences(templateId)` | Deletes unpaid future expenses and regenerates with updated template data |
| `convertFixedExpenseToRecurring(expenseId, recurringData)` | Converts a one-off expense into a recurring template |
| `calculateUpcomingOccurrences(template, count)` | Calculates the next N occurrence dates without persisting |

**Frequency Options:** monthly, quarterly (3mo), biannually (6mo), annually (12mo), custom

### 9.4 DataManager

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
- **V3→V4 Migration:** Converts legacy `accountId` values like `"cc-1"` to `creditCardId: 1, accountId: null`
- **Validation:** `validateExpenseDataV4()`, `validateImportedDataV4()`, `fixCommonExpenseIssues()`

### 9.5 financeService

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

### 9.6 categoryCache / categoryUsageCache

**Paths:** `src/services/categoryCache.js`, `src/services/categoryUsageCache.js`
**Pattern:** Singleton with TTL

- **categoryCache:** 30-second TTL, stale-while-revalidate, listener pattern for invalidation
- **categoryUsageCache:** 60-second TTL, per-category invalidation

---

## 10. Custom Hooks

### 10.1 `useExpenseOperations`

**Path:** `src/hooks/useExpenseOperations.js`

The primary interface for all expense mutations. Wraps database operations with V4 validation, optimistic updates, payment processing, and error recovery.

**Returns:**

| Function | Description |
|---|---|
| `addExpense(data)` / `addExpenseV4(data)` | Create new expense with V4 validation |
| `updateExpense(id, updates)` / `updateExpenseV4(id, updates)` | Update with optimistic UI, V4 validation, self-healing for legacy data |
| `deleteExpense(id)` | Delete with optimistic removal |
| `duplicateExpense(original, overrides)` | Clone expense with reset payment status |
| `markAsPaid(id)` | Set `paidAmount` = `amount`, trigger balance updates |
| `getPaymentSourceInfo(expense)` | Display info for expense's funding source |
| `getCreditCardPaymentInfo(expense)` | Two-field display info for CC payment expenses |
| `validateExpensePaymentSources(expense)` | Validate referenced entities exist |
| `validateCreditCardPaymentAmount(expense, amount)` | Enhanced CC payment validation |
| `generatePaymentSuggestions(expense)` | Smart payment amount suggestions |

**Self-Healing:** When updating a Credit Card Payment expense, the hook auto-infers missing `targetCreditCardId` (by name matching) and missing `accountId` (falls back to default account).

### 10.2 `usePaycheckCalculations`

**Path:** `src/hooks/usePaycheckCalculations.js`

Memoized wrapper around `PaycheckService`. Only recalculates when `paycheckSettings` changes.

**Returns:** `{ paycheckService, paycheckDates }`

### 10.3 `useMemoizedCalculations`

**Path:** `src/hooks/useMemoizedCalculations.js`

Heavy computation memoization for expense views.

**Returns:**

| Value | Description |
|---|---|
| `expensesByCategory` | Expenses grouped by category name |
| `totals` | `{ totalAmount, totalPaid, totalRemaining, totalExpenses }` |
| `categoryTotals` | Per-category count, total remaining, paid count |
| `accountTotals` | `{ accountTotal, creditCardTotal, netWorth }` |
| `expenseStatuses` | Per-expense `{ isPaid, isOverdue, remaining, percentage }` |
| `getFilteredExpenses(filters)` | Filter by category, status, accountId, search, expenseType (recurring/oneoff) |
| `getSortedExpenses(list, sortBy)` | Sort by dueDate, name, amount, or remaining |

### 10.4 `useAccountOperations`

**Path:** `src/hooks/useAccountOperations.js`

Account and credit card CRUD with optimistic updates.

### 10.5 `usePersistedState`

**Path:** `src/hooks/usePersistedState.js`

Persists UI state to both localStorage and IndexedDB (userPreferences table).

### 10.6 `usePerformanceMonitor`

**Path:** `src/hooks/usePerformanceMonitor.js`

Dev-only hook that tracks render counts and timing for performance debugging.

---

## 11. Context Providers

### 11.1 PrivacyContext

**Path:** `src/contexts/PrivacyContext.jsx`

**Purpose:** Toggle visibility of sensitive financial values throughout the app.

**API:**
- `isHidden: boolean` — whether values are currently hidden
- `setIsHidden(bool)` — set visibility
- `toggleHidden()` — toggle visibility

**Keyboard Shortcut:** Cmd+Shift+H / Ctrl+Shift+H (does not trigger when input is focused)

**Consumer:** `<PrivacyWrapper>` component wraps any monetary display. When `isHidden` is true, it replaces content with `••••••`.

### 11.2 GlobalCategoryContext

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

## 12. Component Inventory

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
| `Calendar` | `src/components/Calendar/Calendar.jsx` | Main calendar container with month navigation |
| `CalendarGrid` | `src/components/Calendar/CalendarGrid.jsx` | 7-column grid layout |
| `CalendarDay` | `src/components/Calendar/CalendarDay.jsx` | Individual day cell with expense badges |
| `CalendarHeader` | `src/components/Calendar/CalendarHeader.jsx` | Day-of-week headers |
| `CalendarCycleButton` | `src/components/Calendar/CalendarCycleButton.jsx` | Pay cycle reset trigger |
| `ExpenseBadge` | `src/components/Calendar/ExpenseBadge.jsx` | Expense indicator on calendar days |
| `QuickActions` | `src/components/Calendar/QuickActions.jsx` | Quick action popup on day click |
| `UpcomingRecurringWidget` | `src/components/Calendar/UpcomingRecurringWidget.jsx` | Shows next scheduled recurring expenses |

### Expenses Table System

| Component | Path | Description |
|---|---|---|
| `FixedExpensesTable` | `src/components/FixedExpensesTable.jsx` | Main table orchestrator |
| `ExpenseTableContainer` | `src/components/ExpenseTableContainer.jsx` | Table wrapper with overflow handling |
| `ExpenseTableHeader` | `src/components/ExpenseTableHeader.jsx` | Column headers |
| `ExpenseTableBody` | `src/components/ExpenseTableBody.jsx` | Table body with category grouping |
| `ExpenseCategoryGroup` | `src/components/ExpenseCategoryGroup.jsx` | Collapsible category section |
| `DraggableExpenseRow` | `src/components/DraggableExpenseRow.jsx` | Individual expense row with DnD |
| `QuickAddRow` | `src/components/QuickAddRow.jsx` | Inline row for adding new expenses |
| `ExpenseMobileView` | `src/components/ExpenseMobileView.jsx` | Card-based layout for mobile |
| `MobileExpenseCard` | `src/components/MobileExpenseCard.jsx` | Single expense card for mobile |
| `OneOffExpensesView` | `src/components/OneOffExpensesView.jsx` | Future one-off expenses list |

### Expense Modals & Panels

| Component | Path | Description |
|---|---|---|
| `AddExpensePanel` | `src/components/AddExpensePanel.jsx` | Slide-out panel for adding expenses |
| `RecurringExpenseModal` | `src/components/RecurringExpenseModal.jsx` | Convert expense to recurring template |
| `DuplicateExpenseModal` | `src/components/DuplicateExpenseModal.jsx` | Duplicate an expense with modifications |
| `RecurringTemplatesManager` | `src/components/RecurringTemplatesManager.jsx` | Full templates CRUD interface |

### Credit Card Components

| Component | Path | Description |
|---|---|---|
| `EnhancedCreditCard` | `src/components/EnhancedCreditCard.jsx` | Visual credit card component with stats |
| `CreditCardSelector` | `src/components/CreditCardSelector.jsx` | Dropdown selector for credit cards |
| `CreditCardPaymentInput` | `src/components/CreditCardPaymentInput.jsx` | Specialized input for CC payment amounts |
| `CreditCardDeletionModal` | `src/components/CreditCardDeletionModal.jsx` | Enhanced deletion with expense reassignment |
| `CreditCardMigrationModal` | `src/components/CreditCardMigrationModal.jsx` | Auto-link expenses to credit cards |
| `CreditCardPaymentTester` | `src/components/CreditCardPaymentTester.jsx` | Dev tool for testing payment flows |
| `CreditCardDemo` | `src/components/CreditCardDemo.jsx` | Demo component for Storybook |

### Category System

| Component | Path | Description |
|---|---|---|
| `CategoryManager/index` | `src/components/CategoryManager/index.jsx` | Main category management interface |
| `CategoryGrid` | `src/components/CategoryManager/CategoryGrid.jsx` | Grid layout of category cards |
| `CategoryCard` | `src/components/CategoryManager/CategoryCard.jsx` | Individual category display |
| `CategoryForm` | `src/components/CategoryManager/CategoryForm.jsx` | Add/edit category form |
| `CategoryContext` | `src/components/CategoryManager/CategoryContext.jsx` | Local context for CategoryManager |
| `CategoryRenameModal` | `src/components/CategoryManager/CategoryRenameModal.jsx` | Rename category modal |
| `CategoryDeletionModal` | `src/components/CategoryManager/CategoryDeletionModal.jsx` | Delete with reassignment |
| `CategoryDropZone` | `src/components/CategoryManager/CategoryDropZone.jsx` | DnD drop target |
| `CategoryExpenseSummary` | `src/components/CategoryExpenseSummary.jsx` | Visual category breakdown |
| `CategoryDetailView` | `src/components/CategoryDetailView.jsx` | Detailed category analytics |

### Summary & Insight Cards

| Component | Path | Description |
|---|---|---|
| `PaySummaryCard` | `src/components/PaySummaryCard.jsx` | Expense totals by payment timing |
| `PayDateCountdownCard` | `src/components/PayDateCountdownCard.jsx` | Countdown to next paycheck |
| `ProjectedBalanceCard` | `src/components/ProjectedBalanceCard.jsx` | Discretionary balance after bills |
| `NextCheckExpensesCard` | `src/components/NextCheckExpensesCard.jsx` | Expenses due with next paycheck |
| `ThisWeekExpensesCard` | `src/components/ThisWeekExpensesCard.jsx` | Expenses due this week |
| `BudgetVsActualDashboard` | `src/components/BudgetVsActualDashboard.jsx` | Budget vs. actual comparison |
| `MonthlyTrends` | `src/components/MonthlyTrends.jsx` | 12-month trend visualization |
| `DebtPayoffCalculator` | `src/components/DebtPayoffCalculator.jsx` | Snowball/Avalanche calculator |
| `OverpaymentAnalysis` | `src/components/OverpaymentAnalysis.jsx` | Where spending exceeds budget |
| `CreditCardDebtTable` | `src/components/CreditCardDebtTable.jsx` | Credit card debt overview table |
| `DonutChart` | `src/components/DonutChart.jsx` | SVG donut chart visualization |

### Shared UI Components

| Component | Path | Description |
|---|---|---|
| `InlineEdit` | `src/components/InlineEdit.jsx` | Click-to-edit text/number/date/select |
| `CollapsibleCard` | `src/components/CollapsibleCard.jsx` | Expandable/collapsible card |
| `CollapsibleCardGroup` | `src/components/CollapsibleCardGroup.jsx` | Accordion group (exclusive mode) |
| `IconSelector` | `src/components/IconSelector.jsx` | Emoji/icon picker |
| `StatusBadge` | `src/components/StatusBadge.jsx` | Colored status pill |
| `ErrorDisplay` | `src/components/ErrorDisplay.jsx` | Error message display |
| `AccountSelector` | `src/components/AccountSelector.jsx` | Account dropdown with smart filtering |
| `PaymentSourceSelector` | `src/components/PaymentSourceSelector.jsx` | Combined account/credit card selector |
| `PaycheckManager` | `src/components/PaycheckManager.jsx` | Paycheck settings editor |
| `PrivacyWrapper` | `src/components/PrivacyWrapper.jsx` | Conditionally hides content in privacy mode |

---

## 13. Utilities

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
| `validateAccountType(type)` | Must be "checking" or "savings" |
| `validateCreditCard(data)` | All required fields present and valid |
| `validateForm(fields)` | Batch validate multiple fields |
| `sanitizeObject(obj)` | Deep sanitize all string properties |

### `expenseValidation.js`

V4-specific expense validation.

| Function | Description |
|---|---|
| `validatePaymentSource(expense)` | Ensures exactly one of accountId/creditCardId is set |
| `validateCreditCardPayment(expense)` | Ensures CC payments have accountId + targetCreditCardId |
| `getPaymentSourceType(expense)` | Returns "account", "creditCard", or "none" |
| `isCreditCardPayment(expense)` | Checks if category is "Credit Card Payment" |

### `accountUtils.js`

Account-related display and lookup helpers.

| Function | Description |
|---|---|
| `formatCurrency(amount)` | Formats number as `$1,234.56` |
| `createAccountMapping(accounts)` | Creates id→account Map |
| `findSelectedAccount(accounts, id)` | Find account by ID |
| `validateAccount(data)` | Validate account object |

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

### `exportUtils.js`

| Function | Description |
|---|---|
| `exportJSONData(progressCallback)` | Full database export as downloadable JSON file |

### `logger.js`

Structured logging with levels: `debug`, `info`, `warn`, `error`, `success`, `db`, `component`.

### `errorHandler.js`

| Object | Description |
|---|---|
| `ErrorHandler` | Categorize errors by type and severity, generate user-friendly messages, suggest recovery actions |
| `createErrorBoundaryHandler` | Factory for React Error Boundary handlers |
| `createAsyncHandler` | Wraps async functions with error handling |
| `createValidationHandler` | Validation-specific error handler |

### `pagination.js`

| Function | Description |
|---|---|
| `createPaginatedResult(items, page, size)` | Paginate an array |
| `createPaginatedQuery(table, page, size)` | Paginate a Dexie query |
| `createInfiniteScrollQuery(table, cursor, size)` | Cursor-based pagination |
| `createSearchQuery(table, field, term)` | Full-text search |
| `processBatch(items, batchSize, fn)` | Process items in batches |
| `streamData(table, batchSize, fn)` | Stream table data in batches |

### `notifications.jsx`

| Function | Description |
|---|---|
| `notify.success(msg)` | Green toast |
| `notify.error(msg)` | Red toast |
| `notify.info(msg)` | Blue toast |
| `notify.warning(msg)` | Yellow toast |
| `showConfirmation(msg)` | Confirmation dialog |

---

## 14. State Management

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

Only `currentPage` and `isPanelOpen` are persisted to localStorage via Zustand's `persist` middleware. All financial data is loaded fresh from IndexedDB on every app boot.

---

## 15. Design System

### Liquid Glass

Digibook uses a custom "Liquid Glass" design system inspired by Apple's iOS glassmorphism aesthetic.

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
  backdrop: {
    light: 'rgba(255, 255, 255, 0.8)',
    dark:  'rgba(0, 0, 0, 0.8)',
  },
}
backdropBlur: { glass: '14px' }
borderRadius: { glass: '24px' }
boxShadow: {
  glass:       '0 4px 20px rgba(0, 0, 0, 0.25)',
  'glass-light': '0 4px 20px rgba(255, 255, 255, 0.1)',
}
```

#### CSS Component Classes (defined in `index.css`)

| Class | Usage |
|---|---|
| `.glass-card` | Content cards with backdrop blur |
| `.glass-panel` | Larger content panels |
| `.glass-sidebar` | Sidebar with fixed glass styling |
| `.glass-button` | Standard button with glass effect |
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
| `.text-primary` | Primary text color |
| `.text-secondary` | Secondary text color |
| `.text-muted` | Muted text color |
| `.empty-state` | Empty state container |
| `.empty-state-icon` | Empty state illustration |

#### Animations

| Animation | Description |
|---|---|
| `ripple` | Button press feedback (0.4s scale + fade) |
| `fade-in` | Content entry (0.3s opacity) |
| `slide-in` | Sidebar/panel entry (0.3s translateX) |

#### Responsive Breakpoints

| Breakpoint | Usage |
|---|---|
| Mobile (< 1024px) | Hamburger menu, card-based layouts, stacked forms |
| Desktop (>= 1024px) | Fixed sidebar, table layouts, multi-column grids |

---

## 16. Data Management & Backup

### Export Formats

| Format | Scope | Method |
|---|---|---|
| JSON | Full database (all tables) | `exportJSONData()` or Cmd+E |
| CSV | Per-table files | `dataManager.exportData('csv')` |
| Credit Cards CSV | Credit cards table only | `dataManager.exportCreditCardsCSV()` |

### Import Flow

1. User selects JSON or CSV file
2. Confirmation dialog warns about data overwrite
3. Auto-backup created in localStorage
4. File parsed and validated (V4 format, data integrity)
5. V3→V4 migration applied if needed
6. Database cleared and replaced atomically (single Dexie transaction)
7. Category cache invalidated
8. Store reloaded from fresh database
9. Future expense generation prompt shown if applicable

### Backup System (BackupManager)

- **Storage:** localStorage (backup data stored as JSON strings with checksums)
- **Rotation:** Maximum 5 backups; oldest deleted when limit reached
- **Checksum:** SHA-256 integrity verification
- **Triggers:** Auto-created before import, clear, and restore operations
- **Restore:** User can manually restore from most recent backup via Settings

### V3 → V4 Migration

Legacy data where `accountId` was a string like `"cc-1"` is automatically migrated:
- `accountId: "cc-1"` → `creditCardId: 1, accountId: null`
- Runs on app boot if V4-incompatible data is detected
- Non-blocking; failures are logged but don't prevent app load

---

## 17. Security & Privacy

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

## 18. Performance Optimizations

| Optimization | Location | Description |
|---|---|---|
| Lazy loading | `App.jsx` | All pages except Settings loaded via `React.lazy()` |
| Selector hooks | `useAppStore.js` | Each state slice has a dedicated hook to prevent unnecessary re-renders |
| Memoized calculations | `useMemoizedCalculations` | Expense grouping, totals, statuses memoized with `useMemo` |
| Memoized service instances | `usePaycheckCalculations` | `PaycheckService` only reinstantiated when settings change |
| Category caching | `categoryCache.js` | 30s TTL with stale-while-revalidate |
| Schwartzian transform | `useMemoizedCalculations` | Pre-compute sort keys for O(N) instead of O(N log N) per comparison |
| Optimistic updates | `useExpenseOperations` | UI updates immediately; DB writes async with rollback |
| Background pre-generation | `useAppStore.loadData()` | Recurring expense generation is non-blocking after initial load |
| Pending transaction Map | `Accounts.jsx` | Pre-computed `pendingByAccount` Map for O(1) per-account lookups |

---

## 19. Testing Strategy

### Unit Tests (Vitest + jsdom)

- **Location:** `src/**/*.test.js`, `src/**/*.spec.js`
- **Environment:** jsdom with `fake-indexeddb` for IndexedDB mocking
- **Setup:** `src/test/setup.js`
- **Focus:** Services, utilities, database helpers, custom hooks

### Component Tests (React Testing Library)

- **Focus:** Component rendering, user interactions, state changes
- **Pattern:** Render component → simulate user action → assert DOM changes

### Visual Tests (Storybook)

- **Location:** `src/stories/`
- **Framework:** Storybook 9 with Chromatic
- **Addons:** a11y (accessibility), docs, onboarding, vitest integration

### Browser Tests (Playwright)

- **Integration:** Storybook test runner with Playwright (Chromium)
- **Focus:** Full-page interaction flows

### Commands

| Command | Description |
|---|---|
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Single test run |
| `npm run test:coverage` | Run with coverage report |
| `npm run test:ui` | Open Vitest UI |
| `npm run storybook` | Start Storybook dev server |

---

## 20. Developer Tooling & Code Quality

### Code Style

- **ESLint:** `eslintrc.cjs` with React, accessibility, and Prettier plugins
- **Prettier:** Consistent formatting (config in `.prettierrc`)
- **Commitlint:** Conventional commits enforced (`feat:`, `fix:`, `docs:`, `refactor:`, etc.)

### Git Hooks (Husky)

| Hook | Action |
|---|---|
| `pre-commit` | Runs lint-staged (ESLint + Prettier on staged files) |
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

## 21. Glossary

| Term | Definition |
|---|---|
| **Liquid Balance** | Sum of all bank account balances (excludes credit cards) |
| **Projected Balance** | Current balance + pending transactions |
| **Discretionary Balance** | Default account projected balance minus total remaining unpaid expenses |
| **Dual Foreign Key** | V4 architecture where expenses use either `accountId` or `creditCardId`, never both |
| **Credit Card Payment** | Special expense category where money moves from a bank account to a credit card |
| **Pay Cycle** | The period between two paychecks (14 days for biweekly) |
| **Recurring Template** | A template that auto-generates future expense instances on a schedule |
| **Optimistic Update** | Updating the UI immediately before the database confirms the write |
| **Glass Morphism** | Design style using backdrop blur and transparency for a frosted glass effect |
| **V4 Migration** | Automatic conversion of V3 data (where credit card IDs were stored as `"cc-N"` strings in accountId) to the V4 dual foreign key format |
| **Self-Healing** | The system's ability to auto-infer missing data (e.g., matching a Credit Card Payment to its target card by name) |
| **Pre-Generation** | Creating future expense instances from recurring templates up to N months ahead |

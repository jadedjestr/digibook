# React 19 upgrade: preparation plan

**Status: planned, not started.** Written 2026-11-02. Nothing in this plan has
been implemented; it exists so the work can be picked up later without
re-deriving it. Companion to [ARCHITECTURE.md](ARCHITECTURE.md) (how the app is
built) and [AGENTS.md](AGENTS.md) (working agreements).

## In one paragraph

The app runs React 18.3.1; the latest is 19.3.1. The upgrade is not urgent and
brings the app only modest benefits, but two things make it worth preparing
for: React 19 **silently drops** a feature the app uses in 37 files
(`defaultProps`), and two libraries (the charts and the icons) must move first.
Every preparation step below works on today's React 18, so the work can be done
in small, safe, individually reversible pieces, and stopped at any point.

## Why, and why not yet

**What the upgrade would give this app** (a local-first, browser-only app):

- Less boilerplate: components can take a `ref` directly (two `forwardRef`
  wrappers could go), and the `defaultProps` workaround disappears.
- A built-in tool for optimistic updates, which `useExpenseOperations` writes by
  hand today. Optional; the hand-written version works.
- A longer runway: React 18 is the older line and libraries will increasingly
  target 19.

**What it would not give:** speed. The timing work (ARCHITECTURE.md section 14)
showed the slow parts were storage, not React, and React 19's larger performance
work is aimed at server rendering, which this app does not use.

**Why it has not happened:** React was set once, in the first commit (July
2025), and nothing has forced a change. It was never a decision that got
blocked; it was never a decision.

**When to do it:** when a library you want requires React 19, or at a quiet
moment to clear the console warnings. Not before.

## Where things stand (checked 2026-11-02)

| Item | Today | Needed for React 19 |
|---|---|---|
| `react`, `react-dom` | 18.3.1 | 19.x (latest 19.3.1) |
| `recharts` (Insights charts) | 2.12.7, allows React up to 18 | 2.15.0 or later allows 19; latest 2.x is 2.15.4 |
| `lucide-react` (icons) | 0.263.1, allows React up to 18 | 0.400.0 or later allows 19; newest 0.x is 0.577.0; 1.x exists (1.66.0) |
| `react-toastify` 11, `zustand` 5, `@testing-library/react` 16.3, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | already allow 19 | nothing |
| Storybook 9.1.5 | allows 19 | nothing |

That is every installed dependency that declares a React requirement (10 of
them): only `react-dom` itself and the two libraries above do not allow 19.

**Verified in a throwaway folder outside the repo (nothing installed in the
project):**

- Every one of the 57 icon names and 9 chart names the app imports exists in
  lucide-react 0.475.0 and 1.66.0 and in recharts 2.15.4 and 3.10.1. A name
  existing does not mean the artwork or behavior is identical; see the risks.
- Recharts 2.15.4 turns its axis components into class components that keep
  `defaultProps` (class components still support it in React 19). Recharts
  2.12.7, which the app uses today, uses `defaultProps` on function components,
  which is what prints the `XAxis`/`YAxis` warnings in the console and would
  break under React 19. So recharts 2.15.4 is the right target within 2.x; it
  also quiets those two warnings.

**What the app already does right:** it starts with `createRoot`, uses no
`findDOMNode`, no `ReactDOM.render`, no string refs, no `react-dom/test-utils`,
no legacy context. Its three error boundaries are class components and do not
use `defaultProps`. None of these need work.

## What React 19 breaks for this app

### 1. `defaultProps` on function components (37 files, 116 defaults)

React 19 ignores `defaultProps` on function components: a prop that relies on
one would arrive as `undefined`. The fix is to move each default into the
function's own parameters.

**The trap:** 22 of these components (31 defaults) use an array, `Set`, `Map` or
object as a default. As `defaultProps` that default is one shared object. As a
default parameter (`creditCards = []`) it becomes a **new object on every
render**, which defeats `memo` and re-runs effects. The app has already met
this once: the calendar's day cells all redrew until their inputs were held in
module-level constants (see `src/components/Calendar/Calendar.jsx` and
`src/components/__tests__/CalendarDayRedraws.test.jsx`). A mechanical
find-and-replace would reintroduce that across the app. These defaults must
become shared module-level constants (for example one frozen empty array, one
empty `Set`, one empty `Map`). The full list is in the appendix.

### 2. PropTypes stop being checked at runtime (80 files)

React 19 ignores `propTypes`. Nothing crashes, but the runtime warnings about a
wrong prop type disappear. The static check remains: ESLint's `react/prop-types`
rule (set to `warn` in `.eslintrc.cjs`) still reads them. Decision for later:
keep PropTypes as lint-time documentation, or move to TypeScript (out of scope
here).

### 3. Libraries that must move first

Recharts and lucide-react, as in the table above.

### 4. Unknown until tried

React 19 also changes some smaller behavior (how errors are reported, ref
cleanup, StrictMode details). Nothing the app uses is on the removed list, but
the plan below treats the final bump as an experiment with a full check, not a
formality.

## The plan

Four phases. Each is independent, separately committed, and leaves the app
working on React 18. **Do them on a branch** (for example `react-19-prep`),
merge a phase only when its checks pass, and stop at any phase boundary.

### Phase 0: record a baseline (before touching anything)

So every later phase can be compared with something real.

- `npm run lint` clean; `npm run test:run` green (1,031 tests at the time of
  writing); `npm run build` succeeds, note the size of `dist`.
- Count the console warnings on each main screen (the `defaultProps` ones are
  expected today).
- Run the timing tool (see `scripts/perf/README.md`) for tiers A and C and note:
  confirming a payment (64 ms at one year, 180 ms at ten) and the app loads.
- Take screenshots of the Insights page (charts, icons) and the Fixed Expenses
  page, for visual comparison after Phases 2 and 3.
- Write the smoke list down (below).

### Phase 1: `defaultProps` to default parameters (React 18, safe, largest)

- **Method:** work in small batches, leaf components first, pages last. For each
  component move the defaults into the parameters; for every array, `Set`,
  `Map`, object or function default, use a named module-level constant.
- **Protect it first:** the identity-sensitive components (the 22 in the
  appendix) are where a regression hides. Before changing a component, check
  there is a test that would notice an extra redraw; where there is not, add
  one using the counting helpers in `src/test/perfCounters.js`. The calendar,
  store and priority-list tests already cover the most sensitive ones.
- **Stop it coming back:** add a lint rule that bans
  `Component.defaultProps =` on function components, and consider
  `react/require-default-props` with the `defaultArguments` style. (Plan only;
  the rule should land with the first batch so later batches cannot regress.)
- **Check after each batch:** lint, full tests, and the console on the touched
  screens: the `defaultProps` warnings for those components must be gone and no
  new warning may appear.
- **Done when:** the console shows no `defaultProps` warning from app code.

### Phase 2: move the two libraries (still React 18)

- **recharts to 2.15.4** (not 3.x: that is a rewrite with API changes, which
  would be a separate project). Compare the Insights page against the baseline
  screenshots: axis ticks, labels, tooltips, legend, bar colors.
- **lucide-react to the newest 0.x line** (0.577.0 at the time of writing), not
  1.x yet. Re-run the name check for the chosen version first (all 57 icon names
  must exist), then compare screenshots of every screen that shows icons:
  icon artwork and default sizing can change between versions even when the name
  still exists.
- **Check:** lint, tests, build (note the size change), screenshots, console.
- **Done when:** both packages allow React 19 and the app looks the same.

### Phase 3: bump React

- Raise `react` and `react-dom` to 19.x together, reinstall, and run everything:
  lint, tests (watch for new `act` warnings), a production build, the Storybook
  tests (they need the Playwright browsers installed), and the smoke list.
- Re-run the timing tool for tiers A and C; compare with the Phase 0 numbers.
- Compare screenshots and bundle size with the baseline.
- **Go or no-go:** if anything unexpected appears and is not understood within a
  reasonable effort, revert the one commit and keep the preparation (Phases 1
  and 2 stand on their own and are improvements on React 18).

### Phase 4 (optional, later, separate decisions)

Not part of this plan; listed so they are not forgotten. Drop the two
`forwardRef` wrappers (`src/components/DatePicker.jsx`,
`src/components/Calendar/CalendarGrid.jsx`); evaluate React's built-in
optimistic-update tool against the hand-written one; evaluate the React
Compiler (it also works on React 18 and relates to the redraw work in
ARCHITECTURE.md section 14); decide about recharts 3 and lucide 1.

## Checks to run at the end of every phase

1. `npm run lint` and `npm run test:run` green (baseline: 1,031 tests).
2. `npm run build`, and the size of `dist` against the baseline.
3. The console on each main screen: fewer warnings than before, none new.
4. The timing tool (`scripts/perf/run.mjs`, tiers A and C) within about 15
   percent of the baseline, using the in-page "confirm a payment" row.
5. The smoke list, by hand:
   - Unlock with the PIN; Accounts; Pending Transactions.
   - Fixed Expenses: calendar, change month, pay a bill, skip a bill, edit one.
   - Credit Cards: add, edit, pay extra. Loans: view, pay extra.
   - Insights: every chart and both payoff calculators.
   - Settings: categories, export, restore, appearance.
6. Screenshots of Insights and Fixed Expenses against the baseline.

## Risks and how the plan answers them

| Risk | Answer |
|---|---|
| A default array becomes a new object each render and the app redraws far more | Module-level constants; counting tests on the sensitive components first |
| Charts change subtly (axis defaults, spacing) | Recharts 2.15.4 only; screenshot comparison before and after |
| Icons look different or change size | Newest 0.x only; name check plus screenshots; 1.x deferred |
| Lost runtime prop checking after React 19 | Accepted; lint still checks statically |
| Something unlisted breaks in the final bump | Phases 1 and 2 stand alone; the bump is one revertable commit |
| A library we have not checked drops React 18 meanwhile | Re-check peer ranges when starting |

## What this plan deliberately does not do

No TypeScript migration, no recharts 3, no lucide 1.x, no React Compiler, no
state-management or routing changes. Each of those is its own decision.

## Open questions for the owner

- Is there a trigger that would make the upgrade worth doing now (a library or
  feature that needs React 19)? If not, Phase 1 alone is a reasonable first step
  because it is safe on React 18 and clears the console warnings.
- Keep PropTypes as lint-time documentation, or plan a move to TypeScript later?

## Appendix: the `defaultProps` inventory (37 files, 116 defaults)

**22 files with an array, `Set`, `Map` or object default (identity matters):**

| File | Defaults that need a shared constant |
|---|---|
| `src/components/Calendar/Calendar.jsx` | `monthExpenses`, `virtualExpenses` |
| `src/components/CategoryManager/BulkColorModal.jsx` | `colorOptions` |
| `src/components/CategoryManager/BulkIconModal.jsx` | `iconCategories` |
| `src/components/CategoryManager/CategoryForm.jsx` | `existingCategories`, `iconCategories` |
| `src/components/CategoryManager/CategoryGrid.jsx` | `selectedCategories` |
| `src/components/CategoryManager/ColorPicker.jsx` | `colorOptions` |
| `src/components/CreditCardDebtTable.jsx` | `creditCards` |
| `src/components/CreditCardDeletionModal.jsx` | `accounts`, `creditCards` |
| `src/components/DebtPayoffCalculator.jsx` | `creditCards` |
| `src/components/EnhancedCreditCard.jsx` | `payAccounts` |
| `src/components/EnhancedLoanCard.jsx` | `payAccounts` |
| `src/components/LoanDebtTable.jsx` | `loans` |
| `src/components/LoanPayoffCalculator.jsx` | `loans` |
| `src/components/MissingExpensesModal.jsx` | `cards` |
| `src/components/MonthlyTrends.jsx` | `history` |
| `src/components/OneOffExpensesView.jsx` | `balanceDueExpenseIds` |
| `src/components/OverpaymentAnalysis.jsx` | `categories` |
| `src/components/PriorityExpenseList.jsx` | `resolvedExpenseIds`, `balanceDueExpenseIds`, `extraPaidCentsByExpenseId`, `rolledByExpenseId` |
| `src/components/PriorityExpenseRow.jsx` | `rolledIn` |
| `src/pages/CreditCards.jsx` | `accounts`, `creditCards` |
| `src/pages/Insights.jsx` | `accounts`, `creditCards`, `loans` |
| `src/pages/Loans.jsx` | `accounts` |

**15 files with only simple defaults (numbers, text, booleans, `undefined`):**
`src/components/Calendar/PayCycleNudgeBanner.jsx`,
`src/components/Calendar/PayCycleNudgeToast.jsx`,
`src/components/CardPaymentModeField.jsx`,
`src/components/CategoryManager/CategoryCard.jsx`,
`src/components/ChooseFundingAccountModal.jsx`,
`src/components/CollapsibleCardGroup.jsx`,
`src/components/CreateAccountModal.jsx`,
`src/components/CreditCardPaymentInput.jsx`,
`src/components/DatePicker.jsx`,
`src/components/EditExpenseModal.jsx`,
`src/components/EmptyState.jsx`,
`src/components/InlineEdit.jsx`,
`src/components/LoanDeletionModal.jsx`,
`src/components/ResolveExpenseModal.jsx`,
`src/components/Sidebar.jsx`.

These counts came from a scan on 2026-11-02; re-run the scan when starting,
since files change. The three error boundaries (`src/components/ErrorBoundary.jsx`,
`src/components/AccountSelectorErrorBoundary.jsx`,
`src/components/CategoryManager/CategoryManagerErrorBoundary.jsx`) are class
components without `defaultProps` and are unaffected.

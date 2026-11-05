# UX audit: navigation, touch and accessibility

**Status: findings recorded, none fixed.** Audited 2026-11-05 on the production
build. This document is the evidence and a ranked list; it changes nothing.
Companion to [ARCHITECTURE.md](ARCHITECTURE.md) and
[REACT_19_UPGRADE_PLAN.md](REACT_19_UPGRADE_PLAN.md).

## In one paragraph

The app is efficient in taps (paying a bill is two taps from Fixed Expenses) and
has no iPhone input-zoom problem. It has six kinds of problem worth fixing, led
by a menu in the hardest-to-reach corner on a phone, frequent buttons smaller
than Apple's 44-point guideline, a back swipe that leaves the app, and gaps for
screen-reader users. Two of the six are cheap.

## How it was done, and what that does and does not prove

`scripts/ux/audit.mjs` drives the **production build** in a brand-new,
phone-sized (390 x 844, touch) browser profile with a year of sample data and a
throwaway PIN, so your own data is never touched. It counts taps for common
tasks, measures every interactive element on every main screen, and runs the
accessibility engine axe-core (4.10.3) on each.

```bash
npm run build
node scripts/ux/audit.mjs      # prints a summary, writes scripts/ux/results/audit.json
```

**Limits, so the numbers are read correctly:**

- **It is not Safari and not an iPhone.** It is Playwright's Chromium at iPhone
  size with touch. Scroll feel, real thumb reach, notch spacing, the home-screen
  install and iOS storage behavior still need a real phone.
- **Sample data.** Loans is empty in it, so only the empty Loans screen was
  scanned.
- **A small size is a measurement, not always a failure.** Controls with enough
  space around them can meet accessibility rules at 24 x 24 points. Apple's
  guideline is 44 x 44.
- **axe finds roughly a third of accessibility problems.** A clean scan would not
  mean accessible, and only a few screen-reader behaviors were checked by hand.
- **Milliseconds are not reported.** The tool's own clicks wait for moving
  buttons to hold still, which once made a 9 ms action look like 950 ms
  (ARCHITECTURE.md section 14). Only tap counts are trusted here.
- Sizes are CSS pixels, which equal points on an iPhone.

## What is good

- **Few taps.** Switch month, or open a tab: 1 tap. Add an expense: 1 tap to
  open, 3 fields (name, amount, category). Pay a bill: 2 taps from Fixed
  Expenses (Pay now, Pay full). Export everything: 2 taps once on Settings.
- **No iPhone input-zoom problem.** Every text field is at least 16 px, so Safari
  does not jump-zoom when one is tapped. Zero risks on every screen.
- **Responsive.** The earlier timing work found a month switch answers in about
  9 ms and confirming a payment in 64 to 180 ms (ARCHITECTURE.md section 14).
- **The Add Expense panel closes with Escape** and is marked as a dialog. The Pay
  extra dialog's Cancel button is a good size (84 x 50).

## Taps per task

| Task | Taps |
|---|---|
| Open any screen from another screen | 2 (menu, then the screen) |
| Switch month, open "Where Your Bills Go", open "All Future One-Offs" | 1 each |
| Open the Add Expense panel | 1 |
| Pay a bill, from Fixed Expenses | 2 |
| Pay a bill, from another screen (menu, Fixed Expenses, Pay now, Pay full) | 4 |
| Open Pay extra on a card, from Credit Cards | 1 |
| Export everything, from Settings (expand Data Management, Export JSON) | 2 |
| Lock the app (menu, Lock) | 2 |

## Findings, ranked

| # | Finding | Evidence | Effort |
|---|---|---|---|
| 1 | The menu is in the hardest spot to reach | The hamburger button is at the top-left corner (x 16, y 16, 46 x 48), about 95 percent of the way up a 844-point screen; every screen change is 2 taps. See `src/components/Sidebar.jsx` | Medium: a design change (for example a bottom tab bar for the four or five main screens) |
| 2 | Frequent buttons are under 44 points | "Pay now" 70 x 30 (18 on one screen, `src/components/PriorityExpenseRow.jsx`); Credit Cards "Change" 49 x 20 and Edit/Delete card 38 x 26; Pending Transactions "Mark as Completed" and "Delete Transaction" 32 x 32 side by side, 40 times (`src/components/PendingTransactionRow.jsx`), so an accidental delete is easy; template Edit/Pause/Delete 24 x 24, 25 rows of three (`src/components/RecurringTemplatesManager.jsx`); category checkboxes 16 x 16, some inputs 13 x 13 (`src/components/CategoryManager/CategoryCard.jsx`) | Low: mostly padding and spacing |
| 3 | The back swipe leaves the app | Every screen is at `/`; after navigating, going back lands on a blank page. No bookmarks or direct links, and every screen has the same page title. Navigation is React state (`src/App.jsx`) | Medium: record each screen in the browser history |
| 4 | Screen-reader (VoiceOver) problems | 70 calendar day cells are marked as grid cells but are not inside a grid (axe: critical; `src/components/Calendar/CalendarDay.jsx`, `src/components/Calendar/CalendarGrid.jsx`); on Settings, 11 unlabeled file inputs, 4 unlabeled dropdowns and 10 buttons nested inside buttons; 2 buttons with no text; a credit-utilization label on a plain element that screen readers ignore; 2 scrollable areas the keyboard cannot reach | Medium, in small pieces |
| 5 | The Pay extra dialog ignores Escape and is not marked as a dialog | Escape does not close it with focus outside or inside it (`src/components/PayExtraModal.jsx` handles the key only on one element); it has no dialog role. Cancel works | Low |
| 6 | Minor structure | Heading levels skip on 7 screens; 35 elements sit outside page landmarks on 10 screens; the PIN screen has a 20 x 20 button with no label | Low |

Every screen shares the page title "Digibook - Personal Finance Tracker". The
first two `h1` elements on every screen are the app name (the sidebar's mobile
and desktop copies); whether each screen's own title uses a lower heading level
was not examined.

## Per screen

Interactive elements, how many are under 44 points, under 24 points, input-zoom
risks, and accessibility issues found by axe:

| Screen | Elements | Under 44 | Under 24 | Zoom | axe |
|---|---|---|---|---|---|
| PIN screen (first launch) | 4 | 1 | 1 | 0 | 2 |
| Fixed Expenses: Month View | 97 | 66 | 9 | 0 | 3 |
| Fixed Expenses: Where Your Bills Go | 28 | 4 | 0 | 0 | 1 |
| Fixed Expenses: All Future One-Offs | 14 | 1 | 0 | 0 | 1 |
| Add Expense panel | 158 | 116 | 9 | 0 | 4 |
| Credit Cards | 35 | 12 | 4 | 0 | 3 |
| Pay extra dialog | 44 | 15 | 4 | 0 | 3 |
| Loans (empty in the sample data) | 11 | 0 | 0 | 0 | 2 |
| Insights | 16 | 3 | 0 | 0 | 2 |
| Pending Transactions | 291 | 280 | 0 | 0 | 1 |
| Accounts | 19 | 8 | 0 | 0 | 2 |
| Settings | 239 | 209 | 26 | 0 | 6 |

The Add Expense and Pay extra rows include the elements behind the open panel.

## The accessibility issues in detail

| Issue (axe rule) | Impact | Elements | Where |
|---|---|---|---|
| Certain ARIA roles must be contained by particular parents (`aria-required-parent`) | critical | 70 | Fixed Expenses calendar, Add Expense panel |
| Form elements must have labels (`label`) | critical | 11 | Settings |
| Select element must have an accessible name (`select-name`) | critical | 4 | Settings |
| Buttons must have discernible text (`button-name`) | critical | 2 | PIN screen, Add Expense panel |
| Interactive controls must not be nested (`nested-interactive`) | serious | 10 | Settings |
| Elements must only use permitted ARIA attributes (`aria-prohibited-attr`) | serious | 8 | Credit Cards, Pay extra dialog |
| Scrollable region must have keyboard access (`scrollable-region-focusable`) | serious | 2 | Insights, Settings |
| All page content should be contained by landmarks (`region`) | moderate | 35 | 10 screens |
| Heading levels should only increase by one (`heading-order`) | moderate | 7 | 7 screens |

## A suggested order (not started)

1. **Finding 2, the cheap part:** raise the hit area of "Pay now", the Pending
   Transactions buttons and the template buttons to 44 points with padding, and
   separate "Delete" from "Mark as Completed". Then re-run the audit.
2. **Finding 5:** close the Pay extra dialog on Escape and mark it as a dialog.
3. **Finding 4,** in small pieces: label the Settings fields and dropdowns, give
   the calendar a real grid structure, un-nest the category buttons.
4. **Finding 3:** one history entry per screen, so the back swipe goes back.
5. **Finding 1:** a deliberate design decision before any code; see below.

Run `node scripts/ux/audit.mjs` after each step and compare with the tables above.

## Open decisions

- Is a bottom tab bar acceptable for the main screens, and which four or five?
  The sidebar would stay for secondary screens (Settings, Lock).
- Is 44 points the target everywhere, or is 24 acceptable for dense lists (the
  template and category rows), provided there is spacing?
- Should "Delete" on a pending transaction ask for confirmation? (Not checked
  here whether it already does.)

## Not covered

A real iPhone and real Safari (scroll feel, notch and status bar, home-screen
install, storage after a week unused); VoiceOver used by hand; Dynamic Type and
text zoom; the loan screens with data; one-handed reach measured on a person;
and a think-aloud run through the main tasks, which only the owner can do.

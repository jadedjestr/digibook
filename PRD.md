# Digibook — Product Requirements

**Version:** 4.0
**Last updated:** September 13, 2026
**Owner:** Adrian Garcia
**Status:** live / active development

This document owns **what the product should do and why**.
How it is built lives in [ARCHITECTURE.md](ARCHITECTURE.md).
Rules for changing the code live in [AGENTS.md](AGENTS.md).

---

## Table of Contents

1. [The problem](#1-the-problem)
2. [Who it is for](#2-who-it-is-for)
3. [Principles](#3-principles)
4. [Jobs and capabilities](#4-jobs-and-capabilities)
5. [Success criteria](#5-success-criteria)
6. [Non-goals](#6-non-goals)
7. [Decisions](#7-decisions)
8. [Proposed, not built](#8-proposed-not-built)
9. [Open questions](#9-open-questions)

---

## 1. The problem

Money is spoken for before it arrives. Someone paid on a cycle has to answer a
recurring, stressful question: *after the bills that are due before my next
paycheck, is there enough left?*

Bank apps answer a different question. They report a balance that is already
wrong — it doesn't know about the card payment leaving on the 15th, the cheque
that hasn't cleared, or the paycheck landing on Friday. Budgeting apps answer a
third question, about categories and allocation, which is a different problem
for a different person.

Digibook exists to answer that one question accurately, in a glance, without
sending anyone's financial life to a server.

---

## 2. Who it is for

**Primary and only user: the thin-margin planner.**

Paid on a regular cycle. Carries revolving credit card debt and is paying it
down deliberately. Bills are mostly fixed and repeat. The gap between income
and obligations is narrow enough that being wrong by a hundred dollars has
consequences — an overdraft fee, a missed minimum payment.

They are not trying to build wealth. They are trying to clear the next two
weeks.

> **Their question, in their words:** *"If I pay this now, do I still make it
> to Friday?"*

Every requirement in this document should be traceable to answering that.

**Audience scope:** built for a single named user, not a public product. This
is a deliberate constraint, not a stage. It means defaults can be opinionated,
onboarding can be thin, and features can assume one person's mental model
rather than accommodating everyone's.

---

## 3. Principles

| Principle | What it means |
|---|---|
| **Local-first** | All financial data lives on the device, in the browser. No server, no account, no sync, no telemetry. Offline is the normal case, not a degraded one. |
| **Privacy by design** | The screen can be blanked in one tap and the app locked behind a PIN. Exports are the user's to control. Nothing is ever transmitted. |
| **Pay-cycle centric** | The unit of planning is the period between paychecks, not the calendar month. Bills are grouped by which paycheck has to cover them. |
| **An estimate must never move money** | Forecasts, predictions and defaults may inform what is *displayed*. A stored balance changes only when the user confirms a specific amount. This is the constraint that makes forecasting safe to do at all. |
| **Say the number, or say nothing** | Where the app cannot be accurate it must be visibly uncertain. A confident wrong figure is worse than an absent one. |
| **Zero configuration to usefulness** | Set a PIN, add an account, be productive. Everything else has a working default. |

---

## 4. Jobs and capabilities

Requirements are grouped by the job they serve. A capability that serves no job
below does not belong in the product.

### Job A — "Know what I can actually spend right now"

The bank balance is optimistic; the app's job is to be honest.

- Show the total across all cash accounts, and each account individually.
- Track money that has been committed but hasn't cleared — cheques written,
  card swipes pending, deposits in flight — as a separate ledger that adjusts
  the *projected* balance without touching the real one.
- Show current and projected balance side by side, and visibly distinguish
  them when they differ.
- Applying a pending item to the real balance is an explicit, single action.
- Deleting a pending item changes no real balance. Only completing it does.

### Job B — "Never miss a bill before the next paycheck"

- Record recurring and one-off bills with a name, amount, due date, category
  and funding source.
- Group every bill by which paycheck must cover it: due this week, due with
  the next check, due with the following one, or overdue.
- Show days remaining until the next two paychecks.
- Support partial payment, and correcting or reversing a payment afterwards.
- Generate future occurrences of recurring bills automatically, far enough
  ahead to be useful and without creating duplicates.
  - **Known gap:** today this only happens for a bill's very first occurrence,
    and inconsistently. A credit card's payment bill is made actionable
    immediately, no matter how far off its due date is. A manually added
    recurring bill is only made actionable immediately if its first due date
    falls within the current pay period — otherwise, like every later
    occurrence of any recurring bill, it only appears in the Overdue/This
    week/Later list once its due date actually arrives. Until then it's
    visible only as a forecast on the Calendar, not in this list, which can
    make an upcoming bill look farther away than it is.
- When a view is empty, say why and point at the next real thing rather than
  implying there is nothing to pay.
- Proactively surface unpaid bills from a past period, or a cycle ready to be
  reset — without nagging, and dismissible.
- Roll the cycle forward on demand: archive what was paid, reset amounts, and
  advance every due date by one pay period.

### Job C — "Know what's coming in"

Without this, every projection is systematically pessimistic and the core
question cannot be answered.

- Record where a paycheck lands and roughly how much to expect.
- On payday, surface the expected paycheck **as a pending item**, never as a
  balance change.
- Confirming it is one action and asks only for the amount that actually
  arrived — never for hours, rates or any figure the app would have to
  calculate.
- The expected amount improves itself from what has actually arrived, so
  irregular pay converges without configuration.
- The feature is opt-in, and turning it off removes predictions while
  preserving real history.

### Job D — "Pay down the cards without tipping into an overdraft"

- Track each card's balance, limit, rate, due date and minimum payment.
- Track each card's original balance, required on every new card, so
  progress paid down is visible, not just the current number.
- Optionally set a target payoff date; when set, calculate the required
  minimum payment automatically from the live balance and that date — the
  same amortization the loans job uses — recalculated fresh every cycle, so
  an extra payment lowers what's required next rather than leaving it stale.
  A card with no target date keeps working exactly as before.
- Support an intro/promotional APR as a required yes-or-no choice, never a
  silently-assumed rate: when set, use it in place of the standard rate
  through its stated end date.
- Warn when a manually-set payment won't reach the target date in time,
  showing the date it actually projects to instead.
- Show utilisation per card and overall, with severity visible at a glance,
  and how much paying down would take to reach a healthier utilisation.
- Model a card payment as what it is: money leaving an account *and* debt
  reducing, together or not at all.
- Keep each card's payment bill in step with its balance automatically.
- Project payoff timelines under different strategies and extra-payment
  amounts, as a pure what-if that can never alter real data — except through
  one explicit, confirmed action that applies a previewed payment for real.
- Deleting a card must not strand the bills that pointed at it.

### Job E — "Record what happened in seconds, on my phone"

The most frequent context is standing up, one-handed, mid-errand.

- Every core flow works at phone width, including marking a bill paid.
- Editing a value happens in place, where the value is displayed.
- The common action — "this is paid" — is reachable in one tap from the view
  the user is already on.
- Refuse ambiguous input rather than guessing: a cleared field is not a
  request to set a balance to zero.

### Job F — "Trust the numbers, and get back when something's wrong"

- The same figure must never disagree between two screens.
- Keep a readable history of money movements, with before-and-after balances.
- Back up automatically, before anything destructive and on a schedule.
- Restore any backup, not merely the most recent.
- Warn when an edit would overwrite a change made elsewhere, rather than
  silently discarding it.
- Reject unreadable imported data loudly; never substitute a plausible value
  for one that couldn't be read.

### Job G — "Use my data on whichever device I'm holding"

Local-first means each device holds its own database. Export and import are
therefore not a backup convenience — they are the **transfer mechanism**, and
are load-bearing.

- Export the complete dataset to a single portable file.
- Import that file on another device and arrive at an identical state.
- A file exported by one version must import into any version the user is
  plausibly still running, or fail with a clear explanation rather than
  corrupting data.
- Importing must work on a phone, not only a desktop.

### Job H — "Keep it off the screen when someone's beside me"

- One control blanks every monetary figure across the entire app, while
  leaving it navigable.
- A PIN locks the app outright.
- No analytics, no telemetry, no network calls carrying financial data.

### Job I — "Pay off a loan without losing track of the term"

- Track each loan's balance, interest rate and target payoff date.
- Keep the target payoff date honest against the actual contract: record the
  original loan amount, term, scheduled payment and maturity date, required
  on every loan, and show how the live target-driven numbers compare — ahead
  or behind the original schedule, more or less than the original payment.
  A goal is not the same thing as the deal that was signed, and the app
  should never conflate the two.
- Calculate the required payment automatically from the live balance and the
  target date — never typed in, and recalculated fresh every cycle, so an
  extra payment lowers what's required next rather than leaving it stale.
- Model a loan payment as what it is: money leaving an account *and* debt
  reducing, together or not at all.
- Project payoff timelines as a pure what-if that can never alter real data,
  reusing the same payoff math the cards already use.
- Reject a target payoff date that can't be reached — too soon, or already
  past — at input time, with a clear reason, rather than accepting it
  silently.
- Deleting a loan must not strand the bills that pointed at it.
- Optionally, know how much of a payment is interest vs. principal, and what's
  owed today beyond the stated balance — opt-in per loan, on the user's own
  numbers, never inferred. Daily simple interest, fixed 365-day year; a
  lender using a different convention will read slightly differently, and
  that gap is disclosed, not hidden. Undoing the loan's most recent payment,
  or correcting it to a different amount, restores principal and unpaid
  interest together, exactly — never just the cash.

---

## 5. Success criteria

Checkable statements. Each should be true of a shipped build.

1. The user can see their true spendable figure without doing arithmetic.
2. Every bill due before the next paycheck is visible without navigating away
   from the landing view.
3. Recording a payment takes one action from the page already open.
4. The same figure never disagrees between two screens.
5. No action changes a balance without the user confirming that specific
   amount.
6. A backup restores to a state indistinguishable from the original.
7. Every core flow is usable one-handed at phone width.
8. No financial data leaves the device, ever.

Criteria 4 and 5 were learned the expensive way — see [Decisions](#7-decisions).

---

## 6. Non-goals

Named so they don't creep in. These are decisions, not gaps.

- **Not an envelope budgeter.** It tracks obligations against a cycle. It does
  not allocate every dollar to a category in advance, and should not grow
  toward doing so.
- **No bank connections.** No aggregation, no automatic transaction import. The
  user is the source of truth, deliberately.
- **No multi-user.** No households, sharing, or permissions.
- **No cloud sync.** Data does not leave the device; transfer is by file, by
  hand. Accepted consequence: two devices can diverge.
- **No investments or net worth.** Cash and card debt only.
- **No advice.** It shows the user's numbers. It never recommends a financial
  action.
- **Not double-entry accounting.**

---

## 7. Decisions

Why things are the way they are. The code shows *what* was chosen; this is the
only record of *why*.

### Planning is anchored to paychecks, not months

Bills don't care about the 1st; the user's ability to pay them depends entirely
on when money arrives. Grouping by pay period matches how the decision is
actually made.

*Consequence, still open:* the main expense view nonetheless defaults to a
calendar month. See [Open questions](#9-open-questions).

### Expected income creates a pending item, never a balance change

A paycheck can be late, a different amount, or not arrive. Crediting a balance
on a date would let the app's numbers drift from the bank's silently — the
worst failure mode this product has, because the entire value proposition is
being more trustworthy than the bank app.

*Consequence, and the reason it's worth it:* because a real balance only moves
on confirmation, an inaccurate estimate can only ever make a forecast slightly
wrong. That single property is what makes forecasting safe to attempt.

### There is no salary-versus-hourly setting

Considered, and rejected as unnecessary. One question — "roughly how much do
you usually get?" — covers both, because the confirmation step corrects it
either way. Rate-times-hours would be wrong most paydays regardless, since tax
and deductions sit between gross pay and what arrives.

*Consequence:* an entire configuration screen doesn't exist.

### Money is parsed where it enters, not where it is stored

The common idiom for "fall back if empty" collapses "typed 0", "typed nothing"
and "typed garbage" into one indistinguishable value. Once collapsed, no
downstream validation can recover the difference — a validator sees a perfectly
valid zero. This shipped a bug that silently set a real account balance to $0.

*Consequence:* input is parsed at the edge into an explicit success-or-reason
result, and the collapsing idiom is banned by lint.

### Transfer between devices is by file, not by sync

Sync would require a server, which contradicts local-first. Export/import is
the accepted cost.

*Consequence:* export format compatibility is a product requirement, not an
implementation detail — a file from a newer build must not silently corrupt an
older one.

### Empty states name the next real thing

A view that said "Nothing due this month" while five bills sat one click away
answered the user's actual question wrongly. Worse, it was *well designed*,
which made it convincing.

*Consequence:* an empty state must distinguish "you have nothing" from "there
is nothing *here*", and point at where the something is.

---

## 8. Proposed, not built

Kept separate from the sections above, which describe what exists.

### Income, remaining work

Expected income is built and shipped. Not yet done:

- Per-source schedules, and more than one income source surfaced in the UI.
- Distinguishing income that recurs irregularly (gig work, variable shifts)
  from a scheduled paycheck.

### Verification owed

- Whether importing a file works inside an installed iOS home-screen app. Job G
  depends on it and it has never been tested on a real device.

---

## 9. Open questions

Genuine forks, recorded rather than silently decided.

**Should the main expense view default to the pay cycle rather than the
calendar month?** Everything else in the product is cycle-oriented; this one
surface isn't. Changing it is a real re-architecture of that view, and the
smaller fix (empty states that point forward) has already landed, so the
pressure is reduced but the inconsistency remains.

**How far should divergence between devices be tolerated?** Export/import makes
transfer possible but nothing detects that a phone and a laptop have drifted
apart, or helps merge them. Today the answer is "the user keeps track." It is
unclear whether that holds.

**Is a payday confirmation light enough to do fortnightly, forever?** The income
feature assumes confirming a paycheck feels like one tap, not a chore. If it
turns out to feel like data entry, the feature is worth reconsidering rather
than building further on.

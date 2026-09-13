# Working agreements

Short, durable rules for anyone — human or agent — changing this codebase.
For *what the product should do and why*, see [PRD.md](PRD.md).
For *how it is built*, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Before you commit

```bash
npm run lint       # --max-warnings 0, so a warning fails it
npm run test:run   # the full suite
```

- Commit subjects must be **lower-case** — commitlint rejects
  `feat: Add The Thing`. This bites on proper nouns and UI labels.
- A pre-commit hook rewrites staged files (ESLint `--fix` + Prettier), so
  re-read a file after committing before editing it again.
- Never `--no-verify`. If a hook fails, the hook is usually right.

## Money

This app moves real money, and every bug that reached a balance came from one
of these being ignored.

- **Parse money at the edge.** Anything turning untrusted input into an amount
  goes through `parseMoneyInput` (`src/utils/validation.js`). The
  `parseFloat(x) || fallback` idiom is banned by lint: it collapses "typed 0",
  "typed nothing" and "typed garbage" into one value, and once collapsed no
  downstream validation can recover the difference.
- **Never let an estimate reach a balance.** Forecasts and predictions create
  *pending* rows. A balance moves only when a user confirms a specific amount.
- **Sanitize whole records, not patches.** `sanitizeExpenseData` reasons about
  a complete expense; run it on a bare `{paidAmount, status}` patch and its
  rules fire against fields the patch never mentioned. Sanitize the merged
  record, then persist only the touched keys (`pickSanitizedUpdates`).

## Tests

- **Assert what a write left alone, not just what it changed.** A suite of 261
  passing tests missed a payment silently unlinking an expense from its credit
  card, because every assertion checked the fields that were supposed to move.
- **No wall-clock performance assertions.** Under a parallel suite they measure
  how busy the machine is. Count renders or operations instead.
- Prove a regression test fails against the old behaviour before trusting it.

## Working on the live app

- `npm run dev` serves the real database on port 5173. **That is the user's
  data.** Snapshot it before anything destructive.
- For anything risky, use a scratch profile — a different port is a different
  origin and therefore a different, empty database:
  ```bash
  npm run build && npx vite preview --port 4173
  ```
- Verify glass and fixed-position UI by asserting geometry and computed style,
  not by screenshot. Modals here render correctly while appearing blank in a
  captured image.

## Style

ESLint and Prettier enforce formatting, naming and hook rules on every commit,
so none of that is written down here — the linter cannot drift and a document
restating it can. What follows is the part tooling can't check.

- **Never hardcode a colour or a glass effect.** Use the design tokens and the
  `glass-*` classes; `bg-white/10` and `backdrop-blur-sm` bypass the system.
  See [ARCHITECTURE.md](ARCHITECTURE.md#11-design-system).
- **The Tailwind colour-word scales are aliases, not their names.** In
  `tailwind.config.js`, `blue-*` resolves to ochre, `gray`/`slate` to the warm
  neutrals, and `amber`/`orange` to yellow. They exist so ~641 existing call
  sites across 57 files kept working through the iOS 27 refit without a
  sweeping cosmetic diff. **Write new markup against the semantic names** —
  `accent`, `ink`, `ink-soft`, `surface`, `rule` — and read a colour word in
  old markup as "whatever the config says", never as the colour it spells.
- **Ochre is interactive, never a status.** Buttons, active nav and focus only.
  The warm alert hues were collapsed into one yellow precisely so an accent and
  an overdue bill can't read alike. Four roles: ochre actionable, green
  succeeded, yellow caution, red wrong.
- **Status colour means status.** Green/yellow/red belong in badges and alerts,
  not on buttons or icons. Colour used decoratively stops carrying meaning
  where it matters.
- **Calibrate a surface value on a real page, not on a specimen.** A comparison
  renders on a stage chosen to show the treatment; the app is mostly flat
  near-black. A fill that read as glass on the former went grey slab on the
  latter, at the same alpha.
- **`@apply` of a `@layer components` class across files races HMR.**
  `calendar.css` applies `glass-surface` from `index.css`; editing `index.css`
  with the dev server up can throw "class does not exist" until a restart. The
  production build is unaffected — restart the server rather than chasing it.
- **Comment the why, not the what.** A comment earns its place by recording a
  constraint, an invariant, or a bug that a reader would otherwise reintroduce.

## Documentation

- `ARCHITECTURE.md` is subordinate to the code. If they disagree, the code is
  right and the document is a bug.
- A test asserts that every file path named in the docs exists. Rename or
  delete a module and the docs must follow in the same commit.

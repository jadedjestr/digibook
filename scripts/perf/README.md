# Large-data timing check

Times the real app against years of seeded data. Not part of `npm run test:run`,
never shipped, and never run against your own data.

```bash
npm run build
node scripts/perf/run.mjs --tier A,B,C --throttle 1,4 --repeat 3
```

| Option | Meaning |
|---|---|
| `--tier` | `A` 1 year, `B` 5 years, `C` 10 years (25 recurring bills each); `D` 10x the bills for 10 years (stress, slow to seed) |
| `--throttle` | CPU slow-down factors, e.g. `1,4`; `4` stands in for an older phone |
| `--repeat` | Repeats of each action; the median and worst are reported |
| `--timeout` | Per-action timeout in ms (default 180000) |
| `--dev true` | Serve the unminified dev build on port 5174 (readable names for `--profile`) |
| `--profile true` | Print a CPU profile around opening Insights (use with `--dev true`) |
| `--marks true` | Print a step-by-step timeline of a payment. It needs `performance.mark(...)` calls in the code, which are not committed; add them temporarily around the steps you want to see |
| `--skip a,b` | Skip `reload`, `month`, `pay` or `dbfree` steps, to bisect a result |

**Safe by design.** It serves the production build on port 4173 and drives it in
a brand-new browser context every run: an empty database that is not yours, and
a throwaway PIN. Your real data (port 5173, your own browser) is never touched.
Results are written to `scripts/perf/results/` (git-ignored).

**Timed inside the page.** The tool's own clicks wait for moving buttons to hold
still, which once added about 900 ms to a first click and about 60 ms to each
payment. The tool now waits for animations to finish, and the
"confirm a payment" row is timed inside the page. Read that row, not the
tool-timed one, for what a person waits.

**Read the numbers carefully.** They are one machine, synthetic data and a
handful of repeats. Time an action until what a person waits for has finished,
not until the screen first changes: an early version charged a payment's wait
to the next screen, which looked like a different problem. Results and caveats:
[ARCHITECTURE.md](../../ARCHITECTURE.md) section 14.

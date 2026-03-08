/**
 * Config for pay cycle nudge logic.
 * Can later be driven by user prefs or feature flags.
 */
export const PAY_CYCLE_NUDGE_CONFIG = {
  /** Catch-up nudge when today is within this many days of end of viewed month (current only). */
  daysNearEndOfMonth: 7,

  /** Past month nudge: only immediate previous calendar month. Extensible to last_n. */
  pastMonthScope: 'last_only',
};

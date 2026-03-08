/**
 * Nudge type registry for pay cycle nudges.
 * Add new types here + branch in payCycleNudgeLogic + copy below.
 */
export const NUDGE_TYPES = ['past_month', 'catch_up', 'reset'];

/** Default copy keyed by type. Placeholders like {unpaidCount} are filled from payload. */
export const NUDGE_DEFAULT_COPY = {
  past_month: {
    title: 'Reminder',
    messageTemplate:
      'You have {unpaidCount} expense(s) from {lastMonthLabel}. Review or mark as paid.',
    primaryAction: 'Review', // e.g. "Review February"
    secondaryAction: 'Dismiss',
  },
  catch_up: {
    title: 'Reminder',
    messageTemplate:
      // eslint-disable-next-line quotes -- apostrophe in "aren't", Prettier uses double quotes
      "{unpaidInCurrentMonthCount} expense(s) this month aren't marked paid. Did you pay them?",
    primaryAction: 'Mark as paid',
    secondaryAction: 'Review',
    tertiaryAction: 'Dismiss',
  },
  reset: {
    title: 'Reminder',
    // eslint-disable-next-line quotes -- string contains apostrophe, Prettier uses double quotes
    messageTemplate: "You're all set for this cycle. Start a new pay cycle?",
    primaryAction: 'Start new cycle',
    secondaryAction: 'Not yet',
  },
};

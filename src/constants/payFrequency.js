import { DateUtils } from '../utils/dateUtils';

/**
 * Advance a date by one calendar month. Rely on native Date: setMonth(+1) clamps
 * to the last day of the next month when the current day does not exist there
 * (e.g. Jan 31 -> Feb 28/29).
 */
function addOneCalendarMonth(date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export const PAY_FREQUENCIES = {
  weekly: {
    intervalDays: 7,
    label: 'Weekly (every week)',
    advanceDueDate(dateString) {
      const date = DateUtils.parseDate(dateString);
      if (!date) return null;
      date.setDate(date.getDate() + 7);
      return DateUtils.formatDate(date);
    },
  },
  biweekly: {
    intervalDays: 14,
    label: 'Biweekly (every 2 weeks)',
    advanceDueDate(dateString) {
      const date = DateUtils.parseDate(dateString);
      if (!date) return null;
      date.setDate(date.getDate() + 14);
      return DateUtils.formatDate(date);
    },
  },
  monthly: {
    intervalDays: null,
    label: 'Monthly (once per month)',
    advanceDueDate(dateString) {
      const date = DateUtils.parseDate(dateString);
      if (!date) return null;
      const next = addOneCalendarMonth(date);
      return DateUtils.formatDate(next);
    },
  },
};

export const DEFAULT_PAY_FREQUENCY = 'biweekly';

export const VALID_PAY_FREQUENCIES = Object.keys(PAY_FREQUENCIES);

const NULL_DATES = {
  nextPayDate: null,
  followingPayDate: null,
  daysUntilNextPay: null,
  daysUntilFollowingPay: null,
};

/**
 * Advance a due date by exactly one pay period for the given frequency.
 * @param {string} dateString - ISO date string
 * @param {string} frequency - Key from PAY_FREQUENCIES
 * @returns {string|null} Formatted date string or null if invalid
 */
export function advanceDueDateByFrequency(
  dateString,
  frequency = DEFAULT_PAY_FREQUENCY,
) {
  const config =
    PAY_FREQUENCIES[frequency] ?? PAY_FREQUENCIES[DEFAULT_PAY_FREQUENCY];
  return config.advanceDueDate(dateString);
}

/**
 * Pure function: calculate next and following paycheck dates from a last-pay
 * anchor and a frequency key.  Rolls forward past today so the result is
 * always in the future.
 */
export function calculateNextPayDates(
  lastPaycheckDate,
  frequency = DEFAULT_PAY_FREQUENCY,
) {
  if (!lastPaycheckDate) return NULL_DATES;

  const lastPayDate = DateUtils.parseDate(lastPaycheckDate);
  if (!lastPayDate) return NULL_DATES;

  const config =
    PAY_FREQUENCIES[frequency] ?? PAY_FREQUENCIES[DEFAULT_PAY_FREQUENCY];
  const { intervalDays } = config;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nextPayDate;
  let followingPayDate;

  if (intervalDays === null) {
    // Calendar-month advance. Rely on native Date clamping for overflow (e.g. Jan 31 -> Feb 28/29).
    nextPayDate = addOneCalendarMonth(lastPayDate);
    while (nextPayDate <= today) {
      nextPayDate = addOneCalendarMonth(nextPayDate);
    }
    followingPayDate = addOneCalendarMonth(new Date(nextPayDate));
  } else {
    nextPayDate = new Date(lastPayDate);
    nextPayDate.setDate(nextPayDate.getDate() + intervalDays);
    while (nextPayDate <= today) {
      nextPayDate.setDate(nextPayDate.getDate() + intervalDays);
    }
    followingPayDate = new Date(nextPayDate);
    followingPayDate.setDate(followingPayDate.getDate() + intervalDays);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilNextPay = Math.ceil((nextPayDate - today) / msPerDay);
  const daysUntilFollowingPay = Math.ceil(
    (followingPayDate - today) / msPerDay,
  );

  return {
    nextPayDate: DateUtils.formatDate(nextPayDate),
    followingPayDate: DateUtils.formatDate(followingPayDate),
    daysUntilNextPay,
    daysUntilFollowingPay,
  };
}

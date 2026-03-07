import { DateUtils } from '../utils/dateUtils';

export const PAY_FREQUENCIES = {
  biweekly: { intervalDays: 14, label: 'Biweekly (every 2 weeks)' },
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

  const nextPayDate = new Date(lastPayDate);
  nextPayDate.setDate(nextPayDate.getDate() + intervalDays);

  while (nextPayDate <= today) {
    nextPayDate.setDate(nextPayDate.getDate() + intervalDays);
  }

  const followingPayDate = new Date(nextPayDate);
  followingPayDate.setDate(followingPayDate.getDate() + intervalDays);

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

/**
 * Persistence for pay-cycle nudge dismissal.
 * Session dismissals clear when the tab closes.
 * Month-scoped "don't show again" uses sessionStorage keyed by current month.
 * Optional future: clear month suppress when user clicks "Start new cycle".
 */

const SESSION_KEY = 'digibook_nudge_dismissed_session';
const SUPPRESS_PREFIX = 'digibook_nudge_suppress_';

/**
 * Get current calendar month key (YYYY-MM) for today.
 */
export function getCurrentMonthKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns a Set of dismissKeys that are currently suppressed (session + current month).
 */
export function getDismissedKeys() {
  const set = new Set();
  try {
    const sessionJson = sessionStorage.getItem(SESSION_KEY);
    if (sessionJson) {
      const arr = JSON.parse(sessionJson);
      if (Array.isArray(arr)) arr.forEach(k => set.add(k));
    }
    const monthKey = getCurrentMonthKey();
    const suppressKey = SUPPRESS_PREFIX + monthKey;
    const monthJson = sessionStorage.getItem(suppressKey);
    if (monthJson) {
      const arr = JSON.parse(monthJson);
      if (Array.isArray(arr)) arr.forEach(k => set.add(k));
    }
  } catch {
    // ignore parse errors
  }
  return set;
}

/**
 * Mark a nudge as dismissed.
 * @param {string} dismissKey - e.g. past_month_2025-02
 * @param {'session'|'month'} scope - 'session' = this tab only; 'month' = suppress this month
 */
export function markDismissed(dismissKey, scope = 'session') {
  try {
    if (scope === 'session') {
      const sessionJson = sessionStorage.getItem(SESSION_KEY);
      const arr = sessionJson ? JSON.parse(sessionJson) : [];
      if (!arr.includes(dismissKey)) arr.push(dismissKey);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(arr));
    } else {
      const monthKey = getCurrentMonthKey();
      const suppressKey = SUPPRESS_PREFIX + monthKey;
      const monthJson = sessionStorage.getItem(suppressKey);
      const arr = monthJson ? JSON.parse(monthJson) : [];
      if (!arr.includes(dismissKey)) arr.push(dismissKey);
      sessionStorage.setItem(suppressKey, JSON.stringify(arr));
    }
  } catch {
    // ignore
  }
}

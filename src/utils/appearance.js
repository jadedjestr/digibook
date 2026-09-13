import { logger } from './logger';

/**
 * Glass transparency, the control iOS 27 added to Settings.
 *
 * The value is a per-device display preference, not financial data, so it
 * lives in localStorage rather than Dexie for two reasons: it must be applied
 * before first paint or the UI visibly re-tints a frame in, and Dexie reads
 * are async. It is deliberately excluded from export/import — a backup
 * restored onto a different screen should not carry the old screen's
 * transparency with it.
 */

const STORAGE_KEY = 'digibook.glassTint';
const DEFAULT_TINT = 0.35;

/**
 * Clamp to the slider's range, rejecting anything unparseable.
 *
 * The null and empty-string guards are load-bearing, not defensive noise:
 * `Number(null)` and `Number('')` are both 0, which is a perfectly finite
 * number. Without them an absent key normalizes to 0 rather than nothing,
 * the caller's default never applies, and a first run renders every panel
 * fully transparent.
 */
const normalize = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
};

export const getStoredTint = () => {
  try {
    const stored = normalize(localStorage.getItem(STORAGE_KEY));
    return stored === null ? DEFAULT_TINT : stored;
  } catch {
    // Private browsing, or storage blocked entirely. The default is fine —
    // this only controls how tinted the glass looks.
    return DEFAULT_TINT;
  }
};

export const applyTint = tint => {
  const value = normalize(tint);
  if (value === null) return DEFAULT_TINT;
  document.documentElement.style.setProperty('--glass-tint', String(value));
  return value;
};

export const setStoredTint = tint => {
  const value = applyTint(tint);
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch (error) {
    // Losing the preference across reloads is a far smaller problem than
    // failing the interaction, so this never throws to the caller.
    logger.warn('Could not persist glass tint preference', error);
  }
  return value;
};

/** Called once at startup, before React renders. */
export const applyStoredTint = () => applyTint(getStoredTint());

export { DEFAULT_TINT };

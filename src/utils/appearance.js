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

const AMBIENT_KEY = 'digibook.ambientStrength';
const DEFAULT_AMBIENT = 1;

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

/**
 * Ambient ground strength.
 *
 * Separate from tint because they pull in opposite directions: tint controls
 * how much the glass obscures what is behind it, ambient controls how much
 * there is to obscure. The colour fields are what make glass legible as
 * glass, but they also sit under body text, so this is the control that
 * settles the tradeoff for a reader who finds them distracting. 0 removes
 * them entirely without touching the glass recipe.
 */
export const getStoredAmbient = () => {
  try {
    const stored = normalize(localStorage.getItem(AMBIENT_KEY));
    return stored === null ? DEFAULT_AMBIENT : stored;
  } catch {
    return DEFAULT_AMBIENT;
  }
};

export const applyAmbient = strength => {
  const value = normalize(strength);
  if (value === null) return DEFAULT_AMBIENT;
  document.documentElement.style.setProperty(
    '--ambient-strength',
    String(value),
  );
  return value;
};

export const setStoredAmbient = strength => {
  const value = applyAmbient(strength);
  try {
    localStorage.setItem(AMBIENT_KEY, String(value));
  } catch (error) {
    logger.warn('Could not persist ambient strength preference', error);
  }
  return value;
};

/** Called once at startup, before React renders. */
export const applyStoredTint = () => applyTint(getStoredTint());
export const applyStoredAmbient = () => applyAmbient(getStoredAmbient());

export { DEFAULT_TINT, DEFAULT_AMBIENT };

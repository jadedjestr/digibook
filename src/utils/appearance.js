import { logger } from './logger';

/**
 * Appearance: glass transparency, ambient strength, and ambient colours.
 *
 * These live in localStorage rather than Dexie because they must be applied
 * before first paint — a Dexie read is async, so the UI would render one
 * frame at the defaults and visibly re-tint. Everything here is therefore
 * synchronous and total: no call throws, and every reader has a default.
 *
 * They DO travel in export/import, as one unit. The device carrying a backup
 * to another device is the same person expecting the same app, so the theme
 * arriving intact is the behaviour that matches the intent. The cost, chosen
 * deliberately: importing a backup to restore data also replaces that
 * device's theme. A backup with no appearance section — every file written
 * before this existed — leaves the current theme untouched.
 */

const STORAGE_KEY = 'digibook.glassTint';
const DEFAULT_TINT = 0.35;

const AMBIENT_KEY = 'digibook.ambientStrength';
const DEFAULT_AMBIENT = 1;

const COLORS_KEY = 'digibook.ambientColors';

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

/* ============================================================
   AMBIENT COLOURS

   Three stops drive the five gradients in .app-ambient. Stored as hex
   because that is what a colour input speaks and what reads sensibly in a
   backup file; converted to `R, G, B` triples on the way into CSS so each
   gradient stop can choose its own alpha.
   ============================================================ */

export const AMBIENT_PRESETS = [
  {
    id: 'aurora',
    name: 'Aurora',
    colors: { top: '#3874e0', middle: '#109679', bottom: '#c67426' },
  },
  {
    id: 'ember',
    name: 'Ember',
    colors: { top: '#8c3a2b', middle: '#b5562a', bottom: '#d98c2b' },
  },
  {
    id: 'deep',
    name: 'Deep Water',
    colors: { top: '#1e4f8a', middle: '#12657d', bottom: '#2a7f74' },
  },
  {
    id: 'orchard',
    name: 'Orchard',
    colors: { top: '#4a7c2f', middle: '#7a9b2e', bottom: '#c2a12c' },
  },
  {
    id: 'dusk',
    name: 'Dusk',
    colors: { top: '#4b3f8f', middle: '#7a3f7e', bottom: '#b05070' },
  },
  {
    id: 'slate',
    name: 'Slate',

    /* Near-neutral. The quietest option for anyone who finds colour under
       body text distracting but still wants surfaces to read as glass. */
    colors: { top: '#3d4654', middle: '#33414d', bottom: '#4a4a52' },
  },
];

export const DEFAULT_AMBIENT_COLORS = AMBIENT_PRESETS[0].colors;

const HEX = /^#[0-9a-f]{6}$/i;

/** Parse `#rrggbb` into the `R, G, B` string CSS needs. Null if malformed. */
const hexToTriple = hex => {
  if (typeof hex !== 'string' || !HEX.test(hex.trim())) return null;
  const v = hex.trim();
  return [
    parseInt(v.slice(1, 3), 16),
    parseInt(v.slice(3, 5), 16),
    parseInt(v.slice(5, 7), 16),
  ].join(', ');
};

/**
 * Accept only a complete, well-formed set.
 *
 * Partial sets are rejected rather than merged: a half-applied palette is a
 * combination the user never chose and never saw, and silently blending it
 * with whatever happens to be stored makes a bad import hard to reason
 * about. All three or none.
 */
const normalizeColors = value => {
  if (!value || typeof value !== 'object') return null;
  const { top, middle, bottom } = value;
  if (!hexToTriple(top) || !hexToTriple(middle) || !hexToTriple(bottom)) {
    return null;
  }
  return {
    top: top.trim().toLowerCase(),
    middle: middle.trim().toLowerCase(),
    bottom: bottom.trim().toLowerCase(),
  };
};

export const getStoredAmbientColors = () => {
  try {
    const raw = localStorage.getItem(COLORS_KEY);
    if (!raw) return DEFAULT_AMBIENT_COLORS;
    return normalizeColors(JSON.parse(raw)) ?? DEFAULT_AMBIENT_COLORS;
  } catch {
    // Unparseable JSON, or storage unavailable. Either way the default is a
    // perfectly good palette; this must never be a reason the app fails.
    return DEFAULT_AMBIENT_COLORS;
  }
};

export const applyAmbientColors = colors => {
  const value = normalizeColors(colors);
  if (!value) return getStoredAmbientColors();
  const root = document.documentElement;
  root.style.setProperty('--ambient-top', hexToTriple(value.top));
  root.style.setProperty('--ambient-middle', hexToTriple(value.middle));
  root.style.setProperty('--ambient-bottom', hexToTriple(value.bottom));
  return value;
};

export const setStoredAmbientColors = colors => {
  const value = applyAmbientColors(colors);
  try {
    localStorage.setItem(COLORS_KEY, JSON.stringify(value));
  } catch (error) {
    logger.warn('Could not persist ambient colours', error);
  }
  return value;
};

/** Which preset the current colours match, or null for a custom palette. */
export const matchPreset = colors => {
  const value = normalizeColors(colors);
  if (!value) return null;
  return (
    AMBIENT_PRESETS.find(
      p =>
        p.colors.top.toLowerCase() === value.top &&
        p.colors.middle.toLowerCase() === value.middle &&
        p.colors.bottom.toLowerCase() === value.bottom,
    )?.id ?? null
  );
};

/* ============================================================
   PORTABILITY

   One object, written into the backup and read back out of it.
   ============================================================ */

/** Everything an export should carry. Always complete and valid. */
export const getAppearanceSnapshot = () => ({
  glassTint: getStoredTint(),
  ambientStrength: getStoredAmbient(),
  ambientColors: getStoredAmbientColors(),
});

/**
 * Apply a snapshot read from a backup.
 *
 * Every field is optional and validated independently, so a backup written
 * by an older version — or a hand-edited one — applies what it legitimately
 * carries and leaves the rest alone. Returns what was actually applied, for
 * the caller to log.
 */
export const applyAppearanceSnapshot = snapshot => {
  if (!snapshot || typeof snapshot !== 'object') return null;

  const applied = {};

  const tint = normalize(snapshot.glassTint);
  if (tint !== null) applied.glassTint = setStoredTint(tint);

  const strength = normalize(snapshot.ambientStrength);
  if (strength !== null) applied.ambientStrength = setStoredAmbient(strength);

  const colors = normalizeColors(snapshot.ambientColors);
  if (colors) applied.ambientColors = setStoredAmbientColors(colors);

  return Object.keys(applied).length > 0 ? applied : null;
};

/** Called once at startup, before React renders. */
export const applyStoredTint = () => applyTint(getStoredTint());
export const applyStoredAmbient = () => applyAmbient(getStoredAmbient());
export const applyStoredAmbientColors = () =>
  applyAmbientColors(getStoredAmbientColors());

export { DEFAULT_TINT, DEFAULT_AMBIENT };

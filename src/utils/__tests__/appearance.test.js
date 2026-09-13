import { describe, test, expect, beforeEach, vi } from 'vitest';

import {
  getStoredTint,
  setStoredTint,
  applyStoredTint,
  getStoredAmbient,
  setStoredAmbient,
  applyStoredAmbient,
  getStoredAmbientColors,
  setStoredAmbientColors,
  matchPreset,
  getAppearanceSnapshot,
  applyAppearanceSnapshot,
  AMBIENT_PRESETS,
  DEFAULT_AMBIENT_COLORS,
  DEFAULT_TINT,
  DEFAULT_AMBIENT,
} from '../appearance';

vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const KEY = 'digibook.glassTint';
const AMBIENT_KEY = 'digibook.ambientStrength';
const COLORS_KEY = 'digibook.ambientColors';

const readVar = name => document.documentElement.style.getPropertyValue(name);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty('--glass-tint');
  document.documentElement.style.removeProperty('--ambient-strength');
  document.documentElement.style.removeProperty('--ambient-top');
  document.documentElement.style.removeProperty('--ambient-middle');
  document.documentElement.style.removeProperty('--ambient-bottom');
});

describe('glass tint preference', () => {
  test('an absent key yields the default, not zero', () => {
    // Number(null) is 0, which is finite. A naive numeric guard therefore
    // accepts a missing key as a real value of 0 and renders every panel
    // fully transparent on a first run.
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(getStoredTint()).toBe(DEFAULT_TINT);
  });

  test('an empty string yields the default, not zero', () => {
    localStorage.setItem(KEY, '');
    expect(getStoredTint()).toBe(DEFAULT_TINT);
  });

  test('a stored zero is honoured, because it is a real choice', () => {
    localStorage.setItem(KEY, '0');
    expect(getStoredTint()).toBe(0);
  });

  test('unparseable values fall back to the default', () => {
    localStorage.setItem(KEY, 'not-a-number');
    expect(getStoredTint()).toBe(DEFAULT_TINT);
  });

  test('values outside 0..1 are clamped', () => {
    localStorage.setItem(KEY, '5');
    expect(getStoredTint()).toBe(1);
    localStorage.setItem(KEY, '-3');
    expect(getStoredTint()).toBe(0);
  });

  test('setting writes the variable and persists it', () => {
    setStoredTint(0.8);
    expect(
      document.documentElement.style.getPropertyValue('--glass-tint'),
    ).toBe('0.8');
    expect(localStorage.getItem(KEY)).toBe('0.8');
  });

  test('applyStoredTint puts the default on the root on a first run', () => {
    applyStoredTint();
    expect(
      document.documentElement.style.getPropertyValue('--glass-tint'),
    ).toBe(String(DEFAULT_TINT));
  });

  test('a failing localStorage never breaks the interaction', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };

    // The tint must still apply; only the persistence is lost.
    expect(() => setStoredTint(0.5)).not.toThrow();
    expect(
      document.documentElement.style.getPropertyValue('--glass-tint'),
    ).toBe('0.5');

    Storage.prototype.setItem = original;
  });
});

describe('ambient ground strength', () => {
  test('an absent key yields full strength, not zero', () => {
    // Same trap as the tint: Number(null) is 0 and finite, so a naive guard
    // would return 0 here — which silently removes the colour behind the
    // glass on a first run and makes every panel look like a flat card.
    expect(localStorage.getItem(AMBIENT_KEY)).toBeNull();
    expect(getStoredAmbient()).toBe(DEFAULT_AMBIENT);
  });

  test('a stored zero is honoured, because turning it off is a real choice', () => {
    localStorage.setItem(AMBIENT_KEY, '0');
    expect(getStoredAmbient()).toBe(0);
  });

  test('setting writes its own variable and key, not the tint ones', () => {
    setStoredAmbient(0.4);
    expect(
      document.documentElement.style.getPropertyValue('--ambient-strength'),
    ).toBe('0.4');
    expect(localStorage.getItem(AMBIENT_KEY)).toBe('0.4');

    // The two preferences pull in opposite directions and must stay separate.
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue('--glass-tint'),
    ).toBe('');
  });

  test('applyStoredAmbient puts full strength on the root on a first run', () => {
    applyStoredAmbient();
    expect(
      document.documentElement.style.getPropertyValue('--ambient-strength'),
    ).toBe(String(DEFAULT_AMBIENT));
  });
});

describe('ambient colours', () => {
  test('an absent key yields the default palette', () => {
    expect(getStoredAmbientColors()).toEqual(DEFAULT_AMBIENT_COLORS);
  });

  test('setting writes CSS as R, G, B triples, not hex', () => {
    // The gradients apply their own alpha per stop, which rgba() can only do
    // with a bare triple — a hex custom property cannot carry transparency.
    setStoredAmbientColors({
      top: '#3874e0',
      middle: '#109679',
      bottom: '#c67426',
    });
    expect(readVar('--ambient-top')).toBe('56, 116, 224');
    expect(readVar('--ambient-middle')).toBe('16, 150, 121');
    expect(readVar('--ambient-bottom')).toBe('198, 116, 38');
  });

  test('a partial palette is rejected outright, not merged', () => {
    setStoredAmbientColors(DEFAULT_AMBIENT_COLORS);
    const before = getStoredAmbientColors();

    setStoredAmbientColors({ top: '#ff0000' });

    // Merging would produce a combination the user never picked or saw.
    expect(getStoredAmbientColors()).toEqual(before);
  });

  test('malformed hex is rejected', () => {
    setStoredAmbientColors(DEFAULT_AMBIENT_COLORS);
    for (const bad of ['red', '#fff', '#gggggg', '', null, 12]) {
      setStoredAmbientColors({ ...DEFAULT_AMBIENT_COLORS, middle: bad });
      expect(getStoredAmbientColors()).toEqual(DEFAULT_AMBIENT_COLORS);
    }
  });

  test('corrupt stored JSON falls back to the default palette', () => {
    localStorage.setItem(COLORS_KEY, '{not json');
    expect(getStoredAmbientColors()).toEqual(DEFAULT_AMBIENT_COLORS);
  });

  test('matchPreset identifies a preset and reports custom as null', () => {
    expect(matchPreset(AMBIENT_PRESETS[1].colors)).toBe(AMBIENT_PRESETS[1].id);
    expect(
      matchPreset({ top: '#123456', middle: '#654321', bottom: '#abcdef' }),
    ).toBeNull();
  });
});

describe('appearance travels in a backup', () => {
  test('a snapshot survives a full round trip', () => {
    setStoredTint(0.8);
    setStoredAmbient(0.4);
    setStoredAmbientColors(AMBIENT_PRESETS[2].colors);

    const exported = JSON.parse(JSON.stringify(getAppearanceSnapshot()));

    // Arrive on a device with completely different settings.
    localStorage.clear();
    setStoredTint(0.1);
    setStoredAmbient(1);
    setStoredAmbientColors(AMBIENT_PRESETS[4].colors);

    applyAppearanceSnapshot(exported);

    expect(getStoredTint()).toBe(0.8);
    expect(getStoredAmbient()).toBe(0.4);
    expect(getStoredAmbientColors()).toEqual(AMBIENT_PRESETS[2].colors);
    expect(readVar('--ambient-top')).toBe('30, 79, 138');
  });

  test('a backup with no appearance leaves the current theme alone', () => {
    // Every file exported before this feature shipped looks like this.
    setStoredTint(0.9);
    setStoredAmbientColors(AMBIENT_PRESETS[3].colors);

    expect(applyAppearanceSnapshot(undefined)).toBeNull();
    expect(applyAppearanceSnapshot({})).toBeNull();

    expect(getStoredTint()).toBe(0.9);
    expect(getStoredAmbientColors()).toEqual(AMBIENT_PRESETS[3].colors);
  });

  test('a partly-corrupt snapshot applies only what it can read', () => {
    setStoredTint(0.2);
    setStoredAmbient(0.2);
    setStoredAmbientColors(DEFAULT_AMBIENT_COLORS);

    applyAppearanceSnapshot({
      glassTint: 0.75,
      ambientStrength: 'not-a-number',
      ambientColors: { top: '#000000' },
    });

    expect(getStoredTint()).toBe(0.75);

    // Both of these were unreadable and must not have moved.
    expect(getStoredAmbient()).toBe(0.2);
    expect(getStoredAmbientColors()).toEqual(DEFAULT_AMBIENT_COLORS);
  });

  test('out-of-range values from a backup are clamped, not rejected', () => {
    applyAppearanceSnapshot({ glassTint: 42, ambientStrength: -5 });
    expect(getStoredTint()).toBe(1);
    expect(getStoredAmbient()).toBe(0);
  });
});

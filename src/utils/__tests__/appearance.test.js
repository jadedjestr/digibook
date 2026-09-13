import { describe, test, expect, beforeEach, vi } from 'vitest';

import {
  getStoredTint,
  setStoredTint,
  applyStoredTint,
  getStoredAmbient,
  setStoredAmbient,
  applyStoredAmbient,
  DEFAULT_TINT,
  DEFAULT_AMBIENT,
} from '../appearance';

vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const KEY = 'digibook.glassTint';
const AMBIENT_KEY = 'digibook.ambientStrength';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty('--glass-tint');
  document.documentElement.style.removeProperty('--ambient-strength');
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

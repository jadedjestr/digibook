import { describe, test, expect, beforeEach, vi } from 'vitest';

import {
  getStoredTint,
  setStoredTint,
  applyStoredTint,
  DEFAULT_TINT,
} from '../appearance';

vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const KEY = 'digibook.glassTint';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty('--glass-tint');
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

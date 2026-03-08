import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  getCurrentMonthKey,
  getDismissedKeys,
  markDismissed,
} from '../nudgeDismissal';

describe('nudgeDismissal', () => {
  let sessionStorageMock;

  beforeEach(() => {
    sessionStorageMock = {};
    vi.stubGlobal('sessionStorage', {
      getItem: key => sessionStorageMock[key] ?? null,
      setItem: (key, value) => {
        sessionStorageMock[key] = value;
      },
      removeItem: key => {
        delete sessionStorageMock[key];
      },
      clear: () => {
        sessionStorageMock = {};
      },
      length: 0,
      key: () => null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getCurrentMonthKey', () => {
    it('returns YYYY-MM for current date', () => {
      const key = getCurrentMonthKey();
      expect(key).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('markDismissed and getDismissedKeys', () => {
    it('session scope: markDismissed then getDismissedKeys includes the key', () => {
      markDismissed('past_month_2025-02', 'session');
      const keys = getDismissedKeys();
      expect(keys.has('past_month_2025-02')).toBe(true);
    });

    it('session scope: multiple dismissals are all returned', () => {
      markDismissed('past_month_2025-02', 'session');
      markDismissed('catch_up_2025-03', 'session');
      const keys = getDismissedKeys();
      expect(keys.has('past_month_2025-02')).toBe(true);
      expect(keys.has('catch_up_2025-03')).toBe(true);
    });

    it('month scope: markDismissed with month then getDismissedKeys includes the key', () => {
      markDismissed('reset_2025-03', 'month');
      const keys = getDismissedKeys();
      expect(keys.has('reset_2025-03')).toBe(true);
    });

    it('does not duplicate keys when marking same key twice', () => {
      markDismissed('past_month_2025-02', 'session');
      markDismissed('past_month_2025-02', 'session');
      const keys = getDismissedKeys();
      expect(keys.size).toBe(1);
      expect(keys.has('past_month_2025-02')).toBe(true);
    });
  });
});

import { describe, expect, it } from 'vitest';

import { getCategoryDisplay, hexToRgb } from '../categoryDisplay';

const NEUTRAL = '162, 169, 180';

const categories = [
  { id: 'c-subs', name: 'Subscriptions', icon: '📱', color: '#EC4899' },
  { id: 'c-debt', name: 'Debt', icon: '📊', color: '#EF4444' },
  { id: 'c-gone', name: 'Old', icon: '🕰️', color: '#111111', deletedAt: 'x' },
];

const bill = overrides => ({
  id: 'e1',
  category: '',
  categoryId: null,
  ...overrides,
});

describe('getCategoryDisplay — finding the category', () => {
  it('uses the category the bill points at by id', () => {
    const display = getCategoryDisplay(
      bill({ categoryId: 'c-debt', category: 'Debt' }),
      categories,
    );
    expect(display).toMatchObject({
      name: 'Debt',
      icon: '📊',
      kind: 'category',
    });
    expect(display.rgb).toBe('239, 68, 68');
  });

  it('prefers the id over the name when they disagree', () => {
    const display = getCategoryDisplay(
      bill({ categoryId: 'c-debt', category: 'Subscriptions' }),
      categories,
    );
    expect(display.name).toBe('Debt');
  });

  it('falls back to the name when the bill has no id', () => {
    // Recurring bills made from a template never get a categoryId.
    const display = getCategoryDisplay(
      bill({ category: 'Subscriptions' }),
      categories,
    );
    expect(display).toMatchObject({ name: 'Subscriptions', icon: '📱' });
  });

  it('matches the name ignoring case and stray spaces', () => {
    const display = getCategoryDisplay(
      bill({ category: '  subscriptions ' }),
      categories,
    );
    expect(display.name).toBe('Subscriptions');
    expect(display.kind).toBe('category');
  });

  it('falls back to the name when the id points at nothing', () => {
    const display = getCategoryDisplay(
      bill({ categoryId: 'missing', category: 'Debt' }),
      categories,
    );
    expect(display.name).toBe('Debt');
  });

  it('ignores a deleted category', () => {
    const display = getCategoryDisplay(
      bill({ categoryId: 'c-gone', category: 'Old' }),
      categories,
    );
    expect(display.kind).toBe('unlisted');
    expect(display.icon).not.toBe('🕰️');
  });
});

describe('getCategoryDisplay — bills with no category row', () => {
  it('gives the auto-created card payment bill a built-in look', () => {
    // 'Credit Card Payment' is not one of the user's categories.
    const display = getCategoryDisplay(
      bill({ category: 'Credit Card Payment' }),
      categories,
    );
    expect(display).toEqual({
      name: 'Card payment',
      icon: '💳',
      rgb: NEUTRAL,
      kind: 'built-in',
    });
  });

  it('gives the auto-created loan payment bill a built-in look', () => {
    const display = getCategoryDisplay(
      bill({ category: 'loan payment' }),
      categories,
    );
    expect(display).toMatchObject({
      name: 'Loan payment',
      icon: '🏦',
      kind: 'built-in',
    });
  });

  it('lets a category the user made with that name win over the built-in', () => {
    const display = getCategoryDisplay(
      bill({ category: 'Credit Card Payment' }),
      [
        {
          id: 'c-mine',
          name: 'Credit Card Payment',
          icon: '🧾',
          color: '#10B981',
        },
      ],
    );
    expect(display).toMatchObject({ icon: '🧾', kind: 'category' });
  });

  it('shows the bill’s own category text, uncolored, when no category matches', () => {
    const display = getCategoryDisplay(
      bill({ category: 'Shopping' }),
      categories,
    );
    expect(display).toEqual({
      name: 'Shopping',
      icon: '🏷️',
      rgb: NEUTRAL,
      kind: 'unlisted',
    });
  });

  it('says "No category" for a bill with none', () => {
    for (const category of ['', '   ', null, undefined]) {
      expect(getCategoryDisplay(bill({ category }), categories)).toMatchObject({
        name: 'No category',
        kind: 'none',
      });
    }
  });

  it('copes with no categories at all', () => {
    expect(getCategoryDisplay(bill({ category: 'Debt' })).kind).toBe(
      'unlisted',
    );
    expect(getCategoryDisplay(bill({ category: 'Debt' }), []).kind).toBe(
      'unlisted',
    );
  });
});

describe('getCategoryDisplay — what a category can carry', () => {
  it('uses a generic icon when the category has none', () => {
    const display = getCategoryDisplay(bill({ category: 'Plain' }), [
      { id: 'p', name: 'Plain', color: '#10B981' },
    ]);
    expect(display.icon).toBe('🏷️');
  });

  it('turns an unusable stored color into neutral instead of passing it on', () => {
    for (const color of [
      'red',
      '#abc',
      '#12345',
      'rgb(1,2,3)',
      null,
      undefined,
      42,
    ]) {
      const display = getCategoryDisplay(bill({ category: 'Odd' }), [
        { id: 'o', name: 'Odd', icon: '❓', color },
      ]);
      expect(display.rgb).toBe(NEUTRAL);
    }
  });
});

describe('hexToRgb', () => {
  it('converts a six-digit hex color, in either case', () => {
    expect(hexToRgb('#EC4899')).toBe('236, 72, 153');
    expect(hexToRgb('#ec4899')).toBe('236, 72, 153');
    expect(hexToRgb('#000000')).toBe('0, 0, 0');
  });

  it('is neutral for anything else', () => {
    expect(hexToRgb('EC4899')).toBe(NEUTRAL);
    expect(hexToRgb('')).toBe(NEUTRAL);
    expect(hexToRgb(undefined)).toBe(NEUTRAL);
  });
});

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';

import AddExpensePanel from '../AddExpensePanel';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * Guards a layering bug that looked like a rendering glitch.
 *
 * Every page is wrapped in `.page-transition`. Its entrance animation ends on
 * `transform: translateY(0)`, so an `animation-fill-mode` of `forwards` or
 * `both` left a permanent — if visually identity — transform on that wrapper.
 * A non-`none` transform creates a stacking context and becomes the containing
 * block for `position: fixed` descendants, which had two consequences:
 *
 *   1. the panel's z-index 10000 was trapped inside the wrapper and lost to
 *      the backdrop's 9999, which is portalled to body — so the backdrop
 *      painted *over* the panel, blurring the form the user was typing into;
 *   2. `right: 0` resolved against the padded wrapper rather than the
 *      viewport, leaving the panel 39px short of the screen edge.
 *
 * jsdom has no layout engine, so paint order cannot be asserted here. These
 * tests instead pin the two structural facts the correct behaviour rests on.
 */

const HOLDS_FINAL_FRAME = /\b(forwards|both)\b/;

const defaultProps = {
  isOpen: true,
  onClose: () => {},
  accounts: [],
  creditCards: [],
  onDataChange: () => {},
};

describe('AddExpensePanel layering', () => {
  test('renders the panel into document.body, matching its backdrop', () => {
    render(<AddExpensePanel {...defaultProps} />);

    const heading = screen.getByText('Add New Expense');
    const panel = heading.closest('div[class*="w-[450px]"]');

    expect(panel).not.toBeNull();

    // The backdrop is portalled to body. If the panel is not, the two live in
    // different stacking contexts and their z-indexes cannot be compared.
    expect(panel.parentElement).toBe(document.body);
  });

  test('the panel outranks the backdrop', () => {
    render(<AddExpensePanel {...defaultProps} />);

    const heading = screen.getByText('Add New Expense');
    const panel = heading.closest('div[class*="w-[450px]"]');
    const backdrop = [...document.body.children].find(
      el =>
        typeof el.className === 'string' &&
        el.className.includes('backdrop-blur'),
    );

    expect(backdrop).toBeDefined();
    expect(Number(panel.style.zIndex)).toBeGreaterThan(
      Number(backdrop.style.zIndex),
    );
  });
});

describe('page transition does not trap fixed descendants', () => {
  test('.page-transition does not hold its transform after animating', () => {
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');

    const rule = css.match(/\.page-transition\s*\{([^}]*)\}/);
    expect(rule, '.page-transition rule not found').not.toBeNull();

    const animation = rule[1];

    // `forwards` or `both` would pin the final keyframe's transform in place,
    // re-creating the stacking context that put the backdrop over the modal.
    expect(
      HOLDS_FINAL_FRAME.test(animation),
      'page-transition must not use a forwards/both fill-mode: it animates ' +
        'transform, and holding the final frame leaves a permanent transform ' +
        'that traps every position:fixed descendant.',
    ).toBe(false);
  });
});

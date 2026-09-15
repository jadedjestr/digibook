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
 * Originally this panel portalled the backdrop and the panel as two
 * *separate* fixed-position elements ranked by explicit z-index (9999 vs
 * 10000). Every page is wrapped in `.page-transition`, whose entrance
 * animation ends on `transform: translateY(0)` — an `animation-fill-mode`
 * of `forwards`/`both` would have left a permanent transform on that
 * wrapper, which creates a stacking context and becomes the containing
 * block for `position: fixed` descendants. That would have trapped the
 * panel's z-index 10000 inside the wrapper and lost it to the backdrop's
 * 9999 (portalled straight to body), painting the backdrop *over* the
 * panel.
 *
 * The panel now matches every other modal in the app: one portal, one
 * `fixed` wrapper, with the backdrop and the panel as plain DOM siblings
 * inside it (backdrop first, panel second, no explicit z-index on either).
 * Normal stacking order alone guarantees the panel paints above the
 * backdrop, so the ordering can no longer be lost to a trapped z-index —
 * there is no z-index to trap. jsdom has no layout engine, so paint order
 * itself can't be asserted here; these tests instead pin the structural
 * facts that guarantee it.
 */

const HOLDS_FINAL_FRAME = /\b(forwards|both)\b/;

const defaultProps = {
  isOpen: true,
  onClose: () => {},

  // A default account must exist, or the panel renders the "add an
  // account first" gate instead of the layering this file actually tests.
  accounts: [{ id: 'acct-1', name: 'Checking', isDefault: true }],
  creditCards: [],
  onDataChange: () => {},
};

describe('AddExpensePanel layering', () => {
  test('backdrop and panel share one portal, one fixed wrapper', () => {
    render(<AddExpensePanel {...defaultProps} />);

    const heading = screen.getByText('Add New Expense');
    const panel = heading.closest('div[class*="max-w-lg"]');
    const backdrop = document.body.querySelector('[aria-label="Close panel"]');

    expect(panel).not.toBeNull();
    expect(backdrop).not.toBeNull();

    // Both portalled to body, as siblings inside the SAME fixed wrapper -
    // not two independently-portalled fixed elements ranked by z-index.
    expect(panel.parentElement).toBe(backdrop.parentElement);
    expect(panel.parentElement.parentElement).toBe(document.body);
  });

  test('the panel follows the backdrop in DOM order, so it paints on top', () => {
    render(<AddExpensePanel {...defaultProps} />);

    const heading = screen.getByText('Add New Expense');
    const panel = heading.closest('div[class*="max-w-lg"]');
    const backdrop = document.body.querySelector('[aria-label="Close panel"]');

    // Neither carries an explicit z-index - normal stacking order is what
    // ranks them, and normal stacking order paints later siblings on top.
    expect(panel.style.zIndex).toBe('');
    expect(backdrop.style.zIndex).toBe('');

    const siblings = [...panel.parentElement.children];
    expect(siblings.indexOf(panel)).toBeGreaterThan(siblings.indexOf(backdrop));
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

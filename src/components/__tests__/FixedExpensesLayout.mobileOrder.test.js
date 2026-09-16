import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, test, expect } from 'vitest';

/**
 * jsdom has no layout engine, so the actual visual stacking order can't be
 * asserted by rendering and measuring — the same limitation
 * AddExpensePanel.layering.test.jsx works around by reading the raw CSS
 * source instead of computed layout. This pins the one invariant that
 * matters: at every width, the priority list (what to act on) renders
 * before the calendar (what to browse) — the stack is now the default
 * layout everywhere, not a mobile-only reorder.
 */

const css = readFileSync(
  resolve(__dirname, '../../components/Calendar/calendar.css'),
  'utf8',
);

describe('Fixed Expenses layout order (stacked at every width)', () => {
  test('the base layout stacks the columns vertically', () => {
    // The base (unmediaed) rule for the layout container must be
    // flex-direction: column — side-by-side is gone.
    const layoutRule = css.match(
      /\.fixed-expenses-month-layout\s*\{[^}]*flex-direction:\s*column/,
    );
    expect(layoutRule, 'the base layout rule was not found').not.toBeNull();
  });

  test('the priority list is ordered before the calendar', () => {
    const priorityOrder = css.match(
      /\.fixed-expenses-priority-column\s*\{[^}]*order:\s*(\d+)/,
    );
    const calendarOrder = css.match(
      /\.fixed-expenses-calendar-column\s*\{[^}]*order:\s*(\d+)/,
    );

    expect(
      priorityOrder,
      'no order rule for the priority column',
    ).not.toBeNull();
    expect(
      calendarOrder,
      'no order rule for the calendar column',
    ).not.toBeNull();

    const priorityValue = Number(priorityOrder[1]);
    const calendarValue = Number(calendarOrder[1]);

    expect(
      priorityValue,
      `expected the priority list (order: ${priorityValue}) to come before the calendar (order: ${calendarValue})`,
    ).toBeLessThan(calendarValue);
  });
});

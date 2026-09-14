import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, test, expect } from 'vitest';

/**
 * jsdom has no layout engine, so the actual visual stacking order on a
 * phone can't be asserted by rendering and measuring — the same limitation
 * AddExpensePanel.layering.test.jsx works around by reading the raw CSS
 * source instead of computed layout. This pins the one invariant that
 * matters: on a phone, the priority list (what to act on) renders before
 * the calendar (what to browse), because that's the whole point of the
 * mobile reorder — verified live, this just keeps it from regressing.
 */

const css = readFileSync(
  resolve(__dirname, '../../components/Calendar/calendar.css'),
  'utf8',
);

describe('Fixed Expenses mobile order', () => {
  test('the 1024px breakpoint exists and stacks the layout vertically', () => {
    const mediaBlock = css.match(
      /@media \(max-width: 1024px\) \{([\s\S]*?)\n\}\n/,
    );
    expect(mediaBlock, 'the 1024px breakpoint was not found').not.toBeNull();
    expect(mediaBlock[1]).toMatch(
      /\.fixed-expenses-month-layout\s*\{[^}]*flex-direction:\s*column/,
    );
  });

  test('the priority list is ordered before the calendar on mobile', () => {
    const mediaBlock = css.match(
      /@media \(max-width: 1024px\) \{([\s\S]*?)\n\}\n/,
    )[1];

    const priorityOrder = mediaBlock.match(
      /\.fixed-expenses-priority-column\s*\{[^}]*order:\s*(\d+)/,
    );
    const calendarOrder = mediaBlock.match(
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

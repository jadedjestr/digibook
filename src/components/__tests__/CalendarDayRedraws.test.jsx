import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaycheckService } from '../../services/paycheckService';
import Calendar from '../Calendar/Calendar';

// A month is 35 day cells, each wrapped in memo() so it skips redrawing when
// its own props are unchanged. These tests count how many cells actually
// redraw, to prove that memo is doing its job (and where it is not).

vi.mock('../Calendar/calendar.css', () => ({}));
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('../../utils/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Wrap the REAL CalendarDay so its render function logs each time it runs.
// The real memo wrapper (and any comparator it has) is kept as it is, so a
// cell that memo skips never logs.
const redrawn = [];
vi.mock('../Calendar/CalendarDay', async importOriginal => {
  const real = (await importOriginal()).default;
  const inner = real.type ?? real;
  const counted = props => {
    redrawn.push(props.dayData.dateString);
    return inner(props);
  };
  return { default: real.type ? { ...real, type: counted } : counted };
});

const service = new PaycheckService({
  lastPaycheckDate: '2026-11-06',
  frequency: 'biweekly',
});
const paycheckDates = {
  nextPayDate: '2026-11-20',
  followingPayDate: '2026-12-04',
};
const bill = (id, dueDate, paidAmount = 0) => ({
  id,
  name: id,
  amount: 10,
  paidAmount,
  dueDate,
  status: 'pending',
});
const bills = [
  bill('rent', '2026-11-01'),
  bill('power', '2026-11-12'),
  bill('water', '2026-11-20'),
];

// Held outside the tree, the way the page holds them: a fresh `[]` or `{}`
// on every render would rebuild every cell and prove nothing.
const month = new Date(2026, 10, 1);
const virtualExpenses = [];
const noop = () => {};

const calendar = (monthExpenses, extra = {}) => (
  <Calendar
    currentMonth={month}
    monthExpenses={monthExpenses}
    virtualExpenses={virtualExpenses}
    paycheckService={service}
    paycheckDates={paycheckDates}
    onPreviousMonth={noop}
    onNextMonth={noop}
    onToday={noop}
    {...extra}
  />
);

describe('calendar day cells', () => {
  beforeEach(() => {
    redrawn.length = 0;
  });

  it('draws the 35 cells of November 2026 once', () => {
    render(calendar(bills));
    expect(redrawn).toHaveLength(35);
    expect(new Set(redrawn).size).toBe(35);
  });

  it('redraws no cell when the parent re-renders with the same inputs', () => {
    const { rerender } = render(calendar(bills));
    redrawn.length = 0;

    rerender(calendar(bills));
    expect(redrawn).toEqual([]);
  });

  it('redraws no cell when only a header handler changes', () => {
    const { rerender } = render(calendar(bills));
    redrawn.length = 0;

    rerender(calendar(bills, { onToday: () => {} }));
    expect(redrawn).toEqual([]);
  });

  it('redraws only the clicked cell when a day is selected', () => {
    render(calendar(bills));
    redrawn.length = 0;

    fireEvent.click(screen.getAllByRole('gridcell')[10]);
    expect(redrawn).toHaveLength(1);
  });

  it('redraws the old and the new cell when the selection moves', () => {
    render(calendar(bills));
    fireEvent.click(screen.getAllByRole('gridcell')[10]);
    redrawn.length = 0;

    fireEvent.click(screen.getAllByRole('gridcell')[12]);
    expect(redrawn).toHaveLength(2);
  });

  const changePower = list =>
    list.map(b => (b.id === 'power' ? { ...b, paidAmount: 10 } : b));

  it('redraws only the day of a bill that changed', () => {
    const { rerender } = render(calendar(bills));
    redrawn.length = 0;

    rerender(calendar(changePower(bills)));
    expect(redrawn).toEqual(['2026-11-12']);
  });

  it('redraws no cell when a reload returns the same bills in a new array', () => {
    const { rerender } = render(calendar(bills));
    redrawn.length = 0;

    rerender(calendar(bills.map(b => ({ ...b }))));
    expect(redrawn).toEqual([]);
  });

  // The cost of reusing a day is showing stale data, which is worse than an
  // extra redraw. Each of these must change what is on screen.
  describe('never shows a day that is out of date', () => {
    const cell = day =>
      screen
        .getAllByRole('gridcell')
        .find(c => c.getAttribute('aria-label').includes(day));

    it('moves a bill to its new day, and updates both counts', () => {
      const { rerender } = render(calendar(bills));
      expect(cell('November 12').getAttribute('aria-label')).toMatch(
        /1 expense/,
      );
      expect(cell('November 13').getAttribute('aria-label')).toMatch(
        /0 expenses/,
      );

      rerender(
        calendar(
          bills.map(b =>
            b.id === 'power' ? { ...b, dueDate: '2026-11-13' } : b,
          ),
        ),
      );

      expect(cell('November 12').getAttribute('aria-label')).toMatch(
        /0 expenses/,
      );
      expect(cell('November 13').getAttribute('aria-label')).toMatch(
        /1 expense/,
      );
    });

    it('shows a bill added to an empty day', () => {
      const { rerender } = render(calendar(bills));
      rerender(calendar([...bills, bill('gym', '2026-11-25')]));

      expect(cell('November 25').getAttribute('aria-label')).toMatch(
        /1 expense/,
      );
      expect(screen.getByText('gym')).toBeTruthy();
    });

    it('shows a renamed bill', () => {
      const { rerender } = render(calendar(bills));
      expect(screen.getByText('power')).toBeTruthy();

      rerender(
        calendar(
          bills.map(b => (b.id === 'power' ? { ...b, name: 'electric' } : b)),
        ),
      );

      expect(screen.getByText('electric')).toBeTruthy();
      expect(screen.queryByText('power')).toBeNull();
    });

    it('moves the paycheck marker when the pay dates change', () => {
      const { rerender } = render(calendar(bills));
      expect(cell('November 20').getAttribute('aria-label')).toMatch(
        /Next Paycheck/,
      );

      rerender(
        calendar(bills, {
          paycheckDates: {
            nextPayDate: '2026-11-27',
            followingPayDate: '2026-12-11',
          },
        }),
      );

      expect(cell('November 20').getAttribute('aria-label')).not.toMatch(
        /Paycheck/,
      );
      expect(cell('November 27').getAttribute('aria-label')).toMatch(
        /Next Paycheck/,
      );
    });

    // Both days stay paycheck days; only which one is "next" changes.
    it('swaps the next and following paycheck labels', () => {
      const { rerender } = render(calendar(bills));
      expect(cell('November 20').getAttribute('aria-label')).toMatch(
        /Next Paycheck/,
      );
      expect(cell('December 4').getAttribute('aria-label')).toMatch(
        /Following Paycheck/,
      );

      rerender(
        calendar(bills, {
          paycheckDates: {
            nextPayDate: '2026-12-04',
            followingPayDate: '2026-11-20',
          },
        }),
      );

      expect(cell('November 20').getAttribute('aria-label')).toMatch(
        /Following Paycheck/,
      );
      expect(cell('December 4').getAttribute('aria-label')).toMatch(
        /Next Paycheck/,
      );
    });

    // Same fields, different value inside the resolution record.
    it('redraws a day whose resolution changes from paid to skipped', () => {
      const resolved = type =>
        new Map([
          [
            'power',
            {
              type,
              resolvedAt: '2026-11-12T10:00:00.000Z',
              committedAmount: 10,
              paidAmount: type === 'paid' ? 10 : 0,
            },
          ],
        ]);
      const { rerender, container } = render(
        calendar(bills, { resolutionByExpenseId: resolved('paid') }),
      );
      expect(container.querySelector('.expense-badge--paid')).not.toBeNull();
      redrawn.length = 0;

      rerender(calendar(bills, { resolutionByExpenseId: resolved('skipped') }));

      expect(redrawn).toEqual(['2026-11-12']);
      expect(container.querySelector('.expense-badge--skipped')).not.toBeNull();
      expect(container.querySelector('.expense-badge--paid')).toBeNull();
    });

    it('redraws a day whose bill gets resolved', () => {
      const { rerender } = render(calendar(bills));
      redrawn.length = 0;

      rerender(
        calendar(bills, {
          resolutionByExpenseId: new Map([
            [
              'power',
              {
                type: 'paid',
                resolvedAt: '2026-11-12T10:00:00.000Z',
                committedAmount: 10,
                paidAmount: 10,
              },
            ],
          ]),
        }),
      );

      expect(redrawn).toEqual(['2026-11-12']);
    });
  });
});

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

  // KNOWN INEFFICIENCY, measured 2026-11-02: changing ONE bill rebuilds the
  // data for all 35 days, so all 35 redraw (and so does a store reload that
  // returns the same bills in a new array). `it.fails` passes while that is
  // true. When the calendar is fixed so only the changed day redraws, this
  // starts failing: delete `.fails` and keep it as the guard.
  it.fails('redraws only the day of a bill that changed', () => {
    const { rerender } = render(calendar(bills));
    redrawn.length = 0;

    rerender(
      calendar(
        bills.map(b => (b.id === 'power' ? { ...b, paidAmount: 10 } : b)),
      ),
    );
    expect(redrawn).toEqual(['2026-11-12']);
  });
});

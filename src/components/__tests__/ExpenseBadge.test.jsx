import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PaycheckService } from '../../services/paycheckService';
import ExpenseBadge from '../Calendar/ExpenseBadge';

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

const service = new PaycheckService({
  lastPaycheckDate: '2026-09-01',
  frequency: 'monthly',
});
const paycheckDates = {
  nextPayDate: '2026-09-24',
  followingPayDate: '2026-10-08',
};

const baseExpense = {
  id: 'e1',
  name: 'Netflix',
  amount: 15.99,
  paidAmount: 0,
  dueDate: '2026-09-17',
  recurringTemplateId: 'tpl-1',
  accountId: 'acc-1',
};

const renderBadge = (overrides = {}) =>
  render(
    <ExpenseBadge
      expense={{ ...baseExpense, ...overrides }}
      paycheckService={service}
      paycheckDates={paycheckDates}
    />,
  );

describe('ExpenseBadge — resolved cycles (skip double-pay hazard fix)', () => {
  afterEach(cleanup);

  it('a SKIPPED cycle renders settled and inert, with the Balance Due cross-reference', () => {
    const { container, getByTitle } = renderBadge({
      resolution: {
        type: 'skipped',
        resolvedAt: '2026-09-15T14:22:08.000Z',
        paidAmount: 0,
        committedAmount: 15.99,
      },
    });

    expect(container.querySelector('.expense-badge--skipped')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    const title = getByTitle(/Netflix/).getAttribute('title');
    expect(title).toContain('Skipped (No Payment)');
    expect(title).toContain('Balance Due ($15.99)');
  });

  it('a PARTIAL cycle renders amber-inert, paid figure in the tooltip, Remaining intact', () => {
    const { container, getByTitle } = renderBadge({
      amount: 100,
      paidAmount: 40, // resolveCycle updates the row to match the resolution
      resolution: {
        type: 'partial',
        resolvedAt: '2026-09-15T14:22:08.000Z',
        paidAmount: 40,
        committedAmount: 100,
      },
    });

    expect(container.querySelector('.expense-badge--partial')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    const title = getByTitle(/Netflix/).getAttribute('title');
    expect(title).toContain('Partial Paid ($40 paid)');
    expect(title).toContain('Remaining: $60');
  });

  it('a PAID-IN-FULL cycle renders green-inert with the short resolution date', () => {
    const { container, getByTitle } = renderBadge({
      amount: 100,
      paidAmount: 100,
      dueDate: '2026-09-01',
      resolution: {
        type: 'paid',
        resolvedAt: '2026-09-15T14:22:08.000Z',
        paidAmount: 100,
        committedAmount: 100,
      },
    });

    expect(container.querySelector('.expense-badge--paid')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();

    // ISO timestamp must be sliced to the date part for formatShortDate.
    const title = getByTitle(/Netflix/).getAttribute('title');
    expect(title).toContain('Paid in Full on Sep 15, 2026');
    expect(title).not.toContain('Invalid date');
  });

  it('clicking a resolved badge does NOT open the resolve modal', () => {
    const { container } = renderBadge({
      resolution: {
        type: 'skipped',
        resolvedAt: '2026-09-15T14:22:08.000Z',
        paidAmount: 0,
        committedAmount: 15.99,
      },
    });
    fireEvent.click(container.firstChild);
    expect(screen.queryByText(/Resolve this bill|Mark as paid/)).toBeNull();
  });

  it('a VIRTUAL forecast badge stays non-interactive (existing behavior)', () => {
    const { container } = renderBadge({
      id: 'virtual-tpl-1-2026-10-17',
      isVirtual: true,
      dueDate: '2026-10-17',
    });
    expect(container.querySelector('.expense-badge--virtual')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('an unresolved due-this-week badge is STILL interactive and reads Pay This Week', () => {
    const { container } = renderBadge({ dueDate: '2026-09-20', amount: 100 });
    expect(
      container.querySelector('.expense-badge--pay-this-week'),
    ).toBeTruthy();
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('clicking an unresolved badge DOES open the resolve modal (one-off path)', () => {
    renderBadge({
      recurringTemplateId: null,
      dueDate: '2026-09-20',
      amount: 100,
    });
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Mark as paid')).toBeTruthy();
  });
});
